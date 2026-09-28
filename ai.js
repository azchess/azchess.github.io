/* AzChess AI worker
   Uses chess.js for legal move generation and an alpha-beta search.
   Runs in a Worker so the board UI does not freeze while the engine thinks. */
importScripts("https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js");

const V = {p:100,n:320,b:330,r:500,q:900,k:20000};
const PST = {
  p:[0,0,0,0,0,0,0,0, 5,10,10,-20,-20,10,10,5, 5,-5,-10,0,0,-10,-5,5, 0,0,0,20,20,0,0,0, 5,5,10,25,25,10,5,5, 10,10,20,30,30,20,10,10, 50,50,50,50,50,50,50,50, 0,0,0,0,0,0,0,0],
  n:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,5,5,0,-20,-40,-30,5,10,15,15,10,5,-30,-30,0,15,20,20,15,0,-30,-30,5,15,20,20,15,5,-30,-30,0,10,15,15,10,0,-30,-40,-20,0,0,0,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  b:[-20,-10,-10,-10,-10,-10,-10,-20,-10,5,0,0,0,0,5,-10,-10,10,10,10,10,10,10,-10,-10,0,10,10,10,10,0,-10,-10,5,5,10,10,5,5,-10,-10,0,5,10,10,5,0,-10,-10,0,0,0,0,0,0,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  r:[0,0,0,5,5,0,0,0,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,0,0,0,0,0,5,5,0,0,0,0,5,5,0,0,0,0,0,0,0,0],
  q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  k:[20,30,10,0,0,10,30,20,20,20,0,0,0,0,20,20,-10,-20,-20,-20,-20,-20,-20,-10,-20,-30,-30,-40,-40,-30,-30,-20,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30,-30]
};
let deadline=0, nodes=0;

function val(piece, i) {
  const p=piece.toLowerCase(), base=V[p]||0;
  if (p==="k") return base + PST.k[i];
  return base + (PST[p] ? PST[p][i] : 0);
}
function evaluate(g) {
  if (g.in_checkmate()) return g.turn()==="w" ? -999999 : 999999;
  if (g.in_draw() || g.in_stalemate()) return 0;
  let s=0, b=g.board();
  for(let r=0;r<8;r++) for(let f=0;f<8;f++){
    const p=b[r][f]; if(!p) continue;
    const i=r*8+f;
    let ps=i;
    if(p.color==="b") ps=(7-r)*8+f;
    const x=val(p.type,ps);
    s += p.color==="w" ? x : -x;
  }
  // Small mobility bonus
  const side=g.turn();
  const own=g.moves().length;
  g.turn(); // no-op; kept intentionally out of state
  s += (side==="w"?1:-1) * own * 2;
  return s;
}
function orderedMoves(g) {
  return g.moves({verbose:true}).sort((a,b)=>{
    const sa=(a.captured?V[a.captured]*10:0)+(a.promotion?V[a.promotion]*10:0)+(a.san[0]==="+"?50:0);
    const sb=(b.captured?V[b.captured]*10:0)+(b.promotion?V[b.promotion]*10:0)+(b.san[0]==="+"?50:0);
    return sb-sa;
  });
}
function search(g, depth, alpha, beta, maximizing) {
  if(Date.now()>deadline) throw new Error("TIME");
  nodes++;
  if(depth<=0 || g.game_over()) return evaluate(g);
  const moves=orderedMoves(g);
  if(!moves.length) return evaluate(g);
  if(maximizing){
    let best=-Infinity;
    for(const m of moves){
      g.move({from:m.from,to:m.to,promotion:m.promotion||"q"});
      const x=search(g,depth-1,alpha,beta,false); g.undo();
      if(x>best) best=x;
      if(best>alpha) alpha=best;
      if(beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for(const m of moves){
      g.move({from:m.from,to:m.to,promotion:m.promotion||"q"});
      const x=search(g,depth-1,alpha,beta,true); g.undo();
      if(x<best) best=x;
      if(best<beta) beta=best;
      if(beta<=alpha) break;
    }
    return best;
  }
}
function bestMove(fen, level) {
  const g=new Chess(fen);
  const aiColor=g.turn();
  const maxDepth=[2,3,4,5][Math.max(0,Math.min(3,level-1))];
  const maxMs=[250,650,1300,2200][Math.max(0,Math.min(3,level-1))];
  deadline=Date.now()+maxMs; nodes=0;
  let best=null, bestScore=aiColor==="w"?-Infinity:Infinity;
  for(let d=1;d<=maxDepth;d++){
    try{
      let local=null, localScore=aiColor==="w"?-Infinity:Infinity;
      for(const m of orderedMoves(g)){
        g.move({from:m.from,to:m.to,promotion:m.promotion||"q"});
        const x=search(g,d-1,-Infinity,Infinity,aiColor!=="w");
        g.undo();
        if(aiColor==="w" ? x>localScore : x<localScore){ localScore=x; local=m; }
      }
      if(local){ best=local; bestScore=localScore; }
    }catch(e){ break; }
  }
  if(!best){
    const ms=g.moves({verbose:true});
    best=ms[Math.floor(Math.random()*ms.length)];
  }
  return {from:best.from,to:best.to,promotion:best.promotion||"q",score:bestScore,nodes};
}
self.onmessage=e=>{
  if(e.data && e.data.type==="bestMove"){
    try{ self.postMessage({type:"bestMove",...bestMove(e.data.fen,e.data.level||2),requestId:e.data.requestId}); }
    catch(err){ self.postMessage({type:"error",message:String(err),requestId:e.data.requestId}); }
  }
};
