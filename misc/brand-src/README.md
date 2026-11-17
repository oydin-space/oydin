# Oydin brand sources

Все PNG/MP4 бренда генерируются из HyperFrames-композиций (HTML → кадр), логотип — белый цветок на #FFD62C.

```
node misc/brand-src/build.mjs          # все ассеты
node misc/brand-src/build.mjs og       # только ассеты, чьё имя содержит "og"
```

Нужны Node 22+, bun (`bunx hyperframes`), FFmpeg, интернет для GSAP CDN. Сцены собираются во временной папке `.brand-build/` (в .gitignore).
Шрифт Onest лежит в `fonts/`; иконки-мелки берутся из `web/public/brand/icons`.

Результат:
- `web/public/icons/` — icon-192/512, maskable-512, apple-touch-icon, favicon-48/.svg, splash-*.png (iPhone), `web/public/favicon.ico`, `web/public/og.png` (1200×630)
- `deploy/bot-assets/` — bot-avatar (640²), bot-description и miniapp-cover (640×360), demo.mp4 (4 с)

`web/public/icons/favicon.svg` нарисован вручную (не генерируется).
