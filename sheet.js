// ═══════════════════════════════════════════════════════════════
//  sheet.js — Единый базовый модуль для всех bottom sheets
//  dastdaroz / home.html
//
//  Использование:
//    import { Sheet } from './sheet.js';
//
//    // 1. Зарегистрировать sheet (один раз при инициализации)
//    Sheet.define({
//      id:      'city',
//      title:   'Выбор города',
//      zIndex:  700,
//      onOpen:  () => _loadCities(),
//      onClose: () => {},
//    });
//
//    // 2. Наполнить тело контентом (один раз)
//    Sheet.body('city').innerHTML = `<div id="citysh-list">…</div>`;
//
//    // 3. Открыть / закрыть
//    Sheet.open('city');
//    Sheet.close('city');
//
//    // 4. Дополнительные утилиты
//    Sheet.setTitle('city', 'Новый заголовок');
//    Sheet.isOpen('city');   // → true / false
// ═══════════════════════════════════════════════════════════════


// ── Базовые стили (инжектируются в <head> один раз) ───────────
const _BASE_CSS = `
/* ── BASE SHEET ─────────────────────────────────────────────── */

/* Затемнение */
.bs-ov {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.45);
  opacity: 0; pointer-events: none;
  transition: opacity .28s;
}
.bs-ov.open {
  opacity: 1; pointer-events: all;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* Сам sheet — выезжает снизу вверх, занимает весь экран */
.bs-box {
  position: fixed; left: 0; right: 0; bottom: 0;
  height: 100svh;
  background: var(--surface, #ffffff);
  border-top: 1px solid var(--border, rgba(0,0,0,.07));
  border-radius: var(--r-xl, 20px) var(--r-xl, 20px) 0 0;
  transform: translateY(100%);
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: none;
  /* закрытый sheet не рисуется и не берёт фокус (visibility срабатывает после анимации) */
  visibility: hidden;
  transition: transform .38s cubic-bezier(.32,0,.18,1), box-shadow .38s, visibility 0s linear .38s;
}
.bs-box.open {
  transform: translateY(0);
  box-shadow: 0 -4px 32px rgba(0,0,0,.08);
  visibility: visible;
  will-change: transform;   /* отдельный слой только пока открыт */
  transition: transform .38s cubic-bezier(.32,0,.18,1), box-shadow .38s, visibility 0s;
}

/* Drag-handle (зона захвата для свайпа) */
.bs-drag {
  height: 24px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
}
.bs-drag::before {
  content: '';
  width: 36px; height: 4px;
  border-radius: 99px;
  background: var(--border-h, rgba(0,0,0,.15));
}

/* Заголовок — без отдельной шапки и разделителя.
   Строка существует только если задан title (или closeButton: true) */
.bs-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  padding: 0 14px 8px 20px;
  flex-shrink: 0;
  touch-action: none;
}
.bs-head-title {
  font-family: var(--font-display, 'Unbounded', sans-serif);
  font-weight: 800; font-size: var(--fs-lg, 1rem);
  color: var(--text, #171f1a);
  min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Кнопка закрытия */
.bs-close {
  background: var(--surface-2, #edf4ef);
  border: none;
  width: var(--ctl-md, 36px); height: var(--ctl-md, 36px);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: var(--muted, #5a7a62);
  flex-shrink: 0;
  margin-left: auto;
  transition: background var(--tf, .14s), color var(--tf, .14s);
}
.bs-close:hover {
  background: var(--surface-3, #e0ede3);
  color: var(--text, #171f1a);
}

/* Тело — занимает всё оставшееся место до низа sheet */
.bs-body {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
`;

let _cssReady = false;
function _ensureCSS() {
  if (_cssReady) return;
  const el = document.createElement('style');
  el.id = 'bs-base-styles';
  el.textContent = _BASE_CSS;
  document.head.appendChild(el);
  _cssReady = true;
}


// ── Заголовок: показывать только если он есть ────────────────
function _syncHead(s) {
  const hasTitle = !!s.titleEl.textContent.trim();
  const showClose = s.closeButton ?? hasTitle;
  s.titleEl.style.display = hasTitle ? '' : 'none';
  s.closeBtn.style.display = showClose ? '' : 'none';
  s.head.style.display = (hasTitle || showClose) ? 'flex' : 'none';
}


// ── Закрытие свайпом вниз ─────────────────────────────────────
const _SWIPE_DIST  = 90;    // px — достаточно оттянуть, чтобы закрыть
const _SWIPE_SPEED = 0.55;  // px/ms — или резкий бросок вниз

// Есть ли между точкой касания и sheet прокручиваемый блок, не в самом верху
function _scrolledAbove(target, box) {
  for (let el = target; el && el !== box; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollTop > 0) return true;
    }
  }
  return false;
}

function _attachSwipe(id, s, dragZone) {
  const { box, ov, head } = s;
  let startX = 0, startY = 0, lastY = 0, lastT = 0, vel = 0;
  let tracking = false, dragging = false, fromHandle = false, boxH = 1;

  const reset = () => {
    box.style.transition = '';           // вернуть CSS-анимацию
    void box.offsetHeight;               // зафиксировать текущую позицию
    box.style.transform = '';
    ov.style.transition = '';
    ov.style.opacity = '';
  };

  const begin = (x, y, target) => {
    if (!box.classList.contains('open')) return false;
    tracking = true; dragging = false;
    startX = x; startY = lastY = y; lastT = performance.now(); vel = 0;
    fromHandle = dragZone.contains(target) || head.contains(target);
    return true;
  };

  const move = (x, y, target, ev) => {
    if (!tracking) return;
    const dy = y - startY, dx = x - startX;

    if (!dragging) {
      if (dy <= 6 || Math.abs(dy) < Math.abs(dx)) {
        if (dy < -6) tracking = false;   // тянут вверх — это обычный скролл
        return;
      }
      if (!fromHandle) {
        if (s.body.scrollTop > 0 || _scrolledAbove(target, box)) { tracking = false; return; }
        if (target.closest('input, textarea, select, [contenteditable]')) { tracking = false; return; }
      }
      dragging = true;
      boxH = Math.max(1, box.offsetHeight);
      startY = y;                         // без рывка в начале
      box.style.transition = 'none';
      ov.style.transition = 'none';
    }

    const off = Math.max(0, y - startY);
    box.style.transform = `translateY(${off}px)`;
    ov.style.opacity = String(Math.max(0, 1 - off / boxH));
    const now = performance.now();
    if (now > lastT) vel = (y - lastY) / (now - lastT);
    lastY = y; lastT = now;
    if (ev && ev.cancelable) ev.preventDefault();
  };

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    const off = lastY - startY;
    const close = off > _SWIPE_DIST || (vel > _SWIPE_SPEED && off > 20);
    reset();
    if (close) Sheet.close(id);
  };

  // Touch
  box.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    begin(e.touches[0].clientX, e.touches[0].clientY, e.target);
  }, { passive: true });
  box.addEventListener('touchmove', e => {
    const t = e.touches[0];
    move(t.clientX, t.clientY, e.target, e);
  }, { passive: false });
  box.addEventListener('touchend', end);
  box.addEventListener('touchcancel', end);

  // Мышь — только за ручку/заголовок (десктоп)
  const onMouseMove = e => move(e.clientX, e.clientY, e.target, e);
  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    end();
  };
  [dragZone, head].forEach(el => el.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.bs-close')) return;
    if (!begin(e.clientX, e.clientY, e.target)) return;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }));
}


// ── Реестр всех sheet-ов ──────────────────────────────────────
const _reg = {};


// ── Публичный API ─────────────────────────────────────────────
export const Sheet = {

  /**
   * Регистрирует новый sheet и создаёт его DOM-структуру.
   *
   * @param {object} cfg
   * @param {string}   cfg.id       — уникальный ключ (напр. 'city', 'caddr')
   * @param {string}  [cfg.title]    — заголовок. Нет title → строки заголовка нет вообще
   * @param {boolean} [cfg.closeButton] — показывать крестик. По умолчанию: только если есть заголовок
   * @param {number}  [cfg.zIndex=600] — z-index overlay; box получает zIndex+1
   * @param {Function}[cfg.onOpen]  — коллбэк при открытии (опц.)
   * @param {Function}[cfg.onClose] — коллбэк при закрытии (опц.)
   */
  define({ id, title = '', zIndex = 600, closeButton = null, onOpen = null, onClose = null }) {
    _ensureCSS();

    if (_reg[id]) {
      console.warn(`[Sheet] "${id}" already defined, skipping`);
      return;
    }

    // ── Overlay ─────────────────────────────────────────────
    const ov = document.createElement('div');
    ov.className = 'bs-ov';
    ov.id = `bs-ov-${id}`;
    ov.style.zIndex = zIndex;
    ov.addEventListener('click', () => Sheet.close(id));

    // ── Box ──────────────────────────────────────────────────
    const box = document.createElement('div');
    box.className = 'bs-box';
    box.id = `bs-${id}`;
    box.style.zIndex = zIndex + 1;

    // Drag handle (зона свайпа)
    const drag = document.createElement('div');
    drag.className = 'bs-drag';
    box.appendChild(drag);

    // Строка заголовка (без отдельной шапки; скрывается, если пусто)
    const head = document.createElement('div');
    head.className = 'bs-head';

    const titleEl = document.createElement('div');
    titleEl.className = 'bs-head-title';
    titleEl.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bs-close';
    closeBtn.setAttribute('aria-label', 'Закрыть');
    closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5">
      <line x1="18" y1="6"  x2="6"  y2="18"/>
      <line x1="6"  y1="6"  x2="18" y2="18"/>
    </svg>`;
    closeBtn.addEventListener('click', () => Sheet.close(id));

    head.append(titleEl, closeBtn);
    box.appendChild(head);

    // Тело — сюда будет вставляться уникальный контент
    const body = document.createElement('div');
    body.className = 'bs-body';
    body.id = `bs-body-${id}`;
    box.appendChild(body);

    document.body.append(ov, box);

    _reg[id] = { ov, box, body, head, titleEl, closeBtn, closeButton, onOpen, onClose };
    _syncHead(_reg[id]);
    _attachSwipe(id, _reg[id], drag);
  },

  // ─────────────────────────────────────────────────────────

  /** Открыть sheet */
  open(id) {
    const s = _reg[id];
    if (!s) { console.warn(`[Sheet] open: "${id}" not defined`); return; }
    s.ov.classList.add('open');
    s.box.classList.add('open');
    document.body.style.overflow = 'hidden';
    s.onOpen?.();
  },

  /** Закрыть sheet */
  close(id) {
    const s = _reg[id];
    if (!s) return;
    s.ov.classList.remove('open');
    s.box.classList.remove('open');
    document.body.style.overflow = '';
    s.onClose?.();
  },

  /**
   * Получить DOM-элемент тела sheet (div.bs-body).
   * Используется для вставки уникального контента:
   *   Sheet.body('city').innerHTML = `...`;
   */
  body(id) {
    return _reg[id]?.body ?? null;
  },

  /** Изменить заголовок sheet в рантайме */
  setTitle(id, title) {
    const s = _reg[id];
    if (!s) return;
    s.titleEl.textContent = title || '';
    _syncHead(s);
  },

  /** true если sheet сейчас открыт */
  isOpen(id) {
    return _reg[id]?.box.classList.contains('open') ?? false;
  },

  /** Закрыть все открытые sheet-ы (например при навигации) */
  closeAll() {
    for (const id of Object.keys(_reg)) {
      if (Sheet.isOpen(id)) Sheet.close(id);
    }
  },
};


// ═══════════════════════════════════════════════════════════════
//  МИГРАЦИЯ СУЩЕСТВУЮЩИХ SHEETS — ЧТО МЕНЯТЬ В app.js / home.html
// ═══════════════════════════════════════════════════════════════
//
//  ── 1. CITY SHEET ────────────────────────────────────────────
//
//  В app.js (секция 22. Выбор города) заменить всё на:
//
//  function _initCitySheet() {
//    Sheet.define({
//      id:     'city',
//      title:  'Выбор города',
//      zIndex: 700,
//      onOpen: _loadCities,
//    });
//
//    Sheet.body('city').innerHTML = `
//      <p class="citysh-subtitle">
//        Все магазины и доставка будут показаны для выбранного города
//      </p>
//      <div class="citysh-list" id="citysh-list">
//        <div class="citysh-empty">Загружаем города…</div>
//      </div>
//    `;
//  }
//
//  window.openCitySheet  = () => Sheet.open('city');
//  window.closeCitySheet = () => Sheet.close('city');
//
//  В home.html УДАЛИТЬ блок HTML:
//    <div class="citysh-ov" ...>
//    <div class="citysh" ...>...</div>
//
//  В home.html УДАЛИТЬ CSS:
//    .citysh-ov { ... }   .citysh { ... }
//    .citysh-drag { ... } .citysh-head { ... }
//    .citysh-title { ... } .citysh-close { ... }
//  (оставить только .citysh-list, .citysh-item*, .citysh-subtitle, .citysh-empty)
//
//
//  ── 2. CART ADDRESS SHEET (caddrsh) ──────────────────────────
//
//  function _initCaddrSheet() {
//    Sheet.define({
//      id:     'caddr',
//      title:  'Адрес доставки',
//      zIndex: 700,
//    });
//
//    Sheet.body('caddr').innerHTML = `
//      <div class="caddrsh-list" id="caddrsh-list">
//        <div class="caddrsh-empty">Адреса загружаются…</div>
//      </div>
//      <div style="padding:0 18px 4px;flex-shrink:0">
//        <button class="caddrsh-goto" onclick="openAddAddrSheet()">
//          + Новый адрес
//        </button>
//      </div>
//    `;
//  }
//
//  window.openCartAddrSheet  = () => Sheet.open('caddr');
//  window.closeCartAddrSheet = () => Sheet.close('caddr');
//
//  В home.html УДАЛИТЬ:
//    <div class="caddrsh-ov" ...>
//    <div class="caddrsh" ...>...</div>
//
//  В home.html УДАЛИТЬ CSS:
//    .caddrsh-ov { ... }  .caddrsh { ... }
//    .caddrsh-drag { ... } .caddrsh-head { ... }
//    .caddrsh-title { ... } .caddrsh-close { ... }
//
//
//  ── 3. ADD ADDRESS SHEET (addaddr) ───────────────────────────
//
//  function _initAddAddrSheet() {
//    Sheet.define({
//      id:     'addaddr',
//      title:  'Новый адрес',
//      zIndex: 710,
//    });
//
//    Sheet.body('addaddr').innerHTML = `
//      <div style="padding:0 20px">
//        <label class="addaddr-lbl">Адрес</label>
//        <input class="addaddr-inp" id="addaddr-inp" .../>
//        <label class="addaddr-lbl">Комментарий</label>
//        <textarea class="addaddr-inp" id="addaddr-comment" ...></textarea>
//        <button class="addaddr-save" onclick="saveAddr()">Сохранить</button>
//      </div>
//    `;
//  }
//
//  window.openAddAddrSheet  = () => Sheet.open('addaddr');
//  window.closeAddAddrSheet = () => Sheet.close('addaddr');
//
//
//  ── ИНИЦИАЛИЗАЦИЯ (вызвать в init() или onAuthStateChanged) ──
//
//  _initCitySheet();
//  _initCaddrSheet();
//  _initAddAddrSheet();
//  // ... и т.д. для других sheets
//
// ═══════════════════════════════════════════════════════════════
