(() => {
  'use strict';
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const inviteToken = String(params.get('token') || '').trim();

  function show(type, title, message) {
    document.body.classList.remove('success','error');
    if (type) document.body.classList.add(type);
    $('title').textContent = title;
    $('message').textContent = message;
    $('statusIcon').textContent = type === 'success' ? '✓' : (type === 'error' ? '!' : 'LINE');
  }

  async function bind() {
    $('retryBtn').classList.add('hidden');
    $('loginBtn').classList.add('hidden');
    $('successBox').classList.add('hidden');

    try {
      if (!inviteToken) throw new Error('綁定網址缺少邀請憑證，請向管理員重新取得連結。');
      if (!cfg.LIFF_ID) throw new Error('LIFF_ID 尚未設定');
      if (!cfg.API_URL) throw new Error('API_URL 尚未設定');
      if (typeof liff === 'undefined') throw new Error('LIFF SDK 載入失敗');

      show('', '正在連接 LINE', '請稍候，系統正在確認您的 LINE 身份。');
      await liff.init({ liffId:cfg.LIFF_ID, withLoginOnExternalBrowser:true });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri:location.href });
        return;
      }

      let idToken = '';
      for (let i=0;i<4;i++) {
        idToken = String(liff.getIDToken() || '').trim();
        if (idToken) break;
        await new Promise(r => setTimeout(r,300));
      }
      if (!idToken) throw new Error('LINE 已登入，但沒有取得身份憑證。');

      show('', '正在完成員工綁定', 'LINE 身份驗證成功，正在寫入員工帳號。');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let res;
      try {
        res = await fetch(cfg.API_URL, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'staff.bind',idToken,payload:{inviteToken}}),
          signal:controller.signal
        });
      } finally { clearTimeout(timer); }

      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text || '{}'); }
      catch (_) { throw new Error('伺服器回應格式錯誤'); }
      if (!res.ok || !data.ok) throw new Error(data.error || '員工綁定失敗');

      $('staffId').textContent = data.staffId || '-';
      $('staffName').textContent = data.name || '-';
      $('staffRole').textContent = data.role || '-';
      $('successBox').classList.remove('hidden');
      $('loginBtn').classList.remove('hidden');
      show('success', 'LINE 綁定完成', '員工帳號已啟用。之後請由正式員工登入入口進入店內管理系統。');
    } catch (err) {
      const message = err && err.name === 'AbortError' ? '連線逾時，請稍後重新嘗試。' : String(err && err.message ? err.message : err);
      show('error', '綁定未完成', message);
      $('retryBtn').classList.remove('hidden');
    }
  }

  $('retryBtn').addEventListener('click', bind);
  bind();
})();
