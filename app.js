/* ===========================================================
   MESAİ TAKİP SİSTEMİ — app.js
   Demo amaçlı: tüm veriler bellekte tutulur, sayfa yenilenince sıfırlanır.
   =========================================================== */

/* ---------------- DEMO VERİ ---------------- */

const ROLES = {
  calisan:  {label:"Çalışan",  icon:"👷"},
  sef:      {label:"Şef",      icon:"🧑‍💼"},
  ik:       {label:"İnsan Kaynakları", icon:"🗂️"},
  yonetici: {label:"Yönetici", icon:"🏢"}
};

let users = [
  {id:"u1", ad:"Ahmet",  soyad:"Yılmaz", gorev:"Depo Personeli", departman:"Depo",      role:"calisan", username:"ahmet"},
  {id:"u2", ad:"Can",    soyad:"Öztürk", gorev:"Vardiya Şefi",   departman:"Operasyon",  role:"sef",      username:"can"},
  {id:"u3", ad:"Merve",  soyad:"Demir",  gorev:"İK Uzmanı",      departman:"İnsan Kaynakları", role:"ik", username:"merve"},
  {id:"u4", ad:"Selin",  soyad:"Aydın",  gorev:"Genel Müdür",    departman:"Yönetim",    role:"yonetici", username:"selin"}
];

let entries = [
  {id:"e1", userId:"u1", tarih:"2026-07-01", baslangic:"18:00", bitis:"20:00", durum:"Bekliyor", photos:[true,true,false]},
  {id:"e2", userId:"u1", tarih:"2026-06-28", baslangic:"17:00", bitis:"19:30", durum:"Onaylandı", photos:[true,true,true]},
  {id:"e3", userId:"u2", tarih:"2026-06-30", baslangic:"18:00", bitis:"21:00", durum:"Onaylandı", photos:[true,false,false]},
  {id:"e4", userId:"u1", tarih:"2026-06-25", baslangic:"19:00", bitis:"21:00", durum:"Reddedildi", photos:[true,true,false]}
];

const BUGUN = new Date().toISOString().slice(0,10);
let shiftRequests = [
  {id:"sr1", userId:"u1", type:"Gece", saatler:"20:00 - 04:00", tarih:"2026-07-05", durum:"Bekliyor", sure:"1 Hafta", neden:"Kişisel sebepler"},
  {id:"sr2", userId:"u1", type:"Gündüz", saatler:"08:00 - 17:00", tarih:"2026-07-10", durum:"Onaylandı", sure:"Sürekli", neden:"Sağlık nedenleri"},
  {id:"sr3", userId:"u1", type:"Gece", saatler:"18:00 - 02:00", tarih: BUGUN, durum:"Onaylandı", sure:"1 Ay", neden:"Proje mesaisi (Demo)"},
  {id:"sr4", userId:"u2", type:"Gündüz", saatler:"08:00 - 16:00", tarih: BUGUN, durum:"Onaylandı", sure:"Sürekli", neden:"Vardiya rotasyonu (Demo)"}
];

let logs = [
  {time:"30.06.2026 21:14", text:"<b>Merve Demir (İK)</b>, Ahmet Yılmaz'ın 1 Temmuz mesaisini sisteme kaydetti."},
  {time:"30.06.2026 18:02", text:"<b>Can Öztürk (Şef)</b>, 30 Haziran tarihli kendi mesaisini onayladı."},
  {time:"29.06.2026 09:40", text:"<b>Can Öztürk (Şef)</b>, Ahmet Yılmaz'ın 25 Haziran mesaisini reddetti."},
  {time:"28.06.2026 20:55", text:"<b>Can Öztürk (Şef)</b>, Ahmet Yılmaz'ın 28 Haziran mesaisini onayladı."},
  {time:"28.06.2026 19:05", text:"<b>Ahmet Yılmaz (Çalışan)</b> yeni mesai kaydı oluşturdu."}
];

let currentUser = null;
let calState = {year:2026, month:6}; // 0-index ay, Temmuz=6
let pendingPhotos = [null,null,null];
let editEntryId = null;

/* ---------------- YARDIMCI FONKSİYONLAR ---------------- */

function $(sel, ctx){ return (ctx||document).querySelector(sel); }
function $all(sel, ctx){ return Array.from((ctx||document).querySelectorAll(sel)); }
function fullName(u){ return u ? (u.ad + " " + u.soyad) : "—"; }
function initials(u){ return u ? (u.ad[0]+u.soyad[0]).toUpperCase() : "?"; }
function calcHours(baslangic, bitis) {
  const [h1, m1] = baslangic.split(":").map(Number);
  const [h2, m2] = bitis.split(":").map(Number);
  let d = new Date();
  let d1 = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h1, m1);
  let d2 = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h2, m2);
  if(d2 < d1) d2.setDate(d2.getDate() + 1);
  return (d2 - d1) / (1000 * 60 * 60);
}
function fmtDate(iso){
  const [y,m,d] = iso.split("-");
  const aylar=["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  return `${parseInt(d)} ${aylar[parseInt(m)-1]} ${y}`;
}
function badgeClass(durum){
  if(durum==="Onaylandı") return "badge-approved";
  if(durum==="Reddedildi") return "badge-rejected";
  return "badge-pending";
}
function userById(id){ return users.find(u=>u.id===id); }
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=>t.classList.remove("show"), 2200);
}
function addLog(text){
  const now = new Date();
  const time = now.toLocaleDateString("tr-TR")+" "+now.toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"});
  logs.unshift({time, text});
}

/* ---------------- AUTH ---------------- */

function initAuth(){
  $("#tabLogin").addEventListener("click", ()=>switchAuthTab("login"));
  $("#tabRegister").addEventListener("click", ()=>switchAuthTab("register"));

  populateLoginSelect();

  $("#loginForm").addEventListener("submit", e=>{
    e.preventDefault();
    const uid = $("#loginUser").value;
    const user = users.find(u=>u.id===uid);
    if(!user){ toast("Lütfen bir kullanıcı seçin."); return; }
    login(user);
  });

  $("#registerForm").addEventListener("submit", e=>{
    e.preventDefault();
    const ad = $("#regAd").value.trim();
    const soyad = $("#regSoyad").value.trim();
    const gorev = $("#regGorev").value.trim();
    const departman = $("#regDepartman").value.trim();
    const role = $("#regRol").value;
    if(!ad || !soyad || !gorev || !role){ toast("Lütfen tüm alanları doldurun."); return; }
    const newUser = {
      id:"u"+(users.length+1),
      ad, soyad, gorev,
      departman: departman || "—",
      role,
      username:(ad+soyad).toLowerCase()
    };
    users.push(newUser);
    addLog(`<b>${fullName(newUser)}</b> sisteme yeni çalışan olarak kayıt oldu. (${ROLES[role].label})`);
    toast("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
    $("#registerForm").reset();
    populateLoginSelect();
    switchAuthTab("login");
    $("#loginUser").value = newUser.id;
  });
}

function switchAuthTab(tab){
  $("#tabLogin").classList.toggle("active", tab==="login");
  $("#tabRegister").classList.toggle("active", tab==="register");
  $("#loginForm").classList.toggle("hidden", tab!=="login");
  $("#registerForm").classList.toggle("hidden", tab!=="register");
}

function populateLoginSelect(){
  const sel = $("#loginUser");
  sel.innerHTML = `<option value="">Kullanıcı seçin…</option>` +
    users.map(u=>`<option value="${u.id}">${fullName(u)} — ${ROLES[u.role].label}</option>`).join("");

  const demoWrap = $("#demoChips");
  demoWrap.innerHTML = users.map(u=>
    `<span class="demo-chip" data-id="${u.id}">${fullName(u)} (${ROLES[u.role].label})</span>`
  ).join("");
  $all(".demo-chip", demoWrap).forEach(chip=>{
    chip.addEventListener("click", ()=>{
      $("#loginUser").value = chip.dataset.id;
    });
  });
}

function login(user){
  currentUser = user;
  $("#authScreen").classList.add("hidden");
  $("#appScreen").classList.remove("hidden");
  buildSidebar();
  renderRoleDashboard();
  toast(`Hoş geldiniz, ${user.ad}!`);
}

function logout(){
  if($("#profileModalOverlay")) $("#profileModalOverlay").remove();
  currentUser = null;
  $("#appScreen").classList.add("hidden");
  $("#authScreen").classList.remove("hidden");
  switchAuthTab("login");
}

function openProfileModal(){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "profileModalOverlay";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:400px; text-align:center;">
      <button class="modal-close" id="closeProfileModal">✕</button>
      <div class="avatar" style="width:64px; height:64px; font-size:22px; margin:0 auto 16px;">${initials(currentUser)}</div>
      <h3 style="margin-bottom:4px;">${fullName(currentUser)}</h3>
      <p style="color:var(--text-soft); font-size:13px; margin:0 0 20px;">${ROLES[currentUser.role].label}</p>
      
      <form id="profileForm" style="text-align:left;">
        <div class="form-group">
          <label>Ad</label>
          <input type="text" id="profAd" value="${currentUser.ad}" required>
        </div>
        <div class="form-group">
          <label>Soyad</label>
          <input type="text" id="profSoyad" value="${currentUser.soyad}" required>
        </div>
        <div class="form-group">
          <label>Görev</label>
          <input type="text" id="profGorev" value="${currentUser.gorev}" required>
        </div>
        <div class="form-group">
          <label>Departman</label>
          <input type="text" id="profDepartman" value="${currentUser.departman}">
        </div>
        <button type="submit" class="btn btn-primary btn-block" style="margin-top:10px;">Bilgileri Kaydet</button>
      </form>
      
      <div style="margin-top:24px; padding-top:16px; border-top:1px dashed var(--border);">
        <button type="button" class="btn btn-block" id="modalLogoutBtn" style="background:var(--red-bg); color:var(--red); font-weight:700; display:flex; justify-content:center; align-items:center; gap:8px; border:none; box-shadow:none;"><span style="font-size:16px;">🚪</span> Çıkış Yap</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  $("#closeProfileModal").addEventListener("click", ()=>overlay.remove());
  overlay.addEventListener("click", e=>{ if(e.target===overlay) overlay.remove(); });
  
  $("#modalLogoutBtn").addEventListener("click", logout);
  
  $("#profileForm").addEventListener("submit", e=>{
    e.preventDefault();
    currentUser.ad = $("#profAd").value.trim();
    currentUser.soyad = $("#profSoyad").value.trim();
    currentUser.gorev = $("#profGorev").value.trim();
    currentUser.departman = $("#profDepartman").value.trim() || "—";
    
    buildSidebar();
    
    const activeNav = $(".nav-item.active");
    if(activeNav) renderSection(activeNav.dataset.key);
    
    toast("Profil bilgileriniz güncellendi.");
    overlay.remove();
  });
}

/* ---------------- SIDEBAR ---------------- */

const NAV_BY_ROLE = {
  calisan: [
    {key:"calisan-mesai", label:"Mesailerim", icon:"📅"},
    {key:"calisan-vardiya", label:"Vardiya Taleplerim", icon:"🔄"}
  ],
  sef: [
    {key:"sef-talepler", label:"Takım Talepleri", icon:"📋"},
    {key:"sef-vardiya", label:"Vardiya Talepleri", icon:"🔄"},
    {key:"sef-mesai", label:"Mesailerim", icon:"📅"}
  ],
  ik: [
    {key:"ik-ozet", label:"Şirket Özeti", icon:"🗂️"},
    {key:"ik-mesai-ucret", label:"Mesai Ücretleri", icon:"💰"},
    {key:"vardiya-listesi", label:"Vardiya Listesi", icon:"🔄"},
    {key:"ik-personel", label:"Personel Listesi", icon:"👥"}
  ],
  yonetici: [
    {key:"yon-ozet", label:"Mesai Özeti", icon:"🗂️"},
    {key:"yon-mesai-ucret", label:"Mesai Ücretleri", icon:"💰"},
    {key:"vardiya-listesi", label:"Vardiya Listesi", icon:"🔄"},
    {key:"yon-kayit", label:"Sistem Kayıtları", icon:"🕒"},
    {key:"yon-personel", label:"Personel Listesi", icon:"👥"}
  ]
};

function buildSidebar(){
  $("#sidebarUserName").textContent = fullName(currentUser);
  $("#sidebarUserRole").textContent = ROLES[currentUser.role].label + " · " + currentUser.gorev;
  $("#sidebarAvatar").textContent = initials(currentUser);

  const nav = $("#sidebarNav");
  nav.innerHTML = "";
  NAV_BY_ROLE[currentUser.role].forEach((item,i)=>{
    const btn = document.createElement("button");
    btn.className = "nav-item" + (i===0 ? " active" : "");
    btn.dataset.key = item.key;
    btn.innerHTML = `<span class="ico">${item.icon}</span><span>${item.label}</span>`;
    btn.addEventListener("click", ()=>{
      $all(".nav-item", nav).forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      renderSection(item.key);
    });
    nav.appendChild(btn);
  });
}

function renderRoleDashboard(){
  const first = NAV_BY_ROLE[currentUser.role][0].key;
  renderSection(first);
}

/* ---------------- ANA İÇERİK YÖNLENDİRME ---------------- */

function renderSection(key){
  const main = $("#mainContent");
  main.innerHTML = "";
  if(key==="calisan-mesai") renderCalisanMesai(main, currentUser);
  else if(key==="calisan-vardiya") renderCalisanVardiya(main, currentUser);
  else if(key==="sef-talepler") renderSefTalepler(main);
  else if(key==="sef-vardiya") renderSefVardiya(main);
  else if(key==="sef-mesai") renderCalisanMesai(main, currentUser, true);
  else if(key==="ik-ozet") renderIkOzet(main);
  else if(key==="yon-ozet") renderYonOzet(main);
  else if(key==="ik-mesai-ucret" || key==="yon-mesai-ucret") renderMesaiUcretleri(main);
  else if(key==="vardiya-listesi") renderVardiyaListesi(main);
  else if(key==="yon-kayit") renderYonKayit(main);
  else if(key==="ik-personel" || key==="yon-personel") renderPersonelListesi(main);
}

/* ---------------- ÇALIŞAN / ŞEF: MESAİLERİM ---------------- */

function renderCalisanMesai(main, user, isSef){
  main.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Mesailerim</h1>
        <div class="sub">Mesai günlerinizi takvimden ekleyin ve kanıt fotoğraflarınızı yükleyin.</div>
      </div>
      <button class="btn btn-turq" id="btnAddMesai">+ Mesai Ekle</button>
    </div>

    <div class="card welcome-card">
      <div class="avatar">${initials(user)}</div>
      <div>
        <h2>${fullName(user)} — ${user.gorev}</h2>
        <p>${user.departman} departmanı</p>
      </div>
    </div>

    <div class="card calendar" id="calCard"></div>

    <div class="card">
      <h3>Geçmiş Mesai Kayıtlarım</h3>
      <div id="myEntries"></div>
    </div>
  `;
  renderCalendar($("#calCard"), user.id);
  renderMyEntries($("#myEntries"), user.id);

  $("#btnAddMesai").addEventListener("click", ()=>openMesaiModal(null));
}

function renderMyEntries(container, userId){
  const mine = entries.filter(e=>e.userId===userId).sort((a,b)=>b.tarih.localeCompare(a.tarih));
  if(mine.length===0){ container.innerHTML = `<p style="color:var(--text-soft);font-size:13.5px;">Henüz mesai kaydınız yok.</p>`; return; }
  container.innerHTML = mine.map(e=>`
    <div class="entry-card">
      <div class="entry-left">
        <div class="entry-date">${fmtDate(e.tarih)}</div>
        <div class="entry-time">${e.baslangic} - ${e.bitis}</div>
        <div class="entry-meta">${e.photos.filter(Boolean).length}/3 kanıt fotoğrafı yüklendi</div>
      </div>
      <span class="badge ${badgeClass(e.durum)}">${e.durum}</span>
    </div>
  `).join("");
}

/* ---------------- TAKVİM ---------------- */

function renderCalendar(container, userId){
  const {year, month} = calState;
  const aylar=["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const first = new Date(year, month, 1);
  const startDow = (first.getDay()+6)%7; // Pazartesi=0
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayIso = new Date().toISOString().slice(0,10);

  const entryDates = new Set(entries.filter(e=>e.userId===userId).map(e=>e.tarih));

  let cells = "";
  for(let i=0;i<startDow;i++) cells += `<div class="cal-day empty"></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const hasEntry = entryDates.has(iso);
    const isToday = iso===todayIso;
    cells += `<div class="cal-day ${hasEntry?"has-entry":""} ${isToday?"today":""}" data-iso="${iso}">
        ${d}${hasEntry?'<span class="dot"></span>':''}
      </div>`;
  }

  container.innerHTML = `
    <div class="cal-head">
      <button class="cal-nav-btn" id="calPrev">‹</button>
      <span class="cal-title">${aylar[month]} ${year}</span>
      <button class="cal-nav-btn" id="calNext">›</button>
    </div>
    <div class="cal-grid">
      <div class="cal-dow">Pt</div><div class="cal-dow">Sa</div><div class="cal-dow">Ça</div>
      <div class="cal-dow">Pe</div><div class="cal-dow">Cu</div><div class="cal-dow">Ct</div><div class="cal-dow">Pz</div>
      ${cells}
    </div>
  `;

  $("#calPrev").addEventListener("click", ()=>{
    calState.month--; if(calState.month<0){calState.month=11; calState.year--;}
    renderCalendar(container, userId);
  });
  $("#calNext").addEventListener("click", ()=>{
    calState.month++; if(calState.month>11){calState.month=0; calState.year++;}
    renderCalendar(container, userId);
  });
  $all(".cal-day:not(.empty)", container).forEach(cell=>{
    cell.addEventListener("click", ()=>openMesaiModal(cell.dataset.iso));
  });
}

/* ---------------- MESAİ EKLEME MODALI ---------------- */

function openMesaiModal(iso){
  pendingPhotos = [null,null,null];
  editEntryId = null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "mesaiModalOverlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <button class="modal-close" id="closeMesaiModal">✕</button>
      <h3>Yeni Mesai Kaydı</h3>
      <form id="mesaiForm">
        <div class="form-group">
          <label>Tarih</label>
          <input type="date" id="mesaiTarih" value="${iso || ''}" required>
        </div>
        <div class="time-row">
          <div class="form-group">
            <label>Başlangıç Saati</label>
            <input type="time" id="mesaiBaslangic" required>
          </div>
          <div class="form-group">
            <label>Bitiş Saati</label>
            <input type="time" id="mesaiBitis" required>
          </div>
        </div>
        <div class="form-group">
          <label>Kanıt Fotoğrafları (en fazla 3)</label>
          <div class="photo-row" id="photoRow">
            ${[0,1,2].map(i=>`
              <div class="photo-box" data-idx="${i}">
                <span class="ico">📷</span><span>Fotoğraf ${i+1}</span>
                <input type="file" accept="image/*" capture="environment" class="hidden" data-idx="${i}">
              </div>
            `).join("")}
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Kaydet</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  $("#closeMesaiModal").addEventListener("click", closeMesaiModal);
  overlay.addEventListener("click", e=>{ if(e.target===overlay) closeMesaiModal(); });

  $all(".photo-box", overlay).forEach(box=>{
    const input = $("input", box);
    box.addEventListener("click", ()=> input.click());
    input.addEventListener("change", ()=>{
      const file = input.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = ev=>{
        pendingPhotos[input.dataset.idx] = ev.target.result;
        box.classList.add("filled");
        box.innerHTML = `<img src="${ev.target.result}" alt="kanıt">`;
        box.appendChild(input);
      };
      reader.readAsDataURL(file);
    });
  });

  $("#mesaiForm").addEventListener("submit", e=>{
    e.preventDefault();
    const tarih = $("#mesaiTarih").value;
    const baslangic = $("#mesaiBaslangic").value;
    const bitis = $("#mesaiBitis").value;
    if(!tarih || !baslangic || !bitis){ toast("Lütfen tüm alanları doldurun."); return; }
    const newEntry = {
      id:"e"+(entries.length+1+Math.floor(Math.random()*1000)),
      userId: currentUser.id,
      tarih, baslangic, bitis,
      durum:"Bekliyor",
      photos: [...pendingPhotos]
    };
    entries.push(newEntry);
    addLog(`<b>${fullName(currentUser)} (${ROLES[currentUser.role].label})</b> ${fmtDate(tarih)} tarihi için yeni mesai kaydı oluşturdu.`);
    toast("Mesai kaydı eklendi.");
    closeMesaiModal();
    renderSection(currentUser.role==="sef" ? "sef-mesai" : "calisan-mesai");
  });
}

function closeMesaiModal(){
  const ov = $("#mesaiModalOverlay");
  if(ov) ov.remove();
}

/* ---------------- ŞEF: TAKIM TALEPLERİ ---------------- */

function renderSefTalepler(main){
  const teamEntries = entries.filter(e=>{
    const u = userById(e.userId);
    return u && u.role==="calisan";
  }).sort((a,b)=>b.tarih.localeCompare(a.tarih));

  const todayIso = new Date().toISOString().slice(0,10);

  main.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Takım Mesai Talepleri</h1>
        <div class="sub">Ekibinizin mesai kayıtlarını onaylayın, reddedin veya düzenleyin.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="date" id="pdfDateSef" value="${todayIso}" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);outline:none;font-family:inherit;">
        <button class="btn btn-turq" id="btnDailyPdf">📄 PDF İndir</button>
      </div>
    </div>
    <div class="card" id="talepList"></div>
  `;

  const listEl = $("#talepList");
  if(teamEntries.length===0){
    listEl.innerHTML = `<p style="color:var(--text-soft);">Bekleyen talep bulunmuyor.</p>`;
  } else {
    listEl.innerHTML = teamEntries.map(e=>{
      const u = userById(e.userId);
      return `
      <div class="entry-card">
        <div class="entry-left">
          <div class="entry-date">${fullName(u)} — ${fmtDate(e.tarih)}</div>
          <div class="entry-time">${e.baslangic} - ${e.bitis}</div>
          <div class="entry-meta">${u.departman} · ${e.photos.filter(Boolean).length}/3 kanıt fotoğrafı</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span class="badge ${badgeClass(e.durum)}">${e.durum}</span>
          <div class="dropdown-container">
            <button class="btn btn-sm btn-outline btn-dropdown-toggle">⚙️ İşlemler</button>
            <div class="dropdown-menu hidden">
              <button class="dropdown-item text-turq" data-act="foto" data-id="${e.id}">📷 Fotoğraflar</button>
              <button class="dropdown-item text-green" data-act="onayla" data-id="${e.id}">✅ Onayla</button>
              <button class="dropdown-item text-red" data-act="reddet" data-id="${e.id}">❌ Reddet</button>
              <button class="dropdown-item" data-act="duzenle" data-id="${e.id}">✏️ Düzenle</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join("");
  }

  $all(".btn-dropdown-toggle", listEl).forEach(btn=>{
    btn.addEventListener("click", (ev)=>{
      ev.stopPropagation();
      $all(".dropdown-menu", listEl).forEach(m => {
        if(m !== btn.nextElementSibling) m.classList.add("hidden");
      });
      btn.nextElementSibling.classList.toggle("hidden");
    });
  });

  $all("[data-act]", listEl).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      const entry = entries.find(x=>x.id===id);
      const u = userById(entry.userId);
      if(btn.dataset.act==="onayla"){
        entry.durum = "Onaylandı";
        addLog(`<b>${fullName(currentUser)} (Şef)</b>, ${fullName(u)} adlı çalışanın ${fmtDate(entry.tarih)} mesaisini onayladı.`);
        toast("Mesai onaylandı.");
        renderSefTalepler(main);
      } else if(btn.dataset.act==="reddet"){
        entry.durum = "Reddedildi";
        addLog(`<b>${fullName(currentUser)} (Şef)</b>, ${fullName(u)} adlı çalışanın ${fmtDate(entry.tarih)} mesaisini reddetti.`);
        toast("Mesai reddedildi.");
        renderSefTalepler(main);
      } else if(btn.dataset.act==="duzenle"){
        openEditModal(entry, ()=>renderSefTalepler(main));
      } else if(btn.dataset.act==="foto"){
        viewPhotosModal(entry);
      }
    });
  });

  $("#btnDailyPdf").addEventListener("click", ()=>{
    const date = $("#pdfDateSef").value;
    const filtered = teamEntries.filter(e=>e.tarih===date);
    if(filtered.length===0){ toast("Bu tarihte onaylanacak mesai bulunamadı."); return; }
    exportDailyPdf(filtered, date);
  });
}

function viewPhotosModal(entry){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:440px;text-align:center;">
      <button class="modal-close" id="closePhotoModal">✕</button>
      <h3>Kanıt Fotoğrafları</h3>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:20px;">
        ${entry.photos.map((photoData, i)=> {
          if(!photoData) return `<div style="width:110px;height:110px;background:#fafafa;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#b0b8c0;border:1.5px dashed #dbe0e5;font-size:12px;">Yüklenmedi</div>`;
          
          let imgSrc = typeof photoData === 'string' ? photoData : null;
          let content = imgSrc ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:8.5px;">` : `<span style="font-size:24px;margin-bottom:4px;">🖼️</span>Foto ${i+1}`;
          
          return `<div class="photo-thumb" data-src="${imgSrc || 'demo'}" style="width:110px;height:110px;background:#eef2f5;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1.5px solid var(--turq);color:var(--turq);font-weight:600;cursor:zoom-in;transition:0.15s;">
            ${content}
          </div>`;
        }).join("")}
      </div>
      <p style="font-size:12.5px;color:var(--text-soft);margin-top:24px;">(Büyütmek için fotoğrafların üzerine tıklayın)</p>
    </div>
  `;
  document.body.appendChild(overlay);
  $("#closePhotoModal", overlay).addEventListener("click", ()=>overlay.remove());
  overlay.addEventListener("click", e=>{ if(e.target===overlay) overlay.remove(); });
  
  $all(".photo-thumb", overlay).forEach(thumb => {
    thumb.addEventListener("click", () => {
      const src = thumb.dataset.src;
      const light = document.createElement("div");
      light.className = "modal-overlay";
      light.style.zIndex = "2000";
      light.style.background = "rgba(0,0,0,0.85)";
      light.style.padding = "20px";
      if(src === 'demo') {
        light.innerHTML = `
          <div style="background:#fff;padding:40px;border-radius:16px;text-align:center;max-width:400px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <div style="font-size:40px;margin-bottom:10px;">🖼️</div>
            <h2 style="margin:0 0 10px;color:var(--navy);">Sembolik Görsel</h2>
            <p style="color:var(--text-soft);font-size:14px;margin:0;">Bu mesai kaydı sisteme demo verisi olarak eklendiği için gerçek bir görsel barındırmıyor.</p>
          </div>
        `;
      } else {
        light.innerHTML = `<img src="${src}" style="max-width:100%;max-height:100%;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.6);object-fit:contain;">`;
      }
      document.body.appendChild(light);
      light.addEventListener("click", () => light.remove());
    });
  });
}

function openEditModal(entry, onSaved){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "editModalOverlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <button class="modal-close" id="closeEditModal">✕</button>
      <h3>Mesai Kaydını Düzenle</h3>
      <form id="editForm">
        <div class="form-group">
          <label>Tarih</label>
          <input type="date" id="editTarih" value="${entry.tarih}" required>
        </div>
        <div class="time-row">
          <div class="form-group">
            <label>Başlangıç</label>
            <input type="time" id="editBaslangic" value="${entry.baslangic}" required>
          </div>
          <div class="form-group">
            <label>Bitiş</label>
            <input type="time" id="editBitis" value="${entry.bitis}" required>
          </div>
        </div>
        <div class="form-group">
          <label>Durum</label>
          <select id="editDurum">
            <option ${entry.durum==="Bekliyor"?"selected":""}>Bekliyor</option>
            <option ${entry.durum==="Onaylandı"?"selected":""}>Onaylandı</option>
            <option ${entry.durum==="Reddedildi"?"selected":""}>Reddedildi</option>
          </select>
        </div>
        <div class="card-row" style="margin-top:14px;">
          <button type="button" class="btn btn-red btn-sm" id="deleteEntryBtn">Kaydı Sil</button>
          <button type="submit" class="btn btn-primary btn-sm">Değişiklikleri Kaydet</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  $("#closeEditModal").addEventListener("click", ()=>overlay.remove());
  overlay.addEventListener("click", e=>{ if(e.target===overlay) overlay.remove(); });

  $("#deleteEntryBtn").addEventListener("click", ()=>{
    entries = entries.filter(x=>x.id!==entry.id);
    addLog(`<b>${fullName(currentUser)} (${ROLES[currentUser.role].label})</b>, ${fmtDate(entry.tarih)} tarihli bir mesai kaydını sildi.`);
    toast("Kayıt silindi.");
    overlay.remove();
    onSaved();
  });

  $("#editForm").addEventListener("submit", e=>{
    e.preventDefault();
    entry.tarih = $("#editTarih").value;
    entry.baslangic = $("#editBaslangic").value;
    entry.bitis = $("#editBitis").value;
    entry.durum = $("#editDurum").value;
    addLog(`<b>${fullName(currentUser)} (${ROLES[currentUser.role].label})</b>, ${fmtDate(entry.tarih)} tarihli mesai kaydını düzenledi.`);
    toast("Değişiklikler kaydedildi.");
    overlay.remove();
    onSaved();
  });
}

/* ---------------- İK: ŞİRKET ÖZETİ ---------------- */

function renderIkOzet(main){
  const todayIso = new Date().toISOString().slice(0,10);
  main.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Günlük Şirket Özeti</h1>
        <div class="sub">Tüm çalışanların mesai kayıtlarını günlük dosyalar halinde görüntüleyin.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="date" id="pdfDateIk" value="${todayIso}" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);outline:none;font-family:inherit;">
        <button class="btn btn-turq" id="btnIkPdf">📄 PDF İndir</button>
      </div>
    </div>
    <div id="ikDailyFolders"></div>
  `;
  
  const folderContainer = $("#ikDailyFolders");
  const grouped = entries.reduce((acc, e) => {
    if(!acc[e.tarih]) acc[e.tarih] = [];
    acc[e.tarih].push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));
  
  if(sortedDates.length === 0) {
    folderContainer.innerHTML = `<p style="color:var(--text-soft);">Kayıt bulunamadı.</p>`;
  } else {
    folderContainer.innerHTML = sortedDates.map((date, idx) => {
      const dayEntries = grouped[date];
      const rows = dayEntries.map(e => {
        const u = userById(e.userId);
        return `<tr>
          <td>${fullName(u)}</td>
          <td>${u.departman}</td>
          <td>${e.baslangic} - ${e.bitis}</td>
          <td><span class="badge ${badgeClass(e.durum)}">${e.durum}</span></td>
        </tr>`;
      }).join("");
      
      const isOpen = idx === 0;
      return `
      <div class="card" style="margin-bottom:14px; padding:0; overflow:hidden;">
        <div class="folder-header" style="background:var(--${isOpen?'turq-light':'bg'}); padding:16px 20px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); transition:0.2s;">
          <div style="font-weight:600; color:var(--navy); font-size:15px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">📁</span> ${fmtDate(date)}
          </div>
          <div style="font-size:12px; color:var(--text-soft); font-weight:600; background:var(--white); padding:4px 10px; border-radius:20px; border:1px solid var(--border);">
            ${dayEntries.length} Kayıt
          </div>
        </div>
        <div class="folder-content ${isOpen?'':'hidden'}" style="padding:16px 20px;">
          <div class="table-wrap">
            <table class="modern-table">
              <thead>
                <tr><th>İsim</th><th>Departman</th><th>Mesai Saati</th><th>Durum</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
      `;
    }).join("");
    
    $all(".folder-header", folderContainer).forEach(hdr => {
      hdr.addEventListener("click", () => {
        const content = hdr.nextElementSibling;
        content.classList.toggle("hidden");
        hdr.style.background = content.classList.contains("hidden") ? "var(--bg)" : "var(--turq-light)";
      });
    });
  }

  $("#btnIkPdf").addEventListener("click", ()=>{
    const date = $("#pdfDateIk").value;
    const filtered = entries.filter(e=>e.tarih===date);
    if(filtered.length===0){ toast("Bu tarihte mesai kaydı yok."); return; }
    exportDailyPdf(filtered, date);
  });
}

/* ---------------- YÖNETİCİ: ÖZET + KAYITLAR ---------------- */

function renderYonOzet(main){
  const todayIso = new Date().toISOString().slice(0,10);
  main.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Mesai Özeti</h1>
        <div class="sub">Şirket genelindeki tüm mesai kayıtlarını günlük dosyalar halinde görüntüleyin ve düzenleyin.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="date" id="pdfDateYon" value="${todayIso}" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);outline:none;font-family:inherit;">
        <button class="btn btn-turq" id="btnYonPdf">📄 PDF İndir</button>
      </div>
    </div>
    <div id="yonDailyFolders"></div>
  `;
  
  function draw(){
    const folderContainer = $("#yonDailyFolders");
    const grouped = entries.reduce((acc, e) => {
      if(!acc[e.tarih]) acc[e.tarih] = [];
      acc[e.tarih].push(e);
      return acc;
    }, {});
    const sortedDates = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));
    
    if(sortedDates.length === 0){
      folderContainer.innerHTML = `<p style="color:var(--text-soft);">Kayıt bulunamadı.</p>`;
      return;
    }
    
    folderContainer.innerHTML = sortedDates.map((date, idx) => {
      const dayEntries = grouped[date];
      const rows = dayEntries.map(e => {
        const u = userById(e.userId);
        return `<tr>
          <td>${fullName(u)}</td>
          <td>${u.departman}</td>
          <td>${e.baslangic} - ${e.bitis}</td>
          <td><span class="badge ${badgeClass(e.durum)}">${e.durum}</span></td>
          <td><button class="btn btn-sm btn-outline" data-id="${e.id}">Düzenle</button></td>
        </tr>`;
      }).join("");
      
      const isOpen = idx === 0;
      return `
      <div class="card" style="margin-bottom:14px; padding:0; overflow:hidden;">
        <div class="folder-header" style="background:var(--${isOpen?'turq-light':'bg'}); padding:16px 20px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); transition:0.2s;">
          <div style="font-weight:600; color:var(--navy); font-size:15px; display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">📁</span> ${fmtDate(date)}
          </div>
          <div style="font-size:12px; color:var(--text-soft); font-weight:600; background:var(--white); padding:4px 10px; border-radius:20px; border:1px solid var(--border);">
            ${dayEntries.length} Kayıt
          </div>
        </div>
        <div class="folder-content ${isOpen?'':'hidden'}" style="padding:16px 20px;">
          <div class="table-wrap">
            <table class="modern-table">
              <thead>
                <tr><th>İsim</th><th>Departman</th><th>Mesai Saati</th><th>Durum</th><th>İşlem</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
      `;
    }).join("");
    
    $all(".folder-header", folderContainer).forEach(hdr => {
      hdr.addEventListener("click", () => {
        const content = hdr.nextElementSibling;
        content.classList.toggle("hidden");
        hdr.style.background = content.classList.contains("hidden") ? "var(--bg)" : "var(--turq-light)";
      });
    });

    $all("[data-id]", folderContainer).forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const entry = entries.find(x=>x.id===btn.dataset.id);
        openEditModal(entry, draw);
      });
    });
  }
  
  draw();

  $("#btnYonPdf").addEventListener("click", ()=>{
    const date = $("#pdfDateYon").value;
    const filtered = entries.filter(e=>e.tarih===date);
    if(filtered.length===0){ toast("Bu tarihte mesai kaydı yok."); return; }
    exportDailyPdf(filtered, date);
  });
}

function renderYonKayit(main){
  main.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Sistem Kayıtları</h1>
        <div class="sub">Sistemde gerçekleşen tüm işlemlerin günlüğü.</div>
      </div>
    </div>
    <div class="card">
      <div class="timeline" id="logTimeline"></div>
    </div>
  `;
  $("#logTimeline").innerHTML = logs.map(l=>`
    <div class="timeline-item">
      <div class="timeline-time">${l.time}</div>
      <div class="timeline-text">${l.text}</div>
    </div>
  `).join("");
}

/* ---------------- PERSONEL LİSTESİ (İK & YÖNETİCİ) ---------------- */

function renderPersonelListesi(main){
  main.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Personel Listesi</h1>
        <div class="sub">Sisteme kayıtlı tüm personeller ve görevleri.</div>
      </div>
    </div>
    <div class="grid-2" id="personelListGrid"></div>
  `;
  
  const grid = $("#personelListGrid");
  if(users.length===0){
    grid.innerHTML = `<p style="color:var(--text-soft);grid-column:1/-1;">Sistemde kayıtlı personel bulunmuyor.</p>`;
    return;
  }
  
  grid.innerHTML = users.map(u => `
    <div class="entry-card" style="align-items:center; display:flex; gap:16px; margin-bottom:0; justify-content:flex-start;">
      <div class="avatar" style="width:48px; height:48px; font-size:16px;">${initials(u)}</div>
      <div class="entry-left">
        <div class="entry-date" style="font-size:15px;">${fullName(u)}</div>
        <div class="entry-time" style="color:var(--turq); font-weight:600; margin-bottom:2px;">${ROLES[u.role].label}</div>
        <div class="entry-meta">${u.departman} · ${u.gorev}</div>
      </div>
    </div>
  `).join("");
}

/* ---------------- PDF EXPORT (html2pdf) ---------------- */

function exportDailyPdf(teamEntries, targetDate){
  toast("PDF hazırlanıyor, lütfen bekleyin...");
  
  const printEl = document.createElement("div");
  printEl.style.padding = "30px 40px";
  printEl.style.fontFamily = "'Inter', system-ui, sans-serif";
  printEl.style.color = "#1f2a37";
  printEl.style.background = "#fff";
  
  const rows = teamEntries.map(e=>{
    const u = userById(e.userId);
    return `<tr>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#111827; font-weight:500;">${fullName(u)}</td>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#4b5563;">${u.departman}</td>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#4b5563;">${e.baslangic} - ${e.bitis}</td>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb;">
        <span style="font-weight:600; color:${e.durum==='Onaylandı'?'#059669':(e.durum==='Reddedildi'?'#dc2626':'#d97706')}">${e.durum}</span>
      </td>
    </tr>`;
  }).join("");

  printEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; border-bottom:2px solid #e5e7eb; padding-bottom:20px;">
      <div>
        <h1 style="margin:0; font-size:26px; color:#111827; letter-spacing:-0.5px;">Günlük Mesai Raporu</h1>
        <p style="margin:6px 0 0 0; color:#6b7280; font-size:14px;">Rapor Tarihi: <strong style="color:#374151;">${fmtDate(targetDate)}</strong></p>
        <p style="margin:4px 0 0 0; color:#6b7280; font-size:14px;">İndiren: ${fullName(currentUser)} (${ROLES[currentUser.role].label})</p>
      </div>
      <img src="unnamed (1).png" alt="Logo" style="height:55px; object-fit:contain;">
    </div>
    
    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13.5px; margin-bottom:40px;">
      <thead>
        <tr style="background-color:#f8fafc;">
          <th style="padding:14px 16px; border-bottom:2px solid #cbd5e1; color:#334155; font-weight:600;">Çalışan</th>
          <th style="padding:14px 16px; border-bottom:2px solid #cbd5e1; color:#334155; font-weight:600;">Departman</th>
          <th style="padding:14px 16px; border-bottom:2px solid #cbd5e1; color:#334155; font-weight:600;">Mesai Saati</th>
          <th style="padding:14px 16px; border-bottom:2px solid #cbd5e1; color:#334155; font-weight:600;">Durum</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows : `<tr><td colspan="4" style="padding:20px; text-align:center; color:#9ca3af; font-style:italic;">Bu tarihte herhangi bir mesai kaydı bulunamadı.</td></tr>`}
      </tbody>
    </table>
    
    <div style="display:flex; justify-content:space-between; margin-top:80px; text-align:center; font-size:14px; color:#4b5563;">
      <div style="width:200px;">
        <div style="border-bottom:1px solid #9ca3af; height:40px; margin-bottom:8px;"></div>
        <strong style="color:#111827;">Onaylayan İmza</strong>
        <div style="font-size:12px; margin-top:4px;">Yetkili / Şef</div>
      </div>
      <div style="width:200px;">
        <div style="border-bottom:1px solid #9ca3af; height:40px; margin-bottom:8px;"></div>
        <strong style="color:#111827;">İnsan Kaynakları</strong>
        <div style="font-size:12px; margin-top:4px;">İK Departmanı</div>
      </div>
    </div>
    
    <div style="margin-top:60px; font-size:11px; color:#9ca3af; text-align:center;">
      Bu belge Mesai Takip Sistemi tarafından <strong>${new Date().toLocaleDateString('tr-TR')}</strong> tarihinde otomatik olarak oluşturulmuştur.
    </div>
  `;

  const opt = {
    margin:       [5, 0, 10, 0], // Top, Left, Bottom, Right
    filename:     `mesai-raporu-${targetDate}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(printEl).save().then(()=>{
    addLog(`<b>${fullName(currentUser)} (${ROLES[currentUser.role].label})</b> ${fmtDate(targetDate)} tarihli PDF raporunu indirdi.`);
    toast("PDF raporu başarıyla indirildi.");
  }).catch(err=>{
    console.error("PDF oluşturulurken hata:", err);
    toast("PDF indirilirken bir hata oluştu.");
  });
}

/* ---------------- YENİ: VARDİYA TALEPLERİ (ÇALIŞAN) ---------------- */
function renderCalisanVardiya(main, user){
  main.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Vardiya Taleplerim</h1>
        <div class="sub">Gece/Gündüz seans değişikliği veya özel saatli vardiya taleplerinizi oluşturun.</div>
      </div>
      <button class="btn btn-turq" id="btnYeniVardiya">+ Yeni Talep</button>
    </div>
    <div class="card">
      <h3>Geçmiş Vardiya Taleplerim</h3>
      <div id="myShiftRequests"></div>
    </div>
  `;
  renderMyShiftRequests($("#myShiftRequests"), user.id);
  $("#btnYeniVardiya").addEventListener("click", ()=>openVardiyaModal(null));
}

function renderMyShiftRequests(container, userId){
  const mine = shiftRequests.filter(s=>s.userId===userId).sort((a,b)=>b.tarih.localeCompare(a.tarih));
  if(mine.length===0){ container.innerHTML = `<p style="color:var(--text-soft);font-size:13.5px;">Henüz vardiya talebiniz yok.</p>`; return; }
  container.innerHTML = mine.map(s=>`
    <div class="entry-card">
      <div class="entry-left">
        <div class="entry-date">${fmtDate(s.tarih)} — ${s.type} Vardiyası</div>
        <div class="entry-time">İstenen Saatler: ${s.saatler} | Süre: ${s.sure}</div>
        <div class="entry-meta" style="margin-top:4px;">Neden: ${s.neden}</div>
      </div>
      <span class="badge ${badgeClass(s.durum)}">${s.durum}</span>
    </div>
  `).join("");
}

function openVardiyaModal(){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <button class="modal-close" id="closeVardiyaModal">✕</button>
      <h3>Yeni Vardiya Talebi</h3>
      <form id="vardiyaForm">
        <div class="form-group">
          <label>Tarih</label>
          <input type="date" id="vardiyaTarih" required>
        </div>
        <div class="form-group">
          <label>Vardiya Tipi</label>
          <select id="vardiyaTipi">
            <option value="Gece">Gece (Akşam)</option>
            <option value="Gündüz">Gündüz (Sabah)</option>
            <option value="Özel">Özel Saatler</option>
          </select>
        </div>
        <div class="form-group">
          <label>İstenilen Saatler (Örn: 13:00 - 00:00)</label>
          <input type="text" id="vardiyaSaatler" placeholder="Gece veya Gündüz ise boş bırakabilirsiniz">
        </div>
        <div class="form-group">
          <label>Süre</label>
          <input type="text" id="vardiyaSure" placeholder="Örn: 1 Hafta, 3 Gün, Belirsiz..." required>
        </div>
        <div class="form-group">
          <label>Neden</label>
          <input type="text" id="vardiyaNeden" placeholder="Talebinizin nedeni..." required>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Talep Oluştur</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  $("#closeVardiyaModal", overlay).addEventListener("click", ()=>overlay.remove());
  overlay.addEventListener("click", e=>{ if(e.target===overlay) overlay.remove(); });

  $("#vardiyaForm", overlay).addEventListener("submit", e=>{
    e.preventDefault();
    const tarih = $("#vardiyaTarih").value;
    const type = $("#vardiyaTipi").value;
    const sure = $("#vardiyaSure").value;
    const neden = $("#vardiyaNeden").value || "Belirtilmedi";
    const saatler = $("#vardiyaSaatler").value || (type==="Gece"?"20:00 - 04:00":"08:00 - 17:00");
    if(!tarih) { toast("Lütfen tarih seçin."); return; }
    const newReq = {
      id:"sr"+Math.floor(Math.random()*10000),
      userId: currentUser.id,
      type, saatler, tarih, durum: "Bekliyor", sure, neden
    };
    shiftRequests.push(newReq);
    addLog(`<b>${fullName(currentUser)}</b> ${fmtDate(tarih)} için yeni vardiya talebi oluşturdu.`);
    toast("Vardiya talebi oluşturuldu.");
    overlay.remove();
    renderSection("calisan-vardiya");
  });
}

/* ---------------- YENİ: VARDİYA TALEPLERİ (ŞEF) ---------------- */
function renderSefVardiya(main){
  const teamReqs = shiftRequests.filter(s=>{
    const u = userById(s.userId);
    return u && u.role==="calisan";
  }).sort((a,b)=>b.tarih.localeCompare(a.tarih));

  main.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Takım Vardiya Talepleri</h1>
        <div class="sub">Ekibinizin vardiya (seans) değişiklik taleplerini yönetin.</div>
      </div>
    </div>
    <div class="card" id="talepListVardiya"></div>
  `;

  const listEl = $("#talepListVardiya");
  if(teamReqs.length===0){
    listEl.innerHTML = `<p style="color:var(--text-soft);">Bekleyen talep bulunmuyor.</p>`;
  } else {
    listEl.innerHTML = teamReqs.map(s=>{
      const u = userById(s.userId);
      return `
      <div class="entry-card">
        <div class="entry-left">
          <div class="entry-date">${fullName(u)} — ${fmtDate(s.tarih)}</div>
          <div class="entry-time">${s.type} Vardiyası (${s.saatler}) | Süre: ${s.sure}</div>
          <div class="entry-meta" style="margin-top:4px;">Neden: ${s.neden}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span class="badge ${badgeClass(s.durum)}">${s.durum}</span>
          ${s.durum==="Bekliyor" ? `
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-green" data-vact="onayla" data-id="${s.id}">Onayla</button>
            <button class="btn btn-sm btn-red" data-vact="reddet" data-id="${s.id}">Reddet</button>
          </div>
          `:''}
        </div>
      </div>`;
    }).join("");
  }

  $all("[data-vact]", listEl).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      const s = shiftRequests.find(x=>x.id===id);
      const u = userById(s.userId);
      if(btn.dataset.vact==="onayla"){
        s.durum = "Onaylandı";
        addLog(`<b>${fullName(currentUser)} (Şef)</b>, ${fullName(u)}'ın vardiya talebini onayladı.`);
        toast("Talep onaylandı.");
      } else {
        s.durum = "Reddedildi";
        addLog(`<b>${fullName(currentUser)} (Şef)</b>, ${fullName(u)}'ın vardiya talebini reddetti.`);
        toast("Talep reddedildi.");
      }
      renderSefVardiya(main);
    });
  });
}

/* ---------------- YENİ: VARDİYA LİSTESİ (İK / YÖNETİCİ) ---------------- */
function renderVardiyaListesi(main){
  const todayIso = new Date().toISOString().slice(0,10);
  main.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Vardiya Listesi (Gece/Gündüz)</h1>
        <div class="sub">Vardiyası değişen veya onaylanan çalışanların listesi.</div>
      </div>
    </div>
    <div class="card">
      <div style="margin-bottom:16px;display:flex;gap:8px;align-items:center;">
        <input type="date" id="pdfDateVardiya" value="${todayIso}" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);outline:none;font-family:inherit;">
        <button class="btn btn-turq" id="btnVardiyaPdf">📄 Listeyi İndir (PDF)</button>
      </div>
      <div class="table-wrap" id="vardiyaTableWrap"></div>
    </div>
  `;

  function drawTable(){
    const date = $("#pdfDateVardiya").value;
    const filtered = shiftRequests.filter(s=>s.tarih===date && s.durum==="Onaylandı");
    
    if(filtered.length===0){
      $("#vardiyaTableWrap").innerHTML = `<p style="color:var(--text-soft);">Bu tarihte onaylanmış bir vardiya değişikliği yok.</p>`;
      return;
    }

    const rows = filtered.map(s=>{
      const u = userById(s.userId);
      return `<tr>
        <td>${fullName(u)}</td>
        <td>${u.departman}</td>
        <td><span class="badge ${s.type==='Gece'?'badge-pending':'badge-approved'}">${s.type}</span></td>
        <td>${s.saatler}</td>
        <td>${s.sure}</td>
      </tr>`;
    }).join("");

    $("#vardiyaTableWrap").innerHTML = `
      <table class="modern-table">
        <thead>
          <tr><th>İsim</th><th>Departman</th><th>Vardiya</th><th>Saatler</th><th>Süre</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
  
  drawTable();
  $("#pdfDateVardiya").addEventListener("change", drawTable);

  $("#btnVardiyaPdf").addEventListener("click", ()=>{
    const date = $("#pdfDateVardiya").value;
    const filtered = shiftRequests.filter(s=>s.tarih===date && s.durum==="Onaylandı");
    if(filtered.length===0){ toast("Bu tarihte indirilecek liste bulunamadı."); return; }
    exportVardiyaPdf(filtered, date);
  });
}

function exportVardiyaPdf(teamReqs, targetDate){
  toast("PDF hazırlanıyor, lütfen bekleyin...");
  
  const printEl = document.createElement("div");
  printEl.style.padding = "30px 40px";
  printEl.style.fontFamily = "'Inter', system-ui, sans-serif";
  printEl.style.color = "#1f2a37";
  printEl.style.background = "#fff";
  
  const rows = teamReqs.map(s=>{
    const u = userById(s.userId);
    return `<tr>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#111827; font-weight:500;">${fullName(u)}</td>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#4b5563;">${u.departman}</td>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#4b5563; font-weight:600;">${s.type}</td>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#4b5563;">${s.saatler}</td>
      <td style="padding:14px 16px; border-bottom:1px solid #e5e7eb; color:#4b5563;">${s.sure}</td>
    </tr>`;
  }).join("");

  printEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; border-bottom:2px solid #e5e7eb; padding-bottom:20px;">
      <div>
        <h1 style="margin:0; font-size:26px; color:#111827; letter-spacing:-0.5px;">Günlük Vardiya Listesi</h1>
        <p style="margin:6px 0 0 0; color:#6b7280; font-size:14px;">Rapor Tarihi: <strong style="color:#374151;">${fmtDate(targetDate)}</strong></p>
        <p style="margin:4px 0 0 0; color:#6b7280; font-size:14px;">İndiren: ${fullName(currentUser)} (${ROLES[currentUser.role].label})</p>
      </div>
      <img src="unnamed (1).png" alt="Logo" style="height:55px; object-fit:contain;">
    </div>
    
    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13.5px; margin-bottom:40px;">
      <thead>
        <tr style="background-color:#f8fafc;">
          <th style="padding:14px 16px; border-bottom:2px solid #cbd5e1; color:#334155; font-weight:600;">Çalışan</th>
          <th style="padding:14px 16px; border-bottom:2px solid #cbd5e1; color:#334155; font-weight:600;">Departman</th>
          <th style="padding:14px 16px; border-bottom:2px solid #cbd5e1; color:#334155; font-weight:600;">Vardiya</th>
          <th style="padding:14px 16px; border-bottom:2px solid #cbd5e1; color:#334155; font-weight:600;">Saatler</th>
          <th style="padding:14px 16px; border-bottom:2px solid #cbd5e1; color:#334155; font-weight:600;">Süre</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    
    <div style="display:flex; justify-content:space-between; margin-top:80px; text-align:center; font-size:14px; color:#4b5563;">
      <div style="width:200px;">
        <div style="border-bottom:1px solid #9ca3af; height:40px; margin-bottom:8px;"></div>
        <strong style="color:#111827;">Onaylayan İmza</strong>
        <div style="font-size:12px; margin-top:4px;">Yetkili / Şef</div>
      </div>
      <div style="width:200px;">
        <div style="border-bottom:1px solid #9ca3af; height:40px; margin-bottom:8px;"></div>
        <strong style="color:#111827;">İnsan Kaynakları</strong>
        <div style="font-size:12px; margin-top:4px;">İK Departmanı</div>
      </div>
    </div>
    
    <div style="margin-top:60px; font-size:11px; color:#9ca3af; text-align:center;">
      Bu belge Mesai Takip Sistemi tarafından <strong>${new Date().toLocaleDateString('tr-TR')}</strong> tarihinde otomatik olarak oluşturulmuştur.
    </div>
  `;

  const opt = {
    margin:       [5, 0, 10, 0], // Top, Left, Bottom, Right
    filename:     `vardiya-listesi-${targetDate}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(printEl).save().then(()=>{
    addLog(`<b>${fullName(currentUser)} (${ROLES[currentUser.role].label})</b> ${fmtDate(targetDate)} tarihli Vardiya PDF raporunu indirdi.`);
    toast("Vardiya PDF raporu başarıyla indirildi.");
  }).catch(err=>{
    console.error("PDF oluşturulurken hata:", err);
    toast("PDF indirilirken bir hata oluştu.");
  });
}

/* ---------------- YENİ: MESAİ ÜCRETLERİ (İK / YÖNETİCİ) ---------------- */
let hourlyRate = 100;

function renderMesaiUcretleri(main){
  main.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Mesai Ücreti Hesaplama</h1>
        <div class="sub">Çalışanların onaylanmış mesai saatlerini sıralayın ve ücretlerini hesaplayın.</div>
      </div>
    </div>
    <div class="card" style="display:flex;align-items:center;gap:16px;background:var(--turq-light);border:none;">
      <div>
        <label style="display:block;font-size:12px;font-weight:600;color:var(--navy);margin-bottom:6px;">1 Saatlik Mesai Ücreti (TL)</label>
        <input type="number" id="hourlyRateInput" value="${hourlyRate}" style="padding:10px;border-radius:8px;border:1px solid var(--turq);width:120px;font-weight:700;">
      </div>
      <button class="btn btn-primary" id="btnUpdateRate" style="align-self:flex-end;">Uygula</button>
    </div>
    <div class="card">
      <div class="table-wrap" id="ucretTableWrap"></div>
    </div>
  `;

  function drawTable(){
    const userTotals = {};
    users.forEach(u => userTotals[u.id] = { user: u, totalHours: 0 });

    entries.forEach(e => {
      if(e.durum === "Onaylandı"){
        const h = calcHours(e.baslangic, e.bitis);
        if(userTotals[e.userId]) userTotals[e.userId].totalHours += h;
      }
    });

    const sorted = Object.values(userTotals)
      .filter(u => u.totalHours > 0)
      .sort((a,b) => b.totalHours - a.totalHours);

    if(sorted.length===0){
      $("#ucretTableWrap").innerHTML = `<p style="color:var(--text-soft);">Onaylanmış mesai bulunamadı.</p>`;
      return;
    }

    const rows = sorted.map((item, idx)=>{
      const rankBadge = idx < 3 ? `<span class="rank-badge rank-${idx+1}">${idx+1}.</span>` : `<span class="rank-badge">${idx+1}.</span>`;
      return `<tr>
        <td style="width:50px;text-align:center;">${rankBadge}</td>
        <td>${fullName(item.user)}</td>
        <td>${item.user.departman}</td>
        <td style="font-weight:600;">${item.totalHours.toFixed(2)} Saat</td>
        <td style="font-weight:700;color:var(--navy);">${(item.totalHours * hourlyRate).toFixed(2)} TL</td>
      </tr>`;
    }).join("");

    $("#ucretTableWrap").innerHTML = `
      <table class="modern-table">
        <thead>
          <tr><th style="text-align:center;">Sıra</th><th>İsim</th><th>Departman</th><th>Toplam Mesai</th><th>Toplam Ücret</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  drawTable();

  $("#btnUpdateRate").addEventListener("click", ()=>{
    hourlyRate = parseFloat($("#hourlyRateInput").value) || 0;
    toast(`Saatlik ücret ${hourlyRate} TL olarak güncellendi.`);
    drawTable();
  });
}

/* ---------------- BAŞLAT ---------------- */

document.addEventListener("DOMContentLoaded", ()=>{
  initAuth();
  $("#sidebarProfileBtn").addEventListener("click", openProfileModal);
  $("#sidebarProfileBtn").addEventListener("mouseover", function(){ this.style.background="var(--bg)"; });
  $("#sidebarProfileBtn").addEventListener("mouseout", function(){ this.style.background="transparent"; });
  document.addEventListener("click", (ev)=>{
    if(!ev.target.closest(".dropdown-container")){
      $all(".dropdown-menu").forEach(m=>m.classList.add("hidden"));
    }
  });
});