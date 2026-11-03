import { useEffect, useState } from 'react';
import { request, errorText } from '../api.ts';
import { Alert } from '../ui.tsx';
export interface AiConsent {
  semantic_enabled: boolean;
}
export default function AiPreferences() {
  const [prefs, setPrefs] = useState<AiConsent | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    request<AiConsent>('/me/ai-preferences')
      .then((p) => {
        if (active) setPrefs(p);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, []);
  async function change(key: keyof AiConsent, value: boolean) {
    if (!prefs) return;
    setBusy(true);
    setError('');
    setNotice('');
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      setPrefs(
        await request<AiConsent>('/me/ai-preferences', 'PUT', {
          ...prefs,
          [key]: value,
        }),
      );
      setNotice('Đã cập nhật quyền AI.');
    } catch (e) {
      setPrefs(previous);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-card">
      <h2>Quyền riêng tư AI</h2>
      <p>
        Tìm kiếm ngữ nghĩa mặc định tắt. Chỉ bật khi bạn đồng ý gửi ghi chú đến
        Gemini. Ghi chú có thể chứa thông tin cá nhân dù số, email và đường dẫn
        được lọc trước khi tạo embedding.
      </p>
      {error && <Alert>{error}</Alert>}
      {notice && <p role="status">{notice}</p>}
      <label className="consent-option">
        <input
          type="checkbox"
          checked={prefs?.semantic_enabled ?? false}
          disabled={!prefs || busy}
          onChange={(e) => void change('semantic_enabled', e.target.checked)}
        />{' '}
        Cho phép gửi ghi chú giao dịch để tìm theo ý nghĩa
      </label>
      <p>
        Tắt tìm kiếm sẽ xóa embedding đã tạo. Việc tắt không thu hồi dữ liệu đã
        gửi cho nhà cung cấp.
      </p>
    </section>
  );
}
