(() => {
  'use strict';
  const cfg = window.APP_CONFIG || {};
  const state = { idToken:'', displayName:'', boot:null, customer:null, date:'', course:null, time:'', courseSeq:0, slotSeq:0 };
  const inflight = new Map();
  let dateTimer = null;
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));

  $('appName').textContent = cfg.APP_NAME || '多采多姿頭皮管理－土城店';

  function setBadge(text, type='') {
    const el = $('identityBadge');
    el.textContent = text;
    el.className = 'identity-badge' + (type ? ' ' + type : '');
  }
  function msg(text, type='') {
    const el = $('globalMsg');
    el.textContent = text;
    el.className = 'notice' + (type ? ' ' + type : '');
    el.classList.remove('hidden');
    if (type === 'ok') setTimeout(() => el.classList.add('hidden'), 4200);
  }
  function clearMsg(){ $('globalMsg').classList.add('hidden'); }
  function debug(data){ $('debugOutput').textContent = JSON.stringify(data, null, 2); }
  function apiConfigured(){ return cfg.API_URL && !cfg.API_URL.includes('YOUR-WORKER'); }

  function apiKey(action, payload) {
    return action + '|' + JSON.stringify(payload || {});
  }

  async function api(action, payload={}) {
    if (!apiConfigured()) throw new Error('API 尚未設定。請先完成 Cloudflare Worker，再更新 config.js 的 API_URL。');
    if (!state.idToken) throw new Error('LINE 身份尚未取得');
    const key = apiKey(action, payload);
    if (inflight.has(key)) return inflight.get(key);

    const task = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(cfg.API_URL, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ action, idToken:state.idToken, payload }),
          signal:controller.signal,
          cache:'no-store'
        });
        const text = await res.text();
        let body;
        try { body = JSON.parse(text || '{}'); } catch (_) { throw new Error('API 回應格式錯誤'); }
        if (!res.ok) throw new Error(body.error || `API 連線失敗（HTTP ${res.status}）`);
        if (!body.ok) throw new Error(body.error || '操作失敗');
        return body;
      } catch (err) {
        if (err && err.name === 'AbortError') throw new Error('連線逾時，請稍後再試');
        throw err;
      } finally { clearTimeout(timer); }
    })();
    inflight.set(key, task);
    try { return await task; } finally { if (inflight.get(key) === task) inflight.delete(key); }
  }

  function decodeJwtPayload(token) {
    try {
      const p = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      return JSON.parse(decodeURIComponent(atob(p).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2,'0')).join('')));
    } catch (_) { return null; }
  }

  async function initLiffIdentity() {
    if (!cfg.LIFF_ID) throw new Error('config.js 尚未設定 LIFF_ID');
    if (typeof liff === 'undefined') throw new Error('LIFF SDK 載入失敗');
    await liff.init({ liffId:cfg.LIFF_ID, withLoginOnExternalBrowser:true });
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri:location.href });
      return null;
    }
    let token = '';
    for (let i=0;i<4;i++) {
      token = String(liff.getIDToken() || '').trim();
      if (token) break;
      await new Promise(r => setTimeout(r, 300));
    }
    if (!token) throw new Error('LINE 已登入，但沒有取得 ID Token');
    const decoded = (liff.getDecodedIDToken && liff.getDecodedIDToken()) || decodeJwtPayload(token) || {};
    state.idToken = token;
    state.displayName = String(decoded.name || '');
    return {
      isInClient:liff.isInClient(),
      isLoggedIn:liff.isLoggedIn(),
      hasIdToken:true,
      lineUserId:String(decoded.sub || ''),
      apiConfigured:apiConfigured()
    };
  }

  async function bootstrap() {
    try {
      setBadge('LINE 連線中');
      const diag = await initLiffIdentity();
      if (!diag) return;
      setBadge('LINE 已連線','ok');
      debug(diag);
      if (!apiConfigured()) {
        msg('LINE 身份已成功。下一步只差 API Proxy 設定，完成後即可載入正式課程與時段。');
        return;
      }
      const r = await api('mini.bootstrap');
      state.boot = r;
      state.customer = r.customer || {};
      renderProfile();
      setupDate(r);
      await loadCourses();
    } catch (err) {
      setBadge('連線異常','error');
      msg(err.message || String(err), 'error');
      debug({ error:err.message || String(err), apiConfigured:apiConfigured() });
    }
  }

  function renderProfile() {
    const c = state.customer || {};
    $('profileCard').classList.remove('hidden');
    const display = c.name || state.displayName || '顧客';
    $('hello').textContent = '您好，' + display;
    $('avatar').textContent = display.slice(0,1);
    $('bindingText').textContent = c.bound ? (c.formal ? '正式顧客已綁定' : '預約資料已綁定') : '第一次預約請填寫姓名與手機';
    $('nameInput').value = c.name || state.displayName || '';
    $('phoneInput').value = c.phone || '';
  }

  function setupDate(boot) {
    const input = $('dateInput');
    input.min = boot.today;
    const max = new Date(boot.today + 'T00:00:00+08:00');
    max.setDate(max.getDate() + Number(boot.maxBookingDays || 30));
    const yyyy=max.getFullYear(), mm=String(max.getMonth()+1).padStart(2,'0'), dd=String(max.getDate()).padStart(2,'0');
    input.max = `${yyyy}-${mm}-${dd}`;
    input.value = boot.today;
    state.date = boot.today;
  }

  async function loadCourses() {
    const seq = ++state.courseSeq;
    clearMsg();
    state.date = $('dateInput').value;
    state.course = null; state.time = '';
    $('slotCard').classList.add('hidden'); $('contactCard').classList.add('hidden'); $('confirmCard').classList.add('hidden');
    if (!state.date) return;
    $('courseCard').classList.remove('hidden');
    $('courseList').innerHTML = '<div class="loading">讀取課程中…</div>';
    try {
      const requestedDate = state.date;
      const r = await api('mini.courses', { date:requestedDate });
      if (seq !== state.courseSeq || requestedDate !== state.date) return;
      renderCourses(r.courses || []);
    } catch (err) { if (seq === state.courseSeq) { $('courseCard').classList.add('hidden'); msg(err.message,'error'); } }
  }

  function renderCourses(list) {
    const el = $('courseList');
    if (!list.length) { el.innerHTML = '<div class="empty">當天目前沒有開放線上預約的項目</div>'; return; }
    el.innerHTML = '';
    list.forEach(c => {
      const btn = document.createElement('button');
      btn.type='button'; btn.className='course-option'; btn.dataset.course=c.courseId;
      const price = Number(c.price || 0);
      btn.innerHTML = `<span><span class="course-name">${esc(c.name)}</span><span class="course-meta">${esc(c.category || '')}</span></span><em class="course-price">${price>0 ? 'NT$ '+price.toLocaleString() : ''}</em>`;
      btn.addEventListener('click', () => selectCourse(c));
      el.appendChild(btn);
    });
  }

  async function selectCourse(course) {
    const seq = ++state.slotSeq;
    state.course = course; state.time = '';
    document.querySelectorAll('.course-option').forEach(b => b.classList.toggle('selected', b.dataset.course === course.courseId));
    $('contactCard').classList.add('hidden'); $('confirmCard').classList.add('hidden');
    $('slotCard').classList.remove('hidden'); $('slotList').innerHTML='<div class="loading">讀取時段中…</div>';
    try {
      const requestedDate = state.date, requestedCourse = course.courseId;
      const r = await api('mini.slots', { date:requestedDate, courseId:requestedCourse });
      if (seq !== state.slotSeq || !state.course || state.course.courseId !== requestedCourse || state.date !== requestedDate) return;
      renderSlots(r.slots || []);
    } catch (err) { if (seq === state.slotSeq) msg(err.message,'error'); }
  }

  function renderSlots(list) {
    const el = $('slotList');
    if (!list.length) { el.innerHTML='<div class="empty" style="grid-column:1/-1">目前沒有可預約時段</div>'; return; }
    el.innerHTML='';
    list.forEach(s => {
      const time = typeof s === 'string' ? s : s.time;
      const btn=document.createElement('button'); btn.type='button'; btn.className='slot'; btn.textContent=time; btn.dataset.time=time;
      btn.addEventListener('click', () => selectTime(time)); el.appendChild(btn);
    });
  }

  function selectTime(time) {
    state.time = time;
    document.querySelectorAll('.slot').forEach(b => b.classList.toggle('selected', b.dataset.time === time));
    $('contactCard').classList.remove('hidden'); $('confirmCard').classList.remove('hidden');
    updateSummary();
    $('contactCard').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function profilePayload() {
    const name=$('nameInput').value.trim();
    const phone=$('phoneInput').value.replace(/\D/g,'');
    if (!name) throw new Error('請輸入姓名');
    if (!/^09\d{8}$/.test(phone)) throw new Error('請輸入正確的台灣手機號碼');
    return { name, phone };
  }

  function updateSummary() {
    $('bookingSummary').innerHTML = `日期：<b>${esc(state.date)}</b><br>課程：<b>${esc(state.course ? state.course.name : '')}</b><br>時間：<b>${esc(state.time)}</b><br>老師：<b>由系統自動安排</b>`;
  }

  async function saveProfile() {
    try {
      const btn=$('saveProfileBtn'); btn.disabled=true; btn.textContent='儲存中…';
      const r=await api('mini.saveProfile', profilePayload());
      state.customer=r; renderProfile(); msg('會員資料已儲存','ok');
    } catch(err){ msg(err.message,'error'); }
    finally { const btn=$('saveProfileBtn'); btn.disabled=false; btn.textContent='儲存會員資料'; }
  }

  async function createBooking() {
    const btn=$('bookBtn');
    try {
      if (!state.course || !state.time) throw new Error('請先選擇課程與時間');
      const p=profilePayload(); btn.disabled=true; btn.textContent='建立預約中…';
      const r=await api('mini.createBooking', { date:state.date, courseId:state.course.courseId, startTime:state.time, name:p.name, phone:p.phone, note:$('noteInput').value.trim() });
      state.customer=r.customer || state.customer; renderProfile();
      msg(`預約成功｜${r.date} ${r.startTime}`,'ok');
      state.course=null; state.time=''; $('slotCard').classList.add('hidden'); $('contactCard').classList.add('hidden'); $('confirmCard').classList.add('hidden'); $('noteInput').value='';
      await loadCourses();
      window.scrollTo({top:0,behavior:'smooth'});
    } catch(err){ msg(err.message,'error'); }
    finally { btn.disabled=false; btn.textContent='確認送出預約'; }
  }

  async function loadMine() {
    const el=$('mineList'); el.className='loading'; el.textContent='載入中…';
    try {
      const r=await api('mini.myBookings'); const list=r.bookings || [];
      if (!list.length) { el.className='empty'; el.textContent='目前沒有預約紀錄'; return; }
      el.className=''; el.innerHTML='';
      list.forEach(b => {
        const item=document.createElement('div'); item.className='booking-item';
        item.innerHTML=`<div class="booking-top"><div class="booking-date">${esc(b.date)} ${esc(b.startTime)}</div><span class="status">${esc(b.status)}</span></div><div class="booking-course">${esc(b.courseName)}</div>`;
        if (b.canCancel) {
          const cancel=document.createElement('button'); cancel.type='button'; cancel.className='cancel-btn'; cancel.textContent='取消此預約';
          cancel.addEventListener('click', () => cancelBooking(b.bookingId)); item.appendChild(cancel);
        }
        el.appendChild(item);
      });
    } catch(err){ el.className='notice error'; el.textContent=err.message; }
  }

  async function cancelBooking(id) {
    if (!window.confirm('確定要取消這筆預約嗎？')) return;
    try { await api('mini.cancelBooking',{bookingId:id}); msg('預約已取消','ok'); await loadMine(); }
    catch(err){ msg(err.message,'error'); }
  }

  function switchTab(tab) {
    const booking=tab==='book';
    $('tabBook').classList.toggle('active',booking); $('tabMine').classList.toggle('active',!booking);
    $('bookPage').classList.toggle('hidden',!booking); $('minePage').classList.toggle('hidden',booking);
    if (!booking) loadMine();
  }

  $('dateInput').addEventListener('change', () => {
    clearTimeout(dateTimer);
    dateTimer = setTimeout(loadCourses, 250);
  });
  $('saveProfileBtn').addEventListener('click', saveProfile);
  $('bookBtn').addEventListener('click', createBooking);
  $('tabBook').addEventListener('click', () => switchTab('book'));
  $('tabMine').addEventListener('click', () => switchTab('mine'));
  $('refreshMineBtn').addEventListener('click', loadMine);
  bootstrap();
})();
