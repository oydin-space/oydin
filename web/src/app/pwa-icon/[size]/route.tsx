import { ImageResponse } from "next/og";

const SIZES = new Set(["180", "192", "512"]);

// PNG-иконка PWA/Apple: белый цветок на #FFD62C (маскируемая, с запасом по краям).
export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(raw) ? Number(raw) : 512;
  const mark = Math.round(size * 0.52);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFD62C" }}>
        <svg width={mark} height={Math.round((mark * 299) / 269)} viewBox="0 0 269 299" fill="none">
          <g fill="white" stroke="white" strokeWidth="22">
            <ellipse cx="209.903" cy="103.029" rx="50" ry="36.5" transform="rotate(-35 209.903 103.029)" />
            <ellipse cx="210.607" cy="196.185" rx="50" ry="36.5" transform="rotate(35 210.607 196.185)" />
            <ellipse cx="50" cy="36.5" rx="50" ry="36.5" transform="matrix(-0.819152 -0.573576 -0.573576 0.819152 119.601 101.809)" />
            <ellipse cx="50" cy="36.5" rx="50" ry="36.5" transform="matrix(-0.819152 0.573576 0.573576 0.819152 77.026 137.607)" />
            <ellipse cx="131.21" cy="61" rx="36.5" ry="50" />
            <ellipse cx="133.21" cy="238" rx="36.5" ry="50" />
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
