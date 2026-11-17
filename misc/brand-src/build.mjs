// Oydin brand asset generator. HyperFrames compositions -> PNG stills / MP4.
// Usage (repo root): node misc/brand-src/build.mjs [name-filter]
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SRC, "../..");
const OUT_ICONS = join(ROOT, "web/public/icons");
const OUT_PUBLIC = join(ROOT, "web/public");
const OUT_BOT = join(ROOT, "deploy/bot-assets");
const WORK = join(ROOT, ".brand-build"); // gitignored scratch
const YELLOW = "#FFD62C";
const INK = "#4a3d1a";
const TAGLINE = "Финансовый пульс вашего бизнеса";

const FLOWER = `
<ellipse cx="209.903" cy="103.029" rx="50" ry="36.5" transform="rotate(-35 209.903 103.029)"/>
<ellipse cx="210.607" cy="196.185" rx="50" ry="36.5" transform="rotate(35 210.607 196.185)"/>
<ellipse cx="50" cy="36.5" rx="50" ry="36.5" transform="matrix(-0.819152 -0.573576 -0.573576 0.819152 119.601 101.809)"/>
<ellipse cx="50" cy="36.5" rx="50" ry="36.5" transform="matrix(-0.819152 0.573576 0.573576 0.819152 77.026 137.607)"/>
<ellipse cx="131.21" cy="61" rx="36.5" ry="50"/>
<ellipse cx="133.21" cy="238" rx="36.5" ry="50"/>`;

const defs = `
<filter id="crayon" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="w"/>
  <feDisplacementMap in="SourceGraphic" in2="w" scale="7" result="d"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="9" result="g"/>
  <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 2.05" result="ga"/>
  <feComposite in="d" in2="ga" operator="in"/>
</filter>
<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.7 0.35" numOctaves="2" seed="2"/>
  <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.95  0 0 0 -2.6 1.45"/>
</filter>`;

// Absolute-positioned SVG flower. s = rendered height in px.
const flower = (id, cx, cy, s, color = "#fff") => {
  const k = s / 299;
  const t = `translate(${cx - 134.5 * k} ${cy - 149.5 * k}) scale(${k})`;
  return `<svg id="${id}" class="fl" width="${s}" height="${s}" style="left:${cx - s / 2}px;top:${cy - s / 2}px" viewBox="${cx - s / 2} ${cy - s / 2} ${s} ${s}">
  <g filter="url(#crayon)"><g transform="translate(${s * 0.012} ${s * 0.018})" fill="#E9B400" stroke="#E9B400" stroke-width="22" opacity=".55"><g transform="${t}">${FLOWER}</g></g>
  <g fill="${color}" stroke="${color}" stroke-width="22"><g transform="${t}">${FLOWER}</g></g></g></svg>`;
};

const blob = (cx, cy, r, color, op = 0.55) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}" filter="url(#crayon)"/>`;

const backdrop = (w, h, soft = 1) => {
  const m = Math.min(w, h);
  return `<svg class="bg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${defs}</defs>
  <rect width="${w}" height="${h}" fill="${YELLOW}"/>
  ${blob(w * 0.05, h * 0.06, m * 0.32, "#FFD9C7", 0.8 * soft)}
  ${blob(w * 0.97, h * 0.1, m * 0.26, "#E0D6FA", 0.8 * soft)}
  ${blob(w * 0.02, h * 0.98, m * 0.28, "#CDEFDC", 0.8 * soft)}
  ${blob(w * 0.98, h * 0.96, m * 0.34, "#CBE6FA", 0.8 * soft)}
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity=".2"/></svg>`;
};

const page = ({ w, h, body, script = "", dur = 1 }) => `<!doctype html>
<html lang="ru"><head><meta charset="UTF-8"/><meta name="viewport" content="width=${w}, height=${h}"/>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
@font-face{font-family:"Onest";font-weight:700;src:url('assets/fonts/Onest-Bold.ttf')}
@font-face{font-family:"Onest";font-weight:500;src:url('assets/fonts/Onest-Medium.ttf')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:${YELLOW}}
#root{position:relative;width:${w}px;height:${h}px;font-family:"Onest",sans-serif;color:${INK}}
.bg,.fl,.abs{position:absolute}.bg{left:0;top:0}
.t{position:absolute;font-weight:700;letter-spacing:-.02em;line-height:1.08}
.ic{position:absolute;object-fit:contain}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${dur}" data-width="${w}" data-height="${h}">
${backdrop(w, h)}
${body}
</div>
<script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});
${script || `tl.to({}, {duration:${dur}});`}
window.__timelines["main"]=tl;tl.seek(0);</script></body></html>`;

// ---- scene builders ----
const icon = (size, ratio) => () => page({ w: size, h: size, body: flower("f", size / 2, size / 2, size * ratio) });
const splash = (w, h) => () => {
  const m = Math.min(w, h);
  return page({ w, h, body: flower("f", w / 2, h * 0.45, m * 0.3) +
    `<div class="t" style="left:0;width:${w}px;top:${h * 0.45 + m * 0.2}px;text-align:center;font-size:${m * 0.085}px;color:#fff;text-shadow:0 ${m*0.004}px 0 #E9B400">Oydin</div>` });
};
const og = () => page({ w: 1200, h: 630, body: `
  ${flower("f", 940, 315, 360)}
  <div class="t" style="left:80px;top:130px;font-size:64px;color:#fff;text-shadow:0 3px 0 #E9B400">Oydin</div>
  <div class="t" style="left:80px;top:230px;width:640px;font-size:68px">${TAGLINE}</div>
  <div class="t" style="left:80px;top:480px;font-size:30px;font-weight:500;opacity:.75">Второй мозг для малого бизнеса</div>` });

const ICONS = ["calendar", "pulse", "voice", "chat"];
const brandStrip = (x, y, s, gap, prefix = "i") =>
  ICONS.map((n, i) => `<img id="${prefix}${i}" class="ic" src="assets/icons/${n}.png" style="left:${x + i * (s + gap)}px;top:${y}px;width:${s}px;height:${s}px"/>`).join("");

const demo = () => page({ w: 640, h: 360, dur: 4, body: `
  ${flower("f", 150, 150, 210)}
  <div id="t1" class="t" style="left:290px;top:62px;font-size:48px;color:#fff;text-shadow:0 2px 0 #E9B400">Oydin</div>
  <div id="t2" class="t" style="left:290px;top:124px;width:320px;font-size:30px">${TAGLINE}</div>
  ${brandStrip(40, 268, 72, 20)}`,
  script: `tl.from("#f",{scale:0.2,rotation:-40,opacity:0,duration:.8,ease:"back.out(1.6)",transformOrigin:"50% 50%"},0)
 .from("#t1",{y:16,opacity:0,duration:.5,ease:"power2.out"},.5)
 .from("#t2",{y:16,opacity:0,duration:.5,ease:"power2.out"},.8)
 .from(["#i0","#i1","#i2","#i3"],{y:30,scale:.6,opacity:0,duration:.45,stagger:.25,ease:"back.out(1.8)"},1.3)
 .to({},{duration:4});` });

const cover = () => page({ w: 640, h: 360, body: `
  ${flower("f", 320, 118, 170)}
  <div class="t" style="left:0;width:640px;text-align:center;top:204px;font-size:30px">${TAGLINE}</div>
  ${brandStrip(320 - (4 * 56 + 3 * 18) / 2, 268, 56, 18)}` });

// name, out path, builder, w, h, extra
const ASSETS = [
  ["icon-192", OUT_ICONS, icon(192, 0.58)],
  ["icon-512", OUT_ICONS, icon(512, 0.58)],
  ["maskable-512", OUT_ICONS, icon(512, 0.4)],
  ["apple-touch-icon", OUT_ICONS, icon(180, 0.58)],
  ["favicon-48", OUT_ICONS, icon(48, 0.7)],
  ["og", OUT_PUBLIC, og],
  ["bot-avatar", OUT_BOT, icon(640, 0.55)],
  ["miniapp-cover", OUT_BOT, cover],
  ...[[1290, 2796], [1179, 2556], [1284, 2778], [1170, 2532], [1125, 2436], [828, 1792], [750, 1334]].map(
    ([w, h]) => [`splash-${w}x${h}`, OUT_ICONS, splash(w, h)]),
];

const only = process.argv[2];
const sh = (args) => execFileSync("bunx", ["hyperframes", ...args], { stdio: ["ignore", "pipe", "inherit"], cwd: WORK }).toString();

function project(name, html) {
  const dir = join(WORK, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "assets/fonts"), { recursive: true });
  mkdirSync(join(dir, "assets/icons"), { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
  writeFileSync(join(dir, "hyperframes.json"), JSON.stringify({ paths: { blocks: "compositions", components: "compositions/components", assets: "assets" } }));
  writeFileSync(join(dir, "meta.json"), JSON.stringify({ name }));
  for (const f of readdirSync(join(SRC, "fonts"))) cpSync(join(SRC, "fonts", f), join(dir, "assets/fonts", f));
  for (const n of ICONS) cpSync(join(ROOT, "web/public/brand/icons", `${n}.png`), join(dir, "assets/icons", `${n}.png`));
  return dir;
}
function still(name, html, dest, at = "0") {
  const dir = project(name, html);
  const out = join(dir, "snap");
  sh(["snapshot", dir, "--at", at, "--no-end", "-o", out]);
  const png = readdirSync(out).find((f) => f.endsWith(".png"));
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(out, png), dest);
  console.log("wrote", dest);
}

mkdirSync(WORK, { recursive: true });
for (const [name, outDir, build] of ASSETS) {
  if (only && !name.includes(only)) continue;
  still(name, build(), join(outDir, `${name}.png`));
}
if (!only || "demo".includes(only)) {
  const html = demo();
  still("bot-description", html, join(OUT_BOT, "bot-description.png"), "3.9");
  const dir = project("demo", html);
  sh(["render", dir, "--quality", "looks", "-o", join(OUT_BOT, "demo.mp4")]);
  console.log("wrote demo.mp4");
}
if (!only || "favicon".includes(only)) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(OUT_ICONS, "favicon-48.png"), join(OUT_PUBLIC, "favicon.ico")]);
  console.log("wrote favicon.ico");
}
