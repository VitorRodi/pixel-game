(async () => {
  const CONFIG = {
    DELAY: 1000,
    AREA: {
      MIN_X: 910,
      MAX_X: 1874,
      MIN_Y: 257,
      MAX_Y: 3707
    },
    THEME: {
      primary: '#000000',
      secondary: '#111111',
      accent: '#222222',
      text: '#ffffff',
      highlight: '#775ce3',
      success: '#00ff00',
      error: '#ff0000'
    }
  };

  const state = {
    running: false,
    paintedCount: 0,
    charges: { count: 0, max: 80, cooldownMs: 30000 },
    userInfo: null,
    lastPixel: null,
    minimized: false,
    menuOpen: false,
    language: 'en'
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const fetchAPI = async (url, options = {}) => {
    try {
      const res = await fetch(url, {
        credentials: 'include',
        ...options
      });
      return await res.json();
    } catch (e) {
      return null;
    }
  };

  const getRandomPosition = () => ({
    x: Math.floor(Math.random() * (CONFIG.AREA.MAX_X - CONFIG.AREA.MIN_X + 1)) + CONFIG.AREA.MIN_X,
    y: Math.floor(Math.random() * (CONFIG.AREA.MAX_Y - CONFIG.AREA.MIN_Y + 1)) + CONFIG.AREA.MIN_Y
  });

  const paintPixel = async (x, y) => {
    const randomColor = Math.floor(Math.random() * 31) + 1;
    return await fetchAPI(`https://backend.wplace.live/s0/pixel/${x}/${y}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ coords: [x, y], colors: [randomColor] })
    });
  };

  const getCharge = async () => {
    const data = await fetchAPI('https://backend.wplace.live/me');
    if (data) {
      state.userInfo = data;
      state.charges = {
        count: Math.floor(data.charges.count),
        max: Math.floor(data.charges.max),
        cooldownMs: data.charges.cooldownMs
      };
      if (state.userInfo.level) {
        state.userInfo.level = Math.floor(state.userInfo.level);
      }
    }
    return state.charges;
  };

  const detectUserLocation = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      state.language = (data.country === 'BR') ? 'pt' : 'en';
    } catch {
      state.language = 'en';
    }
  };

  const paintLoop = async () => {
    while (state.running) {
      const { count, cooldownMs } = state.charges;

      if (count < 1) {
        updateUI(state.language === 'pt' ? `⌛ Sem cargas. Esperando ${Math.ceil(cooldownMs/1000)}s...` : `⌛ No charges. Waiting ${Math.ceil(cooldownMs/1000)}s...`, 'status');
        await sleep(cooldownMs);
        await getCharge();
        continue;
      }

      const pos = getRandomPosition();
      const paintResult = await paintPixel(pos.x, pos.y);

      if (paintResult?.painted === 1) {
        state.paintedCount++;
        state.lastPixel = { x: pos.x, y: pos.y, time: new Date() };
        state.charges.count--;

        document.getElementById('paintEffect').style.animation = 'pulse 0.5s';
        setTimeout(() => {
          document.getElementById('paintEffect').style.animation = '';
        }, 500);

        updateUI(state.language === 'pt' ? '✅ Pixel pintado!' : '✅ Pixel painted!', 'success');
      } else {
        updateUI(state.language === 'pt' ? '❌ Falha ao pintar' : '❌ Failed to paint', 'error');
      }

      await sleep(CONFIG.DELAY);
      updateStats();
    }
  };

  const createUI = () => {
    if (state.menuOpen) return;
    state.menuOpen = true;

    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(fontAwesome);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(0, 255, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0); }
      }
      @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .wplace-bot-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 250px;
        background: ${CONFIG.THEME.primary};
        border: 1px solid ${CONFIG.THEME.accent};
        border-radius: 8px;
        padding: 0;
        box-shadow: 0 5px 15px rgba(0,0,0,0.5);
        z-index: 9999;
        font-family: 'Segoe UI', Roboto, sans-serif;
        color: ${CONFIG.THEME.text};
        animation: slideIn 0.4s ease-out;
        overflow: hidden;
      }
      /* ... [mantém o restante da UI igual, sem mudanças] ... */
    `;
    document.head.appendChild(style);

    const translations = {
      pt: {
        title: "WPlace Auto-Farm",
        start: "Iniciar",
        stop: "Parar",
        ready: "Pronto para começar",
        user: "Usuário",
        pixels: "Pixels",
        charges: "Cargas",
        level: "Level"
      },
      en: {
        title: "WPlace Auto-Farm",
        start: "Start",
        stop: "Stop",
        ready: "Ready to start",
        user: "User",
        pixels: "Pixels",
        charges: "Charges",
        level: "Level"
      }
    };

    const t = translations[state.language] || translations.en;

    // ... [restante da criação de UI permanece o mesmo, sem mudança estrutural]
  };

  window.updateUI = (message, type = 'default') => {
    const statusText = document.querySelector('#statusText');
    if (statusText) {
      statusText.textContent = message;
      statusText.className = `wplace-status status-${type}`;
      statusText.style.animation = 'none';
      void statusText.offsetWidth;
      statusText.style.animation = 'slideIn 0.3s ease-out';
    }
  };

  window.updateStats = async () => {
    await getCharge();
    const statsArea = document.querySelector('#statsArea');
    if (statsArea) {
      const t = {
        pt: { user: "Usuário", pixels: "Pixels", charges: "Cargas", level: "Level" },
        en: { user: "User", pixels: "Pixels", charges: "Charges", level: "Level" }
      }[state.language] || { user: "User", pixels: "Pixels", charges: "Charges", level: "Level" };

      statsArea.innerHTML = `
        <div class="wplace-stat-item"><div class="wplace-stat-label"><i class="fas fa-user"></i> ${t.user}</div><div>${state.userInfo.name}</div></div>
        <div class="wplace-stat-item"><div class="wplace-stat-label"><i class="fas fa-paint-brush"></i> ${t.pixels}</div><div>${state.paintedCount}</div></div>
        <div class="wplace-stat-item"><div class="wplace-stat-label"><i class="fas fa-bolt"></i> ${t.charges}</div><div>${Math.floor(state.charges.count)}/${Math.floor(state.charges.max)}</div></div>
        <div class="wplace-stat-item"><div class="wplace-stat-label"><i class="fas fa-star"></i> ${t.level}</div><div>${state.userInfo?.level || '0'}</div></div>
      `;
    }
  };

  await detectUserLocation();
  createUI();
  await getCharge();
  updateStats();
})();
