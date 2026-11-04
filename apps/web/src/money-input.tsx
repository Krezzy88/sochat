import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
export const digitsOnly = (text: string) => text.replace(/[.\s]/g, '');
export const grouped = (text: string) =>
  text.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export function MoneyInput({
  name = 'amount_vnd',
  label = 'Số tiền (đ)',
  value,
  defaultValue = '',
  onChange,
}: {
  name?: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const [local, setLocal] = useState(defaultValue);
  const raw = value ?? local;
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caret.current !== null) {
      let n = caret.current,
        pos = 0;
      for (const ch of el.value) {
        if (n === 0) break;
        if (/\d/.test(ch)) n--;
        pos++;
      }
      el.setSelectionRange(pos, pos);
      caret.current = null;
    }
  }, [raw]);
  useEffect(() => {
    const form = ref.current?.form;
    const reset = () => setLocal(defaultValue);
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [defaultValue]);
  return (
    <div className="money-field">
      <label htmlFor={id}>{label}</label>
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        required
        value={grouped(raw)}
        placeholder="Ví dụ: 50.000"
        aria-describedby={id + '-hint'}
        onChange={(e) => {
          const next = digitsOnly(e.target.value);
          if (!/^\d{0,12}$/.test(next)) return;
          caret.current = digitsOnly(
            e.target.value.slice(0, e.target.selectionStart ?? 0),
          ).length;
          setLocal(next);
          onChange?.(next);
        }}
        onInput={(e) => {
          const raw = digitsOnly(e.currentTarget.value);
          e.currentTarget.setCustomValidity(
            raw && (!/^[1-9]\d*$/.test(raw) || BigInt(raw) > 100000000000n)
              ? 'Nhập số tiền từ 1 đến 100.000.000.000 đồng.'
              : '',
          );
        }}
      />
      <input type="hidden" name={name} value={raw} />
      <small id={id + '-hint'} className="money-hint">
        Đơn vị đồng · Ví dụ 50.000 = năm mươi nghìn
      </small>
    </div>
  );
}
