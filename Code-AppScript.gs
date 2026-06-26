// ================================================================
// I CARE TRUE — Google Apps Script v2.0
// Paste YOUR Spreadsheet ID di bawah ini setelah membuat spreadsheet baru
// ================================================================

const SPREADSHEET_ID = 'PASTE_SPREADSHEET_ID_DISINI';

// ================================================================
// HTTP HANDLERS
// ================================================================
function doGet(e) {
    const action = e.parameter.action || '';
    try {
        switch (action) {
            case 'setup':        return jsonResponse(runSetupFromWeb());
            case 'login':        return jsonResponse(login(e.parameter));
            case 'getUsers':     return jsonResponse(getUsers());
            case 'getEvents':    return jsonResponse(getEvents());
            case 'getDevotions': return jsonResponse(getDevotions());
            case 'getAnnouncements': return jsonResponse(getAnnouncements());
            case 'getPrayers':   return jsonResponse(getPrayers(e.parameter));
            case 'getDailyVerse': return jsonResponse(getDailyVerse());
            case 'getStats':     return jsonResponse(getStats());
            case 'getFirman':    return jsonResponse(getFirman(e.parameter));
            default:
                return jsonResponse({ success: false, message: 'Action tidak dikenal: ' + action });
        }
    } catch (err) {
        return jsonResponse({ success: false, message: err.toString() });
    }
}

function doPost(e) {
    let data;
    try { data = JSON.parse(e.postData.contents); }
    catch (err) { return jsonResponse({ success: false, message: 'Body request tidak valid.' }); }

    const action = data.action || '';
    try {
        switch (action) {
            // Users
            case 'addUser':            return jsonResponse(addUser(data));
            case 'updateUser':         return jsonResponse(updateUser(data));
            case 'deleteUser':         return jsonResponse(deleteUser(data));
            // Events
            case 'addEvent':           return jsonResponse(addEvent(data));
            case 'updateEvent':        return jsonResponse(updateEvent(data));
            case 'deleteEvent':        return jsonResponse(deleteEvent(data));
            // Devotions
            case 'addDevotion':        return jsonResponse(addDevotion(data));
            case 'updateDevotion':     return jsonResponse(updateDevotion(data));
            case 'deleteDevotion':     return jsonResponse(deleteDevotion(data));
            // Announcements
            case 'addAnnouncement':    return jsonResponse(addAnnouncement(data));
            case 'updateAnnouncement': return jsonResponse(updateAnnouncement(data));
            case 'deleteAnnouncement': return jsonResponse(deleteAnnouncement(data));
            // Prayers
            case 'addPrayer':          return jsonResponse(addPrayer(data));
            case 'updatePrayer':       return jsonResponse(updatePrayer(data));
            case 'deletePrayer':       return jsonResponse(deletePrayer(data));
            // Firman
            case 'addFirman':          return jsonResponse(addFirman(data));
            case 'updateFirman':       return jsonResponse(updateFirman(data));
            // File Upload
            case 'uploadFile':         return jsonResponse(uploadFileToDrive(data));
            case 'deleteFile':         return jsonResponse(deleteFileFromDrive(data));
            default:
                return jsonResponse({ success: false, message: 'Action POST tidak dikenal: ' + action });
        }
    } catch (err) {
        return jsonResponse({ success: false, message: err.toString() });
    }
}

// ================================================================
// SETUP — Jalankan SEKALI dari editor Apps Script
// ================================================================
function initializeSpreadsheet() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Buat sheet sementara dulu agar Sheet1 bisa dihapus (GSheets tidak izinkan hapus sheet terakhir)
    let tempSheet = ss.getSheetByName('_temp_setup_');
    if (!tempSheet) tempSheet = ss.insertSheet('_temp_setup_');

    // Hapus sheet default jika ada
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet) ss.deleteSheet(defaultSheet);

    // 1. USERS
    const usersSheet = createOrClearSheet(ss, 'Users');
    usersSheet.getRange(1, 1, 1, 10).setValues([['id','nama','email','password','wa','role','birthday','alamat','foto','created_at']]);
    styleHeader(usersSheet, 10);
    usersSheet.getRange(2, 1, 3, 10).setValues([
        ['USR001','Admin I Care','admin@icaretrue.com','admin123','081234567890','admin','1990-05-15','Jakarta Selatan','',formatDate(new Date())],
        ['USR002','Budi Santoso','budi@example.com','budi123','082233445566','member','1995-08-20','Bekasi','',formatDate(new Date())],
        ['USR003','Maria Lestari','maria@example.com','maria123','083344556677','member','1998-12-25','Depok','',formatDate(new Date())],
    ]);

    // 2. EVENTS
    const evSheet = createOrClearSheet(ss, 'Events');
    evSheet.getRange(1, 1, 1, 9).setValues([['id','nama_kegiatan','tanggal','jam','lokasi','pic','created_at','file_name','file_url']]);
    styleHeader(evSheet, 9);
    const today = new Date();
    evSheet.getRange(2, 1, 5, 9).setValues([
        ['EVT001','I Care Jumat',formatDate(addDays(today,7)),'19:00','Gereja Bethel Indonesia','Kak Sarah',formatDate(today),'',''],
        ['EVT002','Kelompok Sel',formatDate(addDays(today,14)),'18:30','Rumah Ibu Mirna','Pak Budi',formatDate(today),'',''],
        ['EVT003','Sunday Service',formatDate(addDays(today,21)),'08:00','GBI Pusat','Ps. Jonathan',formatDate(today),'',''],
        ['EVT004','Youth Camp 2026',formatDate(addDays(today,30)),'07:00','Puncak, Bogor','Kak Reza',formatDate(today),'',''],
        ['EVT005','Prayer Meeting',formatDate(addDays(today,5)),'20:00','Online Zoom','Kak Dewi',formatDate(today),'',''],
    ]);

    // 3. DEVOTIONS
    const dvSheet = createOrClearSheet(ss, 'Devotions');
    dvSheet.getRange(1, 1, 1, 6).setValues([['id','judul','isi','ayat','penulis','tanggal']]);
    styleHeader(dvSheet, 6);
    dvSheet.getRange(2, 1, 4, 6).setValues([
        ['DEV001','Berjalan dalam Terang Firman','Firman Tuhan adalah lampu yang menerangi setiap langkah kita. Ketika kita membaca dan merenungkan firman-Nya setiap hari, kita diperlengkapi untuk menghadapi setiap tantangan dengan iman yang kuat. Mazmur 119:105 mengingatkan kita bahwa firman Tuhan bukan hanya pengetahuan, tetapi cahaya hidup yang secara aktif menuntun jalan kita di tengah kegelapan dunia.','Mazmur 119:105','Ps. Jonathan',formatDate(today)],
        ['DEV002','Kasih yang Tidak Berkesudahan','Kasih Allah kepada kita tidak pernah berakhir. Ratapan 3:22-23 mengatakan bahwa kasih setia Allah tidak habis-habisnya dan pembaharuannya terjadi setiap pagi. Ini berarti setiap hari adalah kesempatan baru untuk mengalami kasih-Nya yang segar.','Ratapan 3:22-23','Kak Maria',formatDate(addDays(today,-1))],
        ['DEV003','Kekuatan dalam Kelemahan','2 Korintus 12:9 berkata bahwa kuasa Allah menjadi sempurna dalam kelemahan kita. Ketika kita menyerahkan kelemahan kita kepada-Nya, Dia bekerja dengan cara yang melampaui kemampuan kita sendiri.','2 Korintus 12:9','Pak Budi',formatDate(addDays(today,-2))],
        ['DEV004','Damai yang Melampaui Akal','Filipi 4:6-7 berbicara tentang damai Allah yang melampaui segala akal manusia. Ketika kita bersyukur dan berdoa, damai itu hadir bukan karena situasi berubah, tetapi karena hati kita dijaga oleh tangan Allah yang penuh kasih.','Filipi 4:6-7','Kak Sarah',formatDate(addDays(today,-3))],
    ]);

    // 4. ANNOUNCEMENTS
    const anSheet = createOrClearSheet(ss, 'Announcements');
    anSheet.getRange(1, 1, 1, 6).setValues([['id','judul','isi','tanggal','file_name','file_url']]);
    styleHeader(anSheet, 6);
    anSheet.getRange(2, 1, 3, 6).setValues([
        ['ANN001','Pendaftaran I Care Camp 2026 Dibuka!','Segera daftarkan dirimu untuk I Care Camp 2026 di Puncak, Bogor. Kuota terbatas 50 peserta! Biaya Rp 350.000 sudah termasuk penginapan dan konsumsi.',formatDate(today),'',''],
        ['ANN002','Perubahan Jadwal Kelompok Sel','Mulai bulan Juli 2026, jadwal kelompok sel dipindahkan dari Rabu menjadi Jumat malam pukul 19:00 WIB untuk semua wilayah.',formatDate(addDays(today,-3)),'',''],
        ['ANN003','Kolekte Online Tersedia','Tersedia kolekte online via BCA 1234567890 a.n. Yayasan I Care True. Mohon cantumkan nama dan keterangan.',formatDate(addDays(today,-7)),'',''],
    ]);

    // 5. PRAYER REQUESTS
    const prSheet = createOrClearSheet(ss, 'PrayerRequests');
    prSheet.getRange(1, 1, 1, 6).setValues([['id','nama','isi_doa','status','email','tanggal']]);
    styleHeader(prSheet, 6);
    prSheet.getRange(2, 1, 3, 6).setValues([
        ['PRY001','Budi Santoso','Doakan proses wawancara kerja saya minggu depan.','praying','budi@example.com',formatDate(today)],
        ['PRY002','Maria Lestari','Doakan kesehatan orang tua saya yang sedang sakit.','praying','maria@example.com',formatDate(addDays(today,-1))],
        ['PRY003','Budi Santoso','Puji Tuhan! Doa studi saya sudah dijawab.','answered','budi@example.com',formatDate(addDays(today,-5))],
    ]);

    // 6. DAILY VERSE
    const vrSheet = createOrClearSheet(ss, 'DailyVerse');
    vrSheet.getRange(1, 1, 1, 3).setValues([['id','ayat','referensi']]);
    styleHeader(vrSheet, 3);
    const verses = [
        ['VRS001','Firman-Mu itu pelita bagi kakiku dan terang bagi jalanku.','Mazmur 119:105'],
        ['VRS002','Sebab Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, yaitu rancangan damai sejahtera untuk memberikan kepadamu hari depan yang penuh harapan.','Yeremia 29:11'],
        ['VRS003','Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal.','Yohanes 3:16'],
        ['VRS004','Kuatkan dan teguhkanlah hatimu, janganlah takut dan jangan gemetar karena mereka, sebab Tuhan, Allahmu, Dialah yang berjalan menyertai engkau.','Ulangan 31:6'],
        ['VRS005','Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku.','Filipi 4:13'],
        ['VRS006','Sebab itu janganlah kamu kuatir akan hari besok, karena hari besok mempunyai kesusahannya sendiri. Kesusahan sehari cukuplah untuk sehari.','Matius 6:34'],
        ['VRS007','Tuhan adalah gembalaku, takkan kekurangan aku.','Mazmur 23:1'],
        ['VRS008','Janganlah hendaknya kamu kuatir tentang apapun juga, tetapi nyatakanlah dalam segala hal keinginanmu kepada Allah dalam doa dan permohonan dengan ucapan syukur.','Filipi 4:6'],
        ['VRS009','TUHAN adalah terangku dan keselamatanku, kepada siapakah aku harus takut?','Mazmur 27:1'],
        ['VRS010','Kasihilah Tuhan, Allahmu, dengan segenap hatimu dan dengan segenap jiwamu dan dengan segenap akal budimu.','Matius 22:37'],
        ['VRS011','Mintalah, maka akan diberikan kepadamu; carilah, maka kamu akan mendapat; ketoklah, maka pintu akan dibukakan bagimu.','Matius 7:7'],
        ['VRS012','Percayalah kepada TUHAN dengan segenap hatimu, dan janganlah bersandar kepada pengertianmu sendiri.','Amsal 3:5'],
        ['VRS013','Tetapi orang-orang yang menanti-nantikan TUHAN mendapat kekuatan baru.','Yesaya 40:31'],
        ['VRS014','Aku adalah jalan dan kebenaran dan hidup. Tidak ada seorangpun yang datang kepada Bapa, kalau tidak melalui Aku.','Yohanes 14:6'],
        ['VRS015','Kasih tidak berbuat jahat terhadap sesama manusia, karena itu kasih adalah kegenapan hukum Taurat.','Roma 13:10'],
        ['VRS016','Bersukacitalah senantiasa. Tetaplah berdoa. Mengucap syukurlah dalam segala hal.','1 Tesalonika 5:16-18'],
        ['VRS017','Dan kamu akan mengetahui kebenaran, dan kebenaran itu akan memerdekakan kamu.','Yohanes 8:32'],
        ['VRS018','Yesus Kristus tetap sama, baik kemarin maupun hari ini dan sampai selama-lamanya.','Ibrani 13:8'],
        ['VRS019','Diberkatilah orang yang mengandalkan TUHAN, yang menaruh harapannya pada TUHAN.','Yeremia 17:7'],
        ['VRS020','Carilah dahulu Kerajaan Allah dan kebenarannya, maka semuanya itu akan ditambahkan kepadamu.','Matius 6:33'],
        ['VRS021','Semua orang telah berbuat dosa dan telah kehilangan kemuliaan Allah.','Roma 3:23'],
        ['VRS022','Sebab upah dosa ialah maut; tetapi karunia Allah ialah hidup yang kekal dalam Kristus Yesus, Tuhan kita.','Roma 6:23'],
        ['VRS023','Hendaklah perkataan Kristus diam dengan segala kekayaannya di antara kamu.','Kolose 3:16'],
        ['VRS024','Bukan dengan keperkasaan dan bukan dengan kekuatan, melainkan dengan roh-Ku, firman TUHAN semesta alam.','Zakharia 4:6'],
        ['VRS025','Orang yang percaya kepada-Ku, seperti yang dikatakan oleh Kitab Suci: Dari dalam hatinya akan mengalir aliran-aliran air hidup.','Yohanes 7:38'],
        ['VRS026','Hendaklah kamu murah hati, sama seperti Bapamu adalah murah hati.','Lukas 6:36'],
        ['VRS027','Masuklah melalui pintu yang sesak itu, karena sempitlah jalan yang menuju kepada kehidupan dan sedikit orang yang mendapatinya.','Matius 7:14'],
        ['VRS028','Demikianlah iman: jika tidak disertai perbuatan, maka iman itu pada hakekatnya adalah mati.','Yakobus 2:17'],
        ['VRS029','Orang yang mengasihi saudaranya, ia tetap berada di dalam terang dan di dalam dia tidak ada penyesatan.','1 Yohanes 2:10'],
        ['VRS030','Karena kita ini buatan Allah, diciptakan dalam Kristus Yesus untuk melakukan pekerjaan baik.','Efesus 2:10'],
        ['VRS031','Sebab itu, saudara-saudaraku yang kekasih, jadilah teguh, jangan goyah, dan giatlah selalu dalam pekerjaan Tuhan!','1 Korintus 15:58'],
    ];
    vrSheet.getRange(2, 1, verses.length, 3).setValues(verses);

    // 7. FIRMAN ASSIGNMENTS
    const fmSheet = createOrClearSheet(ss, 'FirmanAssignments');
    fmSheet.getRange(1, 1, 1, 8).setValues([['id','member_email','member_nama','tanggal','status','catatan','assigned_by','created_at']]);
    styleHeader(fmSheet, 8);

    // Hapus sheet sementara
    const toDelete = ss.getSheetByName('_temp_setup_');
    if (toDelete) ss.deleteSheet(toDelete);

    return {
        success: true,
        message: '✅ Spreadsheet berhasil diinisialisasi! 7 sheet dibuat dengan data contoh.',
        sheets: ['Users','Events','Devotions','Announcements','PrayerRequests','DailyVerse','FirmanAssignments'],
        login_demo: { admin: 'admin@icaretrue.com / admin123', member: 'budi@example.com / budi123' }
    };
}

function runSetupFromWeb() { return initializeSpreadsheet(); }

// ================================================================
// USERS / AUTH
// ================================================================
function getUsers() {
    const data = sheetToArray(getSheet('Users'));
    return { success: true, data: data.map(u => { const { password, ...rest } = u; return rest; }) };
}

function login(params) {
    const { email, password } = params;
    if (!email || !password) return { success: false, message: 'Email dan password harus diisi.' };
    const user = sheetToArray(getSheet('Users')).find(u => u.email === email && String(u.password) === String(password));
    if (!user) return { success: false, message: 'Email atau password salah.' };
    const { password: _, ...safeUser } = user;
    return { success: true, data: safeUser };
}

function addUser(data) {
    const sheet = getSheet('Users');
    const users = sheetToArray(sheet);
    if (users.find(u => u.email === data.email)) return { success: false, message: 'Email sudah terdaftar.' };
    const id = 'USR' + generateId();
    sheet.appendRow([id, data.nama, data.email, data.password, data.wa, data.role || 'member', data.birthday || '', data.alamat || '', data.foto || '', formatDate(new Date())]);
    return { success: true, data: { id, nama: data.nama, email: data.email, wa: data.wa, role: data.role || 'member', birthday: data.birthday, alamat: data.alamat } };
}

function updateUser(data) {
    const sheet = getSheet('Users');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] == data.id) {
            const fields = { nama: data.nama, wa: data.wa, birthday: data.birthday, alamat: data.alamat, foto: data.foto, role: data.role, password: data.password };
            Object.entries(fields).forEach(([k, v]) => {
                if (v !== undefined && v !== '') { const col = headers.indexOf(k) + 1; if (col > 0) sheet.getRange(i + 1, col).setValue(v); }
            });
            return { success: true };
        }
    }
    return { success: false, message: 'User tidak ditemukan.' };
}

function deleteUser(data) { return deleteRowById(getSheet('Users'), data.id); }

// ================================================================
// EVENTS
// ================================================================
function getEvents() {
    return { success: true, data: sheetToArray(getSheet('Events')).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal)) };
}

function addEvent(data) {
    const sheet = getSheet('Events');
    const id = 'EVT' + generateId();
    ensureColumns(sheet, ['file_name', 'file_url']);
    sheet.appendRow([id, data.nama_kegiatan, data.tanggal, data.jam, data.lokasi, data.pic || '', formatDate(new Date()), data.file_name || '', data.file_url || '']);
    return { success: true, data: { id, ...data } };
}

function updateEvent(data) { return updateRowById(getSheet('Events'), data); }
function deleteEvent(data) { return deleteRowById(getSheet('Events'), data.id); }

// ================================================================
// DEVOTIONS
// ================================================================
function getDevotions() {
    return { success: true, data: sheetToArray(getSheet('Devotions')).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)) };
}

function addDevotion(data) {
    const sheet = getSheet('Devotions');
    const id = 'DEV' + generateId();
    const tanggal = formatDate(new Date());
    sheet.appendRow([id, data.judul, data.isi, data.ayat, data.penulis, tanggal]);
    return { success: true, data: { id, ...data, tanggal } };
}

function updateDevotion(data) { return updateRowById(getSheet('Devotions'), data); }
function deleteDevotion(data) { return deleteRowById(getSheet('Devotions'), data.id); }

// ================================================================
// ANNOUNCEMENTS
// ================================================================
function getAnnouncements() {
    return { success: true, data: sheetToArray(getSheet('Announcements')).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)) };
}

function addAnnouncement(data) {
    const sheet = getSheet('Announcements');
    const id = 'ANN' + generateId();
    const tanggal = formatDate(new Date());
    ensureColumns(sheet, ['file_name', 'file_url']);
    sheet.appendRow([id, data.judul, data.isi, tanggal, data.file_name || '', data.file_url || '']);
    return { success: true, data: { id, ...data, tanggal } };
}

function updateAnnouncement(data) { return updateRowById(getSheet('Announcements'), data); }
function deleteAnnouncement(data) { return deleteRowById(getSheet('Announcements'), data.id); }

// ================================================================
// PRAYERS — admin dapat semua, member hanya milik sendiri
// ================================================================
function getPrayers(params) {
    let data = sheetToArray(getSheet('PrayerRequests')).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    if (params && params.email && params.role !== 'admin') data = data.filter(p => p.email === params.email);
    return { success: true, data };
}

function addPrayer(data) {
    const sheet = getSheet('PrayerRequests');
    const id = 'PRY' + generateId();
    const tanggal = formatDate(new Date());
    sheet.appendRow([id, data.nama, data.isi_doa, data.status || 'praying', data.email || '', tanggal]);
    return { success: true, data: { id, ...data, tanggal } };
}

function updatePrayer(data) {
    const sheet = getSheet('PrayerRequests');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] == data.id) {
            if (data.isi_doa !== undefined) sheet.getRange(i + 1, headers.indexOf('isi_doa') + 1).setValue(data.isi_doa);
            if (data.status !== undefined) sheet.getRange(i + 1, headers.indexOf('status') + 1).setValue(data.status);
            return { success: true };
        }
    }
    return { success: false, message: 'Pokok doa tidak ditemukan.' };
}

function deletePrayer(data) { return deleteRowById(getSheet('PrayerRequests'), data.id); }

// ================================================================
// DAILY VERSE — rotasi per hari dalam tahun
// ================================================================
function getDailyVerse() {
    const data = sheetToArray(getSheet('DailyVerse'));
    if (!data.length) return { success: false, message: 'Tidak ada data ayat.' };
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    return { success: true, data: data[dayOfYear % data.length] };
}

// ================================================================
// STATS
// ================================================================
function getStats() {
    return {
        success: true,
        data: {
            members: sheetToArray(getSheet('Users')).length,
            events: sheetToArray(getSheet('Events')).length,
            devotions: sheetToArray(getSheet('Devotions')).length,
            prayers: sheetToArray(getSheet('PrayerRequests')).length
        }
    };
}

// ================================================================
// FIRMAN ASSIGNMENTS
// ================================================================
function getFirman(params) {
    let data = sheetToArray(getSheet('FirmanAssignments'));
    if (params && params.email && params.status === 'pending') {
        data = data.filter(f => f.member_email === params.email && f.status === 'pending');
    }
    return { success: true, data };
}

function addFirman(data) {
    const sheet = getSheet('FirmanAssignments');
    const id = 'FRM' + generateId();
    sheet.appendRow([id, data.member_email, data.member_nama, data.tanggal, 'pending', data.catatan || '', data.assigned_by || '', formatDate(new Date())]);
    return { success: true, data: { id, ...data, status: 'pending' } };
}

function updateFirman(data) {
    const sheet = getSheet('FirmanAssignments');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] == data.id) {
            if (data.status !== undefined) sheet.getRange(i + 1, headers.indexOf('status') + 1).setValue(data.status);
            return { success: true };
        }
    }
    return { success: false, message: 'Penugasan tidak ditemukan.' };
}

// ================================================================
// FILE UPLOAD — Google Drive
// ================================================================
function uploadFileToDrive(data) {
    const decoded = Utilities.base64Decode(data.fileBase64);
    const blob = Utilities.newBlob(decoded, data.mimeType || 'application/octet-stream', data.fileName);
    const file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = 'https://drive.google.com/uc?export=download&id=' + file.getId();
    return { success: true, url: url, name: data.fileName, id: file.getId() };
}

function deleteFileFromDrive(data) {
    try {
        DriveApp.getFileById(data.fileId).setTrashed(true);
        return { success: true };
    } catch(e) { return { success: false, message: e.toString() }; }
}

// ================================================================
// SHARED HELPERS
// ================================================================
function getSheet(name) {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
    if (!sheet) throw new Error(`Sheet "${name}" tidak ditemukan. Jalankan initializeSpreadsheet() terlebih dahulu!`);
    return sheet;
}

function sheetToArray(sheet) {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0];
    return data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
    });
}

function updateRowById(sheet, data) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] == data.id) {
            Object.entries(data).forEach(([k, v]) => {
                if (k === 'id' || k === 'action') return;
                const col = headers.indexOf(k) + 1;
                if (col > 0) sheet.getRange(i + 1, col).setValue(v);
            });
            return { success: true };
        }
    }
    return { success: false, message: 'Data tidak ditemukan.' };
}

function deleteRowById(sheet, id) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] == id) { sheet.deleteRow(i + 1); return { success: true }; }
    }
    return { success: false, message: 'Data tidak ditemukan.' };
}

function createOrClearSheet(ss, name) {
    let sheet = ss.getSheetByName(name);
    if (sheet) { sheet.clearContents(); return sheet; }
    return ss.insertSheet(name);
}

function styleHeader(sheet, colCount) {
    const range = sheet.getRange(1, 1, 1, colCount);
    range.setBackground('#6B8E6B').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    try { sheet.autoResizeColumns(1, colCount); } catch (e) {}
}

function ensureColumns(sheet, colNames) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    colNames.forEach(name => {
        if (!headers.includes(name)) {
            sheet.getRange(1, headers.length + 1).setValue(name);
            headers.push(name);
        }
    });
}

function generateId() { return Math.random().toString(36).substr(2, 9).toUpperCase(); }
function formatDate(date) { return Utilities.formatDate(new Date(date), 'Asia/Jakarta', 'yyyy-MM-dd'); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
