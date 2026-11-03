import { CalendarInput } from '../DateControls.tsx';
import { useFeedback } from '../Feedback.tsx';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { dateLabel, errorText, money, request, today } from '../api.ts';
import type { Goal } from '../api.ts';
import {
  Alert,
  Empty,
  Icon,
  Loading,
  LoadError,
  MoneyInput,
  useLoad,
} from '../ui.tsx';
export default function Goals() {
  const state = useLoad(() => request<{ items: Goal[] }>('/goals'), []);
  const [editing, setEditing] = useState<Goal>();
  const editor = useRef<HTMLElement>(null);
  useEffect(() => {
    if (editing) {
      editor.current?.scrollIntoView({ block: 'center' });
      editor.current?.querySelector('input')?.focus({ preventScroll: true });
    }
  }, [editing?.id]);
  const [contributing, setContributing] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const setNotice = useFeedback().success;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    try {
      await request(
        '/goals' + (editing ? '/' + editing.id : ''),
        editing ? 'PATCH' : 'POST',
        data,
      );
      setEditing(undefined);
      form.reset();
      setNotice('Đã lưu quỹ mục tiêu.');
      state.reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function contribute(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      await request('/goals/' + id + '/contributions', 'POST', data);
      setContributing(undefined);
      setNotice('Đã ghi nhận đóng góp vào quỹ.');
      state.reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const confirmAction = useFeedback().confirm;
  async function remove(g: Goal) {
    if (
      !(await confirmAction({
        title: 'Xóa quỹ?',
        message:
          'Xóa quỹ “' + g.name + '” và toàn bộ đóng góp? Không thể hoàn tác.',
        accept: 'Xóa quỹ',
      }))
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request('/goals/' + g.id, 'DELETE');
      if (editing?.id === g.id) setEditing(undefined);
      setNotice('Đã xóa quỹ.');
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
          <span className="eyebrow">DÀNH DỤM CHO ĐIỀU BẠN THÍCH</span>
          <h1>Quỹ mục tiêu</h1>
          <p>Một chuyến đi, chiếc laptop, hay một dự định nhỏ.</p>
        </div>
        <span className="header-stamp">
          <Icon name="goal" size={30} />
        </span>
      </header>
      {error && <Alert>{error}</Alert>}
      <div className="split-layout">
        <section>
          {state.loading ? (
            <Loading />
          ) : state.error ? (
            <LoadError error={state.error} retry={state.reload} />
          ) : state.data?.items.length ? (
            <div className="goal-list">
              {state.data.items.map((g) => (
                <article className="panel goal-card" key={g.id}>
                  <div className="section-heading">
                    <span className="round-icon">
                      <Icon name="goal" />
                    </span>
                    <h2>{g.name}</h2>
                    <span className="goal-percent">
                      {g.progress_basis_points / 100}%
                    </span>
                  </div>
                  <p className="goal-amount">
                    <strong>{money(g.contributed_vnd)}</strong>
                    <span> / {money(g.target_vnd)}</span>
                  </p>
                  <progress
                    value={g.progress_basis_points}
                    max="10000"
                    aria-label={'Tiến độ ' + g.name}
                  />
                  <div className="budget-meta">
                    <span>Hạn {dateLabel(g.deadline)}</span>
                    <span>Còn {money(g.remaining_vnd)}</span>
                  </div>
                  <p className="goal-suggestion">
                    {g.remaining_vnd === '0' ? (
                      'Đã đạt mục tiêu. Chúc mừng bạn!'
                    ) : g.suggested_daily_saving_vnd === null ? (
                      'Đã đến hạn. Bạn có thể cập nhật ngày mục tiêu.'
                    ) : (
                      <>
                        Chia đều {g.days_left} ngày còn lại:{' '}
                        <strong>
                          {money(g.suggested_daily_saving_vnd)}/ngày
                        </strong>
                      </>
                    )}
                  </p>
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        setContributing(
                          contributing === g.id ? undefined : g.id,
                        )
                      }
                    >
                      + Đóng góp
                    </button>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setEditing(g)}
                      aria-label={'Sửa quỹ ' + g.name}
                    >
                      Sửa
                    </button>
                    <button
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={() => void remove(g)}
                      aria-label={'Xóa quỹ ' + g.name}
                    >
                      Xóa
                    </button>
                  </div>
                  {contributing === g.id && (
                    <form
                      className="contribution-form"
                      onSubmit={(e) => void contribute(e, g.id)}
                    >
                      <MoneyInput label="Số tiền đóng góp (đ)" />
                      <label>
                        Ngày đóng góp
                        <CalendarInput
                          name="contributed_on"
                          type="date"
                          defaultValue={today()}
                          required
                        />
                      </label>
                      <label>
                        Ghi chú đóng góp
                        <input name="note" maxLength={300} />
                      </label>
                      <button className="primary" disabled={busy}>
                        {busy ? 'Đang lưu…' : 'Ghi nhận đóng góp'}
                      </button>
                      <p className="muted">
                        Chỉ cập nhật tiến độ quỹ, không tạo giao dịch thu chi.
                      </p>
                    </form>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty title="Bạn đang ấp ủ điều gì?">
              Tạo một quỹ để ghi nhận từng bước dành dụm.
            </Empty>
          )}
        </section>
        <section ref={editor} className="panel side-form">
          <h2>{editing ? 'Chỉnh sửa quỹ' : 'Tạo quỹ mới'}</h2>
          <form key={editing?.id ?? 'new'} onSubmit={save}>
            <label>
              Tên quỹ
              <input
                name="name"
                maxLength={100}
                defaultValue={editing?.name ?? ''}
                placeholder="Ví dụ: Chuyến đi Đà Lạt"
                required
              />
            </label>
            <MoneyInput
              name="target_vnd"
              label="Số tiền mục tiêu (đ)"
              defaultValue={editing?.target_vnd ?? ''}
            />

            <label>
              Ngày mục tiêu
              <CalendarInput
                name="deadline"
                type="date"
                defaultValue={editing?.deadline ?? ''}
                required
              />
            </label>
            <button className="primary full" disabled={busy}>
              {busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo quỹ'}
            </button>
            {editing && (
              <button
                type="button"
                className="text-button full"
                disabled={busy}
                onClick={() => setEditing(undefined)}
              >
                Hủy chỉnh sửa quỹ
              </button>
            )}
          </form>
          <p className="form-foot">
            Mức chia mỗi ngày là phép tính đơn giản từ số còn thiếu và số ngày
            còn lại. Không phải tư vấn tài chính.
          </p>
        </section>
      </div>
    </>
  );
}
