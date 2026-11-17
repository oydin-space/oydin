import type { SVGProps } from "react";

// Шестилепестковый цветок Oydin (temp-media/oydin icon.svg). Цвет — currentColor.
export function Flower(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 269 299" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <g fill="currentColor" stroke="currentColor" strokeWidth="22">
        <ellipse cx="209.903" cy="103.029" rx="50" ry="36.5" transform="rotate(-35 209.903 103.029)" />
        <ellipse cx="210.607" cy="196.185" rx="50" ry="36.5" transform="rotate(35 210.607 196.185)" />
        <ellipse cx="50" cy="36.5" rx="50" ry="36.5" transform="matrix(-0.819152 -0.573576 -0.573576 0.819152 119.601 101.809)" />
        <ellipse cx="50" cy="36.5" rx="50" ry="36.5" transform="matrix(-0.819152 0.573576 0.573576 0.819152 77.026 137.607)" />
        <ellipse cx="131.21" cy="61" rx="36.5" ry="50" />
        <ellipse cx="133.21" cy="238" rx="36.5" ry="50" />
      </g>
    </svg>
  );
}
