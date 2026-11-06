import { useFeedback } from '../Feedback.tsx';
import { useEffect, useRef, useState } from 'react';
import type { Draft } from '../api.ts';
import { request, errorText } from '../api.ts';
export default function DraftRevision({
  items,
  disabled,
  onChange,
  onBusy,
}: {
  items: Draft[];
  disabled: boolean;
  onChange: (items: Draft[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const notify = useFeedback().success;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      onBusy(false);
    };
  }, [onBusy]);
  return (
    <details className="draft-revision">
      <summary>Sửa bản nháp bằng câu nói</summary>
      <div className="quick-prompts">
        {[
          'tăng khoản 1 thêm 20k',
          'đổi sang ngày hôm qua',
          'đổi danh mục sang mua sắm',
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            className="prompt-chip"
            disabled={disabled || busy}
            onClick={() => setText(chip)}
          >
            ✦ {chip}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          onBusy(true);
          setNotice('');
          void request<{
            items: Draft[];
            needs_clarification: boolean;
            question: string;
          }>('/assistant/revise', 'POST', { message: text, items })
            .then((r) => {
              if (!mounted.current) return;
              if (!r.needs_clarification) {
                onChange(r.items);
                notify(r.question);
              } else setNotice(r.question);
            })
            .catch((e) => setNotice(errorText(e)))
            .finally(() => {
              if (mounted.current) {
                setBusy(false);
                onBusy(false);
              }
            });
        }}
      >
        <label>
          Yêu cầu sửa bản nháp
          <input
            maxLength={500}
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ví dụ: tăng khoản 1 thêm 20k"
            disabled={disabled || busy}
          />
        </label>
        <button className="secondary" disabled={disabled || busy}>
          {busy ? 'Đang sửa…' : 'Áp dụng vào bản nháp'}
        </button>
      </form>
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
