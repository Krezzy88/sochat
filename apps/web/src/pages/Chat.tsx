import { CalendarInput } from '../DateControls.tsx';
import { useFeedback } from '../Feedback.tsx';
import DraftRevision from './DraftRevision.tsx';
import { QueryPanel } from './QueryPanel.tsx';
import { Mascot } from '../Mascot.tsx';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, errorText, money, request } from '../api.ts';
import type { Category, Draft, Proposal } from '../api.ts';
import { Alert, Icon, MoneyInput, useLoad } from '../ui.tsx';
export function Chat({ categories }: { categories: Category[] }) {
  const engine = useLoad(
    () =>
      request<{
        provider: 'gemini' | 'fake';
        money_profile: 'standard' | 'owner-confirmed-v1' | 'owner-confirmed-v2';
      }>('/chat/status'),
    [],
  );
  const statusMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!statusMenu.current?.contains(event.target as Node))
        statusMenu.current?.removeAttribute('open');
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && statusMenu.current?.open) {
        statusMenu.current.open = false;
        statusMenu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  const engineState = engine.loading
    ? 'loading'
    : engine.error
      ? 'unknown'
      : engine.data?.provider === 'gemini'
        ? 'on'
        : 'off';
  const engineLabel = {
    on: 'Gemini đang bật',
    off: 'Gemini đang tắt',
    loading: 'Đang kiểm tra trạng thái Gemini',
    unknown: 'Chưa xác định trạng thái Gemini',
  }[engineState];
  const [message, setMessage] = useState('');
  const [source, setSource] = useState('');
  const [proposal, setProposal] = useState<Proposal>();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const setSuccess = useFeedback().success;
  const pending = useRef<
    { idempotency_key: string; items: Draft[] } | undefined
  >(undefined);
  const card = useRef<HTMLDivElement>(null);
  async function parse(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const data = await request<Proposal>('/chat/parse', 'POST', { message });
      setProposal(data);
      setSource(message);
      setDrafts(
        data.items.map((i) => ({
          type: i.type,
          category: i.category,
          amount_vnd: i.amount_vnd === null ? '' : String(i.amount_vnd),
          note: i.note.slice(0, 300),
          occurred_on: i.occurred_on ?? '',
        })),
      );
      pending.current = undefined;
      setLocked(false);
      setTimeout(() => card.current?.focus(), 0);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function edit(index: number, key: keyof Draft, value: string) {
    setDrafts((items) =>
      items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [key]: value };
        if (key === 'type')
          next.category = categories.find((c) => c.type === value)?.key ?? '';
        return next;
      }),
    );
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    pending.current ??= {
      idempotency_key: crypto.randomUUID(),
      items: drafts.map((i) => ({ ...i })),
    };
    setLocked(true);
    try {
      await request('/transactions/batch', 'POST', pending.current);
      setSuccess(
        `Đã lưu ${pending.current.items.length} khoản vào sổ. Não được nghỉ một chút rồi!`,
      );
      setProposal(undefined);
      setDrafts([]);
      setMessage('');
      pending.current = undefined;
      setLocked(false);
    } catch (e) {
      if (e instanceof ApiError && [400, 404, 415].includes(e.status)) {
        pending.current = undefined;
        setLocked(false);
        setError(errorText(e) + ' Kiểm tra và sửa lại bản nháp trước khi lưu.');
      } else {
        setError(
          errorText(e) +
            ' Chọn “Thử lưu lại” để gửi lại đúng yêu cầu, tránh ghi trùng.',
        );
      }
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">MỖI NGÀY MỘT CHÚT</span>
          <h1>Hôm nay bạn chi gì?</h1>
          <button
            className="text-button"
            onClick={() =>
              document.getElementById('ask-ledger')?.scrollIntoView()
            }
          >
            Hỏi về giao dịch đã lưu ↓
          </button>
          <p>Cứ kể tự nhiên. SổChat giúp bạn ghi lại.</p>
        </div>
        <details
          ref={statusMenu}
          className="ai-status"
          data-state={engineState}
        >
          <summary aria-label={engineLabel} title={engineLabel}>
            <Icon name="spark" size={24} />
            <span className="ai-status-light" aria-hidden="true" />
          </summary>
          <div className="ai-status-popover" role="status">
            <strong>{engineLabel}</strong>
            <p>
              {engineState === 'on'
                ? 'Gemini hỗ trợ khi cần. Bạn luôn kiểm tra và xác nhận trước khi lưu.'
                : engineState === 'off'
                  ? 'Gemini hiện không được bật. Bạn vẫn có thể ghi và kiểm tra các khoản thu chi.'
                  : engineState === 'loading'
                    ? 'Đang tải cấu hình hỗ trợ AI.'
                    : 'Không tải được trạng thái. Bạn có thể thử kiểm tra lại.'}
            </p>
            {engine.error && (
              <button className="secondary" onClick={engine.reload}>
                Kiểm tra lại
              </button>
            )}
          </div>
        </details>
      </header>
      <div className="chat-layout">
        <section className="chat-panel panel">
          <div className="panel-heading">
            <span className="round-icon">
              <Icon name="spark" />
            </span>
            <div>
              <h2>Nhắn một câu, vào sổ gọn gàng</h2>
              <p>Bạn luôn kiểm tra trước khi lưu.</p>
            </div>
            <span className="live-label">Sổ đang mở</span>
          </div>
          <div className="chat-body">
            <div className="assistant-note">
              <span className="assistant-avatar">S</span>
              <div>
                <strong>Chào bạn, mình là SổChat.</strong>
                <p>
                  Bữa trưa, ly cà phê hay tiền gia đình gửi —
                  <br className="desktop-only" /> ghi lại bằng một tin nhắn là
                  được.
                </p>
              </div>
            </div>
            {!proposal && (
              <div className="chat-prompt">
                <Mascot />
                <span className="prompt-illustration">
                  <Icon name="list" size={42} />
                  <span>✦</span>
                </span>
                <h3>Bắt đầu từ một khoản nhỏ</h3>
                <p>
                  Chẳng hạn: “ăn phở 50k, cà phê 25k”.
                  <br />
                  Số tiền chưa rõ? Mình sẽ hỏi lại bạn.
                </p>
              </div>
            )}
            {proposal && (
              <div ref={card} tabIndex={-1} className="proposal">
                <p className="source-message">{source}</p>
                <div className="confirm-heading">
                  <h3>Kiểm tra trước khi lưu</h3>
                  <span className="route-label">
                    {proposal.path === 'rules'
                      ? proposal.reasons.some((r) => r.startsWith('llm_'))
                        ? 'AI chưa xử lý được · bạn kiểm tra lại'
                        : 'Bản gốc được tự nhận diện'
                      : proposal.path === 'cache'
                        ? 'Dùng kết quả lần trước · không gọi lại AI'
                        : proposal.provider === 'gemini'
                          ? 'Gemini đã hỗ trợ bóc tách'
                          : 'Phản hồi mô phỏng kiểm thử'}
                  </span>
                  <span className="count-pill">{drafts.length} khoản</span>
                </div>
                <DraftRevision
                  items={drafts}
                  onBusy={setBusy}
                  disabled={saving || locked}
                  onChange={(items) => {
                    setDrafts(items);
                    pending.current = undefined;
                  }}
                />
                {proposal.needs_clarification && (
                  <div className="clarification" role="status">
                    <strong>Có chỗ cần bạn làm rõ</strong>
                    {proposal.questions.length ? (
                      proposal.questions.map((q, i) => <p key={i}>{q}</p>)
                    ) : (
                      <p>
                        Kiểm tra số tiền, ngày và danh mục trước khi xác nhận.
                      </p>
                    )}
                  </div>
                )}
                {drafts.length ? (
                  <form onSubmit={save}>
                    <fieldset
                      disabled={saving || locked || busy}
                      className="draft-list"
                    >
                      {drafts.map((item, index) => {
                        const uncertain =
                          proposal.items[index]?.flags.length ||
                          (proposal.items[index]?.confidence ?? 1) < 0.8 ||
                          !item.amount_vnd ||
                          !item.occurred_on;
                        return (
                          <section
                            className={
                              'draft-card' + (uncertain ? ' uncertain' : '')
                            }
                            key={index}
                          >
                            <div className="draft-title">
                              <strong>Khoản {index + 1}</strong>
                              {!!uncertain && <span>Cần kiểm tra</span>}
                            </div>
                            <div className="form-grid">
                              <label>
                                Thu / Chi
                                <select
                                  value={item.type}
                                  onChange={(e) =>
                                    edit(index, 'type', e.target.value)
                                  }
                                >
                                  <option value="expense">Chi tiêu</option>
                                  <option value="income">Thu nhập</option>
                                </select>
                              </label>
                              <label>
                                Danh mục
                                <select
                                  value={item.category}
                                  onChange={(e) =>
                                    edit(index, 'category', e.target.value)
                                  }
                                >
                                  {categories
                                    .filter((c) => c.type === item.type)
                                    .map((c) => (
                                      <option key={c.id} value={c.key}>
                                        {c.name_vi}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <MoneyInput
                                value={item.amount_vnd}
                                onChange={(v) => edit(index, 'amount_vnd', v)}
                              />

                              <label
                                className={
                                  !item.occurred_on ? 'field-warning' : ''
                                }
                              >
                                Ngày giao dịch
                                <CalendarInput
                                  type="date"
                                  required
                                  value={item.occurred_on}
                                  onChange={(e) =>
                                    edit(index, 'occurred_on', e.target.value)
                                  }
                                />
                              </label>
                            </div>
                            <label>
                              Ghi chú
                              <input
                                value={item.note}
                                maxLength={300}
                                onChange={(e) =>
                                  edit(index, 'note', e.target.value)
                                }
                              />
                            </label>
                          </section>
                        );
                      })}
                    </fieldset>
                    <div className="confirmation-total">
                      {(['expense', 'income'] as const).map((type) => (
                        <div key={type}>
                          <span>
                            {type === 'expense' ? 'Tổng chi' : 'Tổng thu'}
                          </span>
                          <strong>
                            {money(
                              drafts
                                .filter((i) => i.type === type)
                                .reduce(
                                  (sum, i) =>
                                    sum +
                                    (/^[1-9]\d*$/.test(i.amount_vnd)
                                      ? BigInt(i.amount_vnd)
                                      : 0n),
                                  0n,
                                ),
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <button className="primary full" disabled={saving || busy}>
                      {saving
                        ? 'Đang lưu…'
                        : locked
                          ? 'Thử lưu lại'
                          : 'Xác nhận và lưu'}
                      <Icon name="check" />
                    </button>
                    {!locked && (
                      <button
                        type="button"
                        className="text-button full discard"
                        disabled={busy}
                        onClick={() => {
                          setProposal(undefined);
                          setDrafts([]);
                        }}
                      >
                        Bỏ bản nháp
                      </button>
                    )}
                  </form>
                ) : (
                  <p className="muted">
                    Hãy bổ sung tin nhắn bên dưới, kèm số tiền và đơn vị như
                    “50k”.
                  </p>
                )}
              </div>
            )}
            {error && <Alert>{error}</Alert>}
          </div>
          <form className="composer" onSubmit={parse}>
            <label htmlFor="message">Tin nhắn thu chi</label>
            <textarea
              id="message"
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              placeholder="Ví dụ: trưa nay ăn phở 50k, cà phê 25k"
              disabled={busy || saving || locked}
            />
            <div className="composer-bottom">
              <span>
                {Array.from(message).length}/500 · Không lưu khi chưa xác nhận
              </span>
              <button
                className="primary"
                disabled={busy || saving || locked || !message.trim()}
              >
                {busy ? 'Đang phân tích…' : 'Phân tích'}
                <Icon name="arrow" size={18} />
              </button>
            </div>
          </form>
        </section>
        <aside className="chat-aside">
          <section className="tip-card">
            <span className="eyebrow">NHỎ MÀ CÓ VÕ</span>
            <h2>
              Ghi sao cho
              <br />
              dễ hiểu?
            </h2>
            <div className="tip-row">
              <span>01</span>
              <div>
                <strong>Có số, có đơn vị</strong>
                <p>50k, 1tr2, 2 triệu rưỡi.</p>
                {engine.data && engine.data.money_profile !== 'standard' && (
                  <details>
                    <summary>Quy ước tiếng lóng</summary>
                    <p>
                      Lít, loét, xị, cành = 100.000đ; chục = 10.000đ.{' '}
                      {engine.data.money_profile === 'owner-confirmed-v2'
                        ? 'Số tiền từ 1–999 thiếu đơn vị được hiểu là nghìn đồng (35 = 35.000đ); ngày, giờ và số lượng không quy đổi.'
                        : 'Số thiếu đơn vị vẫn cần hỏi lại.'}{' '}
                      Bạn luôn kiểm tra trước khi lưu.
                    </p>
                  </details>
                )}
              </div>
            </div>
            <div className="tip-row">
              <span>02</span>
              <div>
                <strong>Nhớ cả ngày tháng</strong>
                <p>“Hôm qua”, “sáng nay” đều được.</p>
              </div>
            </div>
            <div className="tip-row">
              <span>03</span>
              <div>
                <strong>Nhiều khoản? Cứ kể.</strong>
                <p>Ngăn bằng dấu phẩy hoặc “và”.</p>
              </div>
            </div>
          </section>
          <section className="example-card">
            <Icon name="chat" />
            <h3>Chưa biết viết gì?</h3>
            <button
              disabled={locked || busy}
              onClick={() => setMessage('Trưa nay ăn phở 50k, cà phê 25k')}
            >
              “Trưa nay ăn phở 50k,
              <br />
              cà phê 25k” <span>↗</span>
            </button>
            <p>Chạm để điền thử. Bạn vẫn tự xác nhận.</p>
          </section>
          <p className="aside-foot">
            <Icon name="check" size={16} />
            Bạn quyết định khoản nào được lưu.
          </p>
        </aside>
      </div>
      <QueryPanel categories={categories} />
    </>
  );
}
