// One phone: chat, source reveal, in-place reader expansion, fresh-scroll reading.
(() => {
 const hero=document.querySelector('.hero-block'),story=hero?.querySelector('.hero-story');
 if(!story)return;
 document.documentElement.classList.add('hero-scroll-stable');
 const stage=story.querySelector('.hero-stage'),phone=story.querySelector('.phone'),wrap=story.querySelector('.phone-wrap');
 const motion=story.querySelector('.brief-motion-layer'),reader=story.querySelector('.brief-reader'),morph=story.querySelector('.brief-morph');
 const title=story.querySelector('.brief-title-flight'),date=story.querySelector('.brief-date-flight');
 const body=story.querySelector('.reader-body'),bodyWindow=story.querySelector('.reader-body-window');
 const sky=hero.querySelector('.hero-sky-sheet'),layout=story.querySelector('.brief-layout');
 const revealItems=[...story.querySelectorAll('[data-reader-reveal]')];
 const revealDelays={lead:0,divider:40,attention:90,overview:140,issues:190,sources:240,footer:290};
 const REVEAL_DURATION=400,CONTENT_DURATION=290+REVEAL_DURATION;
 const sources=story.querySelector('.brief-sources'),cards=[...sources.querySelectorAll('.brief-source')];
 const connectors=story.querySelector('.brief-connectors'),lines=[...connectors.querySelectorAll('.brief-connector')];
 const masks=[...story.querySelectorAll('[data-hero-step]')],reveal=story.querySelector('.hero-chat-reveal'),typing=story.querySelector('.hero-typing');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const clamp=v=>Math.max(0,Math.min(1,v)),lerp=(a,b,t)=>a+(b-a)*t;
 const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
 const easeOut=v=>1-Math.pow(1-clamp(v),3);
 const smooth=v=>{v=clamp(v);return v<.5?4*v*v*v:1-Math.pow(-2*v+2,3)/2;};
 const states={nodes:{value:0,from:0,target:0,start:0},expand:{value:0,from:0,target:0,start:0}};
 // The chat plays itself like a conversation, with typing dots before Moonin replies. Scrolling
 // ahead hurries it, but each beat keeps a minimum gap so messages never pop in together.
 // at: ms after load; seen: scroll progress that makes the beat due early; gap: ms since the last beat.
 const beats=[{at:300,seen:.03,gap:0,show:0},{at:1300,seen:.075,gap:380,show:1},{at:1900,seen:.12,gap:300,typing:true},
  {at:3000,seen:.15,gap:650,show:2},{at:3550,seen:.24,gap:380,show:3},{at:4200,seen:.33,gap:380,show:4}];
 const BRIEF_BEAT=5;
 const chat={done:0,last:-1e4,start:null,timer:0};
 function playBeat(beat){
  if(beat.typing)typing.classList.add('is-visible');
  else{if(beat.show===2)typing.classList.remove('is-visible');masks[beat.show].classList.add('is-visible');}
 }
 function finishChat(){while(chat.done<beats.length)playBeat(beats[chat.done++]);typing.classList.remove('is-visible');}
 function chatTick(time){
  if(chat.start===null)chat.start=time;
  while(chat.done<beats.length){
   const beat=beats[chat.done];
   if((time-chat.start<beat.at&&seen<beat.seen)||time-chat.last<beat.gap)break;
   playBeat(beat);chat.done++;chat.last=time;
  }
  clearTimeout(chat.timer);
  if(chat.done<beats.length){
   const beat=beats[chat.done];
   const wait=Math.max(chat.last+beat.gap-time,seen>=beat.seen?0:chat.start+beat.at-time);
   chat.timer=setTimeout(request,Math.max(16,wait));
  }
 }
 let frame=0,seen=-1,nodesGoal=0,expandGoal=0,initialized=false,lockY=null,touching=false,heroVisible=true;
 let expandedAt=0,readerAnchor=null,freshInput=false,contentStarted=null,detailPosition=0,closedAt=0;
 const mobileView=()=>matchMedia('(max-width:700px)').matches;
 const timing=()=>mobileView()?{open:.43,close:.32}:{open:1,close:.82};
 const metrics=()=>{const rect=story.getBoundingClientRect();return {top:rect.top+scrollY,vh:innerHeight};};
 const request=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(render);};
 function tween(s,target,time,duration){if(target!==s.target){s.from=s.value;s.target=target;s.start=time;}s.value=lerp(s.from,s.target,smooth((time-s.start)/duration));return s.value;}
 function hold(target=1){
  if(lockY!==null||reduced.matches)return;
  const m=metrics(),t=timing();
  lockY=m.top-64+m.vh*(target?t.open+.001:t.close-.001);
  expandedAt=closedAt=0;freshInput=false;expandGoal=target;
  if(target){readerAnchor=null;contentStarted=null;detailPosition=0;nodesGoal=mobileView()?0:1;}
  // Cancel pending momentum without stopping Lenis or hiding the scrollbar.
  window.mooninScroll?.to(lockY,true);request();
 }
 function release(){const y=lockY;lockY=null;if(y!==null)window.mooninScroll?.to(y,true);}
 // A link, key or find-in-page jump that lands past a threshold finishes the scene in place
 // rather than pulling the visitor back to it.
 function settle(target,time){
  const m=metrics(),t=timing();
  expandGoal=target;expandedAt=closedAt=0;freshInput=false;
  if(!target)return;
  nodesGoal=mobileView()?0:1;
  Object.assign(states.nodes,{value:nodesGoal,from:nodesGoal,target:nodesGoal});Object.assign(states.expand,{value:1,from:1,target:1});
  readerAnchor=m.top-64+m.vh*(t.open+.001);expandedAt=time;contentStarted=time-CONTENT_DURATION;
  finishChat();
 }
 function wheel(event){
  if(event.ctrlKey||reduced.matches)return;
  const m=metrics(),t=timing(),at=m.top-64+m.vh*t.open,back=m.top-64+m.vh*t.close;
  if(lockY!==null){event.preventDefault();event.stopImmediatePropagation();return;}
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?m.vh:1);
  if((delta>0&&expandGoal===0&&scrollY<at&&scrollY+delta>=at)||(delta<0&&expandGoal===1&&scrollY>back&&scrollY+delta<=back)){
   event.preventDefault();event.stopImmediatePropagation();hold(delta>0?1:0);return;
  }
  if(states.expand.value>.999&&readerAnchor!==null)freshInput=true;
 }
 addEventListener('wheel',wheel,{passive:false,capture:true});
 addEventListener('touchstart',()=>{touching=true;if(readerAnchor!==null&&lockY===null)freshInput=true;},{passive:true});
 addEventListener('touchend',()=>{touching=false;request();},{passive:true});
 addEventListener('touchcancel',()=>{touching=false;request();},{passive:true});
 addEventListener('touchmove',event=>{if(lockY!==null)event.preventDefault();},{passive:false});
 function onScroll(){
  if(lockY!==null&&Math.abs(scrollY-lockY)>1)window.mooninScroll?.to(lockY,true);
  else if(readerAnchor!==null&&expandedAt&&performance.now()-expandedAt>120&&Math.abs(scrollY-readerAnchor)>1)freshInput=true;
  // Below the hero nothing it draws is visible; the observer renders once on the way out and back in.
  if(heroVisible||lockY!==null)request();
 }
 function render(time){
  frame=0;
  const m=metrics(),scene=story.getBoundingClientRect(),box=stage.getBoundingClientRect();
  const mobile=mobileView(),t=timing();
  const phase=Math.max(0,((lockY??scrollY)-m.top+64)/m.vh);
  if(!initialized){
   initialized=true;
   if(phase>t.open)settle(1,time);
  }
  if(mobile)nodesGoal=0;
  else if(phase>.46)nodesGoal=1;else if(phase<.30)nodesGoal=0;
  if(lockY===null){
   // Scrolling across a threshold holds; a link scroll or a jump of more than half a screen settles.
   const jumped=y=>window.mooninScroll?.navigating||Math.abs(scrollY-y)>m.vh*.5;
   if(phase>t.open&&expandGoal===0)jumped(m.top-64+m.vh*t.open)?settle(1,time):hold(1);
   else if(phase<t.close&&expandGoal===1)jumped(m.top-64+m.vh*t.close)?settle(0,time):hold(0);
  }
  const nodes=reduced.matches?0:tween(states.nodes,nodesGoal,time,480);
  const briefReady=chat.done>=BRIEF_BEAT;
  const expansion=reduced.matches?0:tween(states.expand,(mobile||nodes>.999)&&briefReady?expandGoal:0,time,760);
  if(expansion>.5&&expandGoal===1&&contentStarted===null)contentStarted=time;
  if(expansion<.00001&&expandGoal===0){contentStarted=null;detailPosition=0;readerAnchor=null;if(!closedAt)closedAt=time;}
  const contentElapsed=contentStarted===null?-10000:time-contentStarted;
  const contentComplete=contentElapsed>=CONTENT_DURATION;
  revealItems.forEach(el=>{
   const amount=contentStarted===null?0:easeOut((contentElapsed-revealDelays[el.dataset.readerReveal])/REVEAL_DURATION);
   const visible=amount*ease(expansion/.88);
   el.style.opacity=String(visible);
   el.style.transform=amount>=1?'none':'translateY('+((1-amount)*12)+'px)';
   el.style.filter=amount>=1?'none':'blur('+((1-amount)*2)+'px)';
  });
  if(expansion>.99999&&contentComplete&&expandGoal===1&&!expandedAt){expandedAt=time;readerAnchor=lockY??scrollY;freshInput=false;}
  const settled=expandGoal?expandedAt:closedAt;
  // The hold lasts only as long as the animation. Continued scrolling (a steady wheel, trackpad
  // momentum) must not extend it, or the page stops responding for as long as the visitor scrolls.
  if(lockY!==null&&settled&&time-settled>80&&!touching){if(expandGoal)readerAnchor=lockY;release();}
  const bodyStart=(readerAnchor??m.top-64+m.vh*(t.open+.001))+m.vh*.04;
  if(!reduced.matches&&expansion>.99999&&contentComplete&&lockY===null&&freshInput)detailPosition=clamp((scrollY-bodyStart)/(m.vh*.48));
  const detailProgress=reduced.matches?0:detailPosition;
  // The full phone height is reserved in the sticky stage. At the end it
  // leaves naturally with the section, rather than being lifted through a clip.
  const scale=phone.clientWidth/450;
  const phoneHeight=phone.getBoundingClientRect().height;
  stage.style.setProperty('--phone-height',phoneHeight+'px');
  if(!reduced.matches)story.style.height=(Math.max(mobile?0:m.vh-64,phoneHeight)+m.vh*(t.open+.04+.48+.08))+'px';
  else story.style.removeProperty('height');
  wrap.style.setProperty('--phone-y','0px');
  motion.style.transform='scale('+scale+')';
  const exitProgress=ease((64-stage.getBoundingClientRect().top)/Math.max(1,phone.clientHeight));
  seen=reduced.matches?1:Math.max(seen,phase);
  reveal.classList.add('is-playing');
  if(reduced.matches)finishChat();else chatTick(time);
  masks[3].classList.toggle('is-lifted',expansion>.0001);
  const scrollDistance=Math.max(0,parseFloat(getComputedStyle(body).height)-bodyWindow.clientHeight);
  body.style.setProperty('--reader-scroll',String(detailProgress*scrollDistance));
  reader.style.opacity=String(ease(expansion/.75));
  reader.style.clipPath='inset('+lerp(362,0,expansion)+'px '+lerp(115,0,expansion)+'px '+lerp(256,0,expansion)+'px '+lerp(15,0,expansion)+'px round '+lerp(25,62,expansion)+'px)';
  reader.inert=expansion<.999;reader.setAttribute('aria-hidden',String(expansion<.1));
  morph.style.left=lerp(39,24,expansion)+'px';morph.style.top=lerp(385,23,expansion)+'px';morph.style.width=lerp(272,402,expansion)+'px';
  morph.style.height=lerp(258,876,expansion)+'px';morph.style.borderRadius=lerp(25,62,expansion)+'px';
  morph.style.opacity=expansion>.0001?String(1-ease(expansion/.85)):'0';
  const sourceScale=272/356,blend=ease(expansion/.82);
  title.style.opacity=date.style.opacity=expansion>.0001?'1':'0';
  title.style.transform='translate('+lerp(39+24.9*sourceScale,40,expansion)+'px,'+lerp(385+20*sourceScale,139,expansion)+'px)';
  date.style.transform='translate('+lerp(39+24.9*sourceScale,40,expansion)+'px,'+lerp(385+55*sourceScale,180,expansion)+'px)';
  title.querySelector('.source-title-crop').style.transform='scale('+lerp(sourceScale,34/28,expansion)+')';
  date.querySelector('.source-date-crop').style.transform='scale('+lerp(sourceScale,15/17,expansion)+')';
  title.querySelector('.reader-title-copy').style.transform='scale('+lerp(28*sourceScale/34,1,expansion)+')';
  date.querySelector('.reader-date-copy').style.transform='scale('+lerp(17*sourceScale/15,1,expansion)+')';
  for(const el of [title,date]){el.querySelector('span').style.opacity=String(1-blend);el.querySelector(':scope>img').style.opacity=String(blend);}
  const visibility=mobile?0:1;
  const alpha=nodes*visibility;
  const sceneScale=Math.min(1,innerWidth/1440,innerHeight/900);stage.style.setProperty('--scene-scale',String(sceneScale));
  sources.setAttribute('aria-hidden',String(alpha<.1));connectors.style.opacity=mobile?'0':String(alpha);
  // The glow repaints every frame, so it runs only while the connectors can be seen.
  connectors.classList.toggle('is-pulsing',heroVisible&&!mobile&&alpha>.01);
  cards.forEach((card,i)=>{const arrival=ease((nodes-i*.07)/.79);card.style.opacity=String(arrival*visibility);card.style.transform='translateY('+((1-arrival)*24)+'px) scale('+((mobile?1:Math.min(.9,sceneScale))*lerp(.97,1,arrival))+')';});
  // Fixed diagram geometry: neither end follows the brief, reader or phone.
  if(!mobile){
   const l=layout.getBoundingClientRect(),phoneLeft=(box.width-phone.clientWidth)/2;
   cards.forEach((card,i)=>{
    const left=i%2===0,cardScale=Math.min(.9,sceneScale),badge=card.querySelector('.source-badge'),sourceBody=card.querySelector('.source-body');
    const badgeHeight=badge.offsetHeight+parseFloat(getComputedStyle(badge).marginBottom);
    const sourceTop=(i<2?163.5:505.5)*sceneScale;
    const x1=(left?l.left+356*cardScale:l.right-356*cardScale)-box.left;
    const y1=l.top-box.top+sourceTop+(badgeHeight+sourceBody.offsetHeight/2)*cardScale;
    const x2=phoneLeft+(left?24:426)*scale,y2=(i<2?388:570)*scale;
    const dx=x2-x1,dy=y2-y1;
    lines[i].style.transform='translate('+x1+'px,'+y1+'px) rotate('+Math.atan2(dy,dx)+'rad) scale('+Math.hypot(dx,dy)/172.711+','+Math.max(.4,sceneScale)+') translateY(-18.0652px)';
   });
  }
  // Restore the original gradient's initial scroll travel, then hold that image.
  // Its dimensions and stop colors never change during the reader expansion.
  const skyHeight=Math.max(1587.3,m.vh*1.7637),freezeAt=Math.max(1,m.top-64+m.vh*.46);
  const skyY=reduced.matches?0:-(skyHeight-m.vh)*clamp(scrollY/freezeAt);
  hero.style.setProperty('--sky-height',skyHeight+'px');sky.style.setProperty('--sky-y',skyY.toFixed(3)+'px');
  Object.assign(story.dataset,{phase:phase.toFixed(4),nodes:nodes.toFixed(4),expansion:expansion.toFixed(4),docking:expansion.toFixed(4),detailProgress:detailProgress.toFixed(4),detailScroll:(detailProgress*scrollDistance).toFixed(3),exitProgress:exitProgress.toFixed(4),phoneLift:'0.000',scrollHeld:String(lockY!==null),readerAnchor:String(readerAnchor??''),skyFrozen:String(scrollY>=freezeAt),contentReveal:clamp(contentElapsed/CONTENT_DURATION).toFixed(4)});
  story.dispatchEvent(new CustomEvent('hero-progress',{detail:{seen,brief:chat.done>=BRIEF_BEAT,expansion,docking:expansion,detailProgress,exitProgress}}));
  const moving=Object.values(states).some(s=>Math.abs(s.value-s.target)>.000001)||(expandGoal&&nodes>.999&&expansion<1);
  if(!reduced.matches&&(moving||lockY!==null||(contentStarted!==null&&!contentComplete&&expansion>.01)))request();
 }
 new IntersectionObserver(([entry])=>{heroVisible=entry.isIntersecting;request();}).observe(hero);
 addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',request,{passive:true});addEventListener('pageshow',request);document.addEventListener('visibilitychange',request);
 reduced.addEventListener('change',()=>{if(lockY!==null)release();request();});new ResizeObserver(request).observe(phone);request();
})();
