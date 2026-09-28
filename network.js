/* PeerJS based online mode.
   Only public game state (FEN + move SAN) is synchronized. */
(function(){
  "use strict";
  const N={peer:null,conn:null,host:false,room:null,callbacks:{},connected:false};

  function code(){ return String(Math.floor(100000+Math.random()*900000)); }
  function id(c){ return "azchess-"+c; }

  function reset(){
    if(N.conn){ try{N.conn.close();}catch(e){} }
    if(N.peer){ try{N.peer.destroy();}catch(e){} }
    N.peer=N.conn=null; N.connected=false; N.host=false; N.room=null;
  }
  function emit(name,data){ const f=N.callbacks[name]; if(f) f(data); }

  N.create=function(cb){
    reset(); N.host=true; N.room=code();
    const p=new Peer(id(N.room));
    N.peer=p;
    p.on("open",()=>{ emit("open",{room:N.room,host:true}); });
    p.on("connection",c=>{
      if(N.conn){ c.close(); return; }
      N.conn=c; bind(c);
    });
    p.on("error",e=>emit("error",e));
    return N.room;
  };
  N.join=function(room,cb){
    reset(); N.host=false; N.room=String(room).replace(/\D/g,"").slice(0,6);
    if(N.room.length!==6) return emit("error",new Error("Kod 6 rəqəm olmalıdır."));
    const p=new Peer(); N.peer=p;
    p.on("open",()=>{
      const c=p.connect(id(N.room),{reliable:true});
      N.conn=c; bind(c);
    });
    p.on("error",e=>emit("error",e));
  };
  function bind(c){
    c.on("open",()=>{ N.connected=true; emit("connected",{host:N.host,room:N.room}); });
    c.on("data",d=>emit("data",d));
    c.on("close",()=>{N.connected=false;emit("closed",{});});
    c.on("error",e=>emit("error",e));
  }
  N.send=function(data){ if(N.conn&&N.conn.open) N.conn.send(data); };
  N.close=reset;
  N.on=function(name,fn){N.callbacks[name]=fn;};
  window.AZ=window.AZ||{}; window.AZ.Network=N;
})();
