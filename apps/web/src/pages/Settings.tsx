import AiPreferences from './AiPreferences.tsx';
import { useState } from 'react';
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
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(false);
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
      {error && <Alert>{error}</Alert>}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <div className="settings-stack">
        <AiPreferences />
        <section className="panel settings-card">
          <h2>Tài khoản</h2>
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
