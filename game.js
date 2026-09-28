/* AzChess — stable UI + chess.js game controller */
"use strict";
(function(){
  const game=new Chess();
  const boardEl=document.getElementById("board");
  const statusEl=document.getElementById("status");
  const subStatus=document.getElementById("subStatus");
  const moveList=document.getElementById("moveList");
  const capturedEl=document.getElementById("captured");
  const evalText=document.getElementById("evalText");
  const evalFill=document.getElementById("evalFill");
  const settingsModal=document.getElementById("settingsModal");
  const onlineModal=document.getElementById("onlineModal");
  const overModal=document.getElementById("gameOverModal");
  const roomInfo=document.getElementById("roomInfo");

  const PIECES={
    w:{p:"♙",n:"♘",b:"♗",r:"♖",q:"♕",k:"♔"},
    b:{p:"♟",n:"♞",b:"♝",r:"♜",q:"♛",k:"♚"}
  };
  let orientation="w", selected=null, legal=[], lastMove=null;
  let mode="ai", aiLevel=2, aiThinking=false, onlineColor=null;
  let worker=null, requestId=0;
  let sound=true;

  try{
    worker=new Worker("ai.js");
    worker.onmessage=e=>{
      if(e.data.requestId!==requestId || e.data.type!=="bestMove") return;
      aiThinking=false;
      if(mode!=="ai" || game.game_over()) return;
      const m=e.data;
      if(game.turn()!=="b") return;
      const made=game.move({from:m.from,to:m.to,promotion:m.promotion||"q"});
      if(made){ lastMove={from:m.from,to:m.to}; playSound(); render(); sendOnlineMove(made); }
    };
  }catch(e){ worker=null; }

  function squareName(file,rank){ return String.fromCharCode(97+file)+(8-rank); }
  function render(){
    boardEl.innerHTML="";
    const b=game.board();
    for(let vr=0;vr<8;vr++){
      for(let vf=0;vf<8;vf++){
        const f=orientation==="w"?vf:7-vf, r=orientation==="w"?vr:7-vr;
        const sq=squareName(f,r), piece=b[r][f];
        const el=document.createElement("div");
        el.className="square "+(((f+r)&1)===0?"light":"dark");
        el.dataset.square=sq;
        if(lastMove && (sq===lastMove.from||sq===lastMove.to)) el.classList.add("last");
        if(selected===sq) el.classList.add("selected");
        if(legal.some(x=>x.to===sq)) el.classList.add(piece?"capture":"legal");
        if(game.in_check()){
          const k=game.turn()==="w"?"K":"k";
          if(piece&&piece.type===k.toLowerCase()&&piece.color===game.turn()) el.classList.add("check");
        }
        if(piece){
          const span=document.createElement("span");
          span.className="piece"; span.textContent=PIECES[piece.color][piece.type];
          el.appendChild(span);
        }
        if(vr===7) { const c=document.createElement("span"); c.className="coords-file"; c.textContent=sq[0]; el.appendChild(c); }
        if(vf===0) { const c=document.createElement("span"); c.className="coords-rank"; c.textContent=sq[1]; el.appendChild(c); }
        el.addEventListener("click",()=>clickSquare(sq));
        boardEl.appendChild(el);
      }
    }
    renderMoves(); renderCaptured(); renderStatus();
  }

  function clickSquare(sq){
    if(aiThinking) return;
    if(mode==="ai" && game.turn()==="b") return;
    if(mode==="online" && game.turn()!==onlineColor) return;

    const piece=game.get(sq);
    if(selected){
      const m=legal.find(x=>x.to===sq);
      if(m){ makeMove(selected,sq,m.promotion||undefined); return; }
    }
    if(piece && piece.color===game.turn()){
      selected=sq;
      legal=game.moves({square:sq,verbose:true});
    }else{
      selected=null; legal=[];
    }
    render();
  }

  function makeMove(from,to,promotion){
    const move=game.move({from,to,promotion:promotion||"q"});
    if(!move) return;
    selected=null; legal=[]; lastMove={from,to};
    playSound(); render();
    sendOnlineMove(move);
    if(mode==="ai" && !game.game_over() && game.turn()==="b") askAI();
    if(mode==="online") AZ.Network.send({type:"state",fen:game.fen(),san:move.san,from,to});
    checkGameOver();
  }

  function sendOnlineMove(move){
    if(mode==="online" && AZ.Network.connected){
      AZ.Network.send({type:"state",fen:game.fen(),san:move.san,from:move.from,to:move.to});
    }
  }

  function askAI(){
    if(!worker) return;
    aiThinking=true; requestId++;
    statusEl.textContent="Kompüter düşünür…";
    worker.postMessage({type:"bestMove",fen:game.fen(),level:aiLevel,requestId});
  }

  function renderStatus(){
    if(game.game_over()) return;
    const side=game.turn()==="w"?"Ağ":"Qara";
    statusEl.textContent=game.in_check()?side+" şahdadır":side+" gedişidir";
    subStatus.textContent=mode==="ai"?(game.turn()==="w"?"Sən oynayırsan":"AI düşünür"):mode==="online"?"Onlayn oyun":"2 oyunçu";
  }

  function renderMoves(){
    moveList.innerHTML="";
    const history=game.history();
    for(let i=0;i<history.length;i+=2){
      const row=document.createElement("div"); row.className="move-row";
      row.innerHTML="<span>"+(Math.floor(i/2)+1)+".</span><span>"+(history[i]||"")+"</span><span>"+(history[i+1]||"")+"</span>";
      moveList.appendChild(row);
    }
    moveList.scrollTop=moveList.scrollHeight;
  }

  function renderCaptured(){
    const start={w:8,b:8};
    const counts={p:0,n:0,b:0,r:0,q:0};
    const h=game.history({verbose:true});
    h.forEach(m=>{if(m.captured) counts[m.captured]++;});
    let s="";
    ["q","r","b","n","p"].forEach(t=>{for(let i=0;i<counts[t];i++) s+=PIECES.b[t]+" ";});
    capturedEl.textContent=s||"Heç nə yoxdur";
  }

  function checkGameOver(){
    if(!game.game_over()) return;
    let title="Oyun bitdi", text="";
    if(game.in_checkmate()) text=(game.turn()==="w"?"Qara":"Ağ")+" mat etdi.";
    else if(game.in_stalemate()) text="Pat — heç bir qanuni gediş yoxdur.";
    else if(game.in_threefold_repetition()) text="Üçqat təkrar.";
    else if(game.insufficient_material()) text="Kifayət qədər material yoxdur.";
    else text="Heç-heçə.";
    document.getElementById("gameOverTitle").textContent=title;
    document.getElementById("gameOverText").textContent=text;
    overModal.classList.remove("hidden");
  }

  function newGame(){
    game.reset(); selected=null; legal=[]; lastMove=null; aiThinking=false; requestId++;
    overModal.classList.add("hidden"); render();
    if(mode==="ai" && game.turn()==="b") askAI();
  }
  function undo(){
    if(mode==="ai"){
      game.undo(); game.undo();
    }else game.undo();
    selected=null; legal=[]; lastMove=null; render();
  }
  function playSound(){
    if(!sound) return;
    try{
      const C=window.AudioContext||window.webkitAudioContext, c=new C(), o=c.createOscillator(), g=c.createGain();
      o.frequency.value=520; g.gain.value=.035; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+.055);
    }catch(e){}
  }

  function setMode(next){
    mode=next; document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));
    document.getElementById(next==="ai"?"btnAi":next==="pvp"?"btnPvp":"btnOnline").classList.add("active");
    if(next==="online") onlineModal.classList.remove("hidden");
    newGame();
  }

  document.getElementById("btnAi").onclick=()=>setMode("ai");
  document.getElementById("btnPvp").onclick=()=>setMode("pvp");
  document.getElementById("btnOnline").onclick=()=>setMode("online");
  document.getElementById("btnFlip").onclick=()=>{orientation=orientation==="w"?"b":"w";render();};
  document.getElementById("btnNew").onclick=newGame;
  document.getElementById("btnUndo").onclick=undo;
  document.getElementById("btnResign").onclick=()=>{
    if(mode==="ai") document.getElementById("gameOverText").textContent="Sən təslim oldun.";
    else document.getElementById("gameOverText").textContent="Oyun dayandırıldı.";
    document.getElementById("gameOverTitle").textContent="Təslim";
    overModal.classList.remove("hidden");
  };
  document.getElementById("btnSettings").onclick=()=>settingsModal.classList.remove("hidden");
  document.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>x.closest(".modal").classList.add("hidden"));
  document.getElementById("overNew").onclick=newGame;
  document.getElementById("themeSelect").onchange=e=>document.body.dataset.theme=e.target.value;
  document.getElementById("difficultySelect").onchange=e=>aiLevel=+e.target.value;
  document.getElementById("soundCheck").onchange=e=>sound=e.target.checked;

  document.getElementById("createRoom").onclick=()=>{
    roomInfo.classList.remove("hidden");
    roomInfo.textContent="Otaq yaradılır…";
    AZ.Network.create();
  };
  document.getElementById("joinRoom").onclick=()=>{
    const code=document.getElementById("roomInput").value.trim();
    roomInfo.classList.remove("hidden"); roomInfo.textContent="Qoşululur…";
    AZ.Network.join(code);
  };

  AZ.Network.on("open",d=>{
    roomInfo.classList.remove("hidden");
    roomInfo.innerHTML="<b>Otaq: "+d.room+"</b><br>Bu kodu rəqibə göndər. Gözləyirik…";
  });
  AZ.Network.on("connected",d=>{
    onlineColor=d.host?"w":"b";
    roomInfo.innerHTML="<b>Qoşuldu.</b><br>Sən "+(onlineColor==="w"?"Ağ":"Qara")+"san.";
    if(d.host) AZ.Network.send({type:"state",fen:game.fen()});
    else orientation="b";
    onlineModal.classList.add("hidden"); mode="online"; render();
  });
  AZ.Network.on("data",d=>{
    if(!d||d.type!=="state"||mode!=="online") return;
    try{
      game.load(d.fen);
      lastMove=d.from&&d.to?{from:d.from,to:d.to}:null;
      selected=null; legal=[]; render(); checkGameOver();
    }catch(e){}
  });
  AZ.Network.on("closed",()=>{roomInfo.classList.remove("hidden");roomInfo.textContent="Rəqib bağlantını bağladı.";});
  AZ.Network.on("error",e=>{roomInfo.classList.remove("hidden");roomInfo.textContent="Bağlantı xətası: "+(e.message||e);});

  render();
})();
