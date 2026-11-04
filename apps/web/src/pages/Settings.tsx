import { VerificationEmail } from '../AccountEmail.tsx';
import { GoogleLogin } from '../GoogleLogin.tsx';
import { useFeedback } from '../Feedback.tsx';
import AiPreferences from './AiPreferences.tsx';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { downloadCsv, errorText, request } from '../api.ts';
import type { User } from '../api.ts';
import { Alert, Icon } from '../ui.tsx';
export default function Settings({
  user,
  onDeleted,
}: {
  user: User;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const setNotice = useFeedback().success;
  const [confirm, setConfirm] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!confirm) return;
    const origin = document.activeElement as HTMLElement | null;
    deleteDialog.current?.showModal();
    return () => origin?.focus();
  }, [confirm]);
  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError('');
    if (data.get('new_password') !== data.get('confirmation')) {
      setError('Xác nhận mật khẩu chưa khớp.');
      return;
    }
    setBusy(true);
    try {
      await request('/auth/password', 'POST', {
        current_password: data.get('current_password'),
        new_password: data.get('new_password'),
      });
      form.reset();
      setNotice(
        'Đã đổi mật khẩu và đăng xuất tất cả thiết bị. Hãy đăng nhập lại.',
      );
      onDeleted();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError('');
    try {
      await downloadCsv();
      setNotice('Đã chuẩn bị tệp CSV để tải xuống.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await request('/auth/logout', 'POST');
      setNotice('Đã đăng xuất.');
      onDeleted();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request('/me', 'DELETE');
      setNotice('Đã xóa tài khoản.');
      onDeleted();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">CUỐN SỔ THUỘC VỀ BẠN</span>
          <h1>Cài đặt</h1>
          <p>Dữ liệu của bạn. Quyền quyết định của bạn.</p>
        </div>
      </header>
      {error && !confirm && <Alert>{error}</Alert>}
      <div className="settings-stack">
        <AiPreferences />
        <section className="panel settings-card">
          <h2>Đổi mật khẩu</h2>
          <p>
            Mật khẩu mới từ 12 đến 128 ký tự. Sau khi đổi, mọi thiết bị sẽ đăng
            xuất.
          </p>
          <form className="editor" onSubmit={changePassword}>
            <label>
              Mật khẩu hiện tại
              <input
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={busy}
              />
            </label>
            <label>
              Mật khẩu mới
              <input
                name="new_password"
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
            <button className="primary" disabled={busy}>
              Đổi mật khẩu
            </button>
          </form>
        </section>
        <section className="panel settings-card">
          <h2>Tài khoản</h2>
          <GoogleLogin link />
          <VerificationEmail />
          <dl>
            <div>
              <dt>Tên hiển thị</dt>
              <dd>{user.display_name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void logout()}
          >
            Đăng xuất
          </button>
        </section>
        <section className="panel settings-card">
          <span className="round-icon">
            <Icon name="list" />
          </span>
          <h2>Mang cuốn sổ theo bạn</h2>
          <p>
            Xuất toàn bộ giao dịch thu chi của bạn dưới dạng CSV, dùng được với
            bảng tính. Tệp không bao gồm ngân sách và quỹ mục tiêu.
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void download()}
          >
            {busy ? 'Đang xử lý…' : 'Xuất CSV'}
          </button>
        </section>
        <section className="panel settings-card">
          <h2>Một chút về quyền riêng tư</h2>
          <p>
            Khi bạn chọn Google, Google xử lý đăng nhập và SổChat nhận định
            danh, email và tên hồ sơ. Khi yêu cầu email xác minh hoặc khôi phục,
            dịch vụ Resend nhận địa chỉ email và liên kết tài khoản dùng một
            lần. Những liên kết này không được gửi đến Gemini.
          </p>
          <p>
            SổChat là dự án sinh viên, chỉ dùng dữ liệu mẫu. Khi cần Gemini hỗ
            trợ phân tích, hệ thống gửi nội dung tin nhắn và ngày hiện tại;
            không gửi email, ID hay các giao dịch khác.
          </p>
          <p>
            Bạn kiểm tra và xác nhận trước khi ghi sổ. Không có phân tích hành
            vi, trình theo dõi hoặc liên kết ngân hàng.
          </p>
          <p>
            Dữ liệu đã xác nhận được giữ đến khi bạn sửa, xóa hoặc xóa tài
            khoản. Cache phân tích có thời hạn 24 giờ và được dọn khi sử dụng;
            bản nháp chỉ ở bộ nhớ trình duyệt. Xóa tài khoản thu hồi mọi phiên
            và xóa dữ liệu gắn với tài khoản trong cơ sở dữ liệu. Việc này không
            bảo đảm xóa dữ liệu đã gửi tại nhà cung cấp Gemini hoặc bản sao lưu
            bên ngoài.
          </p>
        </section>
        <section className="panel settings-card danger-zone">
          <h2>Xóa tài khoản</h2>
          <p>
            Xóa vĩnh viễn tài khoản cùng giao dịch, ngân sách, quỹ, đóng góp và
            phiên đăng nhập. Thao tác không thể hoàn tác. Hãy xuất CSV trước nếu
            cần.
          </p>
          {confirm ? (
            <dialog
              ref={deleteDialog}
              className="panel confirm-dialog"
              aria-labelledby="delete-account-title"
              onCancel={(e) => {
                if (busy) e.preventDefault();
                else setConfirm(false);
              }}
            >
              <h3 id="delete-account-title">Xác nhận xóa tài khoản</h3>
              <p>Dữ liệu và phiên đăng nhập sẽ bị xóa. Không thể hoàn tác.</p>
              {error && <Alert>{error}</Alert>}
              <form onSubmit={remove}>
                <label>
                  Nhập XÓA để xác nhận
                  <input
                    name="confirmation"
                    required
                    pattern="XÓA"
                    autoComplete="off"
                    placeholder="XÓA"
                  />
                </label>
                <div className="actions">
                  <button className="danger-button" disabled={busy}>
                    Xóa vĩnh viễn
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => setConfirm(false)}
                  >
                    Giữ tài khoản
                  </button>
                </div>
              </form>
            </dialog>
          ) : (
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Xóa tài khoản của tôi
            </button>
          )}
        </section>
      </div>
    </>
  );
}
