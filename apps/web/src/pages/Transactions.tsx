import { CalendarInput } from '../DateControls.tsx';
import { useFeedback } from '../Feedback.tsx';
import SemanticSearch from './SemanticSearch.tsx';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ApiError,
  dateLabel,
  errorText,
  money,
  request,
  today,
} from '../api.ts';
import type { Category, Transaction } from '../api.ts';
import {
  MoneyInput,
  Alert,
  Empty,
  Loading,
  LoadError,
  useLoad,
} from '../ui.tsx';
export default function Transactions({
  categories,
}: {
  categories: Category[];
}) {
  const editor = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const [cursor, setCursor] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [editing, setEditing] = useState<Transaction>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const setNotice = useFeedback().success;
  useEffect(() => {
    if (!editing) return;
    const trigger = document.activeElement as HTMLElement | null;
    editor.current?.showModal();
    return () => trigger?.focus();
  }, [editing?.id]);
  const query =
    filter + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
  const state = useLoad(
    () =>
      request<{ items: Transaction[]; next_cursor: string | null }>(
        '/transactions?limit=20' + query,
      ),
    [query],
  );
  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget))
      if (String(v)) params.set(k, String(v));
    setFilter('&' + params);
    setCursor('');
    setHistory([]);
  }
  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      const formValues = Object.fromEntries(new FormData(e.currentTarget));
      if (!editing.id) {
        await request('/transactions/batch', 'POST', {
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              type: String(formValues.type ?? editing.type),
              category: String(formValues.category ?? editing.category),
              amount_vnd: String(formValues.amount_vnd ?? editing.amount_vnd),
              note: String(formValues.note ?? editing.note),
              occurred_on: String(
                formValues.occurred_on ?? editing.occurred_on,
              ),
            },
          ],
        });
        setEditing(undefined);
        setNotice('Đã thêm giao dịch mới.');
      } else {
        await request('/transactions/' + editing.id, 'PATCH', {
          ...formValues,
          version: editing.version,
        });
        setEditing(undefined);
        setNotice('Đã cập nhật giao dịch.');
      }
      state.reload();
    } catch (e) {
      if (e instanceof ApiError && [404, 409].includes(e.status))
        setConflict(true);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const confirmAction = useFeedback().confirm;
  async function remove(t: Transaction) {
    if (
      !(await confirmAction({
        title: 'Xóa giao dịch?',
        destructive: true,
        message:
          'Xóa giao dịch “' + t.note + '”? Thao tác này không thể hoàn tác.',
        accept: 'Xóa giao dịch',
      }))
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request(
        '/transactions/' + t.id + '?version=' + t.version,
        'DELETE',
      );
      setNotice('Đã xóa giao dịch.');
      state.reload();
    } catch (e) {
      if (e instanceof ApiError && [404, 409].includes(e.status))
        setConflict(true);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function reloadConflict() {
    if (
      editing &&
      !(await confirmAction({
        title: 'Tải bản mới?',
        message:
          'Bản chỉnh sửa hiện tại sẽ bị bỏ. Bạn có thể sao chép nội dung trước khi tiếp tục.',
        accept: 'Tải bản mới',
      }))
    )
      return;
    setEditing(undefined);
    setConflict(false);
    setError('');
    state.reload();
  }
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">TỪNG KHOẢN, RÕ RÀNG</span>
          <h1>Giao dịch</h1>
          <p>Nhìn lại, chỉnh sửa và giữ cuốn sổ đúng ý bạn.</p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true });
              setEditing({
                id: '',
                version: '1',
                type: 'expense',
                category:
                  categories.find((c) => c.type === 'expense')?.key ??
                  'an_uong',
                amount_vnd: '',
                note: '',
                occurred_on: today(),
              });
              setConflict(false);
              setError('');
            }}
          >
            + Nhập tay
          </button>
          <a className="primary" href="#chat">
            + Ghi khoản mới
          </a>
        </div>
      </header>
      <SemanticSearch
        onSelectNote={(note) => {
          const p = new URLSearchParams();
          const trimmed = note.slice(0, 100);
          p.set('search', trimmed);
          if (searchInput.current) searchInput.current.value = trimmed;
          setFilter('&' + p);
          setCursor('');
          setHistory([]);
        }}
      />
      <form className="panel filters" onSubmit={apply}>
        <label>
          Tìm ghi chú
          <input
            ref={searchInput}
            name="search"
            type="search"
            maxLength={100}
            placeholder="Ví dụ: cà phê, tiền trọ…"
          />
        </label>
        <label>
          Từ ngày
          <CalendarInput name="from" type="date" />
        </label>
        <label>
          Đến ngày
          <CalendarInput name="to" type="date" />
        </label>
        <label>
          Loại
          <select name="type">
            <option value="">Tất cả</option>
            <option value="expense">Chi tiêu</option>
            <option value="income">Thu nhập</option>
          </select>
        </label>
        <label>
          Danh mục
          <select name="category">
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.key}>
                {c.name_vi}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary" disabled={busy}>
          Lọc giao dịch
        </button>
        <button
          className="secondary"
          type="reset"
          disabled={busy}
          onClick={() => {
            setFilter('');
            setCursor('');
            setHistory([]);
          }}
        >
          Bỏ bộ lọc
        </button>
      </form>
      {error && !editing && <Alert>{error}</Alert>}
      {conflict && !editing && (
        <button className="secondary" onClick={() => void reloadConflict()}>
          Tải bản mới
        </button>
      )}
      {editing && (
        <dialog
          ref={editor}
          className="panel editor transaction-dialog"
          aria-labelledby="edit-transaction-title"
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setEditing(undefined);
          }}
        >
          <h2 id="edit-transaction-title">
            {editing.id ? 'Sửa giao dịch' : 'Thêm giao dịch mới'}
          </h2>
          {error && <Alert>{error}</Alert>}
          {conflict && (
            <button
              type="button"
              className="secondary"
              onClick={() => void reloadConflict()}
            >
              Tải bản mới
            </button>
          )}
          <form onSubmit={update}>
            <fieldset disabled={busy} className="editor-fields">
              <div className="form-grid">
                <label>
                  Loại
                  <select
                    name="type"
                    value={editing.type}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        type: e.target.value as Transaction['type'],
                        category:
                          categories.find((c) => c.type === e.target.value)
                            ?.key ?? '',
                      })
                    }
                  >
                    <option value="expense">Chi tiêu</option>
                    <option value="income">Thu nhập</option>
                  </select>
                </label>
                <label>
                  Danh mục
                  <select
                    name="category"
                    value={editing.category}
                    onChange={(e) =>
                      setEditing({ ...editing, category: e.target.value })
                    }
                  >
                    {categories
                      .filter((c) => c.type === editing.type)
                      .map((c) => (
                        <option key={c.id} value={c.key}>
                          {c.name_vi}
                        </option>
                      ))}
                  </select>
                </label>
                <MoneyInput
                  value={editing.amount_vnd}
                  onChange={(v) => setEditing({ ...editing, amount_vnd: v })}
                />

                <label>
                  Ngày giao dịch
                  <CalendarInput
                    name="occurred_on"
                    type="date"
                    required
                    value={editing.occurred_on}
                    onChange={(e) =>
                      setEditing({ ...editing, occurred_on: e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                Ghi chú
                <input
                  name="note"
                  maxLength={300}
                  value={editing.note}
                  onChange={(e) =>
                    setEditing({ ...editing, note: e.target.value })
                  }
                />
              </label>
            </fieldset>
            <div className="actions">
              <button className="primary" disabled={busy}>
                {editing.id ? 'Lưu thay đổi' : 'Thêm giao dịch'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setEditing(undefined)}
              >
                Hủy chỉnh sửa
              </button>
            </div>
          </form>
        </dialog>
      )}
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <LoadError error={state.error} retry={state.reload} />
      ) : state.data?.items.length ? (
        <section className="panel">
          <div className="section-heading">
            <h2>Trong cuốn sổ</h2>
            <span className="muted">
              {filter ? 'Đang lọc · ' : ''}
              {state.data.items.length} khoản · Trang {history.length + 1}
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Danh sách giao dịch của bạn</caption>
              <thead>
                <tr>
                  <th>Giao dịch</th>
                  <th>Ngày</th>
                  <th>Danh mục</th>
                  <th className="numeric">Số tiền</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.note || 'Không có ghi chú'}</strong>
                      <small>
                        {t.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}
                      </small>
                    </td>
                    <td>{dateLabel(t.occurred_on)}</td>
                    <td>
                      <span className="category-chip">
                        {categories.find((c) => c.key === t.category)
                          ?.name_vi ?? t.category}
                      </span>
                    </td>
                    <td
                      className={
                        'numeric ' +
                        (t.type === 'income' ? 'income' : 'expense')
                      }
                    >
                      {t.type === 'income' ? '+' : '−'}
                      {money(t.amount_vnd)}
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={(event) => {
                            event.currentTarget.focus({ preventScroll: true });
                            setEditing(t);
                            setConflict(false);
                            setError('');
                          }}
                          aria-label={'Sửa ' + (t.note || 'giao dịch')}
                        >
                          Sửa
                        </button>
                        <button
                          className="text-button danger-text"
                          disabled={busy}
                          onClick={() => void remove(t)}
                          aria-label={'Xóa ' + (t.note || 'giao dịch')}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <Empty title="Chưa có giao dịch phù hợp">
          Thử thay đổi bộ lọc hoặc <a href="#chat">ghi khoản đầu tiên</a>.
        </Empty>
      )}
      <div className="pagination">
        <button
          className="secondary"
          disabled={state.loading || !history.length}
          onClick={() => {
            setCursor(history.at(-1) ?? '');
            setHistory((h) => h.slice(0, -1));
          }}
        >
          ← Trang trước
        </button>
        <button
          className="secondary"
          disabled={state.loading || !state.data?.next_cursor}
          onClick={() => {
            setHistory((h) => [...h, cursor]);
            setCursor(state.data?.next_cursor ?? '');
          }}
        >
          Trang sau →
        </button>
      </div>
    </>
  );
}
