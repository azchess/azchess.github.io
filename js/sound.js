// Lightweight WebAudio move sounds. No external files and works with GitHub Pages.
let ctx=null, master=null;
function ready(){
  if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)(); master=ctx.createGain(); master.gain.value=.12; master.connect(ctx.destination);}
  if(ctx.state==='suspended') ctx.resume();
}
function tone(freq,dur,type='sine',gain=.06,when=0){
  ready(); const o=ctx.createOscillator(), g=ctx.createGain(), t=ctx.currentTime+when;
  o.type=type; o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(gain,t+.008); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.02);
}
export function unlock(){ try{ready();}catch{} }
export function move(capture=false,check=false){
  try{
    if(capture){ tone(185,.075,'triangle',.075); tone(110,.10,'sine',.045,.035); }
    else tone(440,.045,'sine',.055);
    if(check){tone(740,.07,'sine',.055,.055);tone(880,.08,'sine',.04,.12);}
  }catch{}
}
export function castle(){try{tone(330,.05,'sine',.05);tone(520,.06,'sine',.045,.055);}catch{}}
export function promotion(){try{tone(520,.07,'sine',.05);tone(780,.08,'sine',.05,.07);tone(1040,.1,'sine',.04,.15);}catch{}}
export function gameEnd(win=false){try{tone(win?660:300,.12,'sine',.055);tone(win?880:220,.16,'sine',.045,.13);}catch{}}
