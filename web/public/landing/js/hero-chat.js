// Both Read Aloud controls play the brief's recorded narration. Each visit hears one of
// the VoiceLab voices at random; the takes are loudness-matched in assets/morning-brief/.
(() => {
 const story=document.querySelector('.hero-story');
 const read=document.querySelector('.hero-read-aloud');
 const reader=document.querySelector('.reader-audio');
 const buttons=[read,reader];
 const synth=window.speechSynthesis;
 const bus=new EventTarget();
 const audio={paused:true,ended:false,currentTime:0,
  addEventListener:(t,f)=>bus.addEventListener(t,f),
  pause(){if(synth)synth.cancel();this.paused=true;bus.dispatchEvent(new Event('pause'));},
  play(){
   if(!synth||!story)return Promise.reject(new Error('no speech'));
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
  buttons.forEach(button=>{
   button.setAttribute('aria-pressed',String(playing));
   const labels=(document.querySelector('.hero')||{}).dataset||{};
   button.setAttribute('aria-label',(playing?labels.pauseLabel:labels.playLabel)||button.getAttribute('aria-label')||'');
  });
 };
 buttons.forEach(button=>button.addEventListener('click',()=>{
  if(!audio.paused){audio.pause();return;}
  if(audio.ended)audio.currentTime=0;
  audio.play().catch(update);
 }));
 ['play','pause','ended','error'].forEach(event=>audio.addEventListener(event,update));
 story.addEventListener('hero-progress',event=>{
  read.disabled=!event.detail.brief||event.detail.expansion>.0001;
  reader.disabled=event.detail.docking<.98;
 });
 addEventListener('pagehide',()=>audio.pause());update();
})();
