export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="ld-logo" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 269 299" width={size * 0.62} height={size * 0.62} fill="none">
        <g fill="#fff" stroke="#fff" strokeWidth="22">
          <ellipse cx="209.9" cy="103" rx="50" ry="36.5" transform="rotate(-35 209.9 103)" />
          <ellipse cx="210.6" cy="196.2" rx="50" ry="36.5" transform="rotate(35 210.6 196.2)" />
          <ellipse cx="50" cy="36.5" rx="50" ry="36.5" transform="matrix(-0.819152 -0.573576 -0.573576 0.819152 119.6 101.8)" />
          <ellipse cx="50" cy="36.5" rx="50" ry="36.5" transform="matrix(-0.819152 0.573576 0.573576 0.819152 77 137.6)" />
          <ellipse cx="131.2" cy="61" rx="36.5" ry="50" />
          <ellipse cx="133.2" cy="238" rx="36.5" ry="50" />
        </g>
      </svg>
    </span>
  );
}
