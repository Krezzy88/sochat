import { CalendarInput } from '../DateControls.tsx';
import { useFeedback } from '../Feedback.tsx';
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
export default function Goals({ userId }: { userId: string }) {
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
  const [conflict, setConflict] = useState(false);
  const setNotice = useFeedback().success;
  const pendingGoal = useRef<Record<string, FormDataEntryValue> | null>(null);
  const [goalLocked, setGoalLocked] = useState(false);
  const creationKey = useRef<string | null>(null),
    goalForm = useRef<HTMLFormElement>(null);
  const [pendingCreation, setPendingCreation] = useState(false),
    [checkingCreation, setCheckingCreation] = useState(false);
  const storageKey = 'sochat.pending-goal:' + userId;
  function rememberCreation(key: string | null) {
    creationKey.current = key;
    setPendingCreation(!!key);
    try {
      if (key) sessionStorage.setItem(storageKey, key);
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* Replay still works in-page if browser storage is unavailable. */
    }
  }
  async function checkCreation() {
    const key = creationKey.current;
    if (!key) return;
    setCheckingCreation(true);
    try {
      const result = await request<{
        state: 'saved' | 'deleted' | 'unknown';
        goal_id?: string;
      }>('/goals/creation-status/' + key);
      if (result.state !== 'unknown') {
        rememberCreation(null);
        pendingGoal.current = null;
        setGoalLocked(false);
        if (!editing) goalForm.current?.reset();
        setError('');
        setNotice(
          result.state === 'saved'
            ? 'Yêu cầu tạo quỹ trước đã hoàn tất.'
            : 'Quỹ của yêu cầu trước đã được xóa.',
        );
        state.reload();
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setCheckingCreation(false);
    }
  }
  useEffect(() => {
    try {
      const key = sessionStorage.getItem(storageKey);
      if (
        key &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          key,
        )
      ) {
        rememberCreation(key);
        void checkCreation();
      }
    } catch {
      /* Keep memory-only behavior if storage is unavailable. */
    }
  }, [userId]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    if (!editing)
      pendingGoal.current ??= {
        ...fields,
        idempotency_key: creationKey.current ?? crypto.randomUUID(),
      };
    if (!editing)
      rememberCreation(String(pendingGoal.current!.idempotency_key));
    const data = editing
      ? { ...fields, version: editing.version }
      : pendingGoal.current;
    if (!editing) setGoalLocked(true);
    setBusy(true);
    setError('');
    try {
      await request(
        '/goals' + (editing ? '/' + editing.id : ''),
        editing ? 'PATCH' : 'POST',
        data,
      );
      pendingGoal.current = null;
      if (!editing) rememberCreation(null);
      setGoalLocked(false);
      setEditing(undefined);
      form.reset();
      setNotice('Đã lưu quỹ mục tiêu.');
      state.reload();
    } catch (e) {
      if (e instanceof ApiError && [400, 404, 415].includes(e.status)) {
        pendingGoal.current = null;
        setGoalLocked(false);
      }
      if (e instanceof ApiError && [404, 409].includes(e.status))
        setConflict(true);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const pendingContribution = useRef<{
    goal: string;
    data: Record<string, FormDataEntryValue>;
  } | null>(null);
  const [contributionLocked, setContributionLocked] = useState(false);
  async function contribute(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    pendingContribution.current ??= {
      goal: id,
      data: {
        ...Object.fromEntries(new FormData(e.currentTarget)),
        idempotency_key: crypto.randomUUID(),
      },
    };
    const pending = pendingContribution.current;
    setContributionLocked(true);
    setBusy(true);
    setError('');
    try {
      await request(
        '/goals/' + pending.goal + '/contributions',
        'POST',
        pending.data,
      );
      pendingContribution.current = null;
      setContributionLocked(false);
      setContributing(undefined);
      setNotice('Đã ghi nhận đóng góp vào quỹ.');
      state.reload();
    } catch (e) {
      if (e instanceof ApiError && [400, 404, 415].includes(e.status)) {
        pendingContribution.current = null;
        setContributionLocked(false);
      }
      setError(
        errorText(e) +
          ' Nếu chưa rõ kết quả, bấm Thử ghi lại để tránh đóng góp trùng.',
      );
    } finally {
      setBusy(false);
    }
  }
  const confirmAction = useFeedback().confirm;
  async function remove(g: Goal) {
    if (
      !(await confirmAction({
        title: 'Xóa quỹ?',
        destructive: true,
        message:
          'Xóa quỹ “' + g.name + '” và toàn bộ đóng góp? Không thể hoàn tác.',
        accept: 'Xóa quỹ',
      }))
    )
      return;
    setBusy(true);
    setError('');
    try {
      await request('/goals/' + g.id + '?version=' + g.version, 'DELETE');
      if (editing?.id === g.id) setEditing(undefined);
      setNotice('Đã xóa quỹ.');
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
      !(await confirmAction({
        title: 'Tải quỹ mới nhất?',
        message:
          'Bản chỉnh sửa chưa lưu sẽ bị bỏ; danh sách quỹ sẽ được cập nhật.',
        accept: 'Tải bản mới',
      }))
    )
      return;
    pendingGoal.current = null;
    setGoalLocked(false);
    pendingContribution.current = null;
    setContributionLocked(false);
    setEditing(undefined);
    setContributing(undefined);
    setConflict(false);
    setError('');
    state.reload();
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
      {error && !contributing && <Alert>{error}</Alert>}
      {conflict && (
        <button className="secondary" onClick={() => void reloadConflict()}>
          Tải quỹ mới nhất
        </button>
      )}
      {pendingCreation && (
        <div className="panel">
          <p>
            Có yêu cầu tạo quỹ chưa rõ kết quả. Kiểm tra kết quả trước; nếu cần
            thử lại, nhập lại cùng thông tin để giữ một yêu cầu duy nhất.
          </p>
          <button
            className="secondary"
            disabled={busy || checkingCreation || !!editing}
            onClick={() => void checkCreation()}
          >
            Kiểm tra yêu cầu tạo quỹ
          </button>
        </div>
      )}
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
                      disabled={
                        busy ||
                        contributionLocked ||
                        goalLocked ||
                        checkingCreation
                      }
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
                      disabled={
                        busy ||
                        contributionLocked ||
                        goalLocked ||
                        checkingCreation
                      }
                      onClick={() => setEditing(g)}
                      aria-label={'Sửa quỹ ' + g.name}
                    >
                      Sửa
                    </button>
                    <button
                      className="text-button danger-text"
                      disabled={
                        busy ||
                        contributionLocked ||
                        goalLocked ||
                        checkingCreation
                      }
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
                      <fieldset
                        disabled={
                          busy ||
                          contributionLocked ||
                          goalLocked ||
                          checkingCreation
                        }
                        className="editor-fields"
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
                      </fieldset>
                      {error && <Alert>{error}</Alert>}
                      <button className="primary" disabled={busy}>
                        {busy
                          ? 'Đang lưu…'
                          : contributionLocked
                            ? 'Thử ghi lại'
                            : 'Ghi nhận đóng góp'}
                      </button>
                      <p className="muted">
                        Chỉ cập nhật tiến độ quỹ, không tạo giao dịch thu chi.
                        Ngày tương lai vẫn được cộng ngay vào tiến độ.
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
          <form ref={goalForm} key={editing?.id ?? 'new'} onSubmit={save}>
            <fieldset
              disabled={
                busy || contributionLocked || goalLocked || checkingCreation
              }
              className="editor-fields"
            >
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
            </fieldset>
            <button
              className="primary full"
              disabled={busy || contributionLocked || checkingCreation}
            >
              {busy
                ? 'Đang lưu…'
                : editing
                  ? 'Lưu thay đổi'
                  : goalLocked
                    ? 'Thử tạo lại'
                    : 'Tạo quỹ'}
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
