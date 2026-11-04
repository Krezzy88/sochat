import { useEffect, useState } from 'react';
import { request, errorText } from './api.ts';
import { Alert } from './ui.tsx';
export function GoogleLogin({ link = false }: { link?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void request<{ google: boolean }>('/auth/options')
      .then((r) => {
        if (active) setEnabled(r.google);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!link) return;
    let active = true;
    void request<{ google_linked: boolean }>('/me/security')
      .then((r) => {
        if (active) setLinked(r.google_linked);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [link]);
  if (linked) return <p>Đã liên kết Google.</p>;
  if (!enabled) return null;
  return (
    <div>
      <button
        className="secondary"
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError('');
          void request('/auth/csrf')
            .then(() =>
              request<{ url: string }>('/auth/google/start', 'POST', { link }),
            )
            .then((r) => {
              const url = new URL(r.url);
              if (url.origin !== 'https://accounts.google.com')
                throw new Error('Địa chỉ đăng nhập chưa hợp lệ.');
              window.location.assign(url.href);
            })
            .catch((e) => {
              setError(errorText(e));
              setBusy(false);
            });
        }}
      >
        {busy
          ? 'Đang chuyển đến Google…'
          : link
            ? 'Liên kết Google'
            : 'Tiếp tục với Google'}
      </button>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
