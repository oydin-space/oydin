// Always use the visitor's local clock: night 20:00–07:59, day 08:00–19:59.
(() => {
 const root=document.documentElement;
 const apply=()=>{
  const hour=new Date().getHours();
  const mode=hour>=20||hour<8?'night':'day';
  root.dataset.heroMode=mode;
  document.querySelectorAll('[data-hero-shift]').forEach(el=>el.textContent=(window.__oydinWords||{})[mode]||mode);
  const boundary=mode==='night'?'#FBE092':'#FEF1C5';
  document.querySelectorAll('.hero-block > .axle-divider i').forEach(el=>el.style.setProperty('--circle-color',boundary));
 };
 document.addEventListener('DOMContentLoaded',apply);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply();});
 setInterval(apply,60000);
 apply();
})();
