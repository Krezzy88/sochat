import { useFeedback } from '../Feedback.tsx';
import { useRef, useState, useEffect } from 'react';
import { request, errorText, money, dateLabel } from '../api.ts';
import { Alert } from '../ui.tsx';
interface SearchStatus {
  indexed: number;
  pending: number;
  total: number;
}
export default function SemanticSearch() {
  const [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [status, setStatus] = useState<SearchStatus>();
  const [items, setItems] = useState<
    {
      id: string;
      note: string;
      amount_vnd: string;
      occurred_on: string;
      score: number;
    }[]
  >([]);
  const stopped = useRef(false);
  useEffect(
    () => () => {
      stopped.current = true;
    },
    [],
  );
  const confirm = useFeedback().confirm;
  async function search() {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    setItems([]);
    stopped.current = false;
    try {
      let progress = await request<SearchStatus>('/assistant/search-status');
      setStatus(progress);
      if (progress.pending) {
        const accepted = await confirm({
          title: 'Chuẩn bị tìm theo ý nghĩa?',
          message: `Có ${progress.pending} ghi chú chưa được chuẩn bị. Nếu tiếp tục, ứng dụng sẽ gửi tối đa 160 ghi chú trong 1.000 giao dịch có ghi chú gần nhất đến Gemini. Ghi chú có thể chứa thông tin cá nhân. Giới hạn AI hằng ngày vẫn được giữ. Bạn có thể dừng bất cứ lúc nào.`,
          accept: 'Chuẩn bị và tìm',
        });
        if (!accepted) return;
        for (
          let batch = 0;
          batch < 8 && progress.pending > 0 && !stopped.current;
          batch++
        ) {
          const result = await request<{ indexed: number }>(
            '/assistant/index',
            'POST',
            {},
          );
          if (stopped.current) return;
          progress = await request<SearchStatus>('/assistant/search-status');
          setStatus(progress);
          setMessage(
            `Đã sẵn sàng ${progress.indexed}/${progress.total} ghi chú.`,
          );
          if (result.indexed === 0) break;
        }
      }
      if (stopped.current) return;
      const result = await request<{ items: typeof items; indexed: number }>(
        '/assistant/search',
        'POST',
        { query },
      );
      if (stopped.current) return;
      setItems(result.items);
      setMessage(
        result.indexed
          ? `Tìm trong ${result.indexed} ghi chú đã sẵn sàng. Kết quả gần nghĩa, bạn cần kiểm tra lại.${progress.pending ? ' Một số ghi chú chưa được chuẩn bị; kết quả chưa bao phủ hết dữ liệu.' : ''}`
          : 'Chưa có ghi chú sẵn sàng. Cho phép chuẩn bị dữ liệu khi tìm để bắt đầu.',
      );
    } catch (e) {
      if (!stopped.current) setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="panel semantic-options">
      <summary>Tìm theo ý nghĩa (tùy chọn)</summary>
      <p>
        Dùng khi bạn không nhớ đúng từ đã ghi, ví dụ “đi chơi với người yêu”.
        Cần bật quyền trong <a href="#settings">Cài đặt</a>. Tìm tối đa 1.000
        giao dịch có ghi chú gần nhất. Tìm từ khóa ở bộ lọc bên dưới luôn dùng
        được mà không cần AI.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label>
          Tìm theo ý nghĩa
          <input
            value={query}
            placeholder="Ví dụ: đi chơi với người yêu"
            maxLength={300}
            required
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? 'Đang chuẩn bị và tìm…' : 'Tìm theo ý nghĩa'}
        </button>
        {busy && (
          <button
            className="secondary"
            type="button"
            onClick={() => {
              stopped.current = true;
              setMessage(
                'Đã yêu cầu dừng. Lượt đang chạy có thể đã được gửi đến Gemini.',
              );
            }}
          >
            Dừng
          </button>
        )}
      </form>
      {status && (
        <p className="muted">
          Sẵn sàng: {status.indexed}/{status.total} ghi chú. Hạn mức AI có thể
          khiến việc chuẩn bị tạm dừng; dữ liệu đã xử lý được giữ lại.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {error && <Alert>{error}</Alert>}
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            {dateLabel(i.occurred_on)} · {i.note} ·{' '}
            <strong>{money(i.amount_vnd)}</strong>
          </li>
        ))}
      </ul>
    </details>
  );
}
