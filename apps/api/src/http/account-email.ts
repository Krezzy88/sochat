import { randomBytes, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import type pg from 'pg';
import { fail } from './problem.ts';
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const emailReady = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
export async function requestAccountEmail(
  pool: pg.Pool,
  email: string,
  purpose: 'reset' | 'verify',
  origin: string,
  now: Date,
) {
  if (!emailReady())
    fail(503, 'Email chưa được cấu hình. Vui lòng thử lại sau.');
  const user = (
    await pool.query('SELECT id,email_verified_at FROM users WHERE email=$1', [
      email,
    ])
  ).rows[0];
  if (!user || (purpose === 'verify' && user.email_verified_at)) return;
  const token = randomBytes(32).toString('hex');
  await pool.query('DELETE FROM account_tokens WHERE expires_at <= $1', [now]);
  await pool.query(
    `INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,$4)
    ON CONFLICT(user_id,purpose) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires_at=EXCLUDED.expires_at`,
    [
      tokenHash(token),
      user.id,
      purpose,
      new Date(now.getTime() + (purpose === 'reset' ? 1800000 : 86400000)),
    ],
  );
  const link = origin + '/#account-' + purpose + '=' + token;
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': tokenHash(token),
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [email],
        subject:
          purpose === 'reset'
            ? 'Đặt lại mật khẩu SổChat'
            : 'Xác minh email SổChat',
        text: `Bạn đã yêu cầu ${purpose === 'reset' ? 'đặt lại mật khẩu' : 'xác minh email'} SổChat.\nMở liên kết: ${link}\nLiên kết dùng một lần, hết hạn sau ${purpose === 'reset' ? '30 phút' : '24 giờ'}. Nếu không phải bạn, hãy bỏ qua email này.`,
      }),
    });
    if (!result.ok) throw new Error('mail_unavailable');
  } catch {
    // Never expose recipient existence, provider response or token to clients/logs.
    console.error(JSON.stringify({ event: 'account_email_failed' }));
  }
}
export async function consumeAccountToken(
  pool: pg.Pool,
  token: string,
  purpose: 'reset' | 'verify',
  now: Date,
  password?: string,
) {
  const passwordHash =
    purpose === 'reset' && password
      ? await argon2.hash(password, { type: argon2.argon2id })
      : null;
  if (purpose === 'reset' && !passwordHash) fail(400, 'Thiếu mật khẩu mới.');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const row = (
      await db.query(
        'DELETE FROM account_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>$3 RETURNING user_id',
        [tokenHash(token), purpose, now],
      )
    ).rows[0];
    if (!row)
      fail(
        400,
        'Liên kết đã dùng, hết hạn hoặc không hợp lệ. Hãy yêu cầu liên kết mới.',
      );
    if (purpose === 'reset') {
      await db.query(
        'UPDATE users SET password_hash=$2,email_verified_at=coalesce(email_verified_at,$3) WHERE id=$1',
        [row.user_id, passwordHash, now],
      );
      await db.query('DELETE FROM sessions WHERE user_id=$1', [row.user_id]);
    } else
      await db.query(
        'UPDATE users SET email_verified_at=coalesce(email_verified_at,$2) WHERE id=$1',
        [row.user_id, now],
      );
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
