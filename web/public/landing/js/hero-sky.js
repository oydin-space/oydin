// Hero: sky parallax, and on wide screens the four cards that arrive around the phone as you scroll.
// Narrow screens and reduced motion get a static layout from hero.css (no inline card styles here).
(() => {
 const hero=document.querySelector('.hero-block'),story=hero?.querySelector('.hero-story');
 if(!story)return;
 const stage=story.querySelector('.hero-stage'),phone=story.querySelector('.phone'),sky=hero.querySelector('.hero-sky-sheet');
 const layout=story.querySelector('.brief-layout'),connectors=story.querySelector('.brief-connectors');
 if(!stage||!phone||!sky||!layout||!connectors)return;
 const cards=[...layout.querySelectorAll('.brief-source')],lines=[...connectors.querySelectorAll('.brief-connector')];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),compact=matchMedia('(max-width:900px)');
 const clamp=v=>Math.max(0,Math.min(1,v)),lerp=(a,b,t)=>a+(b-a)*t;
 const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
 const node={value:0,from:0,target:0,start:0};
 let frame=0,heroVisible=true;
 const request=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(render);};
 function render(time){
  frame=0;
  const still=reduced.matches||compact.matches;
  const top=story.getBoundingClientRect().top+scrollY,vh=innerHeight;
  const seen=clamp((scrollY-(top-64-vh*.1))/(vh*.5));
  // Sky parallax: the gradient travels with the first screen of scrolling, then rests.
  const skyHeight=Math.max(1587.3,vh*1.7637),freezeAt=Math.max(1,top-64+vh*.46);
  hero.style.setProperty('--sky-height',skyHeight+'px');
  sky.style.setProperty('--sky-y',(reduced.matches?0:-(skyHeight-vh)*clamp(scrollY/freezeAt)).toFixed(3)+'px');
  if(still){
   cards.forEach(c=>{c.style.opacity='';c.style.transform='';});
   lines.forEach(l=>{l.style.transform='';});
   connectors.classList.remove('is-pulsing');connectors.style.opacity='';
   return;
  }
  // Cards and connectors fade in over about 400 ms once the phone has been scrolled into place.
  const goal=seen>.12?1:0;
  if(goal!==node.target){node.from=node.value;node.target=goal;node.start=time;}
  node.value=lerp(node.from,node.target,ease((time-node.start)/700));
  const nodes=node.value,sceneScale=Math.min(1,innerWidth/1440,vh/900);
  stage.style.setProperty('--scene-scale',sceneScale.toFixed(4));
  connectors.style.opacity=String(clamp(nodes*1.4));
  connectors.classList.toggle('is-pulsing',heroVisible&&nodes>.01);
  cards.forEach((card,i)=>{
   const arrival=ease((nodes-i*.07)/.79);
   card.style.opacity=String(arrival);
   card.style.transform='translateY('+((1-arrival)*24)+'px) scale('+(Math.min(.9,sceneScale)*lerp(.97,1,arrival))+')';
  });
  // Connector geometry: from each card's badge-and-body midpoint to the phone edge.
  const box=stage.getBoundingClientRect(),l=layout.getBoundingClientRect(),scale=phone.clientWidth/456,phoneLeft=(box.width-phone.clientWidth)/2;
  cards.forEach((card,i)=>{
   const left=i%2===0,cardScale=Math.min(.9,sceneScale),badge=card.querySelector('.source-badge'),body=card.querySelector('.source-body');
   const badgeHeight=badge.offsetHeight+parseFloat(getComputedStyle(badge).marginBottom);
   const sourceTop=(i<2?163.5:505.5)*sceneScale;
   const x1=(left?l.left+356*cardScale:l.right-356*cardScale)-box.left;
   const y1=l.top-box.top+sourceTop+(badgeHeight+body.offsetHeight/2)*cardScale;
   const x2=phoneLeft+(left?24:426)*scale,y2=(i<2?388:570)*scale;
   const dx=x2-x1,dy=y2-y1;
   lines[i].style.transform='translate('+x1+'px,'+y1+'px) rotate('+Math.atan2(dy,dx)+'rad) scale('+Math.hypot(dx,dy)/172.711+','+Math.max(.4,sceneScale)+') translateY(-18.0652px)';
  });
  if(Math.abs(node.value-node.target)>.000001)request();
 }
 document.documentElement.classList.add('hero-scroll-stable');
 new IntersectionObserver(([entry])=>{heroVisible=entry.isIntersecting;request();}).observe(hero);
 addEventListener('scroll',request,{passive:true});addEventListener('resize',request,{passive:true});addEventListener('pageshow',request);document.addEventListener('visibilitychange',request);
 reduced.addEventListener('change',request);compact.addEventListener('change',request);new ResizeObserver(request).observe(phone);request();
})();
