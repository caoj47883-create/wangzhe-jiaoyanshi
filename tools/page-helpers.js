(function () {
  if (window.__studyHelpersInstalled) {
    return;
  }
  window.__studyHelpersInstalled = true;
  try {
    var CSS = '.kimi-brand-container,.kimi-floating-button,.kimi-action-bar,' +
      '.kimi-brand-close-icon,.kimi-brand-info-wrapper,[class*="kimi-brand"],' +
      '[class*="kimi-floating"],[class*="kimi-action-bar"],' +
      '[id*="kimi-brand"],[id*="kimi-floating"]{display:none!important;' +
      'visibility:hidden!important;opacity:0!important;pointer-events:none!important}';

    function hideKimi() {
      try {
        var st = document.getElementById('__hide_kimi_css');
        if (!st) {
          st = document.createElement('style');
          st.id = '__hide_kimi_css';
          st.textContent = CSS;
          (document.head || document.documentElement).appendChild(st);
        }
        var nodes = document.querySelectorAll('.kimi-brand-container,.kimi-floating-button,.kimi-action-bar');
        for (var i = nodes.length - 1; i >= 0; i--) {
          nodes[i].remove();
        }
      } catch (e) {}
    }

    function openExternal(u) {
      try {
        if (window.AppBridge && typeof window.AppBridge.openExternal === 'function') {
          window.AppBridge.openExternal(String(u));
          return true;
        }
      } catch (e) {}
      return false;
    }

    window.open = function (u) {
      if (u) {
        openExternal(u);
      }
      return null;
    };

    document.addEventListener('click', function (ev) {
      try {
        var el = ev.target;
        if (!el || !el.closest) {
          return;
        }
        var a = el.closest('a[href]');
        if (!a) {
          return;
        }
        var href = a.getAttribute('href') || '';
        if (!href) {
          return;
        }
        var abs = new URL(href, location.href).href;
        if (!/^https?:/i.test(abs)) {
          return;
        }
        var h = new URL(abs).hostname.toLowerCase();
        if (h === 'appassets.local' || h === 'appassets.v2.local' || h === '127.0.0.1' || h === 'localhost' || h === 'jchok.ok.kimi.link') {
          return;
        }
        if (openExternal(abs)) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      } catch (e) {}
    }, true);

    hideKimi();
    var hideScheduled = false;
    function scheduleHide() {
      if (hideScheduled) {
        return;
      }
      hideScheduled = true;
      setTimeout(function () {
        hideScheduled = false;
        hideKimi();
      }, 300);
    }
    try {
      var o = new MutationObserver(scheduleHide);
      o.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    setTimeout(hideKimi, 600);
    setTimeout(hideKimi, 2000);

    // Hardware back key support (legacy fallback).
    // V2+ provides its own window.__appBack/__studyBack (modal closers + router stack),
    // so only install this fallback when the app has not provided a handler.
    function findBackButton() {
      var direct = document.querySelector('[aria-label="返回"],[aria-label="关闭"],[aria-label="Close"],[aria-label="close"]');
      if (direct) {
        var dr = direct.getBoundingClientRect();
        if (dr.width > 0 && dr.height > 0) {
          return direct;
        }
      }
      var candidates = document.querySelectorAll('button, [role="button"]');
      for (var i = 0; i < candidates.length; i++) {
        var b = candidates[i];
        if (!b || b.disabled) {
          continue;
        }
        var r = b.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) {
          continue;
        }
        var t = (b.innerText || '').trim();
        if (t === '‹' || t === '←' || t === '<' || t === '〈' || t === '《') {
          return b;
        }
      }
      return null;
    }
    if (typeof window.__studyBack !== 'function') {
      window.__studyBack = function () {
        try {
          var b = findBackButton();
          if (b) {
            b.click();
            return true;
          }
        } catch (e) {}
        return false;
      };
    }
  } catch (e) {}
})();
