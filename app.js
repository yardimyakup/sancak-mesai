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
  currentUser = null;
  $("#appScreen").classList.add("hidden");
  $("#authScreen").classList.remove("hidden");
  switchAuthTab("login");
}

/* ---------------- SIDEBAR ---------------- */

const NAV_BY_ROLE = {
  calisan: [
    {key:"calisan-mesai", label:"Mesailerim", icon:"📅"}
  ],
  sef: [
    {key:"sef-talepler", label:"Takım Talepleri", icon:"📋"},
    {key:"sef-mesai", label:"Mesailerim", icon:"📅"}
  ],
  ik: [
    {key:"ik-ozet", label:"Şirket Özeti", icon:"🗂️"}
  ],
  yonetici: [
    {key:"yon-ozet", label:"Mesai Özeti", icon:"🗂️"},
    {key:"yon-kayit", label:"Sistem Kayıtları", icon:"🕒"}
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
  else if(key==="sef-talepler") renderSefTalepler(main);
  else if(key==="sef-mesai") renderCalisanMesai(main, currentUser, true);
  else if(key==="ik-ozet") renderIkOzet(main);
  else if(key==="yon-ozet") renderYonOzet(main);
  else if(key==="yon-kayit") renderYonKayit(main);
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
        <div class="sub">Tüm çalışanların mesai kayıtlarını görüntüleyin.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="date" id="pdfDateIk" value="${todayIso}" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);outline:none;font-family:inherit;">
        <button class="btn btn-turq" id="btnIkPdf">📄 PDF İndir</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="modern-table">
          <thead>
            <tr><th>İsim</th><th>Departman</th><th>Tarih</th><th>Mesai Saati</th><th>Durum</th></tr>
          </thead>
          <tbody id="ikTableBody"></tbody>
        </table>
      </div>
    </div>
  `;
  const rows = entries.slice().sort((a,b)=>b.tarih.localeCompare(a.tarih)).map(e=>{
    const u = userById(e.userId);
    return `<tr>
      <td>${fullName(u)}</td>
      <td>${u.departman}</td>
      <td>${fmtDate(e.tarih)}</td>
      <td>${e.baslangic} - ${e.bitis}</td>
      <td><span class="badge ${badgeClass(e.durum)}">${e.durum}</span></td>
    </tr>`;
  }).join("");
  $("#ikTableBody").innerHTML = rows || `<tr><td colspan="5">Kayıt bulunamadı.</td></tr>`;

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
        <div class="sub">Şirket genelindeki tüm mesai kayıtlarını görüntüleyin ve düzenleyin.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="date" id="pdfDateYon" value="${todayIso}" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);outline:none;font-family:inherit;">
        <button class="btn btn-turq" id="btnYonPdf">📄 PDF İndir</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="modern-table">
          <thead>
            <tr><th>İsim</th><th>Departman</th><th>Tarih</th><th>Mesai Saati</th><th>Durum</th><th>İşlem</th></tr>
          </thead>
          <tbody id="yonTableBody"></tbody>
        </table>
      </div>
    </div>
  `;
  const tbody = $("#yonTableBody");
  function draw(){
    const rows = entries.slice().sort((a,b)=>b.tarih.localeCompare(a.tarih)).map(e=>{
      const u = userById(e.userId);
      return `<tr>
        <td>${fullName(u)}</td>
        <td>${u.departman}</td>
        <td>${fmtDate(e.tarih)}</td>
        <td>${e.baslangic} - ${e.bitis}</td>
        <td><span class="badge ${badgeClass(e.durum)}">${e.durum}</span></td>
        <td><button class="btn btn-sm btn-outline" data-id="${e.id}">Düzenle</button></td>
      </tr>`;
    }).join("");
    tbody.innerHTML = rows || `<tr><td colspan="6">Kayıt bulunamadı.</td></tr>`;
    $all("[data-id]", tbody).forEach(btn=>{
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

/* ---------------- BAŞLAT ---------------- */

document.addEventListener("DOMContentLoaded", ()=>{
  initAuth();
  $("#logoutBtn").addEventListener("click", logout);
  document.addEventListener("click", (ev)=>{
    if(!ev.target.closest(".dropdown-container")){
      $all(".dropdown-menu").forEach(m=>m.classList.add("hidden"));
    }
  });
});