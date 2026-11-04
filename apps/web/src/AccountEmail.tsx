import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { request, errorText } from './api.ts';
import { Alert } from './ui.tsx';
import { useFeedback } from './Feedback.tsx';
export function ForgotPassword() {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void request<{ email: boolean }>('/auth/options')
      .then((r) => {
        if (active) setAvailable(r.email);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const notify = useFeedback().success;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email'))
      .trim()
      .toLowerCase();
    setBusy(true);
    setError('');
    try {
      await request('/auth/csrf');
      await request('/auth/forgot-password', 'POST', { email });
      notify(
        'Nếu email có tài khoản phù hợp, bạn sẽ nhận liên kết đặt lại mật khẩu. Kiểm tra cả thư rác.',
      );
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        className="secondary"
        type="button"
        disabled={!available || busy}
        onClick={() => setOpen(!open)}
      >
        Quên mật khẩu?
      </button>
      {open && (
        <form className="editor" onSubmit={submit}>
          <label>
            Email khôi phục
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={busy}
            />
          </label>
          <button className="primary" disabled={busy}>
            Gửi liên kết khôi phục
          </button>
        </form>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
export function AccountTokenPage({
  purpose,
  token,
}: {
  purpose: 'reset' | 'verify';
  token: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError('');
    if (
      purpose === 'reset' &&
      data.get('password') !== data.get('confirmation')
    ) {
      setError('Xác nhận mật khẩu chưa khớp.');
      return;
    }
    setBusy(true);
    try {
      await request('/auth/csrf');
      await request(
        '/auth/' + (purpose === 'reset' ? 'reset-password' : 'verify-email'),
        'POST',
        purpose === 'reset'
          ? { token, password: data.get('password') }
          : { token },
      );
      setDone(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="panel editor account-token-page">
      <h1>{purpose === 'reset' ? 'Đặt lại mật khẩu' : 'Xác minh email'}</h1>
      {done ? (
        <p role="status">
          {purpose === 'reset'
            ? 'Đã đặt lại mật khẩu và đăng xuất các thiết bị.'
            : 'Đã xác minh email.'}
        </p>
      ) : (
        <form className="editor" onSubmit={submit}>
          {purpose === 'reset' && (
            <>
              <label>
                Mật khẩu mới
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  disabled={busy}
                />
              </label>
              <label>
                Xác nhận mật khẩu mới
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  disabled={busy}
                />
              </label>
            </>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? 'Đang xử lý…'
              : purpose === 'reset'
                ? 'Lưu mật khẩu mới'
                : 'Xác minh email'}
          </button>
        </form>
      )}
      {error && <Alert>{error}</Alert>}
      <a className="secondary" href="/">
        Quay lại SổChat
      </a>
    </main>
  );
}
export function VerificationEmail() {
  const [verified, setVerified] = useState(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void request<{ email: boolean }>('/auth/options')
      .then((r) => {
        if (active) setAvailable(r.email);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void request<{ email_verified: boolean }>('/me/security')
      .then((r) => {
        if (active) setVerified(r.email_verified);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const notify = useFeedback().success;
  if (verified) return <p>Email đã được xác minh.</p>;
  return (
    <div>
      <button
        className="secondary"
        disabled={busy || !available}
        onClick={() => {
          setBusy(true);
          setError('');
          void request('/me/verification-email', 'POST')
            .then(() =>
              notify(
                'Nếu email chưa xác minh, liên kết xác minh sẽ được gửi. Kiểm tra cả thư rác.',
              ),
            )
            .catch((e) => setError(errorText(e)))
            .finally(() => setBusy(false));
        }}
      >
        Gửi email xác minh
      </button>
      {!available && <p className="muted">Gửi email hiện chưa khả dụng.</p>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
