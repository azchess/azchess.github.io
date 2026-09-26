game_js = r'''/* ============================================================
   AzChess — game.js
   Şahmat mühərriki (0x88) + UI + i18n + səs + taymerlər
   ============================================================ */
'use strict';

/* ================= CHESS ENGINE (0x88) ================= */
const W=8, B=16, P=1, N=2, Bp=3, R=4, Q=5, K=6;
const KN_OFF=[33,31,18,14,-33,-31,-18,-14];
const DIAG=[15,17,-15,-17], ORTH=[16,-16,1,-1], ALL8=DIAG.concat(ORTH);
const START_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILES='abcdefgh';

function sq88(f,r){return r*16+f}
function fileOf(s){return s&7}
function rankOf(s){return s>>4}
function sqName(s){return FILES[fileOf(s)]+(rankOf(s)+1)}
function nameSq(n){return sq88(FILES.indexOf(n[0]), +n[1]-1)}
function onBoard(s){return (s&0x88)===0}
function colorOf(p){return p&8?'w':'b'}
function typeOf(p){return p&7}

function parseFen(fen){
  const parts=fen.split(' ');
  const board=new Array(128).fill(0);
  let s=112;
  for(const ch of parts[0]){
    if(ch==='/'){s-=24;continue}
    if(/\d/.test(ch)){s+=+ch;continue}
    const c=ch===ch.toUpperCase()?W:B;
    const t={p:P,n:N,b:Bp,r:R,q:Q,k:K}[ch.toLowerCase()];
    board[s++]=c|t;
  }
  const cast={K:false,Q:false,k:false,q:false};
  if(parts[2]&&parts[2]!=='-')for(const c of parts[2])cast[c]=true;
  return {board, turn:parts[1]==='w'?'w':'b', cast,
    ep:parts[3]&&parts[3]!=='-'?nameSq(parts[3]):-1,
    half:parts[4]?+parts[4]:0, full:parts[5]?+parts[5]:1};
}
function newState(){return parseFen(START_FEN)}
function cloneState(s){return {board:s.board.slice(),turn:s.turn,cast:{...s.cast},ep:s.ep,half:s.half,full:s.full}}

function isAttacked(st,sq,byWhite){
  const b=st.board, col=byWhite?W:B;
  // pawns
  const pd=byWhite?-16:16; // attacker sits "behind"
  for(const d of [pd-1,pd+1]){
    const from=sq+d;
    if(onBoard(from)&&b[from]===(col|P))return true;
  }
  for(const o of KN_OFF){const f=sq+o;if(onBoard(f)&&b[f]===(col|N))return true}
  for(const o of ALL8){const f=sq+o;if(onBoard(f)&&b[f]===(col|K))return true}
  for(const o of DIAG){let f=sq+o;while(onBoard(f)){const p=b[f];
    if(p){if((p&col)&&(typeOf(p)===Bp||typeOf(p)===Q))return true;break}f+=o}}
  for(const o of ORTH){let f=sq+o;while(onBoard(f)){const p=b[f];
    if(p){if((p&col)&&(typeOf(p)===R||typeOf(p)===Q))return true;break}f+=o}}
  return false;
}
function kingSq(st,white){
  const target=(white?W:B)|K, b=st.board;
  for(let s=0;s<128;s++)if(!(s&0x88)&&b[s]===target)return s;
  return -1;
}
function inCheck(st,white){const k=kingSq(st,white);return k>=0&&isAttacked(st,k,!white)}

function genPseudo(st){
  const moves=[], b=st.board, white=st.turn==='w', col=white?W:B;
  const push=(from,to,extra)=>{const cap=b[to];
    moves.push(Object.assign({from,to,piece:b[from],captured:cap||0},extra||{}))};
  for(let s=0;s<128;s++){
    if(s&0x88){s+=7;continue}
    const p=b[s]; if(!p||(p&8)!==(white?8:16))continue;
    const t=typeOf(p), f=fileOf(s), r=rankOf(s);
    if(t===P){
      const d=white?16:-16, startR=white?1:6, promoR=white?7:0;
      const one=s+d;
      if(onBoard(one)&&!b[one]){
        if(rankOf(one)===promoR){for(const q of [Q,R,Bp,N])push(s,one,{promo:q})}
        else{
          push(s,one);
          const two=s+2*d;
          if(r===startR&&!b[two])push(s,two,{dbl:true});
        }
      }
      for(const dd of [d-1,d+1]){
        const c=s+dd;
        if(!onBoard(c))continue;
        if(b[c]&&(b[c]&8)!==(white?8:16)){
          if(rankOf(c)===promoR){for(const q of [Q,R,Bp,N])push(s,c,{promo:q})}
          else push(s,c);
        } else if(c===st.ep){ push(s,c,{epCap:true,captured:(white?B:W)|P}); }
      }
    } else if(t===N||t===K){
      const offs=t===N?KN_OFF:ALL8;
      for(const o of offs){const to=s+o;
        if(!onBoard(to))continue;
        if(!b[to]||(b[to]&8)!==(white?8:16))push(s,to)}
      if(t===K){
        const hr=white?0:7, e=sq88(4,hr), kSq=sq88(6,hr), qSq=sq88(2,hr);
        const kRight=white?st.cast.K:st.cast.k, qRight=white?st.cast.Q:st.cast.q;
        if(s===e&&!inCheck(st,white)){
          if(kRight&&!b[sq88(5,hr)]&&!b[kSq]&&!isAttacked(st,sq88(5,hr),!white)&&!isAttacked(st,kSq,!white))
            push(s,kSq,{castle:'k'});
          if(qRight&&!b[sq88(3,hr)]&&!b[qSq]&&!b[sq88(1,hr)]&&!isAttacked(st,sq88(3,hr),!white)&&!isAttacked(st,qSq,!white))
            push(s,qSq,{castle:'q'});
        }
      }
    } else {
      const dirs=t===Bp?DIAG:t===R?ORTH:ALL8;
      for(const o of dirs){let to=s+o;
        while(onBoard(to)){
          if(!b[to])push(s,to);
          else{if((b[to]&8)!==(white?8:16))push(s,to);break}
          to+=o}}
    }
  }
  return moves;
}

function makeMove(st,m){
  const u={m,cast:{...st.cast},ep:st.ep,half:st.half,full:st.full,captured:m.captured,capturedSq:m.to,epCap:!!m.epCap,dbl:!!m.dbl};
  const b=st.board, white=st.turn==='w';
  b[m.from]=0;
  b[m.to]=m.promo?((white?W:B)|m.promo):m.piece;
  if(m.epCap)b[m.to+(white?-16:16)]=0;
  if(m.castle){
    const hr=white?0:7;
    const rf=m.castle==='k'?sq88(7,hr):sq88(0,hr);
    const rt=m.castle==='k'?sq88(5,hr):sq88(3,hr);
    b[rt]=b[rf];b[rf]=0;
  }
  // castling rights
  if(typeOf(m.piece)===K){if(white){st.cast.K=st.cast.Q=false}else{st.cast.k=st.cast.q=false}}
  if(m.from===0||m.to===0)st.cast.Q=false;
  if(m.from===7||m.to===7)st.cast.K=false;
  if(m.from===112||m.to===112)st.cast.q=false;
  if(m.from===119||m.to===119)st.cast.k=false;
  st.ep=m.dbl?(m.from+(white?16:-16)):-1;
  st.half=(typeOf(m.piece)===P||m.captured)?0:st.half+1;
  if(!white)st.full++;
  st.turn=white?'b':'w';
  return u;
}
function unmakeMove(st,u){
  const m=u.m, b=st.board, whiteMover=(m.piece&8)===8;
  st.turn=whiteMover?'w':'b';
  b[m.from]=m.piece;b[m.to]=0;
  if(u.captured)b[u.epCap?(m.to+(whiteMover?-16:16)):m.to]=u.captured;
  if(m.promo)b[m.from]=m.piece;
  if(m.castle){
    const hr=whiteMover?0:7;
    const rf=m.castle==='k'?sq88(7,hr):sq88(0,hr);
    const rt=m.castle==='k'?sq88(5,hr):sq88(3,hr);
    b[rf]=b[rt];b[rt]=0;
  }
  st.cast=u.cast;st.ep=u.ep;st.half=u.half;st.full=u.full;
}
function genLegal(st){
  const out=[], white=st.turn==='w';
  for(const m of genPseudo(st)){
    const u=makeMove(st,m);
    if(!inCheck(st,white))out.push(m);
    unmakeMove(st,u);
  }
  return out;
}
function sanOf(st,m,legal){
  legal=legal||genLegal(st);
  if(m.castle)return m.castle==='k'?'O-O':'O-O-O';
  const t=typeOf(m.piece);
  let s='';
  if(t===P){
    if(m.captured||m.epCap)s+=FILES[fileOf(m.from)]+'x';
    s+=sqName(m.to);
    if(m.promo)s+='='+' QRBN'[m.promo===Q?1:m.promo===R?2:m.promo===Bp?3:4];
  }else{
    s+=' PNBRQK'[t];
    const amb=legal.filter(x=>x!==m&&typeOf(x.piece)===t&&x.to===m.to&&x.from!==m.from);
    if(amb.length){
      const sameFile=amb.some(x=>fileOf(x.from)===fileOf(m.from));
      const sameRank=amb.some(x=>rankOf(x.from)===rankOf(m.from));
      if(!sameFile)s+=FILES[fileOf(m.from)];
      else if(!sameRank)s+=(rankOf(m.from)+1);
      else s+=sqName(m.from);
    }
    if(m.captured||m.epCap)s+='x';
    s+=sqName(m.to);
  }
  const u=makeMove(st,m);
  const oppMoves=genLegal(st);
  if(inCheck(st,st.turn==='w'))s+=oppMoves.length?'+':'#';
  unmakeMove(st,u);
  return s;
}
function posKey(st){
  let k='';
  for(let s=0;s<128;s++){if(s&0x88){s+=7;continue}const p=st.board[s];k+=p?String.fromCharCode(64+p):'.'}
  return k+st.turn+(st.cast.K?'K':'')+(st.cast.Q?'Q':'')+(st.cast.k?'k':'')+(st.cast.q?'q':'')+st.ep;
}
function insufficientMaterial(st){
  const pcs=[];
  for(let s=0;s<128;s++){if(s&0x88){s+=7;continue}const p=st.board[s];
    if(p&&typeOf(p)!==K)pcs.push({t:typeOf(p),sq:s})}
  if(pcs.length===0)return true;
  if(pcs.length===1&&(pcs[0].t===N||pcs[0].t===Bp))return true;
  if(pcs.length===2&&pcs.every(p=>p.t===Bp)){
    const c1=(fileOf(pcs[0].sq)+rankOf(pcs[0].sq))%2;
    const c2=(fileOf(pcs[1].sq)+rankOf(pcs[1].sq))%2;
    if(c1===c2)return true;
  }
  return false;
}
function uciOf(m){return sqName(m.from)+sqName(m.to)+(m.promo?({[Q]:'q',[R]:'r',[Bp]:'b',[N]:'n'})[m.promo]:'')}
function findByUci(st,uci){
  return genLegal(st).find(m=>uciOf(m)===uci)||null;
}
window.AzEngine={W,B,P,N,Bp,R,Q,K,newState,cloneState,genLegal,genPseudo,makeMove,unmakeMove,sanOf,inCheck,isAttacked,posKey,insufficientMaterial,uciOf,findByUci,sqName,nameSq,fileOf,rankOf,sq88,onBoard,typeOf,colorOf,parseFen};

/* ================= I18N ================= */
const I18N={
az:{newGame:'Yeni oyun',help:'Kömək',chooseMode:'Oyun rejimini seçin',playOnline:'Onlayn oyna',playOnlineSub:'P2P · 6 rəqəmli kod',
vsAI:'Kompüterə qarşı',vsAISub:'4 çətinlik səviyyəsi',passPlay:'Üz-üzə (Pass & Play)',passPlaySub:'Eyni cihazda 2 nəfər',
timeControl:'Vaxt nəzarəti',bullet:'Bullet',blitz:'Blitz',rapid:'Rapid',customTC:'Fərdi',minutes:'Dəqiqə',increment:'Artım (sn)',
difficulty:'Çətinlik',dEasy:'Asan',dMedium:'Orta',dHard:'Çətin',dGM:'Qrosmeyster',startGame:'Oyuna başla',
createRoom:'Otaq yarat',joinRoom:'Otağa qoşul',createHint:'6 rəqəmli kod yaradın və dostunuzla paylaşın.',
joinHint:'Dostunuzun 6 rəqəmli kodunu daxil edin.',copy:'Kopyala',copied:'Kopyalandı!',
waiting:'Rəqib gözlənilir…',connecting:'Qoşulur…',connected:'Qoşuldu!',connLost:'Bağlantı kəsildi',connErr:'Bağlantı xətası',
you:'Siz',opponent:'Rəqib',white:'Ağ',black:'Qara',resign:'Tərk et',offerDraw:'Heç-heçə',flip:'Çevir',moves:'Gedişlər',
copyPGN:'PGN kopyala',noMoves:'Hələ gediş yoxdur',promotion:'Piyadanı çevir',settings:'Tənzimləmələr',pieceSet:'Fiqur dəsti',
boardTheme:'Lövhə mövzusu',thBrown:'Qəhvəyi (Klassik)',thGreen:'Yaşıl (Chess.com)',thBlue:'Mavi',thPurple:'Bənövşəyi',
thNeon:'3D / Neon',thCustom:'Fərdi rəng',lightSquare:'Açıq xana',darkSquare:'Tünd xana',sound:'Səs effektləri',
autoFlip:'Avtomatik çevirmə',showEval:'Eval zolağı',premoveSound:'Premove səsi',rematch:'Revansh',
checkmate:'Mat!',stalemate:'Pat — heç-heçə',fiftyMove:'50 gediş qaydası — heç-heçə',repetition:'Üçqat təkrar — heç-heçə',
insufficient:'Kifayət qədər material yoxdur — heç-heçə',timeout:'Vaxt bitdi',whiteWins:'Ağlar qazandı',blackWins:'Qaralar qazandı',
drawGame:'Heç-heçə',resigned:'rəqibi oyunu tərk etdi',drawAgreed:'heç-heçə razılaşması',youWin:'Siz qazandınız! 🎉',
youLose:'Siz uduzdunuz',yourMove:'Sizin növbəniz',opponentThinking:'Rəqib düşünür…',premoveSet:'Premove quruldu (sağ klik — ləğv)',
drawOfferSent:'Heç-heçə təklifi göndərildi',drawOfferIn:'Rəqib heç-heçə təklif edir — qəbul edirsinizmi?',
aiThinking:'Kompüter düşünür…',level:'Səviyyə',roomReady:'Otaq hazırdı! Kodu paylaşın.',
helpItems:[
 '<b>Sürüklə-burax:</b> Fiquru sürükləyin və ya toxunub hədəf xanaya toxunun.',
 '<b>Premove:</b> Rəqib düşünərkən öz gedişinizi əvvəlcədən qeyd edin — narıncı ghost ilə görünür. Sağ klik ləğv edir.',
 '<b>Oxlar:</b> Sağ düyməni basıb sürüşdürün — ox çəkilir; bir xanaya basın — yaşıl vurğulama; yenidən basın — qırmızı.',
 '<b>Təhlil:</b> « ‹ › » düymələri ilə gedişlərə baxın. Gedişlər arasında naviqasiya təhlil rejimidir.',
 '<b>Eval zolağı:</b> Şaquli zolaq pozisiyanın kimin xeyrinə olduğunu göstərir (+ Ağ, − Qara).',
 '<b>Onlayn:</b> 6 rəqəmli kod və ya dəvət linki ilə P2P bağlantı — serverə ehtiyac yoxdur (PeerJS/ WebRTC).']},
en:{newGame:'New game',help:'Help',chooseMode:'Choose game mode',playOnline:'Play online',playOnlineSub:'P2P · 6-digit code',
vsAI:'Play vs computer',vsAISub:'4 difficulty levels',passPlay:'Pass & Play',passPlaySub:'2 players, one device',
timeControl:'Time control',bullet:'Bullet',blitz:'Blitz',rapid:'Rapid',customTC:'Custom',minutes:'Minutes',increment:'Increment (s)',
difficulty:'Difficulty',dEasy:'Easy',dMedium:'Medium',dHard:'Hard',dGM:'Grandmaster',startGame:'Start game',
createRoom:'Create room',joinRoom:'Join room',createHint:'Generate a 6-digit code and share it.',joinHint:'Enter your friend\u2019s 6-digit code.',
copy:'Copy',copied:'Copied!',waiting:'Waiting for opponent…',connecting:'Connecting…',connected:'Connected!',connLost:'Connection lost',connErr:'Connection error',
you:'You',opponent:'Opponent',white:'White',black:'Black',resign:'Resign',offerDraw:'Draw',flip:'Flip',moves:'Moves',
copyPGN:'Copy PGN',noMoves:'No moves yet',promotion:'Pawn promotion',settings:'Settings',pieceSet:'Piece set',
boardTheme:'Board theme',thBrown:'Brown (Classic)',thGreen:'Green (Chess.com)',thBlue:'Blue',thPurple:'Purple',
thNeon:'3D / Neon',thCustom:'Custom colors',lightSquare:'Light square',darkSquare:'Dark square',sound:'Sound effects',
autoFlip:'Auto-flip board',showEval:'Evaluation bar',premoveSound:'Premove sound',rematch:'Rematch',
checkmate:'Checkmate!',stalemate:'Stalemate — draw',fiftyMove:'Fifty-move rule — draw',repetition:'Threefold repetition — draw',
insufficient:'Insufficient material — draw',timeout:'Time out',whiteWins:'White wins',blackWins:'Black wins',
drawGame:'Draw',resigned:'resigned',drawAgreed:'draw agreed',youWin:'You win! 🎉',youLose:'You lose',
yourMove:'Your move',opponentThinking:'Opponent is thinking…',premoveSet:'Premove set (right-click to cancel)',
drawOfferSent:'Draw offer sent',drawOfferIn:'Opponent offers a draw — accept?',aiThinking:'Computer is thinking…',level:'Level',roomReady:'Room ready! Share the code.',
helpItems:[
 '<b>Drag & drop:</b> Drag a piece or tap it, then tap the target square.',
 '<b>Premove:</b> While the opponent thinks, pre-play your move — shown as an orange ghost. Right-click cancels.',
 '<b>Arrows:</b> Hold right button and drag to draw an arrow; click a square to highlight green; click again for red.',
 '<b>Analysis:</b> Use « ‹ › » to browse moves — history navigation is analysis mode.',
 '<b>Eval bar:</b> The vertical bar shows which side is better (+ White, − Black).',
 '<b>Online:</b> Connect P2P with a 6-digit code or invite link — no server needed (PeerJS/WebRTC).']},
ru:{newGame:'Новая игра',help:'Помощь',chooseMode:'Выберите режим',playOnline:'Играть онлайн',playOnlineSub:'P2P · 6-значный код',
vsAI:'Против компьютера',vsAISub:'4 уровня сложности',passPlay:'Вдвоём (Pass & Play)',passPlaySub:'2 игрока, одно устройство',
timeControl:'Контроль времени',bullet:'Bullet',blitz:'Blitz',rapid:'Rapid',customTC:'Свой',minutes:'Минуты',increment:'Инкремент (с)',
difficulty:'Сложность',dEasy:'Лёгкий',dMedium:'Средний',dHard:'Сложный',dGM:'Гроссмейстер',startGame:'Начать игру',
createRoom:'Создать комнату',joinRoom:'Присоединиться',createHint:'Создайте 6-значный код и поделитесь им.',joinHint:'Введите 6-значный код друга.',
copy:'Копировать',copied:'Скопировано!',waiting:'Ожидание соперника…',connecting:'Подключение…',connected:'Подключено!',connLost:'Соединение потеряно',connErr:'Ошибка соединения',
you:'Вы',opponent:'Соперник',white:'Белые',black:'Чёрные',resign:'Сдаться',offerDraw:'Ничья',flip:'Перевернуть',moves:'Ходы',
copyPGN:'Копировать PGN',noMoves:'Ходов пока нет',promotion:'Превращение пешки',settings:'Настройки',pieceSet:'Набор фигур',
boardTheme:'Тема доски',thBrown:'Коричневая (классика)',thGreen:'Зелёная (Chess.com)',thBlue:'Синяя',thPurple:'Фиолетовая',
thNeon:'3D / Неон',thCustom:'Свои цвета',lightSquare:'Светлая клетка',darkSquare:'Тёмная клетка',sound:'Звуковые эффекты',
autoFlip:'Автоповорот доски',showEval:'Оценка позиции',premoveSound:'Звук premove',rematch:'Реванш',
checkmate:'Мат!',stalemate:'Пат — ничья',fiftyMove:'Правило 50 ходов — ничья',repetition:'Троекратное повторение — ничья',
insufficient:'Недостаточно материала — ничья',timeout:'Время вышло',whiteWins:'Белые победили',blackWins:'Чёрные победили',
drawGame:'Ничья',resigned:'сдался',drawAgreed:'ничья по согласию',youWin:'Вы победили! 🎉',youLose:'Вы проиграли',
yourMove:'Ваш ход',opponentThinking:'Соперник думает…',premoveSet:'Premove задан (правая кнопка — отмена)',
drawOfferSent:'Предложение ничьи отправлено',drawOfferIn:'Соперник предлагает ничью — принять?',aiThinking:'Компьютер думает…',level:'Уровень',roomReady:'Комната готова! Поделитесь кодом.',
helpItems:[
 '<b>Перетаскивание:</b> Перетащите фигуру или коснитесь её, затем коснитесь целевой клетки.',
 '<b>Premove:</b> Пока соперник думает, заранее сыграйте ход — оранжевый ghost. Правая кнопка отменяет.',
 '<b>Стрелки:</b> Зажмите правую кнопку и тяните — стрелка; клик по клетке — зелёная подсветка; ещё клик — красная.',
 '<b>Анализ:</b> Кнопками « ‹ › » листайте ходы.',
 '<b>Оценка:</b> Вертикальная полоса показывает, чья позиция лучше (+ белые, − чёрные).',
 '<b>Онлайн:</b> P2P через 6-значный код или ссылку — без сервера (PeerJS/WebRTC).']}
};
function t(k){const d=I18N[App.settings.lang]||I18N.az;return d[k]!==undefined?d[k]:(I18N.az[k]||k)}
function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n)});
  const hl=document.getElementById('helpList');
  if(hl)hl.innerHTML=(I18N[App.settings.lang]||I18N.az).helpItems.map(x=>'<li>'+x+'</li>').join('');
}

/* ================= SETTINGS ================= */
const DEFAULT_SETTINGS={lang:'az',pieceSet:'cburnett',theme:'brown',customLight:'#f0d9b5',customDark:'#b58863',
  sound:true,autoFlip:true,showEval:true,premoveSnd:true};
const App={
  mode:'ai', aiLevel:2, pendingMode:'ai',
  state:newState(), history:[], repKeys:[],
  viewPly:0, orientation:'w',
  selected:null, legalCache:[], legalForSel:[],
  premove:null,
  arrows:[], highlights:[],
  over:false, result:null, started:false,
  clocks:{w:0,b:0,inc:0}, timerId:null,
  myColor:'w',
  settings:Object.assign({},DEFAULT_SETTINGS),
  drag:null, tc:{min:10,inc:0},
  lastEval:0,
};
try{const s=JSON.parse(localStorage.getItem('azchess_settings')||'null');
  if(s)Object.assign(App.settings,s)}catch(e){}
function saveSettings(){localStorage.setItem('azchess_settings',JSON.stringify(App.settings))}

const THEMES={brown:['#f0d9b5','#b58863'],green:['#eeeed2','#769656'],blue:['#dee3e6','#8ca2ad'],
  purple:['#e9dcf5','#7d5ba6'],neon:['#2e3a59','#141b2e']};
function applyTheme(){
  const s=App.settings;
  document.body.classList.remove('theme-neon');
  let light,dark;
  if(s.theme==='custom'){light=s.customLight;dark=s.customDark}
  else{[light,dark]=THEMES[s.theme]||THEMES.brown}
  document.documentElement.style.setProperty('--light',light);
  document.documentElement.style.setProperty('--dark',dark);
  if(s.theme==='neon'){document.body.classList.add('theme-neon');
    document.documentElement.style.setProperty('--board-frame','#0d1220')}
  else document.documentElement.style.setProperty('--board-frame','#1c2230');
}

/* ================= SOUND (Web Audio) ================= */
let AC=null;
function ac(){if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();return AC}
function tone(freq,dur,type,vol,when,slide){
  if(!App.settings.sound)return;
  try{
    const a=ac(),o=a.createOscillator(),g=a.createGain();
    o.type=type||'sine';o.frequency.setValueAtTime(freq,a.currentTime+(when||0));
    if(slide)o.frequency.exponentialRampToValueAtTime(slide,a.currentTime+(when||0)+dur);
    g.gain.setValueAtTime(0.0001,a.currentTime+(when||0));
    g.gain.exponentialRampToValueAtTime(vol||0.25,a.currentTime+(when||0)+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+(when||0)+dur);
    o.connect(g);g.connect(a.destination);
    o.start(a.currentTime+(when||0));o.stop(a.currentTime+(when||0)+dur+0.05);
  }catch(e){}
}
const SFX={
  move(){tone(340,0.09,'triangle',0.3);tone(220,0.07,'sine',0.18,0.01)},
  capture(){tone(520,0.07,'square',0.14);tone(240,0.12,'triangle',0.3,0.02);tone(140,0.14,'sine',0.22,0.03)},
  check(){tone(660,0.1,'square',0.13);tone(880,0.14,'triangle',0.22,0.08)},
  castle(){tone(300,0.08,'triangle',0.25);tone(380,0.08,'triangle',0.25,0.09)},
  gameover(win){const f=win?[520,660,780]:[500,380,260];f.forEach((x,i)=>tone(x,0.22,'triangle',0.25,i*0.16))},
  notify(){tone(760,0.09,'sine',0.2);tone(1020,0.12,'sine',0.2,0.1)},
  warn(){tone(880,0.07,'square',0.12);tone(880,0.07,'square',0.12,0.12)},
  premove(){tone(980,0.05,'sine',0.18)},
  low(){tone(1200,0.06,'square',0.1)},
};

/* ================= PIECES ================= */
const UNI={wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'};
const TYPE_CH={[K]:'K',[Q]:'Q',[R]:'R',[Bp]:'B',[N]:'N',[P]:'P'};
function pieceHTML(p){
  const c=(p&8)?'w':'b', ch=c+TYPE_CH[typeOf(p)];
  if(App.settings.pieceSet==='unicode')
    return '<span class="unicode '+c+'">'+UNI[ch]+'</span>';
  const url='https://lichess1.org/assets/piece/'+App.settings.pieceSet+'/'+ch+'.svg';
  return '<img src="'+url+'" alt="'+ch+'" draggable="false" onerror="this.outerHTML=\'<span class=&quot;unicode '+c+'&quot;>'+UNI[ch]+'</span>\'">';
}
function pieceSpan(p){ // for captured / promo (no onerror swap complexities)
  return pieceHTML(p);
}

/* ================= BOARD RENDER ================= */
const boardEl=document.getElementById('board');
const arrowLayer=document.getElementById('arrowLayer');
function displayState(){
  if(App.viewPly<App.history.length){
    const st=newState();
    for(let i=0;i<App.viewPly;i++)makeMove(st,App.history[i].move);
    return st;
  }
  return App.state;
}
function boardSquares(){
  const out=[];
  for(let r=7;r>=0;r--)for(let f=0;f<8;f++){
    if(App.orientation==='w')out.push(sq88(f,r));
    else out.push(sq88(7-f,7-r));
  }
  return out;
}
function renderBoard(){
  const st=displayState();
  const squares=boardSquares();
  const last=App.history.length&&App.viewPly===App.history.length?App.history[App.history.length-1].move:null;
  const checkedSide=inCheck(st,st.turn==='w')?st.turn:null;
  const kSq=checkedSide?kingSqSafe(st,checkedSide==='w'):-1;
  boardEl.innerHTML='';
  for(const s of squares){
    const d=document.createElement('div');
    const lightSq=(fileOf(s)+rankOf(s))%2===1;
    d.className='sq '+(lightSq?'light':'dark');
    d.dataset.sq=s;
    if(last&&(s===last.from||s===last.to))d.classList.add('lastmove');
    if(App.selected===s)d.classList.add('sel');
    if(App.premove&&(s===App.premove.from||s===App.premove.to))d.classList.add('premove-ghost');
    if(App.highlights.some(h=>h.sq===s))d.classList.add(App.highlights.find(h=>h.sq===s).color==='g'?'hl-green':'hl-red');
    if(s===kSq)d.classList.add('check-glow');
    const lm=App.legalForSel.find(m=>m.to===s);
    if(lm)d.classList.add('dot'), lm.captured&&d.classList.add('cap');
    const p=st.board[s];
    if(p){const pd=document.createElement('div');pd.className='piece';pd.innerHTML=pieceHTML(p);d.appendChild(pd)}
    // coordinates
    const r=rankOf(s),f=fileOf(s);
    const bottomRow=(App.orientation==='w'&&r===0)||(App.orientation==='b'&&r===7);
    const leftFile=(App.orientation==='w'&&f===0)||(App.orientation==='b'&&f===7);
    if(bottomRow)d.insertAdjacentHTML('beforeend','<span class="coord f">'+FILES[f]+'</span>');
    if(leftFile)d.insertAdjacentHTML('beforeend','<span class="coord r">'+(r+1)+'</span>');
    boardEl.appendChild(d);
  }
  renderArrows();
}
function kingSqSafe(st,white){return kingSq(st,white)}

function renderArrows(){
  const W_=boardEl.clientWidth, cell=W_/8;
  arrowLayer.setAttribute('viewBox','0 0 '+W_+' '+W_);
  arrowLayer.innerHTML='<defs><marker id="ah" markerWidth="4" markerHeight="4" refX="2.05" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="context-stroke"/></marker></defs>';
  for(const a of App.arrows){
    const sqs=boardSquares();
    const idx=s=>sqs.indexOf(s);
    const p1=center(idx(a.from)),p2=center(idx(a.to));
    function center(i){return {x:(i%8)*cell+cell/2,y:Math.floor(i/8)*cell+cell/2}}
    const dx=p2.x-p1.x,dy=p2.y-p1.y,len=Math.hypot(dx,dy);
    const ux=dx/len,uy=dy/len, shorten=cell*0.36;
    const x1=p1.x+ux*cell*0.18,y1=p1.y+uy*cell*0.18;
    const x2=p2.x-ux*shorten,y2=p2.y-uy*shorten;
    const col=a.color==='r'?'rgba(248,113,113,.85)':'rgba(74,222,128,.85)';
    const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
    ln.setAttribute('x1',x1);ln.setAttribute('y1',y1);ln.setAttribute('x2',x2);ln.setAttribute('y2',y2);
    ln.setAttribute('stroke',col);ln.setAttribute('stroke-width',cell*0.14);
    ln.setAttribute('stroke-linecap','round');ln.setAttribute('marker-end','url(#ah)');
    arrowLayer.appendChild(ln);
  }
}

/* ================= UI HELPERS ================= */
function $(id){return document.getElementById(id)}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2200)}
function fmtClock(ms){
  ms=Math.max(0,ms);
  const s=Math.ceil(ms/1000);
  if(s>=20){const m=Math.floor(s/60);return m+':'+String(s%60).padStart(2,'0')}
  const t=(ms/1000).toFixed(1);return t;
}
function sideTop(){return App.orientation==='w'?'b':'w'}

function updatePanels(){
  const top=sideTop(), bot=App.orientation;
  const nameOf=c=>{
    if(App.mode==='ai')return c===(App.myColor==='w'?'w':'b')?t('you'):t('vsAI')+' · '+t('level')+' '+App.aiLevel;
    if(App.mode==='online')return c===App.myColor?t('you'):t('opponent');
    return c==='w'?t('white'):t('black');
  };
  const subOf=c=>App.mode==='local'?(c===bot?t('passPlay'):t('passPlay')):(c===App.myColor?'':'');
  $('nameTop').textContent=nameOf(top);$('nameBottom').textContent=nameOf(bot);
  $('avatarTop').textContent=top==='w'?'♔':'♚';$('avatarBottom').textContent=bot==='w'?'♔':'♚';
  $('subTop').textContent=t(top==='w'?'white':'black');$('subBottom').textContent=t(bot==='w'?'white':'black');
  // clocks
  $('clockTop').textContent=fmtClock(App.clocks[top]);
  $('clockBottom').textContent=fmtClock(App.clocks[bot]);
  const active=!App.over&&App.started?App.state.turn:null;
  $('clockTop').classList.toggle('active',active===top);
  $('clockBottom').classList.toggle('active',active===bot);
  $('clockTop').classList.toggle('low',App.clocks[top]<20000&&App.clocks[top]>0);
  $('clockBottom').classList.toggle('low',App.clocks[bot]<20000&&App.clocks[bot]>0);
  renderCaptured(top,'capTop');renderCaptured(bot,'capBottom');
  // status
  let st=t('yourMove');
  if(App.over)st='';
  else if(!App.started)st='AzChess';
  else if(App.mode==='ai'&&App.state.turn!==App.myColor)st=t('aiThinking');
  else if(App.mode==='online'&&App.state.turn!==App.myColor)st=t('opponentThinking');
  else if(App.mode==='local')st=(App.state.turn==='w'?t('white'):t('black'))+' — '+t('yourMove').toLowerCase();
  else st=t('yourMove');
  if(App.viewPly<App.history.length)st='⏪ '+(App.viewPly/2|0 || '')+' — '+(App.viewPly)+'/'+App.history.length;
  $('statusLine').textContent=st;
}
function renderCaptured(side,elId){
  const el=$(elId);el.innerHTML='';
  const mine=side==='w'?W:B, theirs=side==='w'?B:W;
  let mat=0;const vals={[P]:1,[N]:3,[Bp]:3,[R]:5,[Q]:9};
  const caps=[];
  for(const h of App.history){if(h.move.captured&&(h.move.captured&8)===(side==='w'?8:16))caps.push(h.move.captured)}
  caps.sort((a,b)=>vals[typeOf(b)]-vals[typeOf(a)]);
  let oppLost=0,myLost=0;
  const oppCaps=[],myCaps=[];
  for(const h of App.history){
    const cap=h.move.captured;if(!cap)continue;
    if((cap&8)===(side==='w'?16:8)){} // captured by me means captured piece is opponent color
  }
  // material diff from board
  let mineV=0,oppV=0;
  const st=App.state;
  for(let s=0;s<128;s++){if(s&0x88){s+=7;continue}const p=st.board[s];
    if(p&&typeOf(p)!==K){if((p&8)===(side==='w'?8:16))mineV+=vals[typeOf(p)];else oppV+=vals[typeOf(p)]}}
  const diff=mineV-oppV;
  for(const c of caps){const sp=document.createElement('span');
    if(App.settings.pieceSet==='unicode'){sp.textContent=UNI[((c&8)?'w':'b')+TYPE_CH[typeOf(c)]]}
    else{const img=document.createElement('img');const ch=((c&8)?'w':'b')+TYPE_CH[typeOf(c)];
      img.src='https://lichess1.org/assets/piece/'+App.settings.pieceSet+'/'+ch+'.svg';
      img.onerror=()=>{img.outerHTML='<span>'+UNI[ch]+'</span>'};img.draggable=false;sp.appendChild(img)}
    el.appendChild(sp)}
  if(diff>0){const d=document.createElement('span');d.className='mat-diff';d.textContent='+'+diff;el.appendChild(d)}
}

/* ================= EVAL BAR ================= */
function updateEval(cp){
  if(cp===undefined)cp=window.AzAI?AzAI.evalState(App.state)*100:0;
  App.lastEval=cp;
  const pct=1/(1+Math.exp(-0.0036548*cp));
  const h=(pct*100).toFixed(1)+'%';
  $('evalWhite').style.height=h;$('evalWhite2').style.width=h;
  const label=(cp>=0?'+':'')+(cp/100).toFixed(1);
  $('evalLabel').textContent=label;$('evalLabel2').textContent=label;
  $('evalWrap').style.display=App.settings.showEval?'':'none';
  $('evalFloat').style.display=App.settings.showEval?'':'none';
}

/* ================= MOVE LIST ================= */
function renderMoves(){
  const ml=$('moveList');
  if(!App.history.length){ml.innerHTML='<div class="moves-empty">'+t('noMoves')+'</div>';return}
  let html='';
  for(let i=0;i<App.history.length;i+=2){
    html+='<div class="mv-row"><span class="mv-num">'+(i/2+1)+'.</span>';
    html+='<span class="mv'+(App.viewPly===i+1?' current':'')+'" data-ply="'+(i+1)+'">'+App.history[i].san+'</span>';
    if(App.history[i+1])html+='<span class="mv'+(App.viewPly===i+2?' current':'')+'" data-ply="'+(i+2)+'">'+App.history[i+1].san+'</span>';
    else html+='<span></span>';
    html+='</div>';
  }
  ml.innerHTML=html;
  ml.querySelectorAll('.mv').forEach(el=>el.onclick=()=>{App.viewPly=+el.dataset.ply;App.selected=null;App.legalForSel=[];renderBoard();renderMoves();updatePanels()});
  ml.scrollTop=ml.scrollHeight;
}
function buildPGN(){
  let pgn='';
  for(let i=0;i<App.history.length;i+=2){
    pgn+=(i/2+1)+'. '+App.history[i].san+' '+(App.history[i+1]?App.history[i+1].san+' ':'');
  }
  if(App.result){
    const res=App.result.winner==='w'?'1-0':App.result.winner==='b'?'0-1':'1/2-1/2';
    pgn+=res;
  }
  return pgn.trim();
}

/* ================= GAME FLOW ================= */
function canControl(){
  if(App.over||!App.started)return false;
  if(App.viewPly<App.history.length)return false;
  if(App.mode==='local')return true;
  return App.state.turn===App.myColor;
}
function canPremove(){
  if(App.over||!App.started)return false;
  if(App.viewPly<App.history.length)return false;
  if(App.mode==='local')return false;
  return App.state.turn!==App.myColor;
}
function playSoundFor(m,stBefore){
  if(m.castle){SFX.castle();return}
  const givesCheck=inCheck(App.state,App.state.turn==='w');
  if(m.captured||m.epCap)SFX.capture();
  else SFX.move();
  if(givesCheck)setTimeout(SFX.check,110);
}
function afterMove(m,fromNetwork){
  const san=sanOf(App.state,m); // note: called BEFORE makeMove? no — we made already. Fix: compute before.
  return san;
}
function doMove(m,opts){
  opts=opts||{};
  const san=sanOf(App.state,m,App.legalCache.length?App.legalCache:undefined);
  const moverWhite=App.state.turn==='w';
  makeMove(App.state,m);
  App.history.push({move:m,san});
  App.repKeys.push(posKey(App.state));
  App.viewPly=App.history.length;
  App.selected=null;App.legalForSel=[];
  App.arrows=[];App.highlights=[];
  // clock increment
  if(App.started&&!App.over){
    App.clocks[moverWhite?'w':'b']+=App.clocks.inc*1000;
  }
  playSoundFor(m);
  renderBoard();renderMoves();updatePanels();updateEval();
  // repetition / fifty / insufficient
  const rep=App.repKeys.filter(k=>k===App.repKeys[App.repKeys.length-1]).length;
  if(rep>=3)return endGame({winner:null,reason:'repetition'});
  if(App.state.half>=100)return endGame({winner:null,reason:'fiftyMove'});
  if(insufficientMaterial(App.state))return endGame({winner:null,reason:'insufficient'});
  const legal=genLegal(App.state);
  if(!legal.length){
    if(inCheck(App.state,App.state.turn==='w'))
      return endGame({winner:App.state.turn==='w'?'b':'w',reason:'checkmate'});
    return endGame({winner:null,reason:'stalemate'});
  }
  App.legalCache=legal;
  // online: send move
  if(App.mode==='online'&&!fromNetwork_ && window.AzNet)AzNet.sendMove(m);
  // premove execute
  if(App.premove&&canControl()===false&&App.mode!=='local'){/*turn switched to us below*/}
  if(App.premove&&App.state.turn===App.myColor&&App.mode!=='local'){
    const pm=App.premove;App.premove=null;
    setTimeout(()=>{
      const mv=genLegal(App.state).find(x=>x.from===pm.from&&x.to===pm.to&&(!x.promo||x.promo===Q));
      const pmv=mv||genLegal(App.state).find(x=>x.from===pm.from&&x.to===pm.to);
      if(pmv)doMove(pmv);
      else renderBoard();
    },100);
  } else if(App.premove){App.premove=null;renderBoard()}
  // AI move
  if(App.mode==='ai'&&!App.over&&App.state.turn!==App.myColor){
    setTimeout(aiMove,260);
  }
}
let fromNetwork_=false;
function endGame(res){
  if(App.over)return;
  App.over=true;App.result=res;App.started=false;
  stopClock();
  const iWon=res.winner&&(App.mode==='local'?true:res.winner===App.myColor);
  SFX.gameover(res.winner?iWon:false);
  renderMoves();updatePanels();
  const reasonKey={checkmate:'checkmate',stalemate:'stalemate',fiftyMove:'fiftyMove',repetition:'repetition',insufficient:'insufficient',timeout:'timeout',resign:'resign',drawAgreed:'drawAgreed'};
  let title;
  if(App.mode==='local'||App.mode==='ai'&&!res.winner)title=res.winner?(res.winner==='w'?t('whiteWins'):t('blackWins')):t('drawGame');
  else if(App.mode==='ai'||App.mode==='online'){
    if(!res.winner)title=t('drawGame');
    else title=res.winner===App.myColor?t('youWin'):t('youLose');
  } else title=t('drawGame');
  $('overEmoji').textContent=res.winner?(res.winner===App.myColor||App.mode==='local'?'🏆':'😔'):'🤝';
  $('overTitle').textContent=title;
  const rsn=res.reason==='resign'?(res.winner==='w'?t('black'):t('white'))+' '+t('resigned')
    :res.reason==='drawAgreed'?t('drawAgreed'):t(reasonKey[res.reason]||res.reason);
  $('overReason').textContent=rsn;
  openModal('modalOver');
}

/* ================= CLOCK ================= */
function startClock(){
  stopClock();
  App.timerId=setInterval(()=>{
    if(App.over||!App.started)return;
    const side=App.state.turn;
    App.clocks[side]-=100;
    if(App.clocks[side]<=6000&&App.clocks[side]>0&&Math.ceil(App.clocks[side]/1000)!==Math.ceil((App.clocks[side]+100)/1000)&&App.clocks[side]%1000<100)SFX.low();
    if(App.clocks[side]<=0){
      App.clocks[side]=0;
      endGame({winner:side==='w'?'b':'w',reason:'timeout'});
    }
    updatePanels();
  },100);
}
function stopClock(){if(App.timerId){clearInterval(App.timerId);App.timerId=null}}

/* ================= INPUT: click + drag + premove + arrows ================= */
function sqFromEvent(e){
  const el=document.elementFromPoint(e.clientX,e.clientY);
  const sqEl=el&&el.closest?el.closest('.sq'):null;
  return sqEl?+sqEl.dataset.sq:-1;
}
function selectSquare(s){
  App.selected=s;
  App.legalForSel=App.legalCache.filter(m=>m.from===s);
  renderBoard();
}
function tryHumanMove(from,to){
  const candidates=App.legalCache.filter(m=>m.from===from&&m.to===to);
  if(!candidates.length)return false;
  if(candidates.length>1&&candidates[0].promo){
    askPromotion(App.state.turn==='w').then(q=>{
      const m=candidates.find(x=>x.promo===q);
      if(m)doMove(m);
    });
    return true;
  }
  doMove(candidates[0]);
  return true;
}
function handleBoardDown(e){
  if(e.button===2)return; // right handled separately
  const s=sqFromEvent(e);
  if(s<0)return;
  const st=displayState();
  const p=st.board[s];
  // premove mode
  if(canPremove()){
    const mine=(p&8)===(App.myColor==='w'?8:16);
    if(mine){App.premove={from:s,to:null};SFX.premove&&App.settings.premoveSnd&&SFX.premove();selectSquare(s);return}
    if(App.premove&&App.premove.from!=null){
      // complete premove if pseudo-legal
      const pseudo=genPseudo(st).filter(m=>m.from===App.premove.from&&m.to===s);
      if(pseudo.length){
        const isPromo=pseudo.some(m=>m.promo);
        if(isPromo){
          askPromotion(App.myColor==='w').then(q=>{
            App.premove={from:App.premove.from,to:s,promo:q};
            toast(t('premoveSet'));renderBoard();
          });
        }else{
          App.premove={from:App.premove.from,to:s};
          toast(t('premoveSet'));SFX.pnotify;renderBoard();
        }
      } else {App.premove=null;renderBoard()}
      return;
    }
    App.selected=null;App.legalForSel=[];renderBoard();return;
  }
  if(!canControl()){App.selected=null;App.legalForSel=[];renderBoard();return}
  const myTurnPiece=p&&((p&8)===(App.state.turn==='w'?8:16));
  if(App.selected!=null&&App.legalForSel.some(m=>m.to===s)){
    tryHumanMove(App.selected,s);
    return;
  }
  if(myTurnPiece){
    selectSquare(s);
    App.drag={from:s,startX:e.clientX,startY:e.clientY,moved:false,piece:p,ghost:null,pointerId:e.pointerId};
    boardEl.setPointerCapture&&boardEl.setPointerCapture(e.pointerId);
  }else{
    App.selected=null;App.legalForSel=[];renderBoard();
  }
}
function handleBoardMove(e){
  if(!App.drag)return;
  const dx=e.clientX-App.drag.startX,dy=e.clientY-App.drag.startY;
  if(!App.drag.moved&&Math.hypot(dx,dy)>7){
    App.drag.moved=true;
    const g=document.createElement('div');g.className='drag-ghost';
    g.innerHTML='<div class="piece">'+pieceHTML(App.drag.piece)+'</div>';
    document.body.appendChild(g);App.drag.ghost=g;
  }
  if(App.drag.ghost){App.drag.ghost.style.left=e.clientX+'px';App.drag.ghost.style.top=e.clientY+'px'}
  const s=sqFromEvent(e);
  boardEl.querySelectorAll('.sq.hover-tgt').forEach(x=>x.classList.remove('hover-tgt'));
  if(s>=0&&App.legalForSel.some(m=>m.to===s)){
    const el=boardEl.querySelector('.sq[data-sq="'+s+'"]');if(el)el.classList.add('hover-tgt');
  }
}
function handleBoardUp(e){
  const d=App.drag;App.drag=null;
  boardEl.querySelectorAll('.sq.hover-tgt').forEach(x=>x.classList.remove('hover-tgt'));
  if(!d)return;
  if(d.ghost){d.ghost.remove()}
  if(d.moved){
    const s=sqFromEvent(e);
    if(s>=0&&s!==d.from){
      if(canPremove()&&App.premove){App.premove={from:d.from,to:s};toast(t('premoveSet'));renderBoard();return}
      tryHumanMove(d.from,s);
    } else renderBoard();
  }
}
// Right-click: cancel premove / draw arrows / highlights
let rDrag=null;
function handleRightDown(e){
  e.preventDefault();
  const s=sqFromEvent(e);
  if(s<0)return;
  if(App.premove){App.premove=null;renderBoard();toast('✕');return}
  rDrag={from:s,x:e.clientX,y:e.clientY,moved:false};
}
function handleRightMove(e){
  if(!rDrag)return;
  if(Math.hypot(e.clientX-rDrag.x,e.clientY-rDrag.y)>10)rDrag.moved=true;
}
function handleRightUp(e){
  const d=rDrag;rDrag=null;
  if(!d)return;
  const s=sqFromEvent(e);
  if(d.moved&&s>=0&&s!==d.from){
    // arrow: alternate green/red
    const existing=App.arrows.findIndex(a=>a.from===d.from&&a.to===s);
    const count=App.arrows.length;
    App.arrows.push({from:d.from,to:s,color:count%2?'r':'g'});
  } else if(s>=0){
    const ex=App.highlights.find(h=>h.sq===s);
    if(!ex)App.highlights.push({sq:s,color:'g'});
    else if(ex.color==='g')ex.color='r';
    else App.highlights=App.highlights.filter(h=>h.sq!==s);
  }
  renderBoard();
}

/* ================= PROMOTION MODAL ================= */
let promoResolve=null;
function askPromotion(white){
  return new Promise(res=>{
    promoResolve=res;
    const row=$('promoRow');row.innerHTML='';
    for(const ty of [Q,R,Bp,N]){
      const b=document.createElement('button');b.className='promo-btn';
      const p=(white?W:B)|ty;
      b.innerHTML=pieceSpan(p);
      b.onclick=()=>{closeModal('modalPromo');res(ty);promoResolve=null};
      row.appendChild(b);
    }
    openModal('modalPromo');
  });
}

/* ================= MODALS ================= */
function openModal(id){$(id).classList.remove('hidden')}
function closeModal(id){
  $(id).classList.add('hidden');
  if(id==='modalOnline'&&window.AzNet)AzNet.cleanupIfUnconnected();
  if(id==='modalPromo'&&promoResolve){promoResolve(Q);promoResolve=null}
}
document.querySelectorAll('.modal-backdrop').forEach(bd=>{
  bd.addEventListener('click',e=>{
    if(e.target===bd)closeModal(bd.id);
    // backdrop close resets unconnected P2P
  });
});
document.querySelectorAll('[data-close]').forEach(btn=>{
  btn.addEventListener('click',()=>closeModal(btn.closest('.modal-backdrop').id));
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m=>{
    if(m.id!=='modalPromo')closeModal(m.id);
  });
  if(e.key==='ArrowLeft')navPly(-1);
  if(e.key==='ArrowRight')navPly(1);
});

/* ================= NAVIGATION ================= */
function navPly(d){
  if(!App.history.length)return;
  App.viewPly=Math.max(0,Math.min(App.history.length,App.viewPly+d));
  App.selected=null;App.legalForSel=[];
  renderBoard();renderMoves();updatePanels();
}
$('navFirst').onclick=()=>{App.viewPly=0;renderBoard();renderMoves();updatePanels()};
$('navPrev').onclick=()=>navPly(-1);
$('navNext').onclick=()=>navPly(1);
$('navLast').onclick=()=>{App.viewPly=App.history.length;renderBoard();renderMoves();updatePanels()};
$('btnCopyPGN').onclick=()=>{
  navigator.clipboard&&navigator.clipboard.writeText(buildPGN()).then(()=>toast(t('copied'))).catch(()=>toast(buildPGN()));
};
$('btnFlip').onclick=()=>{App.orientation=App.orientation==='w'?'b':'w';renderBoard();updatePanels();updateEval()};
$('btnResign').onclick=()=>{
  if(App.over||!App.started)return;
  if(App.mode==='online'&&window.AzNet)AzNet.send({t:'resign'});
  endGame({winner:App.state.turn==='w'?'b':'w',reason:'resign'});
};
$('btnDraw').onclick=()=>{
  if(App.over||!App.started)return;
  if(App.mode==='online'&&window.AzNet){AzNet.send({t:'drawOffer'});toast(t('drawOfferSent'));return}
  if(App.mode==='ai'){if(confirm(t('drawOfferIn')))endGame({winner:null,reason:'drawAgreed'});return}
  if(confirm(t('drawOfferIn')))endGame({winner:null,reason:'drawAgreed'});
};
$('btnHelp').onclick=()=>openModal('modalHelp');
$('btnSettings').onclick=()=>openModal('modalSettings');
$('btnHome').onclick=()=>openModal('modalHome');
$('logoHome').onclick=()=>openModal('modalHome');

/* ================= NEW GAME ================= */
const TC_PRESETS={
  bullet:[{label:'1 min',min:1,inc:0},{label:'1+1',min:1,inc:1},{label:'2+1',min:2,inc:1}],
  blitz:[{label:'3 min',min:3,inc:0},{label:'3+2',min:3,inc:2},{label:'5 min',min:5,inc:0}],
  rapid:[{label:'10 min',min:10,inc:0},{label:'15+10',min:15,inc:10},{label:'30 min',min:30,inc:0}],
  custom:[]
};
let tcGroup='rapid', tcIdx=0;
function renderTcOptions(){
  const box=$('tcOptions');box.innerHTML='';
  const opts=TC_PRESETS[tcGroup];
  $('tcCustom').style.display=tcGroup==='custom'?'':'none';
  opts.forEach((o,i)=>{
    const b=document.createElement('button');b.className='tc-tab'+(i===tcIdx?' active':'');
    b.textContent=o.label;
    b.onclick=()=>{tcIdx=i;renderTcOptions()};
    box.appendChild(b);
  });
}
document.querySelectorAll('.tc-tab[data-tcgroup]').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('.tc-tab[data-tcgroup]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');tcGroup=b.dataset.tcgroup;tcIdx=0;renderTcOptions();
  };
});
document.querySelectorAll('.tc-tab[data-ai]').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('.tc-tab[data-ai]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');App.aiLevel=+b.dataset.ai;
  };
});
function setPendingMode(m){
  App.pendingMode=m;
  document.querySelectorAll('.mode-card').forEach(x=>x.classList.remove('active'));
  ({online:$('modeOnline'),ai:$('modeAI'),local:$('modeLocal')})[m].classList.add('active');
  $('aiSection').style.display=m==='ai'?'':'none';
  $('btnStart').style.display=m==='online'?'none':'';
}
$('modeOnline').onclick=()=>{setPendingMode('online');closeModal('modalHome');openModal('modalOnline')};
$('modeAI').onclick=()=>setPendingMode('ai');
$('modeLocal').onclick=()=>setPendingMode('local');
$('btnStart').onclick=()=>{
  if(App.pendingMode==='online'){closeModal('modalHome');openModal('modalOnline');return}
  startGame(App.pendingMode);
};
$('btnNewFromOver').onclick=()=>{closeModal('modalOver');openModal('modalHome')};
$('btnRematch').onclick=()=>{
  closeModal('modalOver');
  if(App.mode==='online'&&window.AzNet){AzNet.send({t:'rematch'});toast('…')}
  else{App.myColor=App.myColor==='w'?'b':'w';startGame(App.mode)}
};
function startGame(mode){
  App.mode=mode;
  App.state=newState();
  App.history=[];App.repKeys=[posKey(App.state)];
  App.viewPly=0;App.over=false;App.result=null;App.premove=null;
  App.selected=null;App.legalForSel=[];App.legalCache=genLegal(App.state);
  App.arrows=[];App.highlights=[];
  if(mode!=='local')App.orientation=App.myColor;
  const min=tcGroup==='custom'?Math.max(1,+$('custMin').value||10):(TC_PRESETS[tcGroup][tcIdx]?TC_PRESETS[tcGroup][tcIdx].min:10);
  const inc=tcGroup==='custom'?Math.max(0,+$('custInc').value||0):(TC_PRESETS[tcGroup][tcIdx]?TC_PRESETS[tcGroup][tcIdx].inc:0);
  App.clocks={w:min*60000,b:min*60000,inc:inc*1000/1000*1000};
  App.clocks.inc=inc;
  App.started=true;
  closeModal('modalHome');closeModal('modalOnline');closeModal('modalOver');
  renderBoard();renderMoves();updatePanels();updateEval();
  startClock();
  if(mode==='ai'&&App.state.turn!==App.myColor)setTimeout(aiMove,400);
}
window.AzApp=App;
window.AzUI={renderBoard,renderMoves,updatePanels,updateEval,startGame,endGame,doMove,toast,t,openModal,closeModal,
  setFromNetwork(v){fromNetwork_=v},getFromNetwork(){return fromNetwork_},
  playSoundFor,setPendingMode,getTc(){return {min:tcGroup==='custom'?+$('custMin').value:TC_PRESETS[tcGroup][tcIdx].min,
    inc:tcGroup==='custom'?+$('custInc').value:TC_PRESETS[tcGroup][tcIdx].inc}},
  applySettingsToUI(){
    $('langSelect').value=App.settings.lang;
    $('setPiece').value=App.settings.pieceSet;
    $('setTheme').value=App.settings.theme;
    $('setSound').checked=App.settings.sound;
    $('setAutoFlip').checked=App.settings.autoFlip;
    $('setEval').checked=App.settings.showEval;
    $('setPremoveSnd').checked=App.settings.premoveSnd;
    $('customColors').style.display=App.settings.theme==='custom'?'':'none';
    $('custLight').value=App.settings.customLight;
    $('custDark').value=App.settings.customDark;
  }};

/* ================= AI glue ================= */
function aiMove(){
  if(App.over||App.mode!=='ai'||App.state.turn===App.myColor)return;
  const depth=[0,1,2,3,4][App.aiLevel]||2;
  const res=AzAI.findBestMove(App.state,depth);
  if(res&&res.move&&!App.over){
    const mv=App.state&&findByUci(App.state,uciOf(res.move))||res.move;
    if(mv)doMove(mv);
    if(res.cp!==undefined)updateEval(res.cp);
  }
}

/* ================= SETTINGS BINDINGS ================= */
$('langSelect').onchange=e=>{App.settings.lang=e.target.value;saveSettings();applyI18n();updatePanels();renderMoves()};
$('setPiece').onchange=e=>{App.settings.pieceSet=e.target.value;saveSettings();renderBoard();updatePanels()};
$('setTheme').onchange=e=>{App.settings.theme=e.target.value;saveSettings();applyTheme();
  $('customColors').style.display=e.target.value==='custom'?'':'none';renderBoard()};
$('custLight').oninput=e=>{App.settings.customLight=e.target.value;saveSettings();applyTheme()};
$('custDark').oninput=e=>{App.settings.customDark=e.target.value;saveSettings();applyTheme()};
$('setSound').onchange=e=>{App.settings.sound=e.target.checked;saveSettings()};
$('setAutoFlip').onchange=e=>{App.settings.autoFlip=e.target.checked;saveSettings()};
$('setEval').onchange=e=>{App.settings.showEval=e.target.checked;saveSettings();updateEval()};
$('setPremoveSnd').onchange=e=>{App.settings.premoveSnd=e.target.checked;saveSettings()};

/* ================= BOARD EVENTS + TOUCH BLOCKER ================= */
boardEl.addEventListener('pointerdown',handleBoardDown);
boardEl.addEventListener('pointermove',handleBoardMove);
boardEl.addEventListener('pointerup',handleBoardUp);
boardEl.addEventListener('pointercancel',()=>{if(App.drag&&App.drag.ghost)App.drag.ghost.remove();App.drag=null;renderBoard()});
boardEl.addEventListener('contextmenu',e=>e.preventDefault());
boardEl.addEventListener('mousedown',e=>{if(e.button===2)handleRightDown(e)});
document.addEventListener('mousemove',handleRightMove);
document.addEventListener('mouseup',e=>{if(e.button===2)handleRightUp(e)});
// Mobil sürüşmə bloklayıcı: lövhə üzərində sürüşdürmə səhifəni yerindən oynatmır
document.addEventListener('touchmove',e=>{
  if(App.drag||boardEl.contains(e.target))e.preventDefault();
},{passive:false});
boardEl.style.touchAction='none';
// Auto-flip for local mode: after each render check
const _renderBoard=renderBoard;
renderBoard=function(){
  if(App.mode==='local'&&App.settings.autoFlip&&App.started&&!App.over){
    const want=App.state.turn;
    if(want!==App.orientation){App.orientation=want}
  }
  _renderBoard();
};

/* ================= INIT ================= */
applyI18n();applyTheme();
window.AzUI.applySettingsToUI();
renderTcOptions();setPendingMode('ai');
renderBoard();renderMoves();updatePanels();updateEval();
// start hidden home modal? show it
openModal('modalHome');
// unblock audio on first interaction
document.addEventListener('pointerdown',function once(){try{ac().resume()}catch(e){}document.removeEventListener('pointerdown',once)},{once:true});
'''
open('game.js','w',encoding='utf-8').write(game_js)
print('game.js', len(game_js))
