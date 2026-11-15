// DOM HUD: pushes numbers in, reads the play callback out. All setters cache last values.
const COPY = {
  start: { title: 'DUSTLINE', copy: 'Vanguard plants the charge; Jackals hold the yard. Click to play.', action: 'Click to play' },
  paused: { title: 'DUSTLINE', copy: 'Paused. Click to resume.', action: 'Click to resume' },
  end: { title: 'Round over', copy: 'The round is decided.', action: 'Next round' },
  match: { title: 'Match over', copy: 'The match is decided.', action: 'Play again' },
};

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    healthNum: $('health-num'), healthBar: $('health-bar'),
    ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'), weaponName: $('weapon-name'),
    money: $('money'), timer: $('timer'), scoreV: $('score-v'), scoreJ: $('score-j'),
    aliveV: $('alive-v'), aliveJ: $('alive-j'), roundNum: $('round-num'),
    crosshair: $('crosshair'), hitmarker: $('hitmarker'), killfeed: $('killfeed'),
    bombStatus: $('bomb-status'), banner: $('banner'), bannerSub: $('banner-sub'),
    buyMenu: $('buy-menu'), buyItems: $('buy-items'),
    damageVignette: $('damage-vignette'), overlay: $('overlay'),
    overlayTitle: $('overlay-title'), overlayCopy: $('overlay-copy'), play: $('play'),
  };
  const last = {};
  let hitTimer = 0;
  let bannerTimer = 0;
  let dmgTimer = 0;
  let mutedFlag = false;
  let buyHandler = null;
  let buyItems = [];

  function setText(key, node, value) {
    if (!node || last[key] === value) return;
    last[key] = value;
    node.textContent = value;
  }
  function fmtTime(s) {
    const t = Math.max(0, Math.ceil(s));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }
  function onBuyKey(event) {
    if (!buyHandler) return;
    const n = Number.parseInt(event.code.replace('Digit', ''), 10);
    if (n >= 1 && n <= buyItems.length) buyHandler(buyItems[n - 1].id);
  }

  if (el.damageVignette) el.damageVignette.style.transition = 'opacity 0.35s linear';

  return {
    setHealth(h) {
      setText('health', el.healthNum, String(Math.max(0, Math.round(h))));
      if (el.healthBar && last.healthBar !== h) {
        last.healthBar = h;
        el.healthBar.style.width = `${Math.max(0, Math.min(100, h))}%`;
        el.healthBar.classList.toggle('low', h < 30);
      }
    },
    setAmmo(mag, reserve, weaponName) {
      setText('mag', el.ammoMag, String(mag));
      setText('reserve', el.ammoReserve, reserve === -1 ? '/ ∞' : `/ ${reserve}`);
      if (weaponName) setText('weapon', el.weaponName, weaponName);
      if (el.ammoMag && el.ammoMag.parentElement) el.ammoMag.parentElement.classList.toggle('empty', mag === 0);
    },
    setMoney(m) { setText('money', el.money, `$${m}`); },
    setTimer(s) {
      setText('timer', el.timer, fmtTime(s));
      if (el.timer) el.timer.classList.toggle('low', s <= 10);
    },
    setScore(v, j) {
      setText('scoreV', el.scoreV, String(v));
      setText('scoreJ', el.scoreJ, String(j));
    },
    setAlive(v, j) {
      setText('aliveV', el.aliveV, String(v));
      setText('aliveJ', el.aliveJ, String(j));
    },
    setRound(n) { setText('round', el.roundNum, String(n)); },
    killFeed(text) {
      if (!el.killfeed) return;
      const row = document.createElement('div');
      row.textContent = text;
      el.killfeed.appendChild(row);
      while (el.killfeed.children.length > 5) el.killfeed.removeChild(el.killfeed.firstChild);
      setTimeout(() => row.remove(), 6000);
    },
    setBomb(text, cls) {
      setText('bomb', el.bombStatus, text);
      if (el.bombStatus) el.bombStatus.className = cls || '';
    },
    banner(title, sub) {
      if (!el.banner) return;
      // banner holds the title as a text node plus the #banner-sub child; never
      // overwrite textContent or the child is destroyed.
      if (last.banner !== title) {
        last.banner = title;
        const textNode = Array.from(el.banner.childNodes).find((n) => n.nodeType === 3);
        if (textNode) textNode.textContent = title;
        else el.banner.prepend(document.createTextNode(title));
      }
      setText('bannerSub', el.bannerSub, sub || '');
      el.banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { el.banner.hidden = true; }, 3500);
    },
    hideBanner() { if (el.banner) el.banner.hidden = true; },
    showBuyMenu(items, money, onBuy) {
      if (!el.buyMenu || !el.buyItems) return;
      buyItems = items;
      buyHandler = onBuy;
      el.buyItems.innerHTML = items.map((it, i) =>
        `<button type="button" data-i="${i}" ${it.owned ? 'disabled' : ''}>${i + 1} · ${it.name} — $${it.price}${it.owned ? ' (owned)' : ''}</button>`).join('')
        + `<div class="buy-money">Credits: $${money} · press 1–${items.length} or click · B to close</div>`;
      for (const btn of el.buyItems.querySelectorAll('button')) {
        btn.addEventListener('click', () => onBuy(items[Number(btn.dataset.i)].id));
      }
      el.buyMenu.hidden = false;
      window.addEventListener('keydown', onBuyKey);
    },
    hideBuyMenu() {
      if (el.buyMenu) el.buyMenu.hidden = true;
      buyHandler = null;
      window.removeEventListener('keydown', onBuyKey);
    },
    showOverlay(mode, score) {
      const text = COPY[mode] || COPY.start;
      if (el.overlayTitle) el.overlayTitle.textContent = text.title;
      if (el.overlayCopy) {
        let copy = text.copy;
        if (mode === 'end' && score != null) copy += ` You scored ${score}.`;
        if (mode === 'match' && score != null) copy += typeof score === 'object' ? ` Final score ${score.v}–${score.j}.` : ` Final score ${score}.`;
        el.overlayCopy.textContent = copy;
      }
      if (el.play) el.play.textContent = text.action;
      if (el.overlay) { el.overlay.hidden = false; if (el.play) el.play.focus(); }
    },
    hideOverlay() { if (el.overlay) el.overlay.hidden = true; },
    onPlay(handler) { if (el.play) el.play.addEventListener('click', handler); },
    hitMarker(killed, holdMs = 90) {
      if (!el.hitmarker) return;
      el.hitmarker.classList.add('on');
      el.hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        el.hitmarker.classList.remove('on');
        el.hitmarker.style.transform = '';
      }, holdMs);
    },
    damageFlash(angle) {
      if (!el.damageVignette) return;
      el.damageVignette.style.transform = `rotate(${angle}rad)`;
      el.damageVignette.style.opacity = '1';
      clearTimeout(dmgTimer);
      dmgTimer = setTimeout(() => { el.damageVignette.style.opacity = '0'; }, 350);
    },
    setCrosshair(gapPx) {
      if (!el.crosshair) return;
      const gap = Math.max(2, Math.min(48, gapPx));
      if (last.gap === gap) return;
      last.gap = gap;
      const arms = el.crosshair.children;
      if (arms.length >= 4) {
        arms[0].style.transform = `translateY(${-gap}px)`;
        arms[1].style.transform = `translateY(${gap}px)`;
        arms[2].style.transform = `translateX(${-gap}px)`;
        arms[3].style.transform = `translateX(${gap}px)`;
      }
    },
    setMuted(m) { mutedFlag = !!m; },
  };
}
