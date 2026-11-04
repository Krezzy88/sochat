import { useState } from 'react';
import type { FormEvent } from 'react';
import { request, errorText, money, dateLabel } from '../api.ts';
import type { Category, Transaction } from '../api.ts';
import { Alert } from '../ui.tsx';
interface Answer {
  needs_clarification: boolean;
  question: string;
  month: string | null;
  category: string | null;
  income_vnd: string;
  expense_vnd: string;
  evidence_url: string | null;
}
export function QueryPanel({ categories }: { categories: Category[] }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [answer, setAnswer] = useState<Answer>();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setRows([]);
    setCursor(null);
    try {
      setAnswer(
        await request<Answer>('/assistant/query', 'POST', {
          message: new FormData(e.currentTarget).get('question'),
        }),
      );
    } catch (e) {
      setError(errorText(e));
      setAnswer(undefined);
    } finally {
      setBusy(false);
    }
  }
  async function evidence(next = false) {
    if (!answer?.evidence_url?.startsWith('/api/transactions?')) return;
    setBusy(true);
    try {
      const result = await request<{
        items: Transaction[];
        next_cursor: string | null;
      }>(
        answer.evidence_url.slice(4) +
          (next && cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
      );
      setRows((old) => (next ? [...old, ...result.items] : result.items));
      setCursor(result.next_cursor);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel editor" id="ask-ledger">
      <span className="eyebrow">AI HIỂU CÂU HỎI · SQL TÍNH SỐ TIỀN</span>
      <h2>Hỏi cuốn sổ</h2>
      <p className="muted">
        Gemini chỉ nhận câu hỏi và ngày hiện tại. Giao dịch được truy vấn, tính
        toán ở máy chủ; không gửi lịch sử chi tiêu lên model.
      </p>
      <form onSubmit={ask}>
        <label>
          Câu hỏi về thu chi
          <input
            name="question"
            maxLength={500}
            required
            placeholder="Tháng này chi ăn uống bao nhiêu?"
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? 'Đang tra sổ…' : 'Hỏi cuốn sổ'}
        </button>
      </form>
      {error && <Alert>{error}</Alert>}
      {answer && (
        <div className="success" role="status">
          <div>
            <strong>{answer.question}</strong>
            {!answer.needs_clarification && (
              <>
                <p>
                  Bộ lọc: tháng {answer.month}; danh mục{' '}
                  {categories.find((c) => c.key === answer.category)?.name_vi ??
                    'tất cả'}
                  . Kiểm tra đúng ý bạn trước khi dùng kết quả.
                </p>
                <p>
                  Tổng thu: <strong>{money(answer.income_vnd)}</strong> · Tổng
                  chi: <strong>{money(answer.expense_vnd)}</strong>
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void evidence()}
                >
                  Xem giao dịch làm bằng chứng
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <div className="table-scroll">
          <table>
            <caption>Giao dịch khớp bộ lọc của câu trả lời</caption>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Ghi chú</th>
                <th>Loại</th>
                <th>Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{dateLabel(r.occurred_on)}</td>
                  <td>{r.note}</td>
                  <td>{r.type === 'income' ? 'Thu' : 'Chi'}</td>
                  <td>{money(r.amount_vnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cursor && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void evidence(true)}
            >
              Xem thêm bằng chứng
            </button>
          )}
        </div>
      )}
    </section>
  );
}
