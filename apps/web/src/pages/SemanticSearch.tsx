import { useState } from 'react';
import { request, errorText } from '../api.ts';
import { money } from '../api.ts';
export default function SemanticSearch() {
  const [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [items, setItems] = useState<
    {
      id: string;
      note: string;
      amount_vnd: string;
      occurred_on: string;
      score: number;
    }[]
  >([]);
  async function index() {
    setBusy(true);
    try {
      const r = await request<{ indexed: number }>(
        '/assistant/index',
        'POST',
        {},
      );
      setMessage(
        `Đã xử lý ${r.indexed} ghi chú. Mỗi lượt tối đa 20; bấm lại nếu còn dữ liệu.`,
      );
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="panel semantic-options">
      <summary>Tìm nâng cao theo ý nghĩa</summary>
      <h2>Tìm giao dịch theo ý nghĩa</h2>
      <p>
        Tùy chọn, cần bật quyền trong Cài đặt. Chỉ những ghi chú bạn chủ động
        lập chỉ mục mới được tìm. Kết quả là độ liên quan, không phải lời khuyên
        tài chính. Tối đa 1.000 ghi chú đã lập chỉ mục.
      </p>
      <button type="button" disabled={busy} onClick={() => void index()}>
        Lập chỉ mục 20 ghi chú tiếp theo
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setMessage('');
          void request<{ items: typeof items; indexed: number }>(
            '/assistant/search',
            'POST',
            { query },
          )
            .then((r) => {
              setItems(r.items);
              setMessage(
                `Đã tìm trong ${r.indexed} ghi chú. Kiểm tra kết quả trước khi sử dụng.`,
              );
            })
            .catch((e) => setMessage(errorText(e)))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Tìm theo ý nghĩa
          <input
            value={query}
            maxLength={300}
            required
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button disabled={busy}>Tìm giao dịch</button>
      </form>
      {message && <p role="status">{message}</p>}
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            {i.occurred_on} · {i.note} · {money(i.amount_vnd)}
          </li>
        ))}
      </ul>
    </details>
  );
}
