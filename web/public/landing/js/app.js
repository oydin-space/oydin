const options=[...document.querySelectorAll('[data-feature]')];
const mockups=[...document.querySelectorAll('.feature-mockup')];
const cardAnimations=new Map();
const featureMobile=matchMedia('(max-width:800px)');
const featurePanel=document.querySelector('.product-panel');
const mobileSummary=document.querySelector('.mobile-feature-summary');
function updateMobileSummary(index){
 const title=options[index].querySelector('.feature-heading').textContent.trim();
 const copy=options[index].querySelector('.feature-description').cloneNode(true);
 copy.querySelectorAll('br').forEach(br=>br.replaceWith(' '));
 const description=copy.textContent.replace(/\s+/g,' ').trim();
 mobileSummary.replaceChildren();
 const heading=document.createElement('strong');heading.textContent=title+'. ';
 mobileSummary.append(heading,document.createTextNode(description));
}

let currentFeature=1, keyboardFeature=false;
// Opaque phone layers prevent screens from ghosting through one another.
let screenBusy=false,pendingFeature=null;
const screenLayers=mockups.map(img=>{const layer=document.createElement('div');layer.className='phone-layer';img.before(layer);layer.append(img);return layer;});
const screenPose={front:'translateX(0px) scale(1)',rear:'translateX(195px) scale(.89375)',left:'translateX(-380px) scale(1)',right:'translateX(540px) scale(.89375)'};
let screenRun=0, screenAnimations=[];
function moveScreens(index,direction=1,initial=false){
 const run=++screenRun;
 const snapshots=screenLayers.map(layer=>({transform:getComputedStyle(layer).transform,opacity:getComputedStyle(layer).opacity,visibility:getComputedStyle(layer).visibility,imageOpacity:getComputedStyle(mockups[screenLayers.indexOf(layer)]).opacity,role:layer.dataset.role}));
 screenAnimations.forEach(animation=>animation.cancel());screenAnimations=[];
 const next=(index+1)%mockups.length;
 const reduced=keyboardFeature||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const oldIndex=snapshots.findIndex(layer=>layer.role==='front');
 const distance=(index-oldIndex+mockups.length)%mockups.length;
 const crossfade=!initial&&distance>1&&distance<mockups.length-1;
 const roles=screenLayers.map((_,i)=>i===index?'front':i===next?'rear':'hidden');
 screenLayers.forEach((layer,i)=>{
  const snapshot=snapshots[i],role=roles[i],visible=role!=='hidden';
  const wasVisible=snapshot.visibility!=='hidden'&&Number(snapshot.opacity)>0;
  const entrance=role==='front'?screenPose.front:screenPose.rear;
  const from=wasVisible?snapshot.transform:crossfade?entrance:direction<0?screenPose.left:screenPose.right;
  const to=visible?entrance:crossfade?from:direction<0?screenPose.right:screenPose.left;
  layer.dataset.role=role;
  layer.style.zIndex=String(role==='front'?4:snapshot.role==='front'?3:1);
  layer.style.transform=to;
  layer.style.opacity=visible?'1':'0';
  layer.style.visibility=visible||wasVisible?'visible':'hidden';
  layer.classList.toggle('mobile-suppressed',snapshot.role!=='front'&&role!=='front');
  mockups[i].style.opacity=role==='rear'?'.6':'1';
  mockups[i].classList.toggle('active',i===index);
  mockups[i].setAttribute('aria-hidden',String(i!==index));
  if(!initial&&!reduced&&(visible||wasVisible)){
   const movement={duration:crossfade?320:560,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'};
   const fade={duration:320,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'};
   screenAnimations.push(layer.animate([{transform:from},{transform:to}],movement));
   screenAnimations.push(layer.animate([{opacity:wasVisible?Number(snapshot.opacity):0},{opacity:visible?1:0}],fade));
   screenAnimations.push(mockups[i].animate([{opacity:Number(snapshot.imageOpacity)},{opacity:role==='rear'?.6:1}],fade));
  }
 });
 const animations=[...screenAnimations];screenBusy=animations.length>0;
 const settle=()=>{
  if(run!==screenRun)return;
  screenLayers.forEach((layer,i)=>{layer.style.visibility=roles[i]==='hidden'?'hidden':'visible';layer.style.zIndex=roles[i]==='front'?'3':'1';layer.classList.remove('mobile-suppressed');});
  animations.forEach(animation=>animation.cancel());screenAnimations=[];screenBusy=false;
 };
 if(screenBusy)Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(settle);else settle();
}
const mockupStage=document.querySelector('.mockup-stage');
new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;mockupStage.style.setProperty('--phone-scale',Math.min(1,width/(featureMobile.matches?313:475),height/640));}).observe(mockupStage);
moveScreens(currentFeature,1,true);
updateMobileSummary(currentFeature);
document.querySelector('.mobile-feature-close').addEventListener('click',()=>{
 pendingFeature=null;
 const collapse=()=>{featurePanel.classList.remove('mobile-expanded');options.forEach(card=>{card.classList.remove('active');card.setAttribute('aria-expanded','false');});};
 if(window.mooninPanelChange)window.mooninPanelChange(collapse,false);else collapse();
 options[currentFeature].focus({preventScroll:true});
 options[currentFeature].scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
});
function resetFeatureLayout(){
 pendingFeature=null;
 featurePanel.classList.toggle('mobile-expanded',!featureMobile.matches);
 options.forEach((card,i)=>{const expanded=!featureMobile.matches&&i===currentFeature;card.classList.toggle('active',expanded);card.setAttribute('aria-expanded',String(expanded));});
 updateMobileSummary(currentFeature);
}
featureMobile.addEventListener('change',resetFeatureLayout);
resetFeatureLayout();
function selectFeature(index,direction){
 if(direction===undefined)direction=index<currentFeature?-1:1;
 // New selections retarget immediately from the current rendered phone pose.
 if(featureMobile.matches){
  const wasExpanded=featurePanel.classList.contains('mobile-expanded');
  const expand=()=>{featurePanel.classList.add('mobile-expanded');options.forEach((card,i)=>{card.classList.toggle('active',i===index);card.setAttribute('aria-expanded',String(i===index));});updateMobileSummary(index);};
  if(!wasExpanded&&window.mooninPanelChange&&!keyboardFeature)window.mooninPanelChange(expand,true);else expand();
  if(index!==currentFeature){currentFeature=index;moveScreens(index,direction);}
  document.querySelector('#feature-status').textContent=options[index].querySelector('.feature-heading').textContent.trim();
  if(!wasExpanded)document.querySelector('.mobile-feature-close').focus({preventScroll:true});
  return;
 }
 if(options[index].classList.contains('active'))return;
 document.querySelectorAll('.departing-description').forEach(n=>n.remove());
 const previous=options.find(card=>card.classList.contains('active'));
 const outgoing=previous?.querySelector('.feature-description').cloneNode(true);
 const old=options.map(card=>{const r=card.getBoundingClientRect(),c=getComputedStyle(card),h=getComputedStyle(card.querySelector('.feature-heading'));return {width:r.width,height:r.height,top:r.top,left:r.left,padding:c.padding,fontSize:h.fontSize,lineHeight:h.lineHeight};});
 cardAnimations.forEach(a=>a.cancel());cardAnimations.clear();
 options.forEach((card,i)=>{const active=i===index;card.classList.toggle('active',active);card.setAttribute('aria-expanded',String(active));});
 const next=options.map(card=>{const r=card.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,left:r.left};});
 const description=options[index].querySelector('.feature-description');
 const descriptionWidth=description.getBoundingClientRect().width;
 if(!keyboardFeature&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  description.style.width=descriptionWidth+'px';description.style.maxWidth='none';
  if(outgoing){outgoing.removeAttribute('id');outgoing.setAttribute('aria-hidden','true');outgoing.className='departing-description';previous.appendChild(outgoing);outgoing.animate([{opacity:1},{opacity:0,transform:'translateY(-4px)'}],{duration:260,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).onfinish=()=>outgoing.remove();}
  options.forEach((card,i)=>{
   const duration=360,easing='cubic-bezier(.4,0,.2,1)';
   const animation=card.animate([{transform:`translate(${old[i].left-next[i].left}px,${old[i].top-next[i].top}px)`},{transform:'translate(0,0)'}],{duration,easing});
   cardAnimations.set(card,animation);animation.onfinish=()=>{if(cardAnimations.get(card)===animation)cardAnimations.delete(card);if(i===index){description.style.removeProperty('width');description.style.removeProperty('max-width');}};

  });
  options[index].querySelector('.feature-description').animate([{opacity:0},{opacity:1}],{duration:260,delay:0,fill:'backwards',easing:'cubic-bezier(.4,0,.2,1)'});
 }
 currentFeature=index;updateMobileSummary(index);moveScreens(index,direction);
 document.querySelector('#feature-status').textContent=options[index].querySelector('.feature-heading').textContent.trim();
}
options.forEach((card,index)=>{card.addEventListener('click',event=>{keyboardFeature=event.detail===0;selectFeature(index);keyboardFeature=false;});card.addEventListener('keydown',event=>{let next;if(event.key==='ArrowDown'||event.key==='ArrowRight')next=(index+1)%options.length;if(event.key==='ArrowUp'||event.key==='ArrowLeft')next=(index+options.length-1)%options.length;if(event.key==='Home')next=0;if(event.key==='End')next=options.length-1;if(next!==undefined){event.preventDefault();options[next].focus();keyboardFeature=true;selectFeature(next,event.key==='ArrowUp'||event.key==='ArrowLeft'?-1:1);keyboardFeature=false;}});});
document.querySelector('[data-feature-prev]').addEventListener('click',()=>selectFeature(((pendingFeature?.index??currentFeature)+options.length-1)%options.length,-1));
document.querySelector('[data-feature-next]').addEventListener('click',()=>selectFeature(((pendingFeature?.index??currentFeature)+1)%options.length,1));
// Phones stay put while scrolling: no parallax, so nothing shakes.
for(const phone of document.querySelectorAll('.parallax-visual .parallax-phone'))phone.style.transform='translate3d(-50%,0,0)';
