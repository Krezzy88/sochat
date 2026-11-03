export function Mascot() {
  return (
    <div className="mascot-scene" aria-hidden="true">
      <span className="sticker sticker-a">Ủa, tiền đi đâu?</span>
      <svg
        className="mascot"
        width="160"
        height="154"
        viewBox="0 0 160 154"
        fill="none"
      >
        <ellipse cx="82" cy="144" rx="52" ry="7" fill="#233c3422" />
        <path
          className="mascot-arm"
          d="M122 75q24-28 28-13m-7 5 5-12"
          stroke="#233c34"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="m37 83-22 12m45 30-5 15m48-15 7 15"
          stroke="#233c34"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <rect
          x="34"
          y="14"
          width="94"
          height="116"
          rx="23"
          fill="#ffda7c"
          stroke="#233c34"
          strokeWidth="4"
        />
        <rect
          x="42"
          y="14"
          width="86"
          height="108"
          rx="18"
          fill="#bde5d0"
          stroke="#233c34"
          strokeWidth="4"
        />
        <path
          d="M61 34h46M61 44h31"
          stroke="#68987b"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <g className="mascot-eyes">
          <ellipse cx="67" cy="68" rx="5" ry="7" fill="#233c34" />
          <ellipse cx="103" cy="68" rx="5" ry="7" fill="#233c34" />
        </g>
        <ellipse cx="56" cy="80" rx="9" ry="5" fill="#f2a18c" />
        <ellipse cx="114" cy="80" rx="9" ry="5" fill="#f2a18c" />
        <path
          d="M76 83q9 12 18 0"
          stroke="#233c34"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="m80 101 5 5 9-9"
          stroke="#233c34"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sticker sticker-b">Ghi lại cái đã ✦</span>
    </div>
  );
}
