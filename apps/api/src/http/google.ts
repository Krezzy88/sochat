import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type pg from 'pg';
import { fail } from './problem.ts';
export interface GoogleFlow {
  state: string;
  nonce: string;
  verifier: string;
  expires: number;
  linkUser: string | null;
}
export function googleClient(origin: string) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    fail(503, 'Đăng nhập Google chưa được cấu hình.');
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    origin + '/api/auth/google/callback',
  );
}
export async function startGoogle(
  origin: string,
  now: Date,
  linkUser: string | null,
) {
  const client = googleClient(origin);
  const code = await client.generateCodeVerifierAsync();
  const flow: GoogleFlow = {
    state: randomBytes(32).toString('hex'),
    nonce: randomBytes(32).toString('hex'),
    verifier: code.codeVerifier,
    expires: now.getTime() + 600000,
    linkUser,
  };
  return {
    flow,
    url: client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state: flow.state,
      nonce: flow.nonce,
      code_challenge: code.codeChallenge!,
      code_challenge_method:
        'S256' as import('google-auth-library').CodeChallengeMethod,
      access_type: 'online',
      prompt: 'select_account',
    }),
  };
}
export async function finishGoogle(
  origin: string,
  code: string,
  flow: GoogleFlow,
) {
  const client = googleClient(origin);
  const { tokens } = await client.getToken({
    code,
    codeVerifier: flow.verifier,
  });
  if (!tokens.id_token) fail(401, 'Google chưa xác nhận danh tính.');
  const payload = (
    await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID!,
    })
  ).getPayload();
  if (
    !payload ||
    payload.nonce !== flow.nonce ||
    !payload.email_verified ||
    !payload.email ||
    !payload.sub
  )
    fail(401, 'Danh tính Google chưa hợp lệ.');
  return {
    subject: payload.sub,
    email: payload.email.toLowerCase(),
    name: (payload.name || 'Bạn SổChat').slice(0, 80),
  };
}
export async function googleAccount(
  pool: pg.Pool,
  identity: { subject: string; email: string; name: string },
  linkUser: string | null,
) {
  // Random, unknown password keeps Google-only accounts compatible with the existing schema.
  const hash = await argon2.hash(randomBytes(48).toString('hex'), {
    type: argon2.argon2id,
  });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const linked = (
      await db.query(
        'SELECT u.id,u.email,u.display_name FROM users u JOIN auth_identities i ON i.user_id=u.id WHERE i.provider=$1 AND i.subject=$2',
        ['google', identity.subject],
      )
    ).rows[0];
    if (linked) {
      if (linkUser && linked.id !== linkUser)
        fail(409, 'Google này đã liên kết tài khoản khác.');
      await db.query('COMMIT');
      return linked as { id: string; email: string; display_name: string };
    }
    let user: { id: string; email: string; display_name: string };
    if (linkUser) {
      user = (
        await db.query(
          'SELECT id,email,display_name FROM users WHERE id=$1 FOR UPDATE',
          [linkUser],
        )
      ).rows[0];
      if (!user || user.email !== identity.email)
        fail(
          409,
          'Hãy chọn Google có cùng email với tài khoản đang đăng nhập.',
        );
    } else {
      if (
        (
          await db.query('SELECT id FROM users WHERE email=$1', [
            identity.email,
          ])
        ).rowCount
      )
        fail(
          409,
          'Email đã có tài khoản. Đăng nhập bằng mật khẩu rồi liên kết Google trong Cài đặt.',
        );
      user = (
        await db.query(
          'INSERT INTO users(email,password_hash,display_name,email_verified_at) VALUES($1,$2,$3,now()) RETURNING id,email,display_name',
          [identity.email, hash, identity.name],
        )
      ).rows[0];
    }
    await db.query(
      'INSERT INTO auth_identities(provider,subject,user_id) VALUES($1,$2,$3)',
      ['google', identity.subject, user.id],
    );
    await db.query(
      'UPDATE users SET email_verified_at=coalesce(email_verified_at,now()) WHERE id=$1',
      [user.id],
    );
    await db.query('COMMIT');
    return user;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
