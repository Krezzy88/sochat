import { useState } from 'react';
import type { FormEvent } from 'react';
import { request, errorText, money, dateLabel } from '../api.ts';
import type { Category, Transaction } from '../api.ts';
import { Alert } from '../ui.tsx';
interface Answer {
  mode: 'totals' | 'largest_expenses' | 'budget_usage';
  largest: Transaction[];
  budgets: {
    category: string;
    limit_vnd: string;
    spent_vnd: string;
    remaining_vnd: string;
    status: string;
  }[];
  needs_clarification: boolean;
  question: string;
  month: string | null;
  category: string | null;
  income_vnd: string;
  expense_vnd: string;
  evidence_url: string | null;
  comparison: {
    month: string;
    income_vnd: string;
    expense_vnd: string;
    expense_change_vnd: string;
  } | null;
}
export function QueryPanel({ categories }: { categories: Category[] }) {
  const [questionInput, setQuestionInput] = useState('');
  const [askedQuestion, setAskedQuestion] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [answer, setAnswer] = useState<Answer>();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const quickQuestions = [
    'Tháng này chi tiêu bao nhiêu?',
    '5 khoản chi lớn nhất tháng này?',
    'Ngân sách ăn uống tháng này?',
    'So sánh chi tiêu tháng này với tháng trước',
  ];
  async function runQuery(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setError('');
    setAskedQuestion(q.trim());
    setAnswer(undefined);
    setRows([]);
    setCursor(null);
    try {
      setAnswer(
        await request<Answer>('/assistant/query', 'POST', {
          message: q.trim(),
        }),
      );
    } catch (e) {
      setError(errorText(e));
      setAnswer(undefined);
    } finally {
      setBusy(false);
    }
  }
  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formQuestion = String(
      new FormData(e.currentTarget).get('question') ?? questionInput,
    );
    await runQuery(formQuestion);
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
      <div className="quick-prompts" aria-label="Gợi ý câu hỏi nhanh">
        {quickQuestions.map((q) => (
          <button
            key={q}
            type="button"
            className="prompt-chip"
            disabled={busy}
            onClick={() => {
              setQuestionInput(q);
              void runQuery(q);
            }}
          >
            ✦ {q}
          </button>
        ))}
      </div>
      <form onSubmit={ask}>
        <label>
          Câu hỏi về thu chi
          <input
            name="question"
            maxLength={500}
            required
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="Ví dụ: 5 khoản chi lớn nhất tháng này?"
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? 'Đang tra sổ…' : 'Hỏi cuốn sổ'}
        </button>
      </form>
      {error && <Alert>{error}</Alert>}
      {answer && (
        <div className="success assistant-chat-thread" role="status">
          <div className="assistant-chat-content">
            {askedQuestion && (
              <div className="user-question-bubble">
                <span>Bạn hỏi:</span> <strong>“{askedQuestion}”</strong>
              </div>
            )}
            <div className="assistant-reply-header">
              <span className="assistant-avatar">S</span>
              <div>
                <strong>{answer.question}</strong>
                {!answer.needs_clarification && (
                  <p className="assistant-narrative">
                    {(() => {
                      const catName =
                        categories.find((c) => c.key === answer.category)
                          ?.name_vi ?? null;
                      const net =
                        BigInt(answer.income_vnd || '0') -
                        BigInt(answer.expense_vnd || '0');
                      if (
                        answer.mode === 'largest_expenses' &&
                        answer.largest.length > 0
                      ) {
                        const top = answer.largest[0]!;
                        return `Trong tháng ${answer.month}${catName ? ` (mục ${catName})` : ''}, bạn đã chi tổng cộng ${money(answer.expense_vnd)}. Khoản chi đứng đầu trị giá ${money(top.amount_vnd)} vào ngày ${dateLabel(top.occurred_on)}.`;
                      }
                      if (answer.mode === 'budget_usage') {
                        return `Trong tháng ${answer.month}, tổng chi tiêu${catName ? ` mục ${catName}` : ''} của bạn là ${money(answer.expense_vnd)}. Dưới đây là chi tiết hạn mức ngân sách đã đối chiếu từ sổ:`;
                      }
                      return `Trong tháng ${answer.month}${catName ? ` (mục ${catName})` : ''}, bạn ghi nhận tổng thu ${money(answer.income_vnd)} và tổng chi ${money(answer.expense_vnd)} (chênh lệch thu trừ chi: ${money(net)}).`;
                    })()}
                  </p>
                )}
              </div>
            </div>
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
                {answer.mode === 'largest_expenses' && (
                  <div>
                    <h3>Tối đa 5 khoản chi lớn nhất</h3>
                    {answer.largest.length ? (
                      <ol>
                        {answer.largest.map((r) => (
                          <li key={r.id}>
                            {dateLabel(r.occurred_on)} ·{' '}
                            {r.note || 'Không có ghi chú'} ·{' '}
                            <strong>{money(r.amount_vnd)}</strong>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>Chưa có khoản chi trong kỳ này.</p>
                    )}
                  </div>
                )}
                {answer.mode === 'budget_usage' && (
                  <div>
                    <h3>Mức sử dụng ngân sách</h3>
                    {answer.budgets.length ? (
                      <ul>
                        {answer.budgets.map((b) => {
                          const limit = BigInt(b.limit_vnd || '0');
                          const percent =
                            limit > 0n
                              ? (BigInt(b.spent_vnd) * 100n) / limit
                              : 0n;
                          return (
                            <li key={b.category}>
                              {categories.find((c) => c.key === b.category)
                                ?.name_vi ?? b.category}
                              : đã chi <strong>{money(b.spent_vnd)}</strong> /{' '}
                              {money(b.limit_vnd)} ({percent.toString()}%, làm
                              tròn xuống). Còn trong hạn mức:{' '}
                              {money(b.remaining_vnd)}.
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p>Bạn chưa đặt ngân sách phù hợp trong kỳ này.</p>
                    )}
                  </div>
                )}
                {answer.comparison && (
                  <p>
                    Tháng đối chiếu {answer.comparison.month}: thu{' '}
                    {money(answer.comparison.income_vnd)}, chi{' '}
                    {money(answer.comparison.expense_vnd)}. Chi tiêu tháng{' '}
                    {answer.month}{' '}
                    {BigInt(answer.comparison.expense_change_vnd) >= 0n
                      ? 'tăng'
                      : 'giảm'}{' '}
                    <strong>
                      {money(
                        (BigInt(answer.comparison.expense_change_vnd) < 0n
                          ? -BigInt(answer.comparison.expense_change_vnd)
                          : BigInt(answer.comparison.expense_change_vnd)
                        ).toString(),
                      )}
                    </strong>
                    .
                  </p>
                )}
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
