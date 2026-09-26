/* ============================================================
   AzChess — ai.js
   Negamax + Alfa-Beta kəsimi, Piece-Square Tables,
   4 çətinlik: Asan(1) Orta(2) Çətin(3) Qrosmeyster(4)
   ============================================================ */
'use strict';
(function(){
const E=window.AzEngine;
const {P,N,Bp,R,Q,K,W,B}=E;

const VAL={[P]:100,[N]:320,[Bp]:330,[R]:500,[Q]:900,[K]:20000};
const PST_P=[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0];
const PST_N=[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50];
const PST_B=[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20];
const PST_R=[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0];
const PST_Q=[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20];
const PST_K=[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20];
const PSTS={[P]:PST_P,[N]:PST_N,[Bp]:PST_B,[R]:PST_R,[Q]:PST_Q,[K]:PST_K};

function pstIndex(sq,white){
  const f=E.fileOf(sq),r=E.rankOf(sq);
  return white?(7-r)*8+f:r*8+f;
}

function evalState(st){
  let score=0,bPhase=0;
  for(let s=0;s<128;s++){
    if(s&0x88){s+=7;continue}
    const p=st.board[s];if(!p)continue;
    const white=(p&8)===8,t=E.typeOf(p);
    let v=VAL[t]+PSTS[t][pstIndex(s,white)];
    score+=white?v:-v;
    if(t!==P&&t!==K)bPhase+=VAL[t];
  }
  return score/100;
}
function evalCp(st){return evalState(st)*100}

function orderMoves(st,moves){
  for(const m of moves){
    let s=0;
    if(m.captured)s+=10*VAL[E.typeOf(m.captured)]-VAL[E.typeOf(m.piece)];
    if(m.promo)s+=VAL[m.promo];
    s+=PSTS[E.typeOf(m.piece)][pstIndex(m.to,(m.piece&8)===8)]/10;
    m._s=s;
  }
  moves.sort((a,b)=>b._s-a._s);
  return moves;
}

function quiesce(st,alpha,beta,whitePOV,depth){
  const stand=whitePOV?evalCp(st):-evalCp(st);
  if(depth<=0)return stand;
  if(stand>=beta)return beta;
  if(stand>alpha)alpha=stand;
  const caps=orderMoves(st,E.genPseudo(st).filter(m=>m.captured||m.promo));
  for(const m of caps){
    const u=E.makeMove(st,m);
    if(E.inCheck(st,!whitePOV? (st.turn==='w'?false:true):true)&&false){}
    const score=-quiesce(st,-beta,-alpha,!whitePOV,depth-1);
    E.unmakeMove(st,u);
    if(score>=beta)return beta;
    if(score>alpha)alpha=score;
  }
  return alpha;
}

function negamax(st,depth,alpha,beta){
  if(depth===0)return quiesce(st,alpha,beta,st.turn==='w',2);
  const moves=orderMoves(st,E.genLegal(st));
  if(!moves.length){
    if(E.inCheck(st,st.turn==='w'))return -99999-depth;
    return 0;
  }
  for(const m of moves){
    const u=E.makeMove(st,m);
    const sc=-negamax(st,depth-1,-beta,-alpha);
    E.unmakeMove(st,u);
    if(sc>=beta)return beta;
    if(sc>alpha)alpha=sc;
  }
  return alpha;
}

function findBestMove(st,depth){
  const stc=E.cloneState(st);
  const legal=E.genLegal(stc);
  if(!legal.length)return null;
  orderMoves(stc,legal);
  let best=null,bestScore=-Infinity;
  const rootWhite=stc.turn==='w';
  for(const m of legal){
    const u=E.makeMove(stc,m);
    let sc;
    if(depth<=1){
      sc=(rootWhite?1:-1)*evalCp(stc)+(Math.random()*120-60);
    }else{
      sc=-negamax(stc,depth-1,-Infinity,Infinity);
    }
    E.unmakeMove(stc,u);
    if(sc>bestScore){bestScore=sc;best=m}
  }
  return {move:best,cp:Math.round(bestScore)};
}

window.AzAI={evalState,findBestMove,evalCp};
})();
