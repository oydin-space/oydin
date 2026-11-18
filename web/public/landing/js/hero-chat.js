// The Read Aloud control over the phone speaks the page's summary with the browser's speech synthesis.
(() => {
 const story=document.querySelector('.hero-story');
 const button=document.querySelector('.hero-read-aloud');
 if(!story||!button)return;
 const synth=window.speechSynthesis;
 const bus=new EventTarget();
 const audio={paused:true,ended:false,currentTime:0,
  addEventListener:(t,f)=>bus.addEventListener(t,f),
  pause(){if(synth)synth.cancel();this.paused=true;bus.dispatchEvent(new Event('pause'));},
  play(){
   if(!synth)return Promise.reject(new Error('no speech'));
   synth.cancel();
   const u=new SpeechSynthesisUtterance(story.dataset.speechText||'');
   u.lang=story.dataset.speechLang||'ru-RU';
   const stop=()=>{audio.paused=true;audio.ended=true;bus.dispatchEvent(new Event('ended'));};
   u.onend=stop;u.onerror=()=>{audio.paused=true;bus.dispatchEvent(new Event('error'));};
   audio.paused=false;audio.ended=false;synth.speak(u);bus.dispatchEvent(new Event('play'));
   return Promise.resolve();
  }};
 const update=()=>{
  const playing=!audio.paused&&!audio.ended;
  const labels=(document.querySelector('.hero')||{}).dataset||{};
  button.setAttribute('aria-pressed',String(playing));
  button.setAttribute('aria-label',(playing?labels.pauseLabel:labels.playLabel)||button.getAttribute('aria-label')||'');
 };
 button.addEventListener('click',()=>{
  if(!audio.paused){audio.pause();return;}
  if(audio.ended)audio.currentTime=0;
  audio.play().catch(update);
 });
 ['play','pause','ended','error'].forEach(event=>audio.addEventListener(event,update));
 addEventListener('pagehide',()=>audio.pause());update();
})();
