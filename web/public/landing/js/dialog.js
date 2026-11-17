const manifesto=document.querySelector('#manifesto-dialog');
const pageShell=document.querySelector('.page-shell');
let manifestoTrigger,manifestoScroll=0,manifestoClosing=false,manifestoFrame=0;
function openManifesto(event){
 if(!manifesto.hidden)return;
 window.mooninScroll?.pause();
 manifestoTrigger=event.currentTarget;manifestoScroll=window.scrollY;
 document.body.style.setProperty('--page-offset',-manifestoScroll+'px');
 pageShell.inert=true;document.body.classList.add('manifesto-open');manifesto.hidden=false;
 manifesto.scrollTop=0;
 manifesto.getBoundingClientRect();
 manifestoFrame=requestAnimationFrame(()=>document.body.classList.add('manifesto-visible'));
 manifesto.querySelector('.dialog-close').focus({preventScroll:true});
}
function closeManifesto(){
 if(manifestoClosing||manifesto.hidden)return;
 manifestoClosing=true;cancelAnimationFrame(manifestoFrame);document.body.classList.remove('manifesto-visible');
 let exitTimer;
 const paper=manifesto.querySelector(".manifesto-paper");
 const onEnd=event=>{if(event.target===paper&&event.propertyName==="transform")finish();};
 const finish=()=>{
  clearTimeout(exitTimer);paper.removeEventListener("transitionend",onEnd);
  manifesto.hidden=true;document.body.classList.remove('manifesto-open');pageShell.inert=false;
  document.body.style.removeProperty('--page-offset');
  window.mooninScroll?.resume();
  if(window.mooninScroll?.to)window.mooninScroll.to(manifestoScroll,true);else window.scrollTo({top:manifestoScroll,behavior:'instant'});
  manifestoTrigger?.focus({preventScroll:true});manifestoClosing=false;
 };
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();else{
  paper.addEventListener('transitionend',onEnd);
  const duration=Math.max(...getComputedStyle(paper).transitionDuration.split(',').map(value=>value.trim().endsWith('ms')?parseFloat(value):parseFloat(value)*1000));
  exitTimer=setTimeout(finish,duration+60);
 }
}
for(const button of document.querySelectorAll('#manifesto-link,#footer-manifesto,#floating-manifesto'))button.addEventListener('click',openManifesto);
manifesto.querySelector('.dialog-close').addEventListener('click',closeManifesto);
manifesto.addEventListener('click',event=>{if(event.target===manifesto)closeManifesto();});
document.addEventListener('keydown',event=>{
 if(manifesto.hidden)return;
 if(event.key==='Escape'){event.preventDefault();closeManifesto();}
 if(event.key==='Tab'){event.preventDefault();manifesto.querySelector('.dialog-close').focus();}
});
