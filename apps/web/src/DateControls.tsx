import { useEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { today } from './api.ts';
export function CalendarInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="date"
      onClick={(e) => {
        props.onClick?.(e);
        try {
          e.currentTarget.showPicker();
        } catch {
          /* Native keyboard/calendar affordance remains available. */
        }
      }}
    />
  );
}
export function YearSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const current = Number(today().slice(0, 4)),
    selected = Number(props.value ?? current);
  const years = [
    ...new Set([
      ...Array.from(
        { length: 201 },
        (_, i) => Math.max(1, current - 100) + i,
      ).filter((y) => y <= 9998),
      selected,
    ]),
  ].sort((a, b) => a - b);
  return (
    <select {...props}>
      {years.map((y) => (
        <option key={y} value={String(y).padStart(4, '0')}>
          {y}
        </option>
      ))}
    </select>
  );
}
export function MonthPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(value);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      return () => trigger.current?.focus();
    }
  }, [open]);
  const show = () => {
    setDraft(value);
    setOpen(true);
  };
  return (
    <>
      <input
        ref={trigger}
        aria-label={label}
        readOnly
        value={value.split('-').reverse().join('/')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
        onKeyDown={(e) => {
          if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            show();
          }
        }}
      />
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className="panel confirm-dialog"
            aria-label={'Chọn ' + label.toLowerCase()}
            onCancel={() => setOpen(false)}
          >
            <h2>Chọn tháng và năm</h2>
            <div className="period-controls">
              <label>
                Tháng
                <select
                  aria-label="Chọn tháng"
                  value={draft.slice(5)}
                  onChange={(e) =>
                    setDraft(draft.slice(0, 4) + '-' + e.target.value)
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
                Năm
                <YearSelect
                  aria-label="Chọn năm"
                  value={draft.slice(0, 4)}
                  onChange={(e) =>
                    setDraft(e.target.value + '-' + draft.slice(5))
                  }
                />
              </label>
            </div>
            <div className="actions">
              <button className="secondary" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button
                className="primary"
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                Áp dụng
              </button>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
