(() => {
 if (window.mooninScroll) return;
 const desktop = matchMedia('(min-width:801px) and (hover:hover) and (pointer:fine)');
 const reduced = matchMedia('(prefers-reduced-motion:reduce)');
 const hero = document.querySelector('.home-page .hero-block');
 // Map wheel distance through the hero at the configurable speed, including
 // gestures crossing its boundary. All distance beyond the hero remains 1:1.
 const heroWheel = input => {
  if (!hero || input.event.ctrlKey || !input.deltaY) return;
  const speed = Number(hero.dataset.scrollSpeed) || 1;
  if (speed <= 0 || speed >= 1) return;
  const start = hero.getBoundingClientRect().top + window.scrollY;
  const end = start + hero.offsetHeight;
  const toWheel = y => y <= start ? y : y < end ? start + (y - start) / speed : start + (end - start) / speed + y - end;
  const wheelEnd = start + (end - start) / speed;
  const fromWheel = y => y <= start ? y : y < wheelEnd ? start + (y - start) * speed : end + y - wheelEnd;
  const position = instance?.targetScroll ?? window.scrollY;
  input.deltaY = fromWheel(toWheel(position) + input.deltaY) - position;
 };
 let instance = null, frame = 0, loading = null, disposed = false, inPage = true, paused = false;
 const destroy = () => {cancelAnimationFrame(frame); frame = 0; instance?.destroy(); instance = null;};
 const tick = time => {if (!instance || document.hidden) return; instance.raf(time); frame = requestAnimationFrame(tick);};
 const load = () => loading ||= new Promise(resolve => {
  if (window.Lenis) {resolve(true); return;}
  const script = document.createElement('script');
  script.src = '/landing/js/lenis-1.3.27.min.js'; // Self-hosted copy of lenis@1.3.27 (MIT).
  script.async = true;
  script.onload = () => resolve(!!window.Lenis);
  script.onerror = () => resolve(false); // Native scrolling remains fully usable.
  document.head.append(script);
 });
 const update = async () => {
  if (disposed || !inPage || !desktop.matches || reduced.matches) {destroy(); return;}
  if (instance || !await load() || disposed || !inPage || !desktop.matches || reduced.matches || instance) return;
  instance = new Lenis({lerp:.1, smoothWheel:true, syncTouch:false, autoRaf:false, anchors:false,
   stopInertiaOnNavigate:true, virtualScroll:heroWheel,
   prevent: node => node.hasAttribute?.('data-lenis-prevent') || node.closest?.('#manifesto-dialog, [role="dialog"], .booking-calendar, .features')
  });
  if (paused) instance.stop();
  if (!document.hidden) frame = requestAnimationFrame(tick);
 };
 const reconcile = () => {if (instance) {instance.resize(); instance.scrollTo(window.scrollY,{immediate:true,force:true});}};
 const visibility = () => {cancelAnimationFrame(frame); frame = 0; if (!document.hidden && instance) {reconcile();frame=requestAnimationFrame(tick);}};
 const pagehide = () => {inPage=false;destroy();};
 const pageshow = () => {inPage=true;update();};
 const restore = () => requestAnimationFrame(reconcile);
 // While a link scrolls the page, scroll-driven scenes (the hero) let it pass instead of holding it.
 let navigating = false, navigationTimer = 0;
 const arrive = () => {navigating = false; clearTimeout(navigationTimer);};
 const navigate = () => {navigating = true; clearTimeout(navigationTimer); navigationTimer = setTimeout(arrive, 2500);};
 window.mooninScroll = {
  to(target, immediate = false) {
   if (!immediate) navigate();
   if (instance) {instance.scrollTo(target,{immediate:immediate || reduced.matches,force:true,lerp:.1,onComplete:immediate ? undefined : arrive}); return;}
   if (!immediate) addEventListener('scrollend', arrive, {once:true});
   const behavior = immediate || reduced.matches ? 'instant' : 'smooth';
   if (typeof target === 'number') window.scrollTo({top:target,behavior});
   else target.scrollIntoView({behavior,block:'start'});
  },
  get navigating() {return navigating;},
  pause() {paused=true;instance?.stop();}, resume() {paused=false;instance?.start(); reconcile();},
  destroy() {disposed=true;destroy();desktop.removeEventListener('change',update);reduced.removeEventListener('change',update);document.removeEventListener('visibilitychange',visibility);removeEventListener('pagehide',pagehide);removeEventListener('pageshow',pageshow);removeEventListener('popstate',restore);removeEventListener('hashchange',restore);delete window.mooninScroll;}
 };
 desktop.addEventListener('change',update);reduced.addEventListener('change',update);
 document.addEventListener('visibilitychange',visibility);
 addEventListener('pagehide',pagehide);addEventListener('pageshow',pageshow);
 addEventListener('popstate',restore);addEventListener('hashchange',restore);
 update();
})();
