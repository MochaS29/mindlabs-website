/*
 * Persistent download CTA.
 * Shared by every page so the download path is never more than one tap away.
 * Picks the right store for the visitor's platform. Clicks are reported by the
 * shared listener in /analytics.js, which reads the sticky_bar placement below.
 */
(function () {
  'use strict';

  var IOS = 'https://apps.apple.com/ca/app/mindlab-fitness/id6752837101';
  var PLAY = 'https://play.google.com/store/apps/details?id=com.mochasmindlab.mlhealth';
  var KEY = 'mlf_dlbar_dismissed';

  function dismissed() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function remember() {
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode: fine */ }
  }

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);

  var href, label;
  if (isIOS)        { href = IOS;  label = 'Download free'; }
  else if (isAndroid) { href = PLAY; label = 'Download free'; }
  else              { href = IOS;  label = 'Get it free'; }

  var css = ''
    + '#mlf-dlbar{position:fixed;left:0;right:0;bottom:0;z-index:9000;'
    + 'display:flex;align-items:center;gap:12px;padding:10px 14px;'
    + 'background:linear-gradient(135deg,#8B4513,#4A9B9B);color:#fff;'
    + 'box-shadow:0 -4px 20px rgba(0,0,0,.18);'
    + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;'
    + 'transform:translateY(110%);transition:transform .3s ease}'
    + '#mlf-dlbar.mlf-in{transform:translateY(0)}'
    + '#mlf-dlbar img{width:40px;height:40px;flex:0 0 auto}'
    + '#mlf-dlbar .mlf-txt{flex:1;min-width:0;line-height:1.25}'
    + '#mlf-dlbar .mlf-t{font-weight:700;font-size:.95rem;white-space:nowrap;'
    + 'overflow:hidden;text-overflow:ellipsis}'
    + '#mlf-dlbar .mlf-s{font-size:.78rem;opacity:.92;white-space:nowrap;'
    + 'overflow:hidden;text-overflow:ellipsis}'
    + '#mlf-dlbar a.mlf-btn{flex:0 0 auto;background:#fff;color:#8B4513;'
    + 'padding:10px 18px;border-radius:100px;text-decoration:none;font-weight:700;'
    + 'font-size:.9rem;white-space:nowrap}'
    + '#mlf-dlbar button.mlf-x{flex:0 0 auto;background:transparent;border:0;'
    + 'color:#fff;opacity:.75;font-size:1.35rem;line-height:1;cursor:pointer;'
    + 'padding:4px 6px}'
    + '#mlf-dlbar button.mlf-x:hover{opacity:1}'
    + '@media(max-width:430px){#mlf-dlbar .mlf-s{display:none}'
    + '#mlf-dlbar a.mlf-btn{padding:10px 14px;font-size:.85rem}}'
    + '@media print{#mlf-dlbar{display:none}}'
    + '@media(prefers-reduced-motion:reduce){#mlf-dlbar{transition:none}}';

  function build() {
    if (dismissed() || document.getElementById('mlf-dlbar')) return;

    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    var bar = document.createElement('div');
    bar.id = 'mlf-dlbar';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'Download MindLab Fitness');
    bar.setAttribute('data-placement', 'sticky_bar');

    var icon = document.createElement('img');
    icon.src = 'images/ml-fitness-icon-192.png';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    icon.width = 40; icon.height = 40;

    var txt = document.createElement('div');
    txt.className = 'mlf-txt';
    txt.innerHTML = '<div class="mlf-t">MindLab Fitness</div>'
      + '<div class="mlf-s">Free to download. $8.99 one-time Pro unlock, no subscription.</div>';

    var btn = document.createElement('a');
    btn.className = 'mlf-btn';
    btn.href = href;
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.textContent = label;

    var x = document.createElement('button');
    x.className = 'mlf-x';
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss download banner');
    x.innerHTML = '&times;';
    x.addEventListener('click', function () {
      remember();
      bar.classList.remove('mlf-in');
      document.body.style.paddingBottom = '';
      setTimeout(function () { bar.remove(); }, 300);
    });

    bar.appendChild(icon); bar.appendChild(txt); bar.appendChild(btn); bar.appendChild(x);
    document.body.appendChild(bar);

    // Keep the footer clear of the bar.
    document.body.style.paddingBottom = bar.offsetHeight + 'px';

    requestAnimationFrame(function () { bar.classList.add('mlf-in'); });
  }

  function maybeShow() {
    var short = document.documentElement.scrollHeight < window.innerHeight * 1.6;
    if (short || window.scrollY > 250) {
      build();
      window.removeEventListener('scroll', maybeShow);
    }
  }

  function init() {
    if (dismissed()) return;
    maybeShow();
    window.addEventListener('scroll', maybeShow, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
