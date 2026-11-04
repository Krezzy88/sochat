import { YearSelect } from '../DateControls.tsx';
import { useFeedback } from '../Feedback.tsx';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, errorText, money, request, today } from '../api.ts';
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
  const [conflict, setConflict] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);
  const [editing, setEditing] = useState<Budget | null>(null);
  const editor = useRef<HTMLElement>(null);
  const confirm = useFeedback().confirm;
  async function chooseMonth(next: string) {
    if (next === month) return;
    if (
      editing &&
      !(await confirm({
        title: 'Đổi tháng ngân sách?',
        message: 'Thay đổi chưa lưu của bản chỉnh sửa sẽ bị bỏ.',
        accept: 'Đổi tháng',
      }))
    ) {
      return;
    }
    setEditing(null);
    setError('');
    setMonth(next);
  }
  async function remove(item: Budget) {
    const selectedMonth = month;
    if (
      !(await confirm({
        title: 'Xóa ngân sách?',
        message:
          'Xóa hạn mức ' +
          (categories.find((c) => c.key === item.category)?.name_vi ??
            item.category) +
          ' tháng ' +
          month.split('-').reverse().join('/') +
          '? Giao dịch đã ghi vẫn được giữ lại.',
        accept: 'Xóa ngân sách',
      }))
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(
        '/budgets/' +
          encodeURIComponent(item.category) +
          '?month=' +
          selectedMonth +
          '&version=' +
          item.version,
        'DELETE',
      );
      setNotice('Đã xóa ngân sách.');
      if (editing?.category === item.category) setEditing(null);
      state.reload();
    } catch (e) {
      setErrorFor('delete');
      if (e instanceof ApiError && [404, 409].includes(e.status))
        setConflict(true);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorFor, setErrorFor] = useState<'save' | 'delete'>('save');
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
        items: [
          {
            category: f.get('category'),
            limit_vnd: f.get('limit_vnd'),
            version:
              editing?.version ??
              state.data?.items.find((i) => i.category === f.get('category'))
                ?.version ??
              '0',
          },
        ],
      });
      setNotice(
        'Đã lưu ngân sách tháng ' + month.split('-').reverse().join('/') + '.',
      );
      form.reset();
      setEditing(null);
      state.reload();
    } catch (e) {
      setErrorFor('save');
      if (e instanceof ApiError && [404, 409].includes(e.status))
        setConflict(true);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function reloadConflict() {
    if (
      !(await confirm({
        title: 'Tải ngân sách mới?',
        message:
          'Dữ liệu chưa lưu trong form sẽ bị bỏ để tải hạn mức mới nhất.',
        accept: 'Tải bản mới',
      }))
    )
      return;
    setEditing(null);
    setConflict(false);
    setError('');
    setFormEpoch((n) => n + 1);
    state.reload();
  }
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">CHI TIÊU TRONG TẦM TAY</span>
          <h1>Ngân sách</h1>
          <p>Đặt giới hạn nhỏ, để cuối tháng bớt bất ngờ.</p>
        </div>
        <div className="period-controls budget-period">
          <label>
            Tháng ngân sách
            <select
              aria-label="Tháng ngân sách"
              value={month.slice(5)}
              disabled={busy}
              onChange={(e) =>
                void chooseMonth(month.slice(0, 4) + '-' + e.target.value)
              }
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={String(i + 1).padStart(2, '0')}>
                  Tháng {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Năm ngân sách
            <YearSelect
              aria-label="Năm ngân sách"
              value={month.slice(0, 4)}
              disabled={busy}
              onChange={(e) =>
                void chooseMonth(e.target.value + '-' + month.slice(5))
              }
            />
          </label>
        </div>
      </header>
      <p className="muted">
        Ngân sách theo tháng {month.split('-').reverse().join('/')}, tính từ
        ngày đầu đến ngày cuối tháng. Đổi tháng/năm để xem hoặc đặt hạn mức cho
        kỳ khác.
      </p>
      {error && errorFor === 'delete' && <Alert>{error}</Alert>}
      {conflict && (
        <button className="secondary" onClick={() => void reloadConflict()}>
          Tải ngân sách mới
        </button>
      )}
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
                    <div className="actions budget-actions">
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => {
                          setEditing(item);
                          setError('');
                          requestAnimationFrame(() => {
                            editor.current?.scrollIntoView({ block: 'center' });
                            editor.current
                              ?.querySelector<HTMLInputElement>(
                                'input[inputmode="numeric"]',
                              )
                              ?.focus();
                          });
                        }}
                        aria-label={
                          'Sửa ngân sách ' +
                          (categories.find((c) => c.key === item.category)
                            ?.name_vi ?? item.category)
                        }
                      >
                        Sửa hạn mức
                      </button>
                      <button
                        className="text-button danger-text"
                        disabled={busy}
                        onClick={() => void remove(item)}
                        aria-label={
                          'Xóa ngân sách ' +
                          (categories.find((c) => c.key === item.category)
                            ?.name_vi ?? item.category)
                        }
                      >
                        Xóa
                      </button>
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
        <section ref={editor} className="panel side-form">
          <h2>{editing ? 'Sửa ngân sách' : 'Đặt ngân sách'}</h2>
          <p className="muted">Lưu lại danh mục đã có để cập nhật giới hạn.</p>
          <form
            key={month + '-' + (editing?.category ?? 'new') + '-' + formEpoch}
            onSubmit={save}
          >
            <fieldset disabled={busy} className="editor-fields">
              {editing && (
                <input type="hidden" name="category" value={editing.category} />
              )}
              <label>
                Danh mục
                <select
                  name={editing ? undefined : 'category'}
                  disabled={!!editing}
                  defaultValue={editing?.category}
                >
                  {categories
                    .filter((c) => c.type === 'expense')
                    .map((c) => (
                      <option key={c.id} value={c.key}>
                        {c.name_vi}
                      </option>
                    ))}
                </select>
              </label>
              <MoneyInput
                name="limit_vnd"
                label="Giới hạn tháng (đ)"
                defaultValue={editing?.limit_vnd ?? ''}
              />

              {error && errorFor === 'save' && <Alert>{error}</Alert>}
              <button className="primary full" disabled={busy}>
                {busy
                  ? 'Đang lưu…'
                  : editing
                    ? 'Lưu thay đổi ngân sách'
                    : 'Lưu ngân sách'}
              </button>
              {editing && (
                <button
                  type="button"
                  className="secondary full"
                  onClick={() => {
                    setEditing(null);
                    setError('');
                  }}
                >
                  Hủy chỉnh sửa
                </button>
              )}
            </fieldset>
          </form>
          <p className="form-foot">
            SổChat hiển thị cảnh báo ở mức 80% và 100%. Không có thông báo đẩy.
          </p>
        </section>
      </div>
    </>
  );
}
