import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, errorText, request } from './api.ts';
import type { Category, User } from './api.ts';
import { Alert, Icon, Loading, LoadError, useLoad } from './ui.tsx';
import { Chat } from './pages/Chat.tsx';
const Transactions = lazy(() => import('./pages/Transactions.tsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const Budgets = lazy(() => import('./pages/Budgets.tsx'));
const Goals = lazy(() => import('./pages/Goals.tsx'));
const Settings = lazy(() => import('./pages/Settings.tsx'));
const routes = [
  ['chat', 'Ghi chép', 'chat'],
  ['transactions', 'Giao dịch', 'list'],
  ['dashboard', 'Tổng quan', 'chart'],
  ['budgets', 'Ngân sách', 'budget'],
  ['goals', 'Quỹ mục tiêu', 'goal'],
  ['settings', 'Cài đặt', 'settings'],
] as const;
function Auth({ onAuth }: { onAuth: (user: User) => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      await request('/auth/csrf');
      const data = await request<{ user: User }>(
        '/auth/' + (register ? 'register' : 'login'),
        'POST',
        fields,
      );
      onAuth(data.user);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <section className="auth-story">
        <a href="#chat" className="brand">
          <span className="brand-mark">
            <Icon name="chat" size={27} />
          </span>
          SổChat<span className="brand-dot">.</span>
        </a>
        <span className="eyebrow">MỘT THÓI QUEN NHỎ, MỖI NGÀY</span>
        <h1>
          Ghi nhẹ.
          <br />
          Sống <em>thảnh thơi.</em>
        </h1>
        <p>
          Thu chi gọn trong một tin nhắn.
          <br />
          Để bạn dành tâm trí cho những điều thích hơn.
        </p>
        <div className="sample-chat">
          <span className="sample-label">THỬ HÌNH DUNG NHÉ</span>
          <p className="bubble">Trưa nay ăn phở 50k, cà phê 25k</p>
          <div className="sample-reply">
            <span className="round-icon">
              <Icon name="check" />
            </span>
            <div>
              <strong>Hai khoản, rõ ràng.</strong>
              <p>Kiểm tra → xác nhận → vào sổ.</p>
            </div>
            <span className="sample-amount">75.000 đ</span>
          </div>
        </div>
        <span className="story-foot">
          Một cuốn sổ nhỏ cho cuộc sống sinh viên.
        </span>
      </section>
      <section className="auth-form">
        <div className="form-wrap">
          <span className="eyebrow">CHÀO BẠN ĐẾN VỚI SỔCHAT</span>
          <h2>{register ? 'Bắt đầu cuốn sổ của bạn' : 'Mừng bạn quay lại'}</h2>
          <p className="muted">
            {register
              ? 'Tạo tài khoản để ghi lại thu chi mỗi ngày.'
              : 'Đăng nhập để tiếp tục câu chuyện thu chi.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Tên hiển thị
                <input
                  name="display_name"
                  autoComplete="nickname"
                  required
                  maxLength={80}
                  placeholder="Bạn muốn được gọi là gì?"
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
                placeholder="ban@example.com"
              />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                minLength={register ? 12 : 1}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                placeholder={
                  register ? 'Ít nhất 12 ký tự' : 'Nhập mật khẩu của bạn'
                }
              />
            </label>
            {error && <Alert>{error}</Alert>}
            <button className="primary full" disabled={busy}>
              {busy ? 'Đang xử lý…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}
              <Icon name="arrow" />
            </button>
          </form>
          <p className="auth-switch">
            {register ? 'Đã có tài khoản?' : 'Bạn mới ở đây?'}{' '}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? 'Đăng nhập' : 'Đăng ký ngay'}
            </button>
          </p>
          <p className="privacy-note">
            Dự án sinh viên · Chỉ dùng dữ liệu mẫu
            <br />
            Không liên kết ngân hàng. Không có trình theo dõi.
          </p>
        </div>
      </section>
    </main>
  );
}
function Workspace({ user, onExit }: { user: User; onExit: () => void }) {
  const readPage = () =>
    routes.find((r) => r[0] === location.hash.slice(1))?.[0] ?? 'chat';
  const [page, setPage] = useState(readPage);
  const heading = useRef<HTMLElement>(null);
  const initialPage = useRef(true);
  const categories = useLoad(
    () => request<{ items: Category[] }>('/categories'),
    [],
  );
  useEffect(() => {
    const change = () => setPage(readPage());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    document.title = `${routes.find((r) => r[0] === page)?.[1]} · SổChat`;
    if (initialPage.current) initialPage.current = false;
    else heading.current?.focus();
  }, [page]);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    setLoggingOut(true);
    try {
      await request('/auth/logout', 'POST');
      onExit();
    } catch (e) {
      setLogoutError(errorText(e));
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
      >
        Đến nội dung chính
      </a>
      <aside className="sidebar">
        <a className="brand" href="#chat">
          <span className="brand-mark">
            <Icon name="chat" size={26} />
          </span>
          SổChat<span className="brand-dot">.</span>
        </a>
        <p className="nav-caption">CUỐN SỔ CỦA BẠN</p>
        <nav aria-label="Điều hướng chính">
          {routes.map(([key, label, icon]) => (
            <a
              key={key}
              href={'#' + key}
              aria-current={page === key ? 'page' : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {page === key && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <Icon name="spark" />
          <strong>
            Ghi một chút,
            <br />
            hiểu mình hơn.
          </strong>
          <p>Mọi khoản nhỏ đều có câu chuyện riêng.</p>
        </div>
        <div className="profile">
          <span className="avatar">
            {user.display_name.slice(0, 1).toLocaleUpperCase('vi')}
          </span>
          <div>
            <strong>{user.display_name}</strong>
            <small>Sổ cá nhân</small>
          </div>
          <button
            aria-label="Đăng xuất"
            title="Đăng xuất"
            onClick={logout}
            disabled={loggingOut}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <div className="demo-banner">
          <span className="demo-pill">BẢN THỬ NGHIỆM</span>Chỉ dùng dữ liệu mẫu.
          Đừng nhập thông tin tài chính cá nhân.
        </div>
        <main id="main" ref={heading} tabIndex={-1} className="main-content">
          {logoutError && <Alert>{logoutError}</Alert>}
          {categories.loading ? (
            <Loading />
          ) : categories.error ? (
            <LoadError error={categories.error} retry={categories.reload} />
          ) : (
            <Suspense fallback={<Loading />}>
              {page === 'chat' ? (
                <Chat categories={categories.data?.items ?? []} />
              ) : page === 'transactions' ? (
                <Transactions categories={categories.data?.items ?? []} />
              ) : page === 'dashboard' ? (
                <Dashboard />
              ) : page === 'budgets' ? (
                <Budgets categories={categories.data?.items ?? []} />
              ) : page === 'goals' ? (
                <Goals />
              ) : (
                <Settings user={user} onDeleted={onExit} />
              )}
            </Suspense>
          )}
        </main>
        <footer className="app-footer">
          SổChat · Ghi nhẹ, sống vui.
          <span>Mỗi lần lưu đều do bạn xác nhận.</span>
        </footer>
      </div>
    </div>
  );
}
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError('');
    void request<{ user: User }>('/me')
      .then((d) => {
        if (active) setUser(d.user);
      })
      .catch((e) => {
        if (active && !(e instanceof ApiError && e.status === 401))
          setError(errorText(e));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    const expired = () => setUser(null);
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  if (!ready)
    return (
      <main className="startup">
        <Loading />
      </main>
    );
  if (error)
    return (
      <main className="startup">
        <h1>SổChat</h1>
        <LoadError error={error} retry={() => setAttempt((n) => n + 1)} />
      </main>
    );
  return user ? (
    <Workspace key={user.id} user={user} onExit={() => setUser(null)} />
  ) : (
    <Auth onAuth={setUser} />
  );
}
