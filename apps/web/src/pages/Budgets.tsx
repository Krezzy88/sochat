import { useFeedback } from '../Feedback.tsx';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorText, money, request, today } from '../api.ts';
import type { Category, Budget } from '../api.ts';
import {
  Alert,
  Empty,
  Loading,
  LoadError,
  MoneyInput,
  useLoad,
} from '../ui.tsx';
export default function Budgets({ categories }: { categories: Category[] }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const setNotice = useFeedback().success;
  const state = useLoad(
    () => request<{ items: Budget[] }>('/budgets/status?month=' + month),
    [month],
  );
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await request('/budgets?month=' + month, 'PUT', {
        items: [{ category: f.get('category'), limit_vnd: f.get('limit_vnd') }],
      });
      setNotice(
        'Đã lưu ngân sách tháng ' + month.split('-').reverse().join('/') + '.',
      );
      form.reset();
      state.reload();
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
          <span className="eyebrow">CHI TIÊU TRONG TẦM TAY</span>
          <h1>Ngân sách</h1>
          <p>Đặt giới hạn nhỏ, để cuối tháng bớt bất ngờ.</p>
        </div>
        <label>
          Tháng ngân sách
          <input
            type="month"
            required
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value);
            }}
          />
        </label>
      </header>
      <div className="split-layout">
        <section>
          {state.loading ? (
            <Loading />
          ) : state.error ? (
            <LoadError error={state.error} retry={state.reload} />
          ) : state.data?.items.length ? (
            <div className="budget-list">
              {state.data.items.map((item) => {
                const percent =
                  (BigInt(item.spent_vnd) * 100n) / BigInt(item.limit_vnd);
                return (
                  <article
                    className={'panel budget-card ' + item.status}
                    key={item.category}
                  >
                    <div className="section-heading">
                      <h2>
                        {categories.find((c) => c.key === item.category)
                          ?.name_vi ?? item.category}
                      </h2>
                      <span className="status-chip">
                        {item.status === 'exceeded'
                          ? 'Đã chạm / vượt giới hạn'
                          : item.status === 'warning'
                            ? 'Đã dùng từ 80%'
                            : 'Trong ngân sách'}
                      </span>
                    </div>
                    <p className="budget-amount">
                      <strong>{money(item.spent_vnd)}</strong>
                      <span> / {money(item.limit_vnd)}</span>
                    </p>
                    <progress
                      value={Number(percent > 100n ? 100n : percent)}
                      max="100"
                      aria-label={
                        'Ngân sách ' +
                        (categories.find((c) => c.key === item.category)
                          ?.name_vi ?? item.category)
                      }
                    />
                    <div className="budget-meta">
                      <span>Đã dùng {percent.toString()}%</span>
                      <span>Còn {money(item.remaining_vnd)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty title="Chưa đặt ngân sách tháng này">
              Chọn danh mục và giới hạn đầu tiên của bạn.
            </Empty>
          )}
        </section>
        <section className="panel side-form">
          <h2>Đặt ngân sách</h2>
          <p className="muted">Lưu lại danh mục đã có để cập nhật giới hạn.</p>
          <form onSubmit={save}>
            <label>
              Danh mục
              <select name="category">
                {categories
                  .filter((c) => c.type === 'expense')
                  .map((c) => (
                    <option key={c.id} value={c.key}>
                      {c.name_vi}
                    </option>
                  ))}
              </select>
            </label>
            <MoneyInput name="limit_vnd" label="Giới hạn tháng (đ)" />
            {error && <Alert>{error}</Alert>}
            <button className="primary full" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Lưu ngân sách'}
            </button>
          </form>
          <p className="form-foot">
            SổChat hiển thị cảnh báo ở mức 80% và 100%. Không có thông báo đẩy.
          </p>
        </section>
      </div>
    </>
  );
}
