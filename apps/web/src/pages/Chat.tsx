import { QueryAnswer } from './QueryPanel.tsx';
import type { Answer } from './QueryPanel.tsx';
import { Mascot } from '../Mascot.tsx';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, errorText, money, request } from '../api.ts';
import type { Category, Draft, Proposal } from '../api.ts';
import { Alert, Icon, MoneyInput, useLoad } from '../ui.tsx';
export function Chat({ categories }: { categories: Category[] }) {
  const engine = useLoad(
    () => request<{ provider: 'gemini' | 'fake' }>('/chat/status'),
    [],
  );
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState<
    { id: string; text: string; answer?: Answer; reply?: string }[]
  >([]);
  const [activeId, setActiveId] = useState('');
  const [intent, setIntent] = useState<'auto' | 'record' | 'query' | 'revise'>(
    'auto',
  );
  const [proposal, setProposal] = useState<Proposal>();
  const [revisedByAi, setRevisedByAi] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pending = useRef<
    { idempotency_key: string; items: Draft[] } | undefined
  >(undefined);
  const card = useRef<HTMLDivElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = feed.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, busy, proposal, success]);
  async function parse(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    const text = message.trim();
    const folded = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase();
    const revision =
      intent === 'revise' ||
      (intent === 'auto' &&
        !!proposal &&
        /sua|doi|tang|giam|them|bot|chuyen|ghi chu/.test(folded));
    if (revision && !proposal) {
      setError('Bạn cần có bản nháp chưa lưu để sửa.');
      setBusy(false);
      return;
    }
    const query =
      intent === 'query' ||
      (intent === 'auto' &&
        /bao nhieu|tong (thu|chi)|so sanh|thong ke|da chi|chi (tieu )?(thang|tuan)|\?$/.test(
          folded,
        ));
    if (
      !query &&
      proposal &&
      !revision &&
      !window.confirm('Bạn có bản nháp chưa lưu. Thay bằng tin nhắn mới?')
    ) {
      setBusy(false);
      return;
    }
    const id = crypto.randomUUID();
    setTurns((old) => [...old, { id, text }]);
    setMessage('');
    try {
      if (revision && proposal) {
        const result = await request<{
          items: Draft[];
          needs_clarification: boolean;
          question: string;
          changed_indices: number[];
        }>('/assistant/revise', 'POST', { message: text, items: drafts });
        if (!result.needs_clarification) {
          setDrafts(result.items);
          setRevisedByAi(true);
          setProposal({
            ...proposal,
            needs_clarification: result.items.some(
              (i) => !i.amount_vnd || !i.occurred_on,
            ),
            questions: [],
          });
          pending.current = undefined;
        }
        setTurns((old) =>
          old.map((t) => (t.id === id ? { ...t, reply: result.question } : t)),
        );
        return;
      }
      if (query) {
        const answer = await request<Answer>('/assistant/query', 'POST', {
          message: text,
        });
        setTurns((old) => old.map((t) => (t.id === id ? { ...t, answer } : t)));
        return;
      }
      if (activeId)
        setTurns((old) =>
          old.map((t) =>
            t.id === activeId
              ? { ...t, reply: 'Bản nháp đã được thay thế.' }
              : t,
          ),
        );

      const data = await request<Proposal>('/chat/parse', 'POST', {
        message: text,
      });
      setProposal(data);
      setRevisedByAi(false);
      setActiveId(id);
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
      setTurns((old) =>
        old.map((t) => (t.id === id ? { ...t, reply: errorText(e) } : t)),
      );
      setError(errorText(e));
      setMessage(text);
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
      const savedCount = pending.current.items.length;
      setSuccess(
        `Đã lưu ${savedCount} khoản vào sổ. Não được nghỉ một chút rồi!`,
      );
      setTurns((old) =>
        old.map((t) =>
          t.id === activeId
            ? {
                ...t,
                reply: `Đã lưu ${savedCount} khoản vào sổ.`,
              }
            : t,
        ),
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
  const draftView = proposal ? (
    <div ref={card} tabIndex={-1} className="proposal">
      <div className="confirm-heading">
        <h3>Kiểm tra trước khi lưu</h3>
        <span className="route-label">
          {revisedByAi
            ? 'Gemini đã hỗ trợ sửa bản nháp'
            : proposal.path === 'rules'
              ? proposal.reasons.some((r) => r.startsWith('llm_'))
                ? 'AI chưa xử lý được · bạn kiểm tra lại'
                : 'Tự nhận diện · không cần gọi AI'
              : proposal.path === 'cache'
                ? 'Dùng kết quả lần trước · không gọi lại AI'
                : proposal.provider === 'gemini'
                  ? 'Gemini đã hỗ trợ bóc tách'
                  : 'Phản hồi mô phỏng kiểm thử'}
        </span>
        <span className="count-pill">{drafts.length} khoản</span>
      </div>
      {proposal.needs_clarification && (
        <div className="clarification" role="status">
          <strong>Có chỗ cần bạn làm rõ</strong>
          {proposal.questions.length ? (
            proposal.questions.map((q, i) => <p key={i}>{q}</p>)
          ) : (
            <p>Kiểm tra số tiền, ngày và danh mục trước khi xác nhận.</p>
          )}
        </div>
      )}
      {drafts.length ? (
        <form onSubmit={save}>
          <fieldset disabled={saving || locked} className="draft-list">
            {drafts.map((item, index) => {
              const uncertain =
                proposal.items[index]?.flags.length ||
                (proposal.items[index]?.confidence ?? 1) < 0.8 ||
                !item.amount_vnd ||
                !item.occurred_on;
              return (
                <section
                  className={'draft-card' + (uncertain ? ' uncertain' : '')}
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
                        onChange={(e) => edit(index, 'type', e.target.value)}
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

                    <label className={!item.occurred_on ? 'field-warning' : ''}>
                      Ngày giao dịch
                      <input
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
                      onChange={(e) => edit(index, 'note', e.target.value)}
                    />
                  </label>
                </section>
              );
            })}
          </fieldset>
          <div className="confirmation-total">
            <span>Tổng các khoản đang xác nhận</span>
            <strong>
              {money(
                drafts.reduce(
                  (sum, item) =>
                    sum +
                    (/^[1-9]\d*$/.test(item.amount_vnd)
                      ? BigInt(item.amount_vnd)
                      : 0n),
                  0n,
                ),
              )}
            </strong>
          </div>
          <button className="primary full" disabled={saving}>
            {saving ? 'Đang lưu…' : locked ? 'Thử lưu lại' : 'Xác nhận và lưu'}
            <Icon name="check" />
          </button>
          {!locked && (
            <button
              type="button"
              className="text-button full discard"
              onClick={() => {
                setTurns((old) =>
                  old.map((t) =>
                    t.id === activeId
                      ? { ...t, reply: 'Đã bỏ bản nháp, chưa lưu giao dịch.' }
                      : t,
                  ),
                );
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
          Hãy bổ sung tin nhắn bên dưới, kèm số tiền và đơn vị như “50k”.
        </p>
      )}
    </div>
  ) : null;
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">MỖI NGÀY MỘT CHÚT</span>
          <h1>Hôm nay bạn chi gì?</h1>
          <p>Cứ kể tự nhiên. SổChat giúp bạn ghi lại.</p>
        </div>
        <span className="header-stamp">
          <Icon name="chat" size={30} />
        </span>
      </header>
      <div className="engine-status" role="status">
        <strong>
          {engine.data?.provider === 'gemini'
            ? '✦ Gemini thật đã bật'
            : engine.loading
              ? 'Đang kiểm tra bộ phân tích…'
              : engine.error
                ? 'Không kiểm tra được kết nối bộ phân tích'
                : 'Bản kiểm thử · Không gọi Gemini'}
        </strong>
        <span>
          Tự nhận diện câu rõ ràng → Gemini hỗ trợ khi cần → bạn xác nhận trước
          khi lưu.
        </span>
      </div>
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
          <div className="chat-body" ref={feed}>
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
            {!turns.length && (
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
            {success && (
              <div className="success" role="status">
                <Icon name="check" />
                {success}
                <a href="#transactions">Xem giao dịch →</a>
              </div>
            )}
            <div
              className="conversation"
              role="log"
              aria-label="Lịch sử trò chuyện"
              aria-relevant="additions text"
            >
              {turns.map((turn) => (
                <article className="chat-turn" key={turn.id}>
                  <p className="source-message">
                    <span className="sr-only">Bạn: </span>
                    {turn.text}
                  </p>
                  {turn.reply && <p className="bot-message">{turn.reply}</p>}
                  {turn.answer && (
                    <QueryAnswer answer={turn.answer} categories={categories} />
                  )}
                  {turn.id === activeId && draftView}
                </article>
              ))}
            </div>
            {error && <Alert>{error}</Alert>}
          </div>
          <form className="composer" onSubmit={parse}>
            {proposal && (
              <p>Bản nháp chưa lưu sẽ mất khi đổi trang hoặc tải lại.</p>
            )}
            <label htmlFor="message">Tin nhắn thu chi</label>
            <label className="chat-intent">
              Cách xử lý
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as typeof intent)}
              >
                <option value="auto">Tự nhận diện ghi chép / câu hỏi</option>
                <option value="record">Ghi khoản thu chi</option>
                <option value="query">Hỏi giao dịch đã lưu</option>
                <option value="revise" disabled={!proposal}>
                  Sửa bản nháp chưa lưu
                </option>
              </select>
            </label>
            <textarea
              id="message"
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              placeholder="Ghi: ăn phở 50k · Hỏi: tháng này chi ăn uống bao nhiêu?"
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
                {busy ? 'Đang phân tích…' : 'Gửi'}
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
    </>
  );
}
