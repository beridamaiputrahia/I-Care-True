// ================================================================
// I CARE TRUE — MAIN SCRIPT v2.0
// ================================================================

const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbznBSfGvpENP38aTeBHrOMFisMzBBPzS2vNrx4bE61RjSHASGHoqTReDMQwEBnfdnQI/exec',
    APP_NAME: 'I Care True',
    VERSION: '2.0.0'
};

const S = {
    user: null, page: 'home', darkMode: false, eventView: 'card',
    countdown: null, statsChart: null, pwaPrompt: null,
    currentDevot: null, currentFirman: null, adminTab: 'events',
    data: { events:[], devotions:[], announcements:[], prayers:[],
            verse:null, stats:{}, users:[], firman:[] },
    lastHash: {}
};

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupPWA();
    loadDarkMode();
    loadUser();
    setupScrollAnimations();
    NOTIF.init();
    setTimeout(hideLoading, 2200);
});

function hideLoading() {
    const ls = document.getElementById('loading-screen');
    if (ls) ls.classList.add('fade-out');
    setTimeout(() => {
        if (ls) ls.remove();
        loadDashboard();
        startPeriodicChecks();
    }, 650);
}

// ================================================================
// NOTIFICATION SYSTEM
// ================================================================
const NOTIF = {
    store: [],
    browserOk: false,

    init() {
        this.store = JSON.parse(localStorage.getItem('ict_notifs') || '[]');
        if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => { this.browserOk = p === 'granted'; });
        }
        this.render();
    },

    add(title, body, type = 'info', forAdminOnly = false) {
        const n = { id: Date.now(), title, body, type, forAdminOnly, read: false, time: new Date().toISOString() };
        this.store.unshift(n);
        if (this.store.length > 60) this.store = this.store.slice(0, 60);
        localStorage.setItem('ict_notifs', JSON.stringify(this.store));
        this.render();
        toast(body.length > 80 ? body.substring(0,80)+'...' : body, type);
        if (this.browserOk) {
            try { new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch(e) {}
        }
    },

    getVisible() {
        const isAdmin = S.user && S.user.role === 'admin';
        return this.store.filter(n => !n.forAdminOnly || isAdmin);
    },

    render() {
        const visible = this.getVisible();
        const unread = visible.filter(n => !n.read).length;
        const badge = document.getElementById('notif-badge');
        if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'flex' : 'none'; }
        const list = document.getElementById('notif-list');
        if (!list) return;
        if (!visible.length) { list.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-3);"><i class="fas fa-bell-slash" style="font-size:32px;opacity:0.3;display:block;margin-bottom:12px;"></i>Tidak ada notifikasi</div>`; return; }
        const icons = { info:'fa-info-circle', success:'fa-check-circle', warning:'fa-exclamation-triangle', birthday:'fa-birthday-cake', firman:'fa-microphone' };
        list.innerHTML = visible.slice(0,25).map(n => `
            <div class="notif-item ${n.read?'':'unread'}" onclick="NOTIF.markRead('${n.id}')">
                <div class="ni-icon ${n.type}"><i class="fas ${icons[n.type]||icons.info}"></i></div>
                <div style="flex:1;min-width:0;">
                    <div class="ni-title">${n.title}</div>
                    <div class="ni-body">${n.body}</div>
                    <div class="ni-time">${timeAgo(n.time)}</div>
                </div>
            </div>`).join('');
    },

    markRead(id) {
        this.store = this.store.map(n => n.id == id ? {...n, read:true} : n);
        localStorage.setItem('ict_notifs', JSON.stringify(this.store));
        this.render();
    },

    clearAll() {
        this.store = [];
        localStorage.removeItem('ict_notifs');
        this.render();
        document.getElementById('notif-panel').classList.remove('open');
    }
};

function toggleNotifPanel() {
    const p = document.getElementById('notif-panel');
    p.classList.toggle('open');
    if (p.classList.contains('open')) {
        // mark all as read after viewing
        setTimeout(() => {
            NOTIF.store = NOTIF.store.map(n => ({...n, read:true}));
            localStorage.setItem('ict_notifs', JSON.stringify(NOTIF.store));
            NOTIF.render();
        }, 1500);
    }
}

// Close notif panel on outside click
document.addEventListener('click', e => {
    const panel = document.getElementById('notif-panel');
    if (panel && panel.classList.contains('open') && !panel.contains(e.target) && !e.target.closest('.notif-wrap')) {
        panel.classList.remove('open');
    }
});

// ================================================================
// PERIODIC CHECKS
// ================================================================
function startPeriodicChecks() {
    checkBirthdays();
    checkEventReminders();
    checkDailyVerse();
    checkFirmanAssignment();
    setInterval(() => {
        checkBirthdays();
        checkEventReminders();
        checkDailyVerse();
        autoRefreshData();
    }, 60000); // every minute
}

function checkBirthdays() {
    const today = new Date();
    const todayMD = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // Check logged-in user's birthday
    if (S.user && S.user.birthday) {
        const bd = S.user.birthday.slice(5); // MM-DD
        const key = `ict_bd_self_${today.getFullYear()}`;
        if (bd === todayMD && !localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            setTimeout(() => showBirthdayOverlay(S.user.nama), 1500);
        }
    }

    // Admin: check all other members' birthdays
    if (S.user && S.user.role === 'admin' && S.data.users.length) {
        S.data.users.forEach(u => {
            if (!u.birthday || u.email === S.user.email) return;
            const bd = u.birthday.slice(5);
            const key = `ict_bd_admin_${u.email}_${today.getFullYear()}`;
            if (bd === todayMD && !localStorage.getItem(key)) {
                localStorage.setItem(key, '1');
                NOTIF.add('🎂 Ulang Tahun Anggota', `${u.nama} hari ini berulang tahun! Jangan lupa kirim ucapan 🙏`, 'birthday', true);
            }
        });
    }
}

function checkEventReminders() {
    if (!S.data.events.length) return;
    const now = new Date();
    S.data.events.forEach(ev => {
        const evDate = new Date(`${ev.tanggal}T${(ev.jam||'00:00')}:00`);
        const diffMs = evDate - now;
        if (diffMs <= 0) return;
        const hours = diffMs / 3600000;
        const key1d = `ict_rem1d_${ev.id}`;
        const key1h = `ict_rem1h_${ev.id}`;
        if (hours <= 24 && hours > 1 && !localStorage.getItem(key1d)) {
            localStorage.setItem(key1d, '1');
            NOTIF.add('📅 Pengingat H-1', `"${ev.nama_kegiatan}" besok, ${formatDate(ev.tanggal)} pukul ${ev.jam} di ${ev.lokasi}`, 'info');
        }
        if (hours <= 1 && hours > 0 && !localStorage.getItem(key1h)) {
            localStorage.setItem(key1h, '1');
            NOTIF.add('🔔 1 Jam Lagi!', `"${ev.nama_kegiatan}" dimulai pukul ${ev.jam} di ${ev.lokasi}`, 'warning');
        }
    });
}

function checkDailyVerse() {
    const now = new Date();
    const key = `ict_verse_notif_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}`;
    if (now.getHours() === 5 && now.getMinutes() < 2 && !localStorage.getItem(key)) {
        localStorage.setItem(key, '1');
        apiGet('getDailyVerse').then(res => {
            if (res.success) {
                S.data.verse = res.data;
                renderVerse(res.data);
                NOTIF.add('📖 Ayat Baru Pukul 05:00', `"${res.data.ayat.substring(0,90)}..." — ${res.data.referensi}`, 'success');
            }
        });
    }
}

function checkFirmanAssignment() {
    if (!S.user) return;
    apiGet('getFirman', { email: S.user.email, status: 'pending' }).then(res => {
        if (res.success && res.data && res.data.length) {
            const f = res.data[0];
            S.currentFirman = f;
            document.getElementById('firman-resp-body').innerHTML = `
                <div style="background:rgba(147,112,175,0.08);border-radius:12px;padding:18px;margin-bottom:18px;">
                    <div style="font-size:13px;color:var(--text-3);margin-bottom:6px;">Anda ditugaskan oleh admin untuk</div>
                    <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:8px;"><i class="fas fa-microphone me-2" style="color:#9370AF;"></i>Share Firman</div>
                    <div style="font-size:13.5px;color:var(--text-2);"><i class="fas fa-calendar me-2"></i>${formatDate(f.tanggal)}</div>
                    ${f.catatan?`<div style="margin-top:10px;font-size:13.5px;color:var(--text-2);"><i class="fas fa-sticky-note me-2"></i>${f.catatan}</div>`:''}
                </div>
                <p style="font-size:14px;color:var(--text-2);">Apakah Anda bersedia memimpin share firman pada kegiatan tersebut?</p>`;
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFirmanResp')).show();
        }
    }).catch(() => {});
}

async function autoRefreshData() {
    if (S.page === 'home') {
        const res = await apiGet('getEvents');
        if (res.success) {
            const newHash = JSON.stringify(res.data);
            if (S.lastHash.events && S.lastHash.events !== newHash) {
                NOTIF.add('🔄 Jadwal Diperbarui', 'Ada perubahan atau penambahan pada jadwal kegiatan.', 'info');
                S.data.events = res.data;
                renderDashEvents(res.data);
            }
            S.lastHash.events = newHash;
        }
    }
}

// ================================================================
// BIRTHDAY ANIMATION
// ================================================================
function showBirthdayOverlay(nama) {
    const overlay = document.getElementById('birthday-overlay');
    document.getElementById('bd-card-inner').innerHTML = `
        <span class="bd-emoji">🎂</span>
        <div class="bd-title">Selamat Ulang Tahun!</div>
        <div class="bd-name">${nama}</div>
        <div class="bd-verse">"Kiranya TUHAN memberkati engkau dan melindungi engkau."</div>
        <div class="bd-ref">— Bilangan 6:24</div>
        <button class="btn-p" onclick="closeBirthdayOverlay()" style="margin:0 auto;"><i class="fas fa-heart"></i> Terima Kasih 🙏</button>`;
    overlay.classList.add('show');
    createConfetti();
}

function closeBirthdayOverlay() {
    document.getElementById('birthday-overlay').classList.remove('show');
    document.querySelectorAll('.confetti-piece').forEach(el => el.remove());
}

function createConfetti() {
    const colors = ['#6B8E6B','#B89B72','#E57373','#5B8DB8','#9370AF','#F0B429','#D4B896'];
    for (let i = 0; i < 80; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.cssText = `left:${Math.random()*100}vw;background:${colors[Math.floor(Math.random()*colors.length)]};width:${6+Math.random()*8}px;height:${10+Math.random()*8}px;animation-duration:${2+Math.random()*3}s;animation-delay:${Math.random()*2}s;border-radius:${Math.random()>0.5?'50%':'2px'};`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 6000);
    }
}

// ================================================================
// PWA
// ================================================================
function setupPWA() {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault(); S.pwaPrompt = e;
        document.getElementById('pwa-btn').style.display = 'flex';
        document.getElementById('pwa-fab').style.display = 'flex';
    });
    window.addEventListener('appinstalled', () => {
        S.pwaPrompt = null;
        document.getElementById('pwa-btn').style.display = 'none';
        document.getElementById('pwa-fab').style.display = 'none';
        toast('Aplikasi berhasil dipasang!', 'success');
    });
}
function installPWA() {
    if (!S.pwaPrompt) { toast('Gunakan browser Chrome/Edge untuk memasang aplikasi.', 'info'); return; }
    S.pwaPrompt.prompt();
    S.pwaPrompt.userChoice.then(r => { if (r.outcome==='accepted') toast('Memasang aplikasi...','success'); S.pwaPrompt=null; });
}

// ================================================================
// DARK MODE
// ================================================================
function loadDarkMode() { S.darkMode = localStorage.getItem('ict_dark')==='true'; applyDarkMode(); }
function toggleDarkMode() { S.darkMode=!S.darkMode; localStorage.setItem('ict_dark',S.darkMode); applyDarkMode(); toast(S.darkMode?'Mode gelap aktif':'Mode terang aktif','info'); }
function applyDarkMode() {
    document.documentElement.setAttribute('data-theme', S.darkMode?'dark':'light');
    const icon = document.getElementById('dm-icon');
    if (icon) icon.className = S.darkMode?'fas fa-sun':'fas fa-moon';
    if (S.statsChart) updateChartTheme();
}

// ================================================================
// TOAST
// ================================================================
function toast(msg, type='info', dur=3500) {
    const icons={success:'fa-check-circle',error:'fa-times-circle',warning:'fa-exclamation-triangle',info:'fa-info-circle'};
    const el=document.createElement('div');
    el.className=`toast-item ${type}`;
    el.innerHTML=`<i class="fas ${icons[type]||icons.info} ti"></i><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(110%)';setTimeout(()=>el.remove(),350);},dur);
}

// ================================================================
// NAVIGATION
// ================================================================
function navigate(page) {
    if (page==='admin' && (!S.user || S.user.role!=='admin')) { toast('Akses ditolak. Hanya admin.','error'); return; }
    if (page==='anggota' && !S.user) { showAuth('login'); toast('Silakan masuk untuk melihat anggota.','warning'); return; }
    S.page = page;
    const pages=['home','jadwal','renungan','doa','pengumuman','anggota','profil','admin'];
    pages.forEach(p => {
        const el=document.getElementById(p==='home'?'page-home':`page-${p}`);
        if(el) el.classList.toggle('d-none', p!==page);
    });
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('data-page')===page));
    window.scrollTo({top:0,behavior:'smooth'});
    switch(page) {
        case 'home': loadDashboard(); break;
        case 'jadwal': loadEvents(); break;
        case 'renungan': loadDevotions(); break;
        case 'doa': loadPrayers(); break;
        case 'pengumuman': loadAnnouncements(); break;
        case 'anggota': loadMembers(); break;
        case 'profil': loadProfile(); break;
        case 'admin': loadAdminPanel(); break;
    }
    setTimeout(observeReveal,200);
    document.getElementById('notif-panel').classList.remove('open');
}

function scrollToDashboard() { document.getElementById('dashboard').scrollIntoView({behavior:'smooth'}); }
function toggleMobileNav() { document.getElementById('mobile-nav').classList.toggle('open'); }
function closeMobileNav() { document.getElementById('mobile-nav').classList.remove('open'); }

// ================================================================
// SCROLL ANIMATIONS
// ================================================================
function setupScrollAnimations() {
    new IntersectionObserver(entries => entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); }), {threshold:0.1})
        .observe = (() => { const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible');}),{threshold:0.1}); document.querySelectorAll('.reveal').forEach(el=>obs.observe(el)); return obs.observe.bind(obs); })();
}
function observeReveal() {
    const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible');}),{threshold:0.1});
    document.querySelectorAll('.reveal:not(.visible)').forEach(el=>obs.observe(el));
}

// ================================================================
// AUTH
// ================================================================
function loadUser() {
    const saved=localStorage.getItem('ict_user');
    if(saved) { S.user=JSON.parse(saved); updateAuthUI(); }
}

function updateAuthUI() {
    const btn=document.getElementById('auth-btn');
    if(!btn) return;
    if(S.user) {
        btn.innerHTML=`<i class="fas fa-user-circle"></i> ${S.user.nama.split(' ')[0]}`;
        btn.onclick=()=>showUserMenu();
        document.getElementById('admin-nav-item').style.display = S.user.role==='admin'?'':'none';
        document.getElementById('admin-mob-item').style.display = S.user.role==='admin'?'':'none';
    } else {
        btn.innerHTML=`<i class="fas fa-sign-in-alt"></i> Masuk`;
        btn.onclick=()=>showAuth('login');
        document.getElementById('admin-nav-item').style.display='none';
        document.getElementById('admin-mob-item').style.display='none';
    }
}

function showAuth(type) {
    if(type==='login') { try{bootstrap.Modal.getOrCreateInstance(document.getElementById('registerModal')).hide();}catch(e){} bootstrap.Modal.getOrCreateInstance(document.getElementById('loginModal')).show(); }
    else { try{bootstrap.Modal.getOrCreateInstance(document.getElementById('loginModal')).hide();}catch(e){} bootstrap.Modal.getOrCreateInstance(document.getElementById('registerModal')).show(); }
}

function showUserMenu() {
    Swal.fire({
        title: S.user.nama, html: `<div style="color:#888;">${S.user.email}</div><div style="margin-top:6px;"><span class="badge-${S.user.role==='admin'?'admin':'member'}">${S.user.role}</span></div>`,
        showCancelButton:true, confirmButtonText:'<i class="fas fa-user-circle"></i> Profil', cancelButtonText:'<i class="fas fa-sign-out-alt"></i> Keluar',
        confirmButtonColor:'#6B8E6B', cancelButtonColor:'#E57373'
    }).then(r => { if(r.isConfirmed) navigate('profil'); if(r.isDismissed && r.dismiss===Swal.DismissReason.cancel) doLogout(); });
}

async function doLogin() {
    const email=document.getElementById('l-email').value.trim();
    const pass=document.getElementById('l-pass').value;
    if(!email||!pass){toast('Isi email dan password.','warning');return;}
    try {
        const res=await apiGet('login',{email,password:pass});
        if(res.success) {
            S.user=res.data; localStorage.setItem('ict_user',JSON.stringify(S.user));
            bootstrap.Modal.getOrCreateInstance(document.getElementById('loginModal')).hide();
            updateAuthUI();
            toast(`Selamat datang, ${S.user.nama}! 🙏`,'success');
            NOTIF.render();
            checkBirthdays();
            setTimeout(()=>checkFirmanAssignment(),800);
            if(S.page==='profil') loadProfile();
            if(S.page==='doa') loadPrayers();
        } else { toast(res.message||'Email atau password salah.','error'); }
    } catch(e) { toast('Gagal terhubung ke server.','error'); }
}

async function doRegister() {
    const nama=document.getElementById('r-nama').value.trim();
    const email=document.getElementById('r-email').value.trim();
    const wa=document.getElementById('r-wa').value.trim();
    const pass=document.getElementById('r-pass').value;
    const birthday=document.getElementById('r-birthday').value;
    const alamat=document.getElementById('r-alamat').value.trim();
    if(!nama||!email||!wa||!pass){toast('Lengkapi data wajib.','warning');return;}
    if(pass.length<6){toast('Password minimal 6 karakter.','warning');return;}
    let foto='';
    const fotoInput=document.getElementById('r-foto');
    if(fotoInput.files&&fotoInput.files[0]){
        try{foto=await resizeImageToBase64(fotoInput.files[0]);}
        catch(e){toast('Gagal memproses foto profil.','error');return;}
    }
    try {
        const res=await apiPost({action:'addUser',nama,email,wa,password:pass,role:'member',birthday,alamat,foto});
        if(res.success) {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('registerModal')).hide();
            toast('Pendaftaran berhasil! Silakan masuk.','success');
            showAuth('login');
        } else { toast(res.message||'Pendaftaran gagal.','error'); }
    } catch(e) { toast('Gagal terhubung ke server.','error'); }
}

function doLogout() { S.user=null; localStorage.removeItem('ict_user'); updateAuthUI(); toast('Berhasil keluar. Sampai jumpa! 👋','info'); navigate('home'); }
function togglePw(iId,eId){const i=document.getElementById(iId),e=document.getElementById(eId);i.type=i.type==='password'?'text':'password';e.className=i.type==='password'?'fas fa-eye':'fas fa-eye-slash';}

// ================================================================
// API HELPERS
// ================================================================
async function apiGet(action, params={}) {
    if(!CONFIG.API_URL||CONFIG.API_URL.includes('PASTE_URL')) return getMockData(action,params);
    const url=new URL(CONFIG.API_URL);
    url.searchParams.set('action',action);
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    const res=await fetch(url.toString());
    return res.json();
}
async function apiPost(data) {
    if(!CONFIG.API_URL||CONFIG.API_URL.includes('PASTE_URL')) return getMockPost(data);
    const res=await fetch(CONFIG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(data)});
    return res.json();
}

// ================================================================
// MOCK DATA
// ================================================================
function getMockData(action, params={}) {
    const today=new Date(), fmt=d=>d.toISOString().split('T')[0];
    const add=n=>new Date(today.getTime()+n*864e5);
    const mock={
        getEvents:{success:true,data:[
            {id:'EVT001',nama_kegiatan:'I Care Jumat',tanggal:fmt(add(7)),jam:'19:00',lokasi:'Gereja Bethel Indonesia',pic:'Kak Sarah'},
            {id:'EVT002',nama_kegiatan:'Kelompok Sel',tanggal:fmt(add(14)),jam:'18:30',lokasi:'Rumah Ibu Mirna',pic:'Pak Budi'},
            {id:'EVT003',nama_kegiatan:'Sunday Service',tanggal:fmt(add(21)),jam:'08:00',lokasi:'GBI Pusat',pic:'Ps. Jonathan'},
            {id:'EVT004',nama_kegiatan:'Youth Camp 2026',tanggal:fmt(add(30)),jam:'07:00',lokasi:'Puncak, Bogor',pic:'Kak Reza'},
        ]},
        getDevotions:{success:true,data:[
            {id:'DEV001',judul:'Berjalan dalam Terang Firman',isi:'Firman Tuhan adalah lampu yang menerangi setiap langkah kita. Ketika kita membaca dan merenungkan firman-Nya setiap hari, kita diperlengkapi untuk menghadapi setiap tantangan dengan iman yang kuat. Mazmur 119:105 mengingatkan kita bahwa firman Tuhan bukan hanya pengetahuan, tetapi cahaya hidup yang secara aktif menuntun jalan kita di tengah kegelapan dunia.',ayat:'Mazmur 119:105',penulis:'Ps. Jonathan',tanggal:fmt(today)},
            {id:'DEV002',judul:'Kasih yang Tidak Berkesudahan',isi:'Kasih Allah kepada kita tidak pernah berakhir. Ratapan 3:22-23 mengatakan bahwa kasih setia Allah tidak habis-habisnya dan pembaharuannya terjadi setiap pagi. Ini berarti setiap hari adalah kesempatan baru untuk mengalami kasih-Nya yang segar. Jangan biarkan kegagalan masa lalu menghalangimu untuk menerima kasih yang baru dari Allah hari ini.',ayat:'Ratapan 3:22-23',penulis:'Kak Maria',tanggal:fmt(add(-1))},
            {id:'DEV003',judul:'Kekuatan dalam Kelemahan',isi:'2 Korintus 12:9 berkata bahwa kuasa Allah menjadi sempurna dalam kelemahan kita. Ketika kita menyerahkan kelemahan kita kepada-Nya, Dia bekerja dengan cara yang melampaui kemampuan kita sendiri.',ayat:'2 Korintus 12:9',penulis:'Pak Budi',tanggal:fmt(add(-2))},
            {id:'DEV004',judul:'Damai yang Melampaui Akal',isi:'Filipi 4:6-7 berbicara tentang damai Allah yang melampaui segala akal manusia. Ketika kita bersyukur dan berdoa, damai itu hadir bukan karena situasi berubah, tetapi karena hati kita dijaga oleh tangan Allah yang penuh kasih.',ayat:'Filipi 4:6-7',penulis:'Kak Sarah',tanggal:fmt(add(-3))},
        ]},
        getAnnouncements:{success:true,data:[
            {id:'ANN001',judul:'Pendaftaran I Care Camp 2026 Dibuka!',isi:'Segera daftarkan dirimu untuk I Care Camp 2026 di Puncak, Bogor. Kuota terbatas 50 peserta! Biaya Rp 350.000 sudah termasuk penginapan dan konsumsi.',tanggal:fmt(today)},
            {id:'ANN002',judul:'Perubahan Jadwal Kelompok Sel',isi:'Mulai bulan Juli 2026, jadwal kelompok sel dipindahkan dari Rabu menjadi Jumat malam pukul 19:00 WIB untuk semua wilayah.',tanggal:fmt(add(-3))},
            {id:'ANN003',judul:'Kolekte Online Tersedia',isi:'Tersedia kolekte online via BCA 1234567890 a.n. Yayasan I Care True. Mohon cantumkan nama dan keterangan.',tanggal:fmt(add(-7))},
        ]},
        getPrayers:{success:true,data:[
            {id:'PRY001',nama:'Budi S.',isi_doa:'Doakan proses wawancara kerja saya minggu depan.',status:'praying',tanggal:fmt(today),email:'budi@example.com'},
            {id:'PRY002',nama:'Maria L.',isi_doa:'Terima kasih Tuhan! Doa studi saya sudah dijawab. Lulus dengan nilai terbaik!',status:'answered',tanggal:fmt(add(-2)),email:'maria@example.com'},
            {id:'PRY003',nama:'Anonim',isi_doa:'Doakan kesehatan orang tua saya yang sedang sakit.',status:'praying',tanggal:fmt(add(-1)),email:''},
        ]},
        getDailyVerse:{success:true,data:{id:'VRS001',ayat:'Sebab Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan kecelakaan, untuk memberikan kepadamu hari depan yang penuh harapan.',referensi:'Yeremia 29:11'}},
        getStats:{success:true,data:{members:47,events:28,devotions:124,prayers:89}},
        getUsers:{success:true,data:[
            {id:'USR001',nama:'Admin I Care',email:'admin@icaretrue.com',wa:'081234567890',role:'admin',birthday:'1990-05-15',alamat:'Jakarta Selatan',foto:''},
            {id:'USR002',nama:'Budi Santoso',email:'budi@example.com',wa:'082233445566',role:'member',birthday:'1995-08-20',alamat:'Bekasi',foto:''},
            {id:'USR003',nama:'Maria Lestari',email:'maria@example.com',wa:'083344556677',role:'member',birthday:'1998-12-25',alamat:'Depok',foto:''},
        ]},
        getFirman:{success:true,data:[]},
        login:{success:false,message:'Mode demo: Setup Google Apps Script untuk login nyata.'},
    };
    return Promise.resolve(mock[action]||{success:true,data:[]});
}

const _mockPrayerStore = [];
function getMockPost(data) {
    if(data.action==='addUser') return Promise.resolve({success:false,message:'Mode demo: Setup Google Apps Script untuk registrasi.'});
    if(data.action==='addPrayer') {
        const n={id:Date.now().toString(),nama:S.user?S.user.nama:'Anonim',isi_doa:data.isi_doa,status:'praying',tanggal:new Date().toISOString().split('T')[0],email:S.user?S.user.email:''};
        S.data.prayers.unshift(n); return Promise.resolve({success:true,data:n});
    }
    if(data.action==='updatePrayer') { S.data.prayers=S.data.prayers.map(p=>p.id===data.id?{...p,isi_doa:data.isi_doa}:p); return Promise.resolve({success:true}); }
    if(data.action==='deletePrayer') { S.data.prayers=S.data.prayers.filter(p=>p.id!==data.id); return Promise.resolve({success:true}); }
    if(data.action==='addEvent') { const n={id:'EVT'+Date.now(),...data}; S.data.events.push(n); NOTIF.add('📅 Kegiatan Baru Ditambahkan',`"${data.nama_kegiatan}" pada ${formatDate(data.tanggal)}`,'success'); return Promise.resolve({success:true,data:n}); }
    if(data.action==='updateEvent') { S.data.events=S.data.events.map(e=>e.id===data.id?{...e,...data}:e); NOTIF.add('📅 Jadwal Diperbarui',`"${data.nama_kegiatan}" telah diperbarui`,'info'); return Promise.resolve({success:true}); }
    if(data.action==='deleteEvent') { S.data.events=S.data.events.filter(e=>e.id!==data.id); return Promise.resolve({success:true}); }
    if(data.action==='addDevotion') { const n={id:'DEV'+Date.now(),tanggal:new Date().toISOString().split('T')[0],...data}; S.data.devotions.unshift(n); NOTIF.add('📖 Renungan Baru',`"${data.judul}" oleh ${data.penulis}`,'success'); return Promise.resolve({success:true,data:n}); }
    if(data.action==='updateDevotion') { S.data.devotions=S.data.devotions.map(d=>d.id===data.id?{...d,...data}:d); NOTIF.add('📖 Renungan Diperbarui',`"${data.judul}" telah diperbarui`,'info'); return Promise.resolve({success:true}); }
    if(data.action==='deleteDevotion') { S.data.devotions=S.data.devotions.filter(d=>d.id!==data.id); return Promise.resolve({success:true}); }
    if(data.action==='addAnnouncement') { const n={id:'ANN'+Date.now(),tanggal:new Date().toISOString().split('T')[0],...data}; S.data.announcements.unshift(n); NOTIF.add('📢 Pengumuman Baru',`"${data.judul}"`,'success'); return Promise.resolve({success:true,data:n}); }
    if(data.action==='updateAnnouncement') { S.data.announcements=S.data.announcements.map(a=>a.id===data.id?{...a,...data}:a); NOTIF.add('📢 Pengumuman Diperbarui',`"${data.judul}" telah diperbarui`,'info'); return Promise.resolve({success:true}); }
    if(data.action==='deleteAnnouncement') { S.data.announcements=S.data.announcements.filter(a=>a.id!==data.id); return Promise.resolve({success:true}); }
    if(data.action==='updateUser') { S.data.users=S.data.users.map(u=>u.id===data.id?{...u,...data}:u); if(S.user&&S.user.id===data.id){Object.assign(S.user,data);localStorage.setItem('ict_user',JSON.stringify(S.user));} return Promise.resolve({success:true}); }
    if(data.action==='deleteUser') { S.data.users=S.data.users.filter(u=>u.id!==data.id); return Promise.resolve({success:true}); }
    if(data.action==='addFirman') {
        const n={id:'FRM'+Date.now(),...data,status:'pending'};
        S.data.firman.push(n);
        NOTIF.add('🎤 Tugas Firman Dikirim',`${data.member_nama} ditugaskan share firman pada ${formatDate(data.tanggal)}`,'firman',true);
        return Promise.resolve({success:true,data:n});
    }
    if(data.action==='uploadFile') return Promise.resolve({success:true, url:'#demo', name:data.fileName, id:'mock_'+Date.now()});
    if(data.action==='updateFirman') {
        S.data.firman=S.data.firman.map(f=>f.id===data.id?{...f,status:data.status}:f);
        if(S.user && S.user.role==='admin') NOTIF.add('🎤 Konfirmasi Firman',`${data.member_nama} ${data.status==='accepted'?'BERSEDIA ✅':'tidak bersedia ❌'} memimpin share firman`,'firman',true);
        return Promise.resolve({success:true});
    }
    return Promise.resolve({success:true});
}

// ================================================================
// DASHBOARD
// ================================================================
async function loadDashboard() {
    try {
        const [evR,dvR,anR,vrR,stR] = await Promise.all([apiGet('getEvents'),apiGet('getDevotions'),apiGet('getAnnouncements'),apiGet('getDailyVerse'),apiGet('getStats')]);
        if(evR.success){S.data.events=evR.data;S.lastHash.events=JSON.stringify(evR.data);renderDashEvents(evR.data);startCountdown(evR.data);}
        if(dvR.success){S.data.devotions=dvR.data;renderDashDevotions(dvR.data);}
        if(anR.success){S.data.announcements=anR.data;renderDashAnn(anR.data);}
        if(vrR.success){S.data.verse=vrR.data;renderVerse(vrR.data);}
        if(stR.success){S.data.stats=stR.data;renderStats(stR.data);initChart(stR.data);}
        setTimeout(observeReveal,100);
    } catch(e) { toast('Gagal memuat dashboard.','error'); }
}

function renderDashEvents(events) {
    const el=document.getElementById('dash-events');
    if(!events?.length){el.innerHTML=`<div class="empty"><i class="fas fa-calendar"></i><p>Belum ada jadwal</p></div>`;return;}
    el.innerHTML=events.slice(0,3).map(ev=>`
        <div class="event-card mb-2" onclick="navigate('jadwal')">
            <div class="ev-badge"><i class="fas fa-calendar-day"></i> ${formatDate(ev.tanggal)}</div>
            <div class="ev-name">${ev.nama_kegiatan}</div>
            <div class="ev-meta"><span><i class="fas fa-clock"></i> ${ev.jam}</span><span><i class="fas fa-map-marker-alt"></i> ${ev.lokasi}</span></div>
        </div>`).join('');
}
function renderDashDevotions(devs) {
    const el=document.getElementById('dash-devot');
    if(!devs?.length){el.innerHTML=`<div class="empty"><i class="fas fa-book-open"></i><p>Belum ada renungan</p></div>`;return;}
    const d=devs[0];
    el.innerHTML=`<div class="dev-card" onclick="showDevotionDetail(${safeJson(d)})"><div class="dev-tag"><i class="fas fa-bible"></i> ${d.ayat}</div><div class="dev-title">${d.judul}</div><div class="dev-preview">${d.isi}</div><div class="dev-footer"><span><i class="fas fa-user me-1"></i>${d.penulis}</span><span>${formatDate(d.tanggal)}</span></div></div>`;
}
function renderDashAnn(anns) {
    const el=document.getElementById('dash-ann');
    if(!anns?.length){el.innerHTML=`<div class="empty"><i class="fas fa-bullhorn"></i><p>Belum ada pengumuman</p></div>`;return;}
    const a=anns[0];
    el.innerHTML=`<div class="ann-card" style="cursor:pointer;" onclick="navigate('pengumuman')"><div class="ann-title">${a.judul}</div><div class="ann-body">${a.isi.substring(0,160)}${a.isi.length>160?'...':''}</div><div class="ann-date"><i class="fas fa-clock me-1"></i>${formatDate(a.tanggal)}</div></div>`;
}
function renderVerse(v) { if(!v)return; document.getElementById('verse-text').textContent=v.ayat; document.getElementById('verse-ref').textContent=v.referensi; }
function renderStats(st) {
    const anim=(id,t)=>{const el=document.getElementById(id);if(!el)return;let c=0;const s=Math.ceil(t/40),i=setInterval(()=>{c=Math.min(c+s,t);el.textContent=c;if(c>=t)clearInterval(i);},40);};
    anim('stat-members',st.members||0);anim('stat-events',st.events||0);anim('stat-devotions',st.devotions||0);anim('stat-prayers',st.prayers||0);
}

// ================================================================
// CHART
// ================================================================
function initChart(st) {
    const ctx=document.getElementById('stats-chart');if(!ctx)return;
    if(S.statsChart){S.statsChart.destroy();}
    const dark=document.documentElement.getAttribute('data-theme')==='dark';
    S.statsChart=new Chart(ctx,{type:'bar',data:{labels:['Anggota','Kegiatan','Renungan','Doa'],datasets:[{label:'Jumlah',data:[st.members||0,st.events||0,st.devotions||0,st.prayers||0],backgroundColor:['rgba(107,142,107,0.75)','rgba(91,141,184,0.75)','rgba(184,155,114,0.75)','rgba(147,112,175,0.75)'],borderColor:['#6B8E6B','#5B8DB8','#B89B72','#9370AF'],borderWidth:2,borderRadius:8,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:dark?'rgba(255,255,255,0.05)':'rgba(107,142,107,0.08)'},ticks:{color:dark?'#A0B8A0':'#5A7A5A',font:{size:12}}},x:{grid:{display:false},ticks:{color:dark?'#A0B8A0':'#5A7A5A',font:{size:12}}}}}});
}
function updateChartTheme(){if(S.data.stats)initChart(S.data.stats);}

// ================================================================
// COUNTDOWN
// ================================================================
function startCountdown(events) {
    if(S.countdown)clearInterval(S.countdown);
    if(!events?.length)return;
    const now=new Date();
    const upcoming=events.map(e=>({...e,date:new Date(`${e.tanggal}T${e.jam||'00:00'}:00`)})).filter(e=>e.date>now).sort((a,b)=>a.date-b.date);
    if(!upcoming.length){document.getElementById('cd-event').textContent='Tidak ada jadwal mendatang';return;}
    const next=upcoming[0];
    document.getElementById('cd-event').textContent=next.nama_kegiatan;
    S.countdown=setInterval(()=>{
        const diff=next.date-new Date();
        if(diff<=0){clearInterval(S.countdown);document.getElementById('cd-event').textContent='Sedang berlangsung!';return;}
        const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
        ['cd-d','cd-h','cd-m','cd-s'].forEach((id,i)=>document.getElementById(id).textContent=String([d,h,m,s][i]).padStart(2,'0'));
    },1000);
}

// ================================================================
// EVENTS / JADWAL
// ================================================================
async function loadEvents() {
    document.getElementById('events-container').innerHTML=skelGrid(4);
    try{const res=await apiGet('getEvents');if(res.success)S.data.events=res.data;renderEvents(S.data.events);}
    catch(e){document.getElementById('events-container').innerHTML=`<div class="col-12"><div class="empty"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat data</p></div></div>`;}
}
function renderEvents(events) {
    const c=document.getElementById('events-container');
    if(!events?.length){c.innerHTML=`<div class="col-12"><div class="empty"><i class="fas fa-calendar-times"></i><p>Belum ada jadwal</p></div></div>`;return;}
    if(S.eventView==='card'){
        c.innerHTML=events.map((ev,i)=>`<div class="col-12 col-md-6 col-lg-4"><div class="event-card reveal" style="transition-delay:${i*.05}s;"><div class="ev-badge"><i class="fas fa-calendar-day"></i> ${formatDate(ev.tanggal)}</div><div class="ev-name">${ev.nama_kegiatan}</div><div class="ev-meta"><span><i class="fas fa-clock"></i> ${ev.jam}</span><span><i class="fas fa-map-marker-alt"></i> ${ev.lokasi}</span>${ev.pic?`<span><i class="fas fa-user"></i> ${ev.pic}</span>`:''}</div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn-wa" style="font-size:12px;padding:6px 12px;" onclick="shareEventWA(${i})"><i class="fab fa-whatsapp"></i> Share</button>${(ev.file_url&&ev.file_url!=='#demo')?`<a href="${ev.file_url}" target="_blank" class="file-download-btn"><i class="fas ${fileIcon(ev.file_name||'')} me-1"></i>Unduh</a>`:''}</div></div></div>`).join('');
    } else {
        c.innerHTML=`<div class="col-12">${events.map((ev,i)=>`<div class="list-item reveal" style="transition-delay:${i*.04}s;"><div class="li-num">${i+1}</div><div style="flex:1;"><div style="font-weight:700;color:var(--text);font-size:14.5px;">${ev.nama_kegiatan}</div><div style="font-size:12.5px;color:var(--text-3);margin-top:4px;display:flex;gap:14px;flex-wrap:wrap;"><span><i class="fas fa-calendar me-1"></i>${formatDate(ev.tanggal)}</span><span><i class="fas fa-clock me-1"></i>${ev.jam}</span><span><i class="fas fa-map-pin me-1"></i>${ev.lokasi}</span>${ev.pic?`<span><i class="fas fa-user me-1"></i>${ev.pic}</span>`:''}</div></div><div style="display:flex;gap:6px;"><button class="btn-wa" style="font-size:12px;padding:6px 12px;" onclick="shareEventWA(${i})"><i class="fab fa-whatsapp"></i></button>${(ev.file_url&&ev.file_url!=='#demo')?`<a href="${ev.file_url}" target="_blank" class="file-download-btn" style="margin-top:0;"><i class="fas ${fileIcon(ev.file_name||'')}"></i></a>`:''}</div></div>`).join('')}</div>`;
    }
    setTimeout(observeReveal,50);
}
function setView(v){S.eventView=v;document.getElementById('vt-card').classList.toggle('active',v==='card');document.getElementById('vt-list').classList.toggle('active',v==='list');renderEvents(S.data.events);}
function filterEvents(t){if(!t){renderEvents(S.data.events);return;}const q=t.toLowerCase();renderEvents(S.data.events.filter(e=>e.nama_kegiatan.toLowerCase().includes(q)||e.lokasi.toLowerCase().includes(q)||(e.pic&&e.pic.toLowerCase().includes(q))));}
function shareEventWA(i){const ev=S.data.events[i];if(!ev)return;window.open(`https://wa.me/?text=${encodeURIComponent(`📅 *${ev.nama_kegiatan}*\n🗓️ ${formatDate(ev.tanggal)} | ⏰ ${ev.jam}\n📍 ${ev.lokasi}${ev.pic?`\n👤 PIC: ${ev.pic}`:''}\n\n_I Care True_`)}`, '_blank');}

// ================================================================
// DEVOTIONS
// ================================================================
async function loadDevotions() {
    document.getElementById('devotions-container').innerHTML=skelGrid(4,true);
    try{const res=await apiGet('getDevotions');if(res.success)S.data.devotions=res.data;renderDevotions(S.data.devotions);}
    catch(e){document.getElementById('devotions-container').innerHTML=`<div class="col-12"><div class="empty"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat data</p></div></div>`;}
}
function renderDevotions(devs) {
    const c=document.getElementById('devotions-container');
    if(!devs?.length){c.innerHTML=`<div class="col-12"><div class="empty"><i class="fas fa-book-open"></i><p>Belum ada renungan</p></div></div>`;return;}
    c.innerHTML=devs.map((d,i)=>`<div class="col-12 col-md-6"><div class="dev-card reveal" style="transition-delay:${i*.06}s;" onclick="showDevotionDetail(${safeJson(d)})"><div class="dev-tag"><i class="fas fa-bible"></i> ${d.ayat}</div><div class="dev-title">${d.judul}</div><div class="dev-preview">${d.isi}</div><div class="dev-footer"><span><i class="fas fa-user me-1"></i>${d.penulis}</span><span>${formatDate(d.tanggal)}</span></div></div></div>`).join('');
    setTimeout(observeReveal,50);
}
function filterDevotions(t){if(!t){renderDevotions(S.data.devotions);return;}const q=t.toLowerCase();renderDevotions(S.data.devotions.filter(d=>d.judul.toLowerCase().includes(q)||d.penulis.toLowerCase().includes(q)||d.ayat.toLowerCase().includes(q)));}
function showDevotionDetail(d){if(typeof d==='string')d=JSON.parse(d);S.currentDevot=d;document.getElementById('devot-title').textContent=d.judul;document.getElementById('devot-body').innerHTML=`<div style="background:var(--grad-primary);border-radius:12px;padding:16px 20px;margin-bottom:20px;color:white;"><div style="font-size:12px;opacity:0.8;margin-bottom:4px;"><i class="fas fa-bible me-1"></i>Ayat Dasar</div><div style="font-size:15px;font-weight:700;">${d.ayat}</div></div><div style="font-size:15px;line-height:1.85;color:var(--text);white-space:pre-line;">${d.isi}</div><hr style="border-color:var(--border);margin:20px 0;"><div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-3);"><span><i class="fas fa-user me-1"></i>${d.penulis}</span><span><i class="fas fa-calendar me-1"></i>${formatDate(d.tanggal)}</span></div>`;bootstrap.Modal.getOrCreateInstance(document.getElementById('devotModal')).show();}
function shareDevotionWA(){const d=S.currentDevot;if(!d)return;window.open(`https://wa.me/?text=${encodeURIComponent(`📖 *${d.judul}*\n\n"${d.isi.substring(0,300)}..."\n\n📜 ${d.ayat}\n✍️ ${d.penulis}\n\n_I Care True_`)}`, '_blank');}

// ================================================================
// PRAYERS (ADMIN sees all, MEMBER sees only own)
// ================================================================
async function loadPrayers() {
    renderPrayerAuthSection();
    const c=document.getElementById('my-prayers-container');
    if(!S.user){return;}
    c.innerHTML=`<div class="skel-card mb-3"><div class="skel skel-line sl-t"></div><div class="skel skel-line sl-f"></div></div>`.repeat(3);
    try {
        const res=await apiGet('getPrayers');
        if(res.success)S.data.prayers=res.data;
        const isAdmin=S.user.role==='admin';
        const visible=isAdmin?S.data.prayers:S.data.prayers.filter(p=>p.email===S.user.email);
        renderPrayers(visible, isAdmin);
    } catch(e){c.innerHTML=`<div class="empty"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat data</p></div>`;}
}
function renderPrayerAuthSection() {
    const el=document.getElementById('doa-auth-section');
    const sub=document.getElementById('doa-subtitle');
    if(S.user){
        if(S.user.role==='admin') {
            sub.textContent='Semua pokok doa anggota (hanya terlihat oleh admin)';
            el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;"><div style="color:var(--text-2);font-size:14px;"><i class="fas fa-shield-alt me-2" style="color:#9370AF;"></i>Mode Admin — melihat semua doa</div></div>`;
        } else {
            sub.textContent='Pokok doa Anda hanya diterima dan dilihat oleh admin';
            el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px;"><div style="font-size:14px;color:var(--text-2);"><i class="fas fa-user-check me-2" style="color:var(--primary);"></i>Masuk sebagai <strong>${S.user.nama}</strong></div><button class="btn-p" onclick="showPrayModal()"><i class="fas fa-plus"></i> Tambah Pokok Doa</button></div>`;
        }
    } else {
        el.innerHTML=`<div class="auth-msg"><i class="fas fa-lock"></i><p style="margin-bottom:14px;">Masuk untuk mengirimkan pokok doa kepada admin</p><button class="btn-p" onclick="showAuth('login')"><i class="fas fa-sign-in-alt"></i> Masuk Sekarang</button></div>`;
        document.getElementById('my-prayers-container').innerHTML='';
    }
}
function renderPrayers(prayers, isAdmin=false) {
    const c=document.getElementById('my-prayers-container');
    if(!prayers?.length){c.innerHTML=`<div class="empty"><i class="fas fa-praying-hands"></i><p>${isAdmin?'Belum ada pokok doa yang dikirim anggota.':'Anda belum mengirim pokok doa.'}</p></div>`;return;}
    c.innerHTML=prayers.map((p,i)=>{
        const isOwn=S.user&&S.user.email===p.email;
        const canEdit=isOwn||isAdmin;
        const stBadge=p.status==='answered'?`<span class="badge-answered">✓ Terjawab</span>`:`<span class="badge-g">🙏 Sedang Didoakan</span>`;
        return `<div class="pray-card mb-3 reveal" style="transition-delay:${i*.05}s;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><div class="pray-name"><i class="fas fa-user-circle me-2" style="color:var(--primary);opacity:0.7;"></i>${p.nama}</div>${stBadge}</div><div class="pray-text">${p.isi_doa}</div><div class="pray-meta"><i class="fas fa-clock me-1"></i>${formatDate(p.tanggal)}</div>${canEdit?`<div class="pray-actions">${isOwn?`<button class="btn-e" onclick="editPrayer('${p.id}','${escStr(p.isi_doa)}')"><i class="fas fa-edit"></i> Edit</button>`:''}${(isOwn||isAdmin)?`<button class="btn-d" onclick="deletePrayer('${p.id}')"><i class="fas fa-trash"></i> Hapus</button>`:''}${isAdmin&&p.status!=='answered'?`<button class="btn-p" style="font-size:12px;padding:6px 12px;" onclick="markAnswered('${p.id}')"><i class="fas fa-check"></i> Terjawab</button>`:''}${isAdmin?`<button class="btn-wa" style="font-size:12px;padding:6px 12px;" onclick="notifyPrayerWA('${p.id}')"><i class="fab fa-whatsapp"></i> Balas</button>`:''}</div>`:''}
        </div>`;
    }).join('');
    setTimeout(observeReveal,50);
}
function filterPrayers(t){if(!t){const isAdmin=S.user?.role==='admin';const vis=isAdmin?S.data.prayers:S.data.prayers.filter(p=>p.email===S.user?.email);renderPrayers(vis,isAdmin);return;}const q=t.toLowerCase();const vis2=S.data.prayers.filter(p=>p.isi_doa.toLowerCase().includes(q)||p.nama.toLowerCase().includes(q));renderPrayers(vis2,S.user?.role==='admin');}
function showPrayModal(id='',text=''){document.getElementById('pray-id').value=id;document.getElementById('pray-text').value=text;document.getElementById('pray-modal-title').innerHTML=`<i class="fas fa-praying-hands me-2" style="color:var(--primary);"></i>${id?'Edit':'Tambah'} Pokok Doa`;bootstrap.Modal.getOrCreateInstance(document.getElementById('prayModal')).show();}
function editPrayer(id,text){showPrayModal(id,text);}
async function savePrayer(){
    if(!S.user){toast('Silakan masuk terlebih dahulu.','warning');return;}
    const text=document.getElementById('pray-text').value.trim(),id=document.getElementById('pray-id').value;
    if(!text){toast('Isi pokok doa tidak boleh kosong.','warning');return;}
    try{const res=await apiPost(id?{action:'updatePrayer',id,isi_doa:text}:{action:'addPrayer',nama:S.user.nama,isi_doa:text,status:'praying',email:S.user.email});
    if(res.success){bootstrap.Modal.getOrCreateInstance(document.getElementById('prayModal')).hide();toast(id?'Pokok doa diperbarui.':'Pokok doa dikirim kepada admin 🙏','success');await loadPrayers();}
    else toast(res.message||'Gagal menyimpan.','error');}catch(e){toast('Gagal terhubung.','error');}
}
async function deletePrayer(id){const r=await Swal.fire({title:'Hapus Pokok Doa?',icon:'warning',showCancelButton:true,confirmButtonText:'Hapus',cancelButtonText:'Batal',confirmButtonColor:'#E57373',cancelButtonColor:'#6B8E6B'});if(!r.isConfirmed)return;try{const res=await apiPost({action:'deletePrayer',id});if(res.success){toast('Dihapus.','info');await loadPrayers();}else toast(res.message||'Gagal.','error');}catch(e){toast('Gagal terhubung.','error');}}
async function markAnswered(id){try{await apiPost({action:'updatePrayer',id,status:'answered'});toast('Ditandai terjawab! Puji Tuhan! 🙌','success');await loadPrayers();}catch(e){toast('Gagal.','error');}}
function notifyPrayerWA(id){const p=S.data.prayers.find(x=>x.id===id);if(!p||!p.email)return;const msg=`Halo ${p.nama}, admin I Care True telah mendoakan pokok doa Anda:\n"${p.isi_doa}"\n\nTuhan Memberkati 🙏`;const wa=S.data.users.find(u=>u.email===p.email);const phone=wa?.wa||'';window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');}

// ================================================================
// ANNOUNCEMENTS
// ================================================================
async function loadAnnouncements() {
    document.getElementById('announcements-container').innerHTML=`<div class="skel-card mb-3"><div class="skel skel-line sl-t"></div><div class="skel skel-line sl-f"></div></div>`.repeat(3);
    try{const res=await apiGet('getAnnouncements');if(res.success)S.data.announcements=res.data;renderAnnouncements(S.data.announcements);}
    catch(e){document.getElementById('announcements-container').innerHTML=`<div class="empty"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat data</p></div>`;}
}
function renderAnnouncements(anns) {
    const c=document.getElementById('announcements-container');
    if(!anns?.length){c.innerHTML=`<div class="empty"><i class="fas fa-bullhorn"></i><p>Belum ada pengumuman</p></div>`;return;}
    c.innerHTML=anns.map((a,i)=>`<div class="ann-card mb-3 reveal" style="transition-delay:${i*.06}s;"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;"><div class="ann-title">${a.judul}</div><button class="btn-wa" style="font-size:11px;padding:5px 10px;flex-shrink:0;" onclick="shareAnnWA(${i})"><i class="fab fa-whatsapp"></i></button></div><div class="ann-body">${a.isi}</div><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:10px;"><div class="ann-date"><i class="fas fa-clock me-1"></i>${formatDate(a.tanggal)}</div>${(a.file_url&&a.file_url!=='#demo')?`<a href="${a.file_url}" target="_blank" class="file-download-btn"><i class="fas ${fileIcon(a.file_name||'')} me-1"></i>${a.file_name||'Unduh Lampiran'}</a>`:''}</div></div>`).join('');
    setTimeout(observeReveal,50);
}
function filterAnnouncements(t){if(!t){renderAnnouncements(S.data.announcements);return;}const q=t.toLowerCase();renderAnnouncements(S.data.announcements.filter(a=>a.judul.toLowerCase().includes(q)||a.isi.toLowerCase().includes(q)));}
function shareAnnWA(i){const a=S.data.announcements[i];if(!a)return;window.open(`https://wa.me/?text=${encodeURIComponent(`📢 *${a.judul}*\n\n${a.isi}\n\n📅 ${formatDate(a.tanggal)}\n_I Care True_`)}`, '_blank');}

// ================================================================
// MEMBERS PAGE
// ================================================================
async function loadMembers() {
    document.getElementById('members-container').innerHTML=skelGrid(6);
    try{const res=await apiGet('getUsers');if(res.success)S.data.users=res.data;renderMembers(S.data.users);}
    catch(e){document.getElementById('members-container').innerHTML=`<div class="col-12"><div class="empty"><i class="fas fa-exclamation-circle"></i><p>Gagal memuat data anggota</p></div></div>`;}
}
function renderMembers(users) {
    const c=document.getElementById('members-container');
    if(!users?.length){c.innerHTML=`<div class="col-12"><div class="empty"><i class="fas fa-users"></i><p>Belum ada anggota</p></div></div>`;return;}
    c.innerHTML=users.map((u,i)=>{
        const init=u.nama.split(' ').map(w=>w[0]).join('').toUpperCase().substring(0,2);
        const avatar=u.foto?`<img src="${u.foto}" class="m-avatar-img" onerror="this.parentNode.innerHTML='<div class=\\'m-avatar-ph\\'>${init}</div>'">`:`<div class="m-avatar-ph">${init}</div>`;
        return `<div class="col-12 col-sm-6 col-md-4 col-lg-3"><div class="member-card reveal" style="transition-delay:${i*.04}s;">${avatar}<div class="m-name">${u.nama}</div><div class="m-role-badge"><span class="badge-${u.role==='admin'?'admin':'member'}">${u.role}</span></div><div class="m-info"><div class="m-info-row"><i class="fab fa-whatsapp"></i><a href="https://wa.me/${u.wa}" target="_blank" style="color:var(--primary);">${u.wa||'-'}</a></div><div class="m-info-row"><i class="fas fa-map-marker-alt"></i><span>${u.alamat||'-'}</span></div>${u.birthday?`<div class="m-info-row"><i class="fas fa-birthday-cake"></i><span>${formatDateShort(u.birthday)}</span></div>`:''}</div></div></div>`;
    }).join('');
    setTimeout(observeReveal,50);
}
function filterMembers(t){if(!t){renderMembers(S.data.users);return;}const q=t.toLowerCase();renderMembers(S.data.users.filter(u=>u.nama.toLowerCase().includes(q)||(u.alamat&&u.alamat.toLowerCase().includes(q))));}

// ================================================================
// PROFILE
// ================================================================
function loadProfile() {
    const c=document.getElementById('profile-container');
    if(!S.user){c.innerHTML=`<div class="auth-msg"><i class="fas fa-user-lock"></i><p style="margin-bottom:16px;">Silakan masuk untuk melihat profil</p><button class="btn-p" onclick="showAuth('login')"><i class="fas fa-sign-in-alt"></i> Masuk</button></div>`;return;}
    const init=S.user.nama.split(' ').map(w=>w[0]).join('').toUpperCase().substring(0,2);
    const avatarHtml=S.user.foto?`<img src="${S.user.foto}" id="profile-avatar-img" style="width:88px;height:88px;border-radius:50%;object-fit:cover;" onerror="this.parentNode.querySelector('.p-avatar-ph')&&(this.style.display='none')">`:`<div class="p-avatar">${init}</div>`;
    c.innerHTML=`<div class="row g-4"><div class="col-12 col-md-5"><div class="profile-card">${avatarHtml}<div style="margin-bottom:10px;"><label for="profile-foto-input" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--primary);font-weight:600;padding:4px 10px;border:1px solid var(--primary);border-radius:8px;"><i class="fas fa-camera"></i> Ubah Foto</label><input type="file" id="profile-foto-input" accept="image/png,image/jpeg" style="display:none;" onchange="changeProfilePhoto(this)"></div><div class="p-name">${S.user.nama}</div><div class="p-email">${S.user.email}</div><div class="p-badge"><i class="fas fa-check-circle me-1"></i>Anggota Aktif</div><div style="text-align:left;"><div class="p-info-item"><i class="fas fa-user"></i><span>${S.user.nama}</span></div><div class="p-info-item"><i class="fas fa-envelope"></i><span>${S.user.email}</span></div><div class="p-info-item"><i class="fab fa-whatsapp"></i><a href="https://wa.me/${S.user.wa}" target="_blank" style="color:var(--primary);">${S.user.wa||'-'}</a></div>${S.user.birthday?`<div class="p-info-item"><i class="fas fa-birthday-cake"></i><span>${formatDateShort(S.user.birthday)}</span></div>`:''}<div class="p-info-item"><i class="fas fa-map-marker-alt"></i><span>${S.user.alamat||'-'}</span></div><div class="p-info-item"><i class="fas fa-shield-alt"></i><span style="text-transform:capitalize;">${S.user.role||'member'}</span></div></div><div style="margin-top:20px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;"><button class="btn-d" onclick="doLogout()"><i class="fas fa-sign-out-alt"></i> Keluar</button></div></div></div><div class="col-12 col-md-7"><div class="card" style="text-align:center;"><div class="card-hdr" style="justify-content:center;"><div class="card-ico ci-green"><i class="fas fa-qrcode"></i></div><div><div class="card-label">QR Member Card</div><div class="card-sublabel">Scan untuk identifikasi anggota</div></div></div><div style="display:flex;justify-content:center;margin-bottom:16px;"><div class="qr-wrap"><div id="qr-code"></div></div></div><div style="font-size:12.5px;color:var(--text-3);margin-bottom:16px;">Tunjukkan QR ini saat absensi kegiatan</div><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;"><button class="btn-p" onclick="downloadQR()"><i class="fas fa-download"></i> Unduh QR</button><button class="btn-wa" onclick="shareProfileWA()"><i class="fab fa-whatsapp"></i> Bagikan</button></div></div></div></div>`;
    setTimeout(()=>generateQR(),100);
}
async function changeProfilePhoto(input) {
    if(!input.files[0]||!S.user)return;
    toast('Memproses foto...','info',4000);
    try{
        const foto=await resizeImageToBase64(input.files[0]);
        const res=await apiPost({action:'updateUser',id:S.user.id,foto});
        if(res.success){
            S.user.foto=foto;
            localStorage.setItem('ict_user',JSON.stringify(S.user));
            const img=document.getElementById('profile-avatar-img');
            if(img){img.src=foto;}else{loadProfile();}
            toast('Foto profil berhasil diperbarui!','success');
        } else toast(res.message||'Gagal menyimpan foto.','error');
    }catch(e){toast('Gagal memproses foto.','error');}
}

function generateQR(){const el=document.getElementById('qr-code');if(!el||!S.user)return;el.innerHTML='';try{new QRCode(el,{text:`I CARE TRUE MEMBER\nNama: ${S.user.nama}\nEmail: ${S.user.email}\nWA: ${S.user.wa||'-'}`,width:180,height:180,colorDark:'#2C3E2C',colorLight:'#FFFFFF',correctLevel:QRCode.CorrectLevel.H});}catch(e){el.innerHTML=`<div style="padding:20px;color:var(--text-3);">QR tidak tersedia</div>`;}}
function downloadQR(){const cv=document.querySelector('#qr-code canvas');if(!cv){toast('QR belum siap.','warning');return;}const a=document.createElement('a');a.download=`icare-qr-${S.user.nama.replace(/ /g,'-')}.png`;a.href=cv.toDataURL();a.click();toast('QR berhasil diunduh!','success');}
function shareProfileWA(){if(!S.user)return;window.open(`https://wa.me/?text=${encodeURIComponent(`👤 *Profil Anggota I Care True*\n📛 ${S.user.nama}\n📧 ${S.user.email}\n📱 ${S.user.wa||'-'}\n\n_I Care True_`)}`, '_blank');}

// ================================================================
// ADMIN PANEL
// ================================================================
async function loadAdminPanel() {
    if(!S.user||S.user.role!=='admin')return;
    if(!S.data.users.length){const r=await apiGet('getUsers');if(r.success)S.data.users=r.data;}
    if(!S.data.firman.length){const r=await apiGet('getFirman');if(r.success)S.data.firman=r.data;}
    adminTab(S.adminTab||'events');
}

function adminTab(tab) {
    S.adminTab=tab;
    document.querySelectorAll('.admin-tab').forEach((btn,i)=>{const tabs=['events','devotions','announcements','users','prayers','firman'];btn.classList.toggle('active',tabs[i]===tab);});
    const c=document.getElementById('admin-content');
    switch(tab){
        case 'events': renderAdminEvents(); break;
        case 'devotions': renderAdminDevotions(); break;
        case 'announcements': renderAdminAnnouncements(); break;
        case 'users': renderAdminUsers(); break;
        case 'prayers': renderAdminPrayers(); break;
        case 'firman': renderAdminFirman(); break;
    }
}

function renderAdminEvents() {
    const c=document.getElementById('admin-content');
    c.innerHTML=`<div class="admin-section-hdr"><h5 style="font-weight:700;color:var(--text);margin:0;"><i class="fas fa-calendar-alt me-2" style="color:var(--primary);"></i>Kelola Kegiatan</h5><button class="btn-p" onclick="openEventModal()"><i class="fas fa-plus"></i> Tambah</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nama Kegiatan</th><th>Tanggal</th><th>Jam</th><th>Lokasi</th><th>PIC</th><th>Lampiran</th><th>Aksi</th></tr></thead><tbody>${S.data.events.map(ev=>`<tr><td><strong>${ev.nama_kegiatan}</strong></td><td>${formatDate(ev.tanggal)}</td><td>${ev.jam}</td><td>${ev.lokasi}</td><td>${ev.pic||'-'}</td><td>${(ev.file_url&&ev.file_url!=='#demo')?`<a href="${ev.file_url}" target="_blank" class="file-download-btn" style="margin-top:0;"><i class="fas ${fileIcon(ev.file_name||'')} me-1"></i>${(ev.file_name||'').substring(0,16)||'Lihat'}</a>`:'<span style="color:var(--text-3);font-size:12px;">—</span>'}</td><td><div class="tbl-actions"><button class="btn-e" onclick="openEventModal(${safeJson(ev)})"><i class="fas fa-edit"></i></button><button class="btn-d" onclick="adminDelete('event','${ev.id}','${escStr(ev.nama_kegiatan)}')"><i class="fas fa-trash"></i></button><button class="btn-wa" style="padding:7px 12px;font-size:12px;" onclick="shareEventWA(${S.data.events.indexOf(ev)})"><i class="fab fa-whatsapp"></i></button></div></td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-3);">Belum ada data</td></tr>'}</tbody></table></div>`;
}
function renderAdminDevotions() {
    const c=document.getElementById('admin-content');
    c.innerHTML=`<div class="admin-section-hdr"><h5 style="font-weight:700;color:var(--text);margin:0;"><i class="fas fa-book-open me-2" style="color:var(--brown);"></i>Kelola Renungan</h5><button class="btn-p" onclick="openDevotionModal()"><i class="fas fa-plus"></i> Tambah</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Judul</th><th>Ayat</th><th>Penulis</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>${S.data.devotions.map(d=>`<tr><td><strong>${d.judul}</strong></td><td>${d.ayat}</td><td>${d.penulis}</td><td>${formatDate(d.tanggal)}</td><td><div class="tbl-actions"><button class="btn-e" onclick="openDevotionModal(${safeJson(d)})"><i class="fas fa-edit"></i></button><button class="btn-d" onclick="adminDelete('devotion','${d.id}','${escStr(d.judul)}')"><i class="fas fa-trash"></i></button></div></td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-3);">Belum ada data</td></tr>'}</tbody></table></div>`;
}
function renderAdminAnnouncements() {
    const c=document.getElementById('admin-content');
    c.innerHTML=`<div class="admin-section-hdr"><h5 style="font-weight:700;color:var(--text);margin:0;"><i class="fas fa-bullhorn me-2" style="color:var(--brown);"></i>Kelola Pengumuman</h5><button class="btn-p" onclick="openAnnModal()"><i class="fas fa-plus"></i> Tambah</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Judul</th><th>Isi</th><th>Lampiran</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>${S.data.announcements.map(a=>`<tr><td><strong>${a.judul}</strong></td><td style="max-width:260px;">${a.isi.substring(0,80)}...</td><td>${(a.file_url&&a.file_url!=='#demo')?`<a href="${a.file_url}" target="_blank" class="file-download-btn" style="margin-top:0;"><i class="fas ${fileIcon(a.file_name||'')} me-1"></i>${(a.file_name||'').substring(0,18)||'Lihat'}</a>`:'<span style="color:var(--text-3);font-size:12px;">—</span>'}</td><td>${formatDate(a.tanggal)}</td><td><div class="tbl-actions"><button class="btn-e" onclick="openAnnModal(${safeJson(a)})"><i class="fas fa-edit"></i></button><button class="btn-d" onclick="adminDelete('announcement','${a.id}','${escStr(a.judul)}')"><i class="fas fa-trash"></i></button></div></td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-3);">Belum ada data</td></tr>'}</tbody></table></div>`;
}
function renderAdminUsers() {
    const c=document.getElementById('admin-content');
    c.innerHTML=`<div class="admin-section-hdr"><h5 style="font-weight:700;color:var(--text);margin:0;"><i class="fas fa-users me-2" style="color:#9370AF;"></i>Kelola Anggota <span style="font-size:13px;font-weight:400;color:var(--text-3);">(${S.data.users.length} orang)</span></h5><button class="btn-purple" onclick="openUserModal()"><i class="fas fa-user-plus"></i> Tambah</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Foto</th><th>Nama</th><th>Email</th><th>WhatsApp</th><th>Alamat</th><th>Tgl Lahir</th><th>Bergabung</th><th>Role</th><th>Aksi</th></tr></thead><tbody>${S.data.users.map(u=>{const init=u.nama.split(' ').map(w=>w[0]).join('').toUpperCase().substring(0,2);const av=u.foto?`<img src="${u.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" onerror="this.outerHTML='<div style=\\'width:36px;height:36px;border-radius:50%;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:700;\\'>${init}</div>'">`:`<div style="width:36px;height:36px;border-radius:50%;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:700;">${init}</div>`;return`<tr><td>${av}</td><td><strong>${u.nama}</strong></td><td style="font-size:12px;">${u.email}</td><td><a href="https://wa.me/${u.wa}" target="_blank" style="color:var(--primary);">${u.wa||'-'}</a></td><td style="max-width:120px;font-size:12px;">${u.alamat||'-'}</td><td style="font-size:12px;">${u.birthday?formatDateShort(u.birthday):'-'}</td><td style="font-size:12px;">${u.created_at?formatDate(u.created_at):'-'}</td><td><span class="badge-${u.role==='admin'?'admin':'member'}">${u.role}</span></td><td><div class="tbl-actions"><button class="btn-e" onclick="openUserModal(${safeJson(u)})"><i class="fas fa-edit"></i></button><button class="btn-d" onclick="adminDelete('user','${u.id}','${escStr(u.nama)}')"><i class="fas fa-trash"></i></button></div></td></tr>`}).join('')||'<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-3);">Belum ada data</td></tr>'}</tbody></table></div>`;
}
function renderAdminPrayers() {
    const c=document.getElementById('admin-content');
    c.innerHTML=`<div class="admin-section-hdr"><h5 style="font-weight:700;color:var(--text);margin:0;"><i class="fas fa-praying-hands me-2" style="color:var(--primary);"></i>Semua Pokok Doa</h5></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nama</th><th>Pokok Doa</th><th>Status</th><th>Tanggal</th><th>Aksi</th></tr></thead><tbody>${S.data.prayers.map(p=>`<tr><td><strong>${p.nama}</strong></td><td style="max-width:280px;">${p.isi_doa.substring(0,90)}...</td><td>${p.status==='answered'?`<span class="badge-answered">Terjawab</span>`:`<span class="badge-g">Didoakan</span>`}</td><td>${formatDate(p.tanggal)}</td><td><div class="tbl-actions">${p.status!=='answered'?`<button class="btn-p" style="font-size:12px;padding:6px 10px;" onclick="markAnswered('${p.id}')"><i class="fas fa-check"></i> Terjawab</button>`:''}${p.email?`<button class="btn-wa" style="font-size:12px;padding:6px 10px;" onclick="notifyPrayerWA('${p.id}')"><i class="fab fa-whatsapp"></i></button>`:''}<button class="btn-d" onclick="deletePrayer('${p.id}')"><i class="fas fa-trash"></i></button></div></td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-3);">Belum ada data</td></tr>'}</tbody></table></div>`;
}
function renderAdminFirman() {
    const c=document.getElementById('admin-content');
    const members=S.data.users.filter(u=>u.role==='member');
    c.innerHTML=`<div class="admin-section-hdr"><h5 style="font-weight:700;color:var(--text);margin:0;"><i class="fas fa-microphone me-2" style="color:#9370AF;"></i>Tugaskan Share Firman</h5><button class="btn-purple" onclick="openFirmanModal()"><i class="fas fa-plus"></i> Tugaskan</button></div>${S.data.firman.length?`<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Anggota</th><th>Tanggal</th><th>Catatan</th><th>Status</th></tr></thead><tbody>${S.data.firman.map(f=>`<tr><td><strong>${f.member_nama}</strong></td><td>${formatDate(f.tanggal)}</td><td>${f.catatan||'-'}</td><td><span class="fp-pill fp-${f.status}">${{pending:'Menunggu',accepted:'Bersedia ✅',declined:'Tidak Bersedia ❌'}[f.status]||f.status}</span></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><i class="fas fa-microphone-slash"></i><p>Belum ada penugasan firman</p></div>`}`;
}

// Admin CRUD Modals
function openEventModal(ev=null) {
    document.getElementById('ev-id').value=ev?.id||'';
    document.getElementById('ev-nama').value=ev?.nama_kegiatan||'';
    document.getElementById('ev-tanggal').value=ev?.tanggal||'';
    document.getElementById('ev-jam').value=ev?.jam||'';
    document.getElementById('ev-lokasi').value=ev?.lokasi||'';
    document.getElementById('ev-pic').value=ev?.pic||'';
    document.getElementById('ev-file-url').value=ev?.file_url||'';
    document.getElementById('ev-file-name').value=ev?.file_name||'';
    document.getElementById('ev-file').value='';
    const prev=document.getElementById('ev-file-preview');
    prev.innerHTML=(ev?.file_name&&ev?.file_url&&ev.file_url!=='#demo')?`<div class="file-chip"><i class="fas ${fileIcon(ev.file_name)}"></i>${ev.file_name}<a href="${ev.file_url}" target="_blank" class="file-download-btn" style="padding:3px 8px;font-size:11px;margin-top:0;"><i class="fas fa-eye"></i> Lihat</a></div>`:'';
    document.getElementById('ev-modal-title').innerHTML=`<i class="fas fa-calendar-alt me-2" style="color:var(--primary);"></i>${ev?'Edit':'Tambah'} Kegiatan`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEvent')).show();
}
async function saveEvent() {
    const id=document.getElementById('ev-id').value,nama=document.getElementById('ev-nama').value.trim(),tanggal=document.getElementById('ev-tanggal').value,jam=document.getElementById('ev-jam').value,lokasi=document.getElementById('ev-lokasi').value.trim(),pic=document.getElementById('ev-pic').value.trim();
    if(!nama||!tanggal||!lokasi){toast('Lengkapi data kegiatan.','warning');return;}
    let file_url=document.getElementById('ev-file-url').value, file_name=document.getElementById('ev-file-name').value;
    const fileInput=document.getElementById('ev-file');
    if(fileInput.files[0]){
        toast('Mengunggah file...','info',8000);
        try{const up=await uploadFileToServer(fileInput.files[0]);if(!up.success){toast('Gagal unggah file: '+(up.message||''),'error');return;}file_url=up.url;file_name=up.name;}
        catch(e){toast('Gagal mengunggah file.','error');return;}
    }
    try{const res=await apiPost(id?{action:'updateEvent',id,nama_kegiatan:nama,tanggal,jam,lokasi,pic,file_url,file_name}:{action:'addEvent',nama_kegiatan:nama,tanggal,jam,lokasi,pic,file_url,file_name});
    if(res.success){bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEvent')).hide();toast(id?'Kegiatan diperbarui!':'Kegiatan ditambahkan!','success');const r=await apiGet('getEvents');if(r.success)S.data.events=r.data;renderAdminEvents();}else toast(res.message||'Gagal.','error');}catch(e){toast('Gagal terhubung.','error');}
}
function openDevotionModal(d=null) {
    document.getElementById('dv-id').value=d?.id||'';
    document.getElementById('dv-judul').value=d?.judul||'';
    document.getElementById('dv-isi').value=d?.isi||'';
    document.getElementById('dv-ayat').value=d?.ayat||'';
    document.getElementById('dv-penulis').value=d?.penulis||'';
    document.getElementById('dv-modal-title').innerHTML=`<i class="fas fa-book-open me-2" style="color:var(--brown);"></i>${d?'Edit':'Tambah'} Renungan`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDevotion')).show();
}
async function saveDevotion() {
    const id=document.getElementById('dv-id').value,judul=document.getElementById('dv-judul').value.trim(),isi=document.getElementById('dv-isi').value.trim(),ayat=document.getElementById('dv-ayat').value.trim(),penulis=document.getElementById('dv-penulis').value.trim();
    if(!judul||!isi||!ayat||!penulis){toast('Lengkapi semua data renungan.','warning');return;}
    try{const res=await apiPost(id?{action:'updateDevotion',id,judul,isi,ayat,penulis}:{action:'addDevotion',judul,isi,ayat,penulis});
    if(res.success){bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDevotion')).hide();toast(id?'Renungan diperbarui!':'Renungan ditambahkan!','success');if(!id){const r=await apiGet('getDevotions');if(r.success)S.data.devotions=r.data;}renderAdminDevotions();}else toast(res.message||'Gagal.','error');}catch(e){toast('Gagal terhubung.','error');}
}
function openAnnModal(a=null) {
    document.getElementById('an-id').value=a?.id||'';
    document.getElementById('an-judul').value=a?.judul||'';
    document.getElementById('an-isi').value=a?.isi||'';
    document.getElementById('an-file-url').value=a?.file_url||'';
    document.getElementById('an-file-name').value=a?.file_name||'';
    document.getElementById('an-file').value='';
    const prev=document.getElementById('an-file-preview');
    prev.innerHTML=a?.file_name?`<div class="file-chip"><i class="fas ${fileIcon(a.file_name)}"></i>${a.file_name}<a href="${a.file_url}" target="_blank" class="file-download-btn" style="padding:3px 8px;font-size:11px;margin-top:0;"><i class="fas fa-eye"></i> Lihat</a></div>`:'';
    document.getElementById('an-modal-title').innerHTML=`<i class="fas fa-bullhorn me-2" style="color:var(--brown);"></i>${a?'Edit':'Tambah'} Pengumuman`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAnn')).show();
}
async function saveAnnouncement() {
    const id=document.getElementById('an-id').value,judul=document.getElementById('an-judul').value.trim(),isi=document.getElementById('an-isi').value.trim();
    if(!judul||!isi){toast('Lengkapi data pengumuman.','warning');return;}
    let file_url=document.getElementById('an-file-url').value, file_name=document.getElementById('an-file-name').value;
    const fileInput=document.getElementById('an-file');
    if(fileInput.files[0]){
        toast('Mengunggah file...','info',8000);
        try{const up=await uploadFileToServer(fileInput.files[0]);if(!up.success){toast('Gagal unggah file: '+(up.message||''),'error');return;}file_url=up.url;file_name=up.name;}
        catch(e){toast('Gagal mengunggah file.','error');return;}
    }
    try{const res=await apiPost(id?{action:'updateAnnouncement',id,judul,isi,file_url,file_name}:{action:'addAnnouncement',judul,isi,file_url,file_name});
    if(res.success){bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAnn')).hide();toast(id?'Pengumuman diperbarui!':'Pengumuman ditambahkan!','success');const r=await apiGet('getAnnouncements');if(r.success)S.data.announcements=r.data;renderAdminAnnouncements();}else toast(res.message||'Gagal.','error');}catch(e){toast('Gagal terhubung.','error');}
}
function openUserModal(u=null) {
    const isAdd=!u;
    document.getElementById('usr-modal-title').innerHTML=`<i class="fas fa-user-cog me-2" style="color:#9370AF;"></i>${isAdd?'Tambah':'Edit'} Anggota`;
    document.getElementById('usr-save-text').textContent=isAdd?'Tambah Anggota':'Simpan Perubahan';
    document.getElementById('usr-pw-hint').textContent=isAdd?'(wajib diisi)':'(kosongkan jika tidak diubah)';
    document.getElementById('usr-id').value=u?.id||'';
    document.getElementById('usr-nama').value=u?.nama||'';
    document.getElementById('usr-email').value=u?.email||'';
    document.getElementById('usr-wa').value=u?.wa||'';
    document.getElementById('usr-birthday').value=u?.birthday||'';
    document.getElementById('usr-alamat').value=u?.alamat||'';
    document.getElementById('usr-password').value='';
    document.getElementById('usr-role').value=u?.role||'member';
    document.getElementById('usr-foto').value=u?.foto||'';
    document.getElementById('usr-foto-file').value='';
    const prev=document.getElementById('usr-foto-preview');
    prev.innerHTML=u?.foto?`<img src="${u.foto}" class="photo-preview" alt="foto" onerror="this.style.display='none'">`:'';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalUser')).show();
}
async function saveUser() {
    const id=document.getElementById('usr-id').value;
    const isAdd=!id;
    const nama=document.getElementById('usr-nama').value.trim();
    const email=document.getElementById('usr-email').value.trim();
    const wa=document.getElementById('usr-wa').value.trim();
    const birthday=document.getElementById('usr-birthday').value;
    const alamat=document.getElementById('usr-alamat').value.trim();
    const password=document.getElementById('usr-password').value;
    const role=document.getElementById('usr-role').value;
    if(!nama||!email){toast('Nama dan email wajib diisi.','warning');return;}
    if(isAdd&&!password){toast('Password wajib diisi untuk anggota baru.','warning');return;}
    if(password&&password.length<6){toast('Password minimal 6 karakter.','warning');return;}
    let foto=document.getElementById('usr-foto').value;
    const fileInput=document.getElementById('usr-foto-file');
    if(fileInput.files[0]){
        try{foto=await resizeImageToBase64(fileInput.files[0]);}
        catch(e){toast('Gagal memproses foto.','error');return;}
    }
    try{
        let payload=isAdd
            ?{action:'addUser',nama,email,wa,password,role,birthday,alamat,foto}
            :{action:'updateUser',id,nama,wa,birthday,alamat,foto,role};
        if(!isAdd&&password) payload.password=password;
        const res=await apiPost(payload);
        if(res.success){bootstrap.Modal.getOrCreateInstance(document.getElementById('modalUser')).hide();toast(isAdd?'Anggota berhasil ditambahkan!':'Data anggota diperbarui!','success');const r=await apiGet('getUsers');if(r.success)S.data.users=r.data;renderAdminUsers();}
        else toast(res.message||'Gagal.','error');
    }catch(e){toast('Gagal terhubung.','error');}
}
async function adminDelete(type, id, name) {
    const r=await Swal.fire({title:`Hapus "${name}"?`,text:'Tindakan ini tidak dapat dibatalkan.',icon:'warning',showCancelButton:true,confirmButtonText:'Hapus',cancelButtonText:'Batal',confirmButtonColor:'#E57373',cancelButtonColor:'#6B8E6B'});
    if(!r.isConfirmed)return;
    const actionMap={event:'deleteEvent',devotion:'deleteDevotion',announcement:'deleteAnnouncement',user:'deleteUser'};
    try{const res=await apiPost({action:actionMap[type],id});
    if(res.success){toast('Data berhasil dihapus.','info');adminTab(S.adminTab);}else toast(res.message||'Gagal.','error');}catch(e){toast('Gagal terhubung.','error');}
}

// FIRMAN ASSIGNMENT
function openFirmanModal() {
    const members=S.data.users.filter(u=>u.role==='member');
    const sel=document.getElementById('fm-member');
    sel.innerHTML=members.map(u=>`<option value="${u.email}" data-nama="${u.nama}">${u.nama}</option>`).join('');
    document.getElementById('fm-id').value='';
    document.getElementById('fm-tanggal').value='';
    document.getElementById('fm-catatan').value='';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFirman')).show();
}
async function saveFirman() {
    const sel=document.getElementById('fm-member');
    const email=sel.value,nama=sel.options[sel.selectedIndex]?.getAttribute('data-nama')||'',tanggal=document.getElementById('fm-tanggal').value,catatan=document.getElementById('fm-catatan').value.trim();
    if(!email||!tanggal){toast('Pilih anggota dan tanggal.','warning');return;}
    try{const res=await apiPost({action:'addFirman',member_email:email,member_nama:nama,tanggal,catatan,assigned_by:S.user.email});
    if(res.success){bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFirman')).hide();toast(`Tugas firman dikirim kepada ${nama}!`,'success');S.data.firman.push({...res.data,member_nama:nama,tanggal,catatan,status:'pending'});renderAdminFirman();}else toast(res.message||'Gagal.','error');}catch(e){toast('Gagal terhubung.','error');}
}
async function respondFirman(status) {
    if(!S.currentFirman)return;
    try{const res=await apiPost({action:'updateFirman',id:S.currentFirman.id,status,member_nama:S.user.nama});
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFirmanResp')).hide();
    if(res.success){toast(status==='accepted'?'Konfirmasi bersedia terkirim kepada admin! 🙏':'Konfirmasi tidak bersedia terkirim.','info');}
    S.currentFirman=null;}catch(e){toast('Gagal mengirim konfirmasi.','error');}
}

// ================================================================
// EXPORT
// ================================================================
function exportPDF(section) {
    const {jsPDF}=window.jspdf;if(!jsPDF){toast('Library PDF tidak tersedia.','error');return;}
    const doc=new jsPDF(),title={jadwal:'Jadwal I Care',renungan:'Renungan',pengumuman:'Pengumuman'}[section]||section;
    doc.setFontSize(18);doc.setTextColor(107,142,107);doc.text('I Care True',14,20);
    doc.setFontSize(13);doc.setTextColor(90,122,90);doc.text(title,14,30);
    doc.setFontSize(9);doc.setTextColor(138,154,138);doc.text(`Diekspor: ${new Date().toLocaleDateString('id-ID')}`,14,37);
    doc.line(14,40,196,40);
    let y=48;
    getSectionData(section).forEach((item,idx)=>{
        if(y>270){doc.addPage();y=20;}
        doc.setFontSize(11);doc.setTextColor(44,62,44);doc.text(`${idx+1}. ${getItemTitle(section,item)}`,14,y);y+=6;
        doc.setFontSize(9);doc.setTextColor(90,122,90);
        getItemDetails(section,item).forEach(d=>{doc.text(d.substring(0,90),20,y);y+=5;});y+=4;
    });
    doc.save(`icare-${section}-${Date.now()}.pdf`);toast('PDF diekspor!','success');
}
function exportExcel(section) {
    if(!window.XLSX){toast('Library Excel tidak tersedia.','error');return;}
    const ws=XLSX.utils.json_to_sheet(getSectionData(section)),wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,section);XLSX.writeFile(wb,`icare-${section}-${Date.now()}.xlsx`);toast('Excel diekspor!','success');
}
function getSectionData(s){return{jadwal:S.data.events,renungan:S.data.devotions,pengumuman:S.data.announcements}[s]||[];}
function getItemTitle(s,it){return{jadwal:it.nama_kegiatan,renungan:it.judul,pengumuman:it.judul}[s]||'';}
function getItemDetails(s,it){return{jadwal:[`📅 ${formatDate(it.tanggal)} | ⏰ ${it.jam}`,`📍 ${it.lokasi}`,it.pic?`👤 ${it.pic}`:''].filter(Boolean),renungan:[`📜 ${it.ayat}`,`✍️ ${it.penulis}`],pengumuman:[`📅 ${formatDate(it.tanggal)}`]}[s]||[];}

// ================================================================
// WHATSAPP SHARE
// ================================================================
function shareWhatsApp(){
    const ev=S.data.events[0];
    let text=`🙏 *I Care True*\nPusat Informasi Komunitas Rohani Kristen\n\n`;
    if(ev)text+=`📅 Kegiatan terdekat: *${ev.nama_kegiatan}*\n🗓️ ${formatDate(ev.tanggal)} | ⏰ ${ev.jam}\n📍 ${ev.lokasi}\n\n`;
    text+=`Bergabunglah bersama kami! 💚`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// ================================================================
// HELPERS
// ================================================================
// ================================================================
// FILE & PHOTO HELPERS
// ================================================================
async function uploadFileToServer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async e => {
            const base64 = e.target.result.split(',')[1];
            try {
                const res = await apiPost({ action: 'uploadFile', fileName: file.name, fileBase64: base64, mimeType: file.type || 'application/octet-stream' });
                resolve(res);
            } catch(err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function resizeImageToBase64(file, maxW=200, maxH=200, quality=0.82) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            let {width: w, height: h} = img;
            const r = Math.min(maxW/w, maxH/h, 1);
            w = Math.round(w*r); h = Math.round(h*r);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(img.src);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = URL.createObjectURL(file);
    });
}

function fileIcon(name) {
    if(!name) return 'fa-paperclip';
    const ext = name.split('.').pop().toLowerCase();
    if(['pdf'].includes(ext)) return 'fa-file-pdf';
    if(['mp4','mov','avi','mkv'].includes(ext)) return 'fa-file-video';
    if(['jpg','jpeg','png','gif'].includes(ext)) return 'fa-file-image';
    return 'fa-paperclip';
}

function previewRegisterPhoto(input) {
    const prev = document.getElementById('r-foto-preview');
    if (!input.files[0]) { prev.innerHTML=''; return; }
    const url = URL.createObjectURL(input.files[0]);
    prev.innerHTML = `<img src="${url}" class="photo-preview" alt="preview">`;
}

function previewAdminUserPhoto(input) {
    const prev = document.getElementById('usr-foto-preview');
    if (!input.files[0]) { prev.innerHTML=''; return; }
    const url = URL.createObjectURL(input.files[0]);
    prev.innerHTML = `<img src="${url}" class="photo-preview" alt="preview">`;
}

function formatDate(ds) {
    if(!ds)return'-';
    try{const d=new Date(ds+(ds.includes('T')?'':'T00:00:00'));return d.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});}catch(e){return ds;}
}
function formatDateShort(ds) {
    if(!ds)return'-';
    try{const d=new Date(ds+'T00:00:00');return d.toLocaleDateString('id-ID',{day:'numeric',month:'long'});}catch(e){return ds;}
}
function timeAgo(iso) {
    const diff=Date.now()-new Date(iso).getTime(),m=Math.floor(diff/60000),h=Math.floor(m/60),d=Math.floor(h/24);
    if(d>0)return `${d} hari lalu`;if(h>0)return `${h} jam lalu`;if(m>0)return `${m} menit lalu`;return 'Baru saja';
}
function safeJson(o){return JSON.stringify(o).replace(/"/g,'&quot;');}
function escStr(s){return (s||'').replace(/'/g,"\\'").replace(/"/g,'\\"');}
function skelGrid(n=4,two=false){return Array(n).fill(0).map(()=>`<div class="col-12${two?' col-md-6':''}"><div class="skel-card"><div class="skel skel-line sl-t"></div><div class="skel skel-line sl-f"></div><div class="skel skel-line sl-m"></div></div></div>`).join('');}

document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){const m=e.target.closest('.modal');if(m?.id==='loginModal')doLogin();if(m?.id==='registerModal')doRegister();}});
