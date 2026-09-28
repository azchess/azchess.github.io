import { t, applyDom } from './i18n.js';
import * as S from './settings.js';
import { Board } from './board.js';
import { Clock } from './clock.js';
import { pieceSVG, PIECE_SETS } from './pieces.js';
import { createOnline } from './online.js';
import * as Sound from './sound.js';

if (!window.Chess) { document.body.textContent = 'chess.js could not be loaded.'; throw new Error('chess.js missing'); }
const $ = id => document.getElementById(id);
const THEMES = ['classic','green','brown','blue','dark','minimal','neon'];
const PRESETS = [[1,0],[2,1],[3,0],[3,2],[5,0],[5,3],[10,0],[10,5],[15,10],[30,0]];
const VALUE = {p:1,n:3,b:3,r:5,q:9};
const other = c => c === 'w' ? 'b' : 'w';
const game = new window.Chess();
let over = false, flipped = false, online = null, applyingRemote = false, lastResult = null, ai = {active:false,color:'b',depth:2,busy:false};

function mkBar(color) {
  const el = document.createElement('div');
  el.className = 'pl';
  el.innerHTML = '<div class="who"><span class="nmline"><span class="nm"></span><span class="status-dot"></span></span><span class="cap"></span></div><time class="clk">0:00</time>';
  el.querySelector('.nm').textContent = t(color === 'w' ? 'white' : 'black');
  return {el,cap:el.querySelector('.cap'),clk:el.querySelector('.clk'),dot:el.querySelector('.status-dot')};
}
const bars = {w:mkBar('w'), b:mkBar('b')};
function layout(){ $('pl-top').replaceChildren(bars[flipped?'w':'b'].el); $('pl-bot').replaceChildren(bars[flipped?'b':'w'].el); }
function fmt(ms){ if(ms<10000)return(Math.ceil(ms/100)/10).toFixed(1); const s=Math.ceil(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),p=n=>String(n).padStart(2,'0'); return h?`${h}:${p(m)}:${p(s%60)}`:`${m}:${p(s%60)}`; }
const clock = new Clock((r,active)=>{ for(const c of 'wb'){bars[c].clk.textContent=fmt(r[c]); bars[c].clk.classList.toggle('low',active===c&&r[c]<10000);} }, color=>end('timeout',other(color)));
function kingSquare(color){const b=game.board();for(let r=0;r<8;r++)for(let f=0;f<8;f++){const p=b[r][f];if(p&&p.type==='k'&&p.color===color)return'abcdefgh'[f]+(8-r);}return null;}
function marks(){const h=game.history({verbose:true}),m=h[h.length-1];board.setMarks(m?[m.from,m.to]:[],game.in_check()?kingSquare(game.turn()):null);}
function renderMoves(){const h=game.history(),ol=$('moves');ol.replaceChildren();for(let i=0;i<h.length;i+=2){const li=document.createElement('li');li.innerHTML=`<span>${i/2+1}.</span>`;for(const j of[i,i+1]){if(!h[j])continue;const b=document.createElement('b');b.textContent=h[j];if(j===h.length-1)b.className='cur';li.append(b);}ol.append(li);}ol.scrollTop=ol.scrollHeight;}
function renderCaptured(){const got={w:[],b:[]};for(const m of game.history({verbose:true}))if(m.captured)got[m.color].push(m.captured);const score=c=>got[c].reduce((a,k)=>a+VALUE[k],0),diff={w:score('w')-score('b'),b:score('b')-score('w')};for(const c of'wb')bars[c].cap.innerHTML=got[c].sort((a,b)=>VALUE[b]-VALUE[a]).map(k=>`<span class="cp">${pieceSVG(S.get().pieces,other(c),k)}</span>`).join('')+(diff[c]>0?`<i class="adv">+${diff[c]}</i>`:'');}
function refresh(){renderMoves();renderCaptured();for(const c of'wb')bars[c].el.classList.toggle('on',!over&&game.turn()===c);}
function end(reason,winner,remote=false){if(over)return;over=true;lastResult={reason,winner:winner||null};clock.stop();refresh();$('r-title').textContent=winner?t('won',{c:t(winner==='w'?'white':'black')}):t('draw');$('r-sub').textContent=t(reason);const dlg=$('dlg-result');if(!dlg.open)dlg.showModal();Sound.gameEnd(winner===game.turn());if(online?.active&&!remote)online.sendEnd(reason);}
function checkEnd(){if(game.in_checkmate())return end('checkmate',other(game.turn()));if(game.in_stalemate())return end('stalemate');if(game.insufficient_material())return end('insufficient');if(game.in_threefold_repetition())return end('repetition');if(game.in_draw())return end('fifty');return null;}
function move(from,to,promo,remote=false){if(over)return false;if(online?.active&&!remote&&!online.canMove())return false;const m=game.move({from,to,promotion:promo});if(!m)return false;board.applyMove(m);board.sync(game.board());board.clear();marks();clock.press(m.color);refresh();Sound.unlock();Sound.move(Boolean(m.captured||m.flags.includes('e')),game.in_check());if(m.flags.includes('k')||m.flags.includes('q'))Sound.castle();if(m.promotion)Sound.promotion();if(online?.active&&!remote)online.sendMove(m);const ended=checkEnd();if(!ended&&ai.active&&!online?.active&&game.turn()===ai.color&&!remote)setTimeout(aiMove,180);return m;}
function newGame(custom){const tc=custom||S.get();game.reset();over=false;lastResult=null;ai.busy=false;if($('dlg-result').open)$('dlg-result').close();clock.reset(tc.min*60000,tc.inc*1000);board.sync(game.board());board.clear();board.setMarks([],null);refresh();}
function loadState(moves,ms,inc){game.reset();for(const san of moves){if(!game.move(san))return false;}over=false;lastResult=null;clock.stop();clock.ms={w:Math.max(0,ms.w),b:Math.max(0,ms.b)};clock.inc=inc;board.sync(game.board());board.clear();marks();refresh();if(game.history().length)clock.start(game.turn());return true;}
function playRemote(from,to,promo){applyingRemote=true;try{return move(from,to,promo,true);}finally{applyingRemote=false;}}
function undo(){if(online?.active){toast(t('onlineNoUndo'));return;}if(over&&!game.game_over())return;if(!game.undo())return;over=false;if($('dlg-result').open)$('dlg-result').close();board.sync(game.board());board.clear();marks();clock.stop();if(game.history().length)clock.start(game.turn());refresh();}
function resign(){if(over||!confirm(t('confirmResign')))return;end('resigned',other(game.turn()));}
function toast(msg){const el=$('toast');el.textContent=msg;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2600);}
function mode(on){$('b-undo').disabled=on;$('b-resign').disabled=false;$('b-new').disabled=on;if(on)ai.active=false;}

const AI_VALUE={p:100,n:320,b:330,r:500,q:900,k:20000};
function aiEval(g){
  if(g.in_checkmate()) return g.turn()==='w'?-999999:999999;
  if(g.in_draw()) return 0;
  let s=0; for(const row of g.board()) for(const p of row) if(p) s+=(p.color==='w'?1:-1)*AI_VALUE[p.type];
  return s;
}
function aiSearch(g,depth,alpha=-1e9,beta=1e9){
  if(depth===0||g.game_over()) return aiEval(g);
  const maximizing=g.turn()==='w'; let best=maximizing?-1e9:1e9;
  for(const mv of g.moves({verbose:true})){
    g.move(mv); const v=aiSearch(g,depth-1,alpha,beta); g.undo();
    if(maximizing){best=Math.max(best,v);alpha=Math.max(alpha,v);}else{best=Math.min(best,v);beta=Math.min(beta,v);}
    if(beta<=alpha) break;
  }
  return best;
}
function aiMove(){
  if(!ai.active||ai.busy||over||online?.active||game.turn()!==ai.color)return;
  ai.busy=true;
  const g=new window.Chess(game.fen()), moves=g.moves({verbose:true}), maximizing=ai.color==='w';
  let bestScore=maximizing?-1e9:1e9,best=[];
  for(const mv of moves){
    g.move(mv); const score=aiSearch(g,Math.max(0,ai.depth-1)); g.undo();
    if((maximizing&&score>bestScore)||(!maximizing&&score<bestScore)){bestScore=score;best=[mv];}
    else if(score===bestScore)best.push(mv);
  }
  const mv=best[Math.floor(Math.random()*best.length)];
  ai.busy=false;
  if(mv) move(mv.from,mv.to,mv.promotion);
}
function startAI(depth){
  ai={active:true,color:'b',depth:Number(depth)||2,busy:false};
  newGame();
  toast(t('ai')+' — '+({1:t('easy'),2:t('medium'),3:t('hard')}[ai.depth]));
}

function result(){return lastResult ? {...lastResult} : null;}
const board=new Board($('board'),{moves:sq=>game.moves({square:sq,verbose:true}),piece:sq=>game.get(sq),turn:()=>game.turn(),canMove:()=>!over&&(!online?.active||online.canMove()),name:k=>t('p_'+k),move:(a,b,c)=>move(a,b,c)});
function swatches(boxId,key,items,draw){$(boxId).replaceChildren(...items.map(v=>{const b=document.createElement('button');b.type='button';b.className='sw';b.dataset.key=key;b.dataset.v=v;b.setAttribute('aria-label',t('n_'+v));b.title=t('n_'+v);draw(b,v);b.addEventListener('click',()=>S.set({[key]:v}));return b;}));}
function apply(){const s=S.get(),root=document.documentElement;root.dataset.theme=THEMES.includes(s.theme)?s.theme:'classic';root.dataset.anim=s.anim?'on':'off';board.setPieces(PIECE_SETS[s.pieces]?s.pieces:'classic');board.setOpts(s);renderCaptured();for(const b of document.querySelectorAll('.sw'))b.setAttribute('aria-pressed',String(s[b.dataset.key]===b.dataset.v));$('s-legal').checked=s.legal;$('s-coords').checked=s.coords;$('s-anim').checked=s.anim;$('s-min').value=s.min;$('s-inc').value=s.inc;$('s-preset').value=PRESETS.some(([m,i])=>m===s.min&&i===s.inc)?`${s.min}+${s.inc}`:'custom';}
function initSettings(){swatches('sw-theme','theme',THEMES,(b,v)=>b.dataset.theme=v);swatches('sw-pieces','pieces',Object.keys(PIECE_SETS),(b,v)=>b.innerHTML=pieceSVG(v,'w','n'));$('s-preset').innerHTML=PRESETS.map(([m,i])=>`<option>${m}+${i}</option>`).join('')+'<option value="custom">'+t('custom')+'</option>';$('s-preset').addEventListener('change',e=>{if(e.target.value==='custom')return;const[min,inc]=e.target.value.split('+').map(Number);S.set({min,inc});});for(const[id,key]of[['s-legal','legal'],['s-coords','coords'],['s-anim','anim']])$(id).addEventListener('change',e=>S.set({[key]:e.target.checked}));for(const[id,key,lo,hi]of[['s-min','min',1,180],['s-inc','inc',0,60]])$(id).addEventListener('change',e=>S.set({[key]:Math.min(hi,Math.max(lo,Math.round(+e.target.value)||lo))}));$('dlg-settings').addEventListener('close',()=>{if(!game.history().length&&!over)newGame();});}
applyDom();initSettings();S.subscribe(apply);layout();apply();newGame();
$('b-undo').addEventListener('click',undo);$('b-resign').addEventListener('click',resign);$('b-new').addEventListener('click',newGame);$('b-set').addEventListener('click',()=>$('dlg-settings').showModal());$('b-flip').addEventListener('click',()=>{flipped=!flipped;board.setFlip(flipped);layout();});$('r-again').addEventListener('click',()=>online?.active?online.rematch():newGame());$('r-new').addEventListener('click',()=>{newGame();$('dlg-settings').showModal();});document.addEventListener('visibilitychange',()=>clock.tick());
const wide=matchMedia('(min-aspect-ratio:1/1)'),syncHist=()=>{$('hist').open=wide.matches};wide.addEventListener('change',syncHist);syncHist();
window.__azchess={board,game,clock,bars,toast,mode,newGame,loadState,play:playRemote,isOver:()=>over,end,result,setFlip:v=>{flipped=!!v;board.setFlip(flipped);layout();},S,$};
online=createOnline(window.__azchess);
window.prank=n=>online.fx(n);
$('b-online').addEventListener('click',()=>{$('dlg-online').showModal();});
$('on-close').addEventListener('click',()=>$('dlg-online').close());
$('b-ai').addEventListener('click',()=>$('dlg-ai').showModal());
$('ai-close').addEventListener('click',()=>$('dlg-ai').close());
document.querySelectorAll('[data-ai]').forEach(b=>b.addEventListener('click',()=>{$('dlg-ai').close();startAI(b.dataset.ai);}));
document.addEventListener('pointerdown',()=>Sound.unlock(),{once:true});
