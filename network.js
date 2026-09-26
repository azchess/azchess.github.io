/* ============================================================
   AzChess — network.js
   WebRTC P2P (PeerJS): 6 rəqəmli otaq kodu + dəvət linki
   ============================================================ */
'use strict';
(function(){
const PREFIX='azchess-';
const App=window.AzApp, UI=window.AzUI;
let peer=null, conn=null, role=null, roomCode=null, intentionalClose=false;

function setStatus(id,msg,err){
  const el=document.getElementById(id);
  el.textContent=msg;el.classList.toggle('err',!!err);
}
function genCode(){return String(Math.floor(100000+Math.random()*900000))}

function cleanup(){
  intentionalClose=true;
  try{conn&&conn.close()}catch(e){}
  try{peer&&peer.destroy()}catch(e){}
  peer=null;conn=null;role=null;
}
function cleanupIfUnconnected(){
  if(!conn||!conn.open){cleanup()}
}
function resetFlag(){intentionalClose=false}

function startHost(){
  cleanup();resetFlag();
  roomCode=genCode();
  document.getElementById('roomCodeBox').textContent=roomCode;
  const link=location.origin+location.pathname+'?room='+roomCode;
  document.getElementById('inviteLink').value=link;
  setStatus('netStatusCreate',UI.t('waiting'));
  peer=new Peer(PREFIX+roomCode,{debug:0});
  peer.on('open',()=>{setStatus('netStatusCreate',UI.t('roomReady'))});
  peer.on('error',err=>{
    if(err.type==='unavailable-id'){startHost();return}
    setStatus('netStatusCreate',UI.t('connErr')+': '+err.type,true);
  });
  peer.on('connection',c=>{
    if(conn&&conn.open){c.close();return}
    conn=c;role='host';wireConn();
  });
}

function startJoin(code){
  cleanup();resetFlag();
  if(!/^\d{6}$/.test(code)){setStatus('netStatusJoin',UI.t('connErr'),true);return}
  roomCode=code;
  setStatus('netStatusJoin',UI.t('connecting'));
  peer=new Peer({debug:0});
  peer.on('open',()=>{
    conn=peer.connect(PREFIX+code,{reliable:true});
    role='guest';wireConn();
  });
  peer.on('error',err=>{setStatus('netStatusJoin',UI.t('connErr')+': '+err.type,true)});
  setTimeout(()=>{if(!conn||!conn.open)setStatus('netStatusJoin',UI.t('connLost'),true)},15000);
}

function wireConn(){
  conn.on('open',()=>{
    setStatus(role==='host'?'netStatusCreate':'netStatusJoin',UI.t('connected'));
    if(role==='host'){
      const hostColor=Math.random()<0.5?'w':'b';
      App.myColor=hostColor;
      send({t:'init',guestColor:hostColor==='w'?'b':'w',tc:UI.getTc()});
      const tc=UI.getTc();
      App.mode='online';
      setTimeout(()=>{
        UI.startGame('online');
        App.myColor=hostColor;App.orientation=hostColor;
        UI.renderBoard();UI.updatePanels();
      },300);
    }
  });
  conn.on('data',onData);
  conn.on('close',()=>{
    UI.toast(UI.t('connLost'));
    if(App.started&&!App.over){
      App.started=false;
      UI.endGame({winner:App.myColor==='w'?'w':'b',reason:'resign'});
    }
    cleanup();
  });
  conn.on('error',()=>{setStatus('netStatusJoin',UI.t('connErr'),true)});
}

function send(obj){if(conn&&conn.open)conn.send(obj)}

function onData(d){
  if(!d||typeof d!=='object')return;
  switch(d.t){
    case 'init':{
      App.myColor=d.guestColor;
      App.mode='online';
      setTimeout(()=>{
        UI.startGame('online');
        App.myColor=d.guestColor;App.orientation=d.guestColor;
        UI.renderBoard();UI.updatePanels();
      },300);
      break;
    }
    case 'move':{
      const m=window.AzEngine.findByUci(App.state,d.uci);
      if(m){
        UI.setFromNetwork(true);
        if(typeof d.cw==='number')App.clocks.w=d.cw;
        if(typeof d.cb==='number')App.clocks.b=d.cb;
        UI.doMove(m);
        UI.setFromNetwork(false);
      }
      break;
    }
    case 'resign':{
      UI.endGame({winner:App.myColor,reason:'resign'});
      break;
    }
    case 'drawOffer':{
      if(confirm(UI.t('drawOfferIn'))){send({t:'drawAccept'});UI.endGame({winner:null,reason:'drawAgreed'})}
      else send({t:'drawDecline'});
      break;
    }
    case 'drawAccept':UI.endGame({winner:null,reason:'drawAgreed'});break;
    case 'drawDecline':UI.toast('✕');break;
    case 'rematch':{
      App.myColor=App.myColor==='w'?'b':'w';
      UI.startGame('online');
      App.orientation=App.myColor;
      UI.renderBoard();UI.updatePanels();
      UI.toast('🔄 '+UI.t('rematch'));
      break;
    }
  }
}

function sendMove(m){
  send({t:'move',uci:window.AzEngine.uciOf(m),cw:App.clocks.w,cb:App.clocks.b});
}

document.getElementById('tabCreate').onclick=()=>{
  document.getElementById('tabCreate').classList.add('active');
  document.getElementById('tabJoin').classList.remove('active');
  document.getElementById('paneCreate').style.display='';
  document.getElementById('paneJoin').style.display='none';
  startHost();
};
document.getElementById('tabJoin').onclick=()=>{
  document.getElementById('tabJoin').classList.add('active');
  document.getElementById('tabCreate').classList.remove('active');
  document.getElementById('paneJoin').style.display='';
  document.getElementById('paneCreate').style.display='none';
};
document.getElementById('btnJoin').onclick=()=>{
  startJoin(document.getElementById('joinCode').value.trim());
};
document.getElementById('btnCopyLink').onclick=()=>{
  const inp=document.getElementById('inviteLink');
  navigator.clipboard&&navigator.clipboard.writeText(inp.value).then(()=>UI.toast(UI.t('copied')));
};

const m=location.search.match(/room=(\d{6})/);
if(m){
  UI.openModal('modalOnline');
  document.getElementById('tabJoin').click();
  document.getElementById('joinCode').value=m[1];
  startJoin(m[1]);
}

window.AzNet={send,sendMove,cleanup,cleanupIfUnconnected};
})();
