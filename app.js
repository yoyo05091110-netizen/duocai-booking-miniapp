(() => {
  'use strict';

  const config = window.APP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const statusDot = $('statusDot');
  const statusTitle = $('statusTitle');
  const statusText = $('statusText');
  const loginButton = $('loginButton');
  const retryButton = $('retryButton');
  const identityCard = $('identityCard');
  const bookingDemo = $('bookingDemo');
  const debugOutput = $('debugOutput');

  $('appName').textContent = config.APP_NAME || '多采多姿頭皮管理－土城店';

  function setStatus(type, title, text) {
    statusDot.className = 'status-dot' + (type ? ` ${type}` : '');
    statusTitle.textContent = title;
    statusText.textContent = text;
  }

  function decodeJwtPayload(token) {
    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(normalized).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
      return JSON.parse(json);
    } catch (error) {
      return null;
    }
  }

  function showDebug(data) {
    debugOutput.textContent = JSON.stringify(data, null, 2);
  }

  async function initLiff() {
    loginButton.classList.add('hidden');
    retryButton.classList.add('hidden');
    identityCard.classList.add('hidden');
    bookingDemo.classList.add('hidden');
    setStatus('', '正在初始化 LINE MINI App…', '正在連線 LIFF SDK');

    const diagnostics = {
      href: location.href,
      userAgent: navigator.userAgent,
      liffId: config.LIFF_ID || null,
      liffSdkLoaded: typeof window.liff !== 'undefined'
    };

    try {
      if (!config.LIFF_ID) throw new Error('config.js 尚未設定 LIFF_ID');
      if (typeof window.liff === 'undefined') throw new Error('LIFF SDK 載入失敗');

      await liff.init({
        liffId: config.LIFF_ID,
        withLoginOnExternalBrowser: true
      });

      diagnostics.isInClient = liff.isInClient();
      diagnostics.isLoggedIn = liff.isLoggedIn();
      diagnostics.context = liff.getContext ? liff.getContext() : null;

      if (!liff.isLoggedIn()) {
        setStatus('', '尚未登入 LINE', '目前是一般瀏覽器環境，可使用 LINE Login 測試。');
        loginButton.classList.remove('hidden');
        showDebug(diagnostics);
        return;
      }

      const idToken = liff.getIDToken();
      const decoded = idToken ? decodeJwtPayload(idToken) : null;
      diagnostics.hasIdToken = Boolean(idToken);
      diagnostics.decodedSub = decoded?.sub || null;
      diagnostics.decodedAud = decoded?.aud || null;

      if (!idToken || !decoded?.sub) {
        throw new Error('LIFF 已登入，但無法取得 LINE ID Token / User ID');
      }

      setStatus('success', 'LINE 身份取得成功', 'GitHub Pages 前端已成功取得 LINE 身份。');
      $('inClientValue').textContent = diagnostics.isInClient ? '是' : '否';
      $('loggedInValue').textContent = diagnostics.isLoggedIn ? '已登入' : '未登入';
      $('tokenValue').textContent = '已取得';
      $('userIdValue').textContent = decoded.sub;
      $('welcomeText').textContent = 'LINE 身份驗證成功';
      identityCard.classList.remove('hidden');
      showDebug(diagnostics);
    } catch (error) {
      diagnostics.error = error?.message || String(error);
      setStatus('error', '初始化失敗', diagnostics.error);
      retryButton.classList.remove('hidden');
      showDebug(diagnostics);
    }
  }

  loginButton.addEventListener('click', () => {
    try {
      liff.login({ redirectUri: location.href });
    } catch (error) {
      setStatus('error', 'LINE Login 啟動失敗', error?.message || String(error));
    }
  });

  retryButton.addEventListener('click', initLiff);

  $('bookingDemoButton').addEventListener('click', () => {
    bookingDemo.classList.remove('hidden');
    bookingDemo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.querySelectorAll('.course-option').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.course-option').forEach((item) => item.classList.remove('selected'));
      button.classList.add('selected');
    });
  });

  document.querySelectorAll('.slot').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.slot').forEach((item) => item.classList.remove('selected'));
      button.classList.add('selected');
    });
  });

  const dateInput = $('dateInput');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${yyyy}-${mm}-${dd}`;
  dateInput.value = `${yyyy}-${mm}-${dd}`;

  initLiff();
})();
