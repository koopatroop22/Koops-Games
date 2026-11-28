(() => {
  'use strict';

  const TERMS_VERSION = '1.0-2026-11-28';
  const ACCEPTANCE_KEY = 'koops.terms.acceptance.v1';
  const scriptUrl = document.currentScript?.src || new URL('terms.js', document.baseURI).href;
  const termsUrl = new URL('terms.html', scriptUrl).href;
  const hubUrl = new URL('index.html', scriptUrl).href;
  const nativeOpen = window.open.bind(window);
  let sessionAccepted = false;
  let pendingLaunch = null;
  let declineAction = null;

  function hasAccepted() {
    if (sessionAccepted) return true;
    try { return localStorage.getItem(ACCEPTANCE_KEY) === TERMS_VERSION; }
    catch { return false; }
  }

  function isGameUrl(value) {
    try {
      const path = decodeURIComponent(new URL(value, window.location.href).pathname).toLowerCase();
      return path.includes('/default games/');
    } catch { return false; }
  }

  const style = document.createElement('style');
  style.textContent = `
    #koops-terms-gate{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(3,10,8,.86);backdrop-filter:blur(12px);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#e8f2ec}
    #koops-terms-gate.is-open{display:flex}
    #koops-terms-gate *{box-sizing:border-box}
    .kg-terms-card{width:min(760px,100%);max-height:min(900px,calc(100dvh - 32px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(110,231,183,.35);border-radius:24px;background:#0c1713;box-shadow:0 28px 90px rgba(0,0,0,.58)}
    .kg-terms-head{padding:20px 24px 14px;border-bottom:1px solid rgba(255,255,255,.1)}
    .kg-terms-kicker{margin:0 0 5px;color:#6ee7b7;font:700 10px/1.3 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase}
    .kg-terms-head h2{margin:0;color:#fff;font-size:clamp(21px,4vw,29px);line-height:1.15}
    .kg-terms-sub{margin:8px 0 0;color:#b8c7bf;font-size:12px}
    .kg-terms-frame{display:block;width:100%;height:min(54dvh,520px);min-height:280px;border:0;background:#091512}
    .kg-terms-check{display:flex;align-items:flex-start;gap:11px;padding:14px 24px;color:#e7f2ec;font-size:13px;line-height:1.45}
    .kg-terms-check input{width:18px;height:18px;flex:none;margin:1px 0 0;accent-color:#6ee7b7}
    .kg-terms-foot{display:flex;justify-content:space-between;gap:12px;padding:0 24px 20px}
    .kg-terms-btn{min-height:42px;padding:10px 16px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:#17231d;color:#e7f2ec;font:600 13px system-ui;cursor:pointer}
    .kg-terms-btn:hover{filter:brightness(1.15)}
    .kg-terms-accept{border-color:#6ee7b7;background:#6ee7b7;color:#052218;font-weight:800}
    .kg-terms-accept:disabled{cursor:not-allowed;opacity:.42;filter:none}
    .kg-terms-open{align-self:flex-start;margin:0 24px 12px;color:#8deac4;font-size:12px}
    @media(max-width:520px){#koops-terms-gate{padding:8px}.kg-terms-card{max-height:calc(100dvh - 16px);border-radius:18px}.kg-terms-head{padding:16px 16px 12px}.kg-terms-frame{height:48dvh;min-height:220px}.kg-terms-check{padding:12px 16px;font-size:12px}.kg-terms-foot{padding:0 16px 16px}.kg-terms-open{margin-left:16px}.kg-terms-btn{padding:9px 12px}}
  `;
  document.head.appendChild(style);

  const gate = document.createElement('section');
  gate.id = 'koops-terms-gate';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-labelledby', 'kg-terms-title');
  gate.innerHTML = `
    <div class="kg-terms-card">
      <header class="kg-terms-head">
        <p class="kg-terms-kicker">Koops Games · Version ${TERMS_VERSION}</p>
        <h2 id="kg-terms-title">Please review the Terms &amp; Conditions</h2>
        <p class="kg-terms-sub">You must accept before opening or playing any game. Poker also has a separate 18+ confirmation.</p>
      </header>
      <iframe class="kg-terms-frame" title="Koops Games Terms and Conditions" src="${termsUrl}"></iframe>
      <a class="kg-terms-open" href="${termsUrl}" target="_blank" rel="noopener noreferrer">Open the full Terms &amp; Conditions in a new tab</a>
      <label class="kg-terms-check"><input id="kg-terms-agree" type="checkbox"><span>I have read and agree to the Koops Games Terms &amp; Conditions, including the game, community, privacy, and Poker rules.</span></label>
      <footer class="kg-terms-foot">
        <button class="kg-terms-btn" id="kg-terms-decline" type="button">Decline</button>
        <button class="kg-terms-btn kg-terms-accept" id="kg-terms-accept" type="button" disabled>Accept and continue</button>
      </footer>
    </div>`;
  document.body.appendChild(gate);

  const agree = gate.querySelector('#kg-terms-agree');
  const acceptButton = gate.querySelector('#kg-terms-accept');
  agree.addEventListener('change', () => { acceptButton.disabled = !agree.checked; });

  function closeGate() {
    gate.classList.remove('is-open');
    agree.checked = false;
    acceptButton.disabled = true;
  }

  function showGate(launch = null) {
    pendingLaunch = launch;
    gate.classList.add('is-open');
    declineAction = document.body.dataset.gameId ? 'hub' : null;
    gate.querySelector('#kg-terms-decline').textContent = declineAction ? 'Decline and return to hub' : 'Decline';
    requestAnimationFrame(() => agree.focus());
  }

  acceptButton.addEventListener('click', () => {
    if (!agree.checked) return;
    sessionAccepted = true;
    try { localStorage.setItem(ACCEPTANCE_KEY, TERMS_VERSION); } catch {}
    const launch = pendingLaunch;
    pendingLaunch = null;
    closeGate();
    if (launch?.url) {
      if (launch.target === '_self') window.location.assign(launch.url);
      else nativeOpen(launch.url, launch.target || '_blank', launch.features || 'noopener,noreferrer');
    }
  });

  gate.querySelector('#kg-terms-decline').addEventListener('click', () => {
    pendingLaunch = null;
    closeGate();
    if (declineAction === 'hub') window.location.assign(hubUrl);
  });

  // Cover direct game-page visits as well as launches from either Game Hub.
  if (document.body.dataset.gameId && !hasAccepted()) showGate();

  document.addEventListener('click', (event) => {
    if (hasAccepted() || !(event.target instanceof Element)) return;
    const anchor = event.target.closest('a[href]');
    if (!anchor || !isGameUrl(anchor.href)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showGate({ url: anchor.href, target: anchor.target || '_self' });
  }, true);

  // Community quick-join and lobby cards use window.open instead of anchors.
  window.open = function (url, target, features) {
    if (!hasAccepted() && isGameUrl(url)) {
      showGate({ url: String(url), target: target || '_blank', features });
      return null;
    }
    return nativeOpen(url, target, features);
  };

  window.KoopsTerms = {
    version: TERMS_VERSION,
    open: () => showGate(),
    hasAccepted
  };
})();
