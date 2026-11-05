import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
type Question = {
  title: string;
  message: string;
  accept?: string;
  destructive?: boolean;
};
const Context = createContext<{
  success: (text: string) => void;
  confirm: (q: Question) => Promise<boolean>;
} | null>(null);
export function useFeedback() {
  const value = useContext(Context);
  if (!value) throw Error('Missing feedback provider');
  return value;
}
function Toast({ text, close }: { text: string; close: () => void }) {
  const [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const remaining = useRef(7000);
  useEffect(() => {
    if (paused) return;
    const started = Date.now(),
      timer = setTimeout(close, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started),
      );
    };
  }, [paused, close]);
  return (
    <div
      className="toast"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <p role="status">
        <span aria-hidden="true">✓ </span>
        {text}
      </p>
      <button
        className="toast-close"
        type="button"
        aria-label="Đóng thông báo"
        onClick={close}
      >
        ×
      </button>
    </div>
  );
}
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]),
    [question, setQuestion] = useState<Question | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    resolver = useRef<((answer: boolean) => void) | null>(null),
    serial = useRef(0);
  const pointerOrigin = useRef<HTMLElement | null>(null),
    restoreFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // Safari does not focus buttons on pointer activation. Remember the actual
    // invoker; keyboard activation continues to use the focused element.
    const pointer = (event: PointerEvent) => {
      pointerOrigin.current =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              'button, a, input, select, summary',
            )
          : null;
    };
    const keyboard = () => {
      pointerOrigin.current = null;
    };
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', keyboard, true);
    };
  }, []);
  useEffect(() => {
    if (!question) return;
    const origin = restoreFocus.current;
    dialog.current?.showModal();
    return () => origin?.focus();
  }, [question]);
  function finish(answer: boolean) {
    resolver.current?.(answer);
    resolver.current = null;
    setQuestion(null);
  }
  const success = (text: string) => {
    if (text) setToasts([{ id: ++serial.current, text }]);
  };
  const confirm = (q: Question) => {
    if (resolver.current) return Promise.resolve(false);
    restoreFocus.current =
      pointerOrigin.current ?? (document.activeElement as HTMLElement | null);
    pointerOrigin.current = null;
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setQuestion(q);
    });
  };
  return (
    <Context.Provider value={{ success, confirm }}>
      {children}
      {createPortal(
        <>
          <div
            className="toast-stack"
            role="region"
            aria-label="Thông báo hành động"
          >
            {toasts.map((t) => (
              <Toast
                key={t.id}
                text={t.text}
                close={() =>
                  setToasts((old) => old.filter((x) => x.id !== t.id))
                }
              />
            ))}
          </div>
          {question && (
            <dialog
              className="panel confirm-dialog"
              ref={dialog}
              aria-labelledby="confirm-title"
              aria-describedby="confirm-message"
              onCancel={(e) => {
                e.preventDefault();
                finish(false);
              }}
            >
              <h2 id="confirm-title">{question.title}</h2>
              <p id="confirm-message">{question.message}</p>
              <div className="actions">
                <button
                  className="secondary"
                  autoFocus
                  onClick={() => finish(false)}
                >
                  Hủy
                </button>
                <button
                  className={question.destructive ? 'danger-button' : 'primary'}
                  onClick={() => finish(true)}
                >
                  {question.accept ?? 'Xác nhận'}
                </button>
              </div>
            </dialog>
          )}
        </>,
        document.body,
      )}
    </Context.Provider>
  );
}
