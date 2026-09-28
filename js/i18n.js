const DICT = {
  az: {
    white: 'Ağ', black: 'Qara', undo: 'Geri al', flip: 'Fırlat', resign: 'Təslim ol', newGame: 'Yeni oyun',
    settings: 'Parametrlər', moves: 'Gedişlər', board: 'Şahmat lövhəsi', checkmate: 'Mat', stalemate: 'Pat',
    insufficient: 'Kifayət qədər material yoxdur', repetition: 'Üçqat təkrarlanma', fifty: '50 gediş qaydası',
    timeout: 'Vaxt bitdi', resigned: 'Təslim oldu', draw: 'Heç-heçə', won: '{c} qalib gəldi', rematch: 'Revanş',
    close: 'Bağla', game: 'Oyun', appearance: 'Görünüş', time: 'Vaxt nəzarəti', custom: 'Fərdi', min: 'Dəqiqə',
    inc: 'Artım (san)', legal: 'Mümkün gedişləri göstər', coords: 'Koordinatlar', anim: 'Animasiya',
    theme: 'Lövhə mövzusu', pieces: 'Fiqurlar', confirmResign: 'Təslim olmaq istəyirsiniz?',
    p_q: 'Vəzir', p_r: 'Top', p_b: 'Fil', p_n: 'At',
    n_classic: 'Klassik', n_green: 'Yaşıl', n_brown: 'Qəhvəyi', n_blue: 'Mavi', n_dark: 'Tünd',
    n_minimal: 'Minimal', n_neon: 'Neon', n_modern: 'Müasir', n_tournament: 'Turnir',
    ai:'AI ilə oyna', aiDesc:'Səviyyə seç və kompüterə qarşı oyna.', easy:'Asan', medium:'Orta', hard:'Çətin', online:'Online', onlineDesc:'İnternet üzərindən dostunla şahmat oyna.', createRoom:'Otaq yarat', joinRoom:'Otağa qoşul', roomCode:'Otaq kodu', copy:'Kopyala', onlineGame:'Online oyun', connecting:'Qoşulur...', waiting:'Rəqib gözlənilir...', connected:'Qoşuldu', oppLeft:'Rəqib oyundan çıxdı', rejoin:'Yenidən qoşul', notFound:'Otaq tapılmadı', netError:'Şəbəkə xətası', chat:'Söhbət', messagePlaceholder:'Mesaj yaz...', send:'Göndər', offerDraw:'Heç-heçə təklif et', drawOffer:'Heç-heçə təklifi', drawQuestion:'Rəqib heç-heçə təklif edir.', accept:'Qəbul et', decline:'Rədd et', drawSent:'Heç-heçə təklifi göndərildi', drawDeclined:'Heç-heçə təklifi rədd edildi', leaveGame:'Oyundan çıx', rematchAsk:'Revanş gözlənilir...', waitRematch:'Rəqibin revanş qərarı gözlənilir...', badCode:'6 rəqəmli otaq kodu daxil et', copied:'Kopyalandı', onlineNoUndo:'Online oyunda geri alma bağlıdır', guest:'Qonaq', host:'Host', you:'Sən', messageEmpty:'Boş mesaj göndərmək olmaz' 
  }
};
let lang = 'az';

export const t = (key, vars = {}) =>
  (DICT[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? '');

export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(e => e.setAttribute('aria-label', t(e.dataset.i18nAria)));
  root.querySelectorAll('[data-i18n-placeholder]').forEach(e => e.setAttribute('placeholder', t(e.dataset.i18nPlaceholder)));
}
