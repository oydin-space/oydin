// Animate only the height that changes; cancel and retarget on rapid toggles.
(() => {
 const panel=document.querySelector('.product-panel');
 if(!panel)return;
 const mobile=matchMedia('(max-width:800px)');
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let animation=null,contentAnimation=null,run=0;
 window.mooninPanelChange=(change,expanded)=>{
  const id=++run,from=panel.getBoundingClientRect().height;
  animation?.cancel();animation=null;contentAnimation?.cancel();contentAnimation=null;
  change();
  if(!mobile.matches||reduced.matches)return;
  const to=panel.getBoundingClientRect().height;
  if(Math.abs(to-from)>1){
   animation=panel.animate([{height:`${from}px`,minHeight:'0px'},{height:`${to}px`,minHeight:'0px'}],{duration:420,easing:'cubic-bezier(.4,0,.2,1)'});
   const current=animation;
   current.onfinish=()=>{if(id===run){animation=null;current.cancel();}};
  }
  const content=panel.querySelector(expanded?'.mobile-feature-summary':'.features');
  contentAnimation=content?.animate([{opacity:0,translate:'0 5px'},{opacity:1,translate:'0 0'}],{duration:260,delay:expanded?80:0,easing:'cubic-bezier(.25,.1,.25,1)',fill:'backwards'});
 };
 const reset=()=>{++run;animation?.cancel();contentAnimation?.cancel();animation=null;contentAnimation=null;};
 mobile.addEventListener('change',reset);reduced.addEventListener('change',reset);
})();
