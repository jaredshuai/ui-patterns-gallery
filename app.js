/* ============================================================
   界面模式图鉴 — 交互
   每个演示都是真实可用的：能开、能关、能确认、能撤销。
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------
     0. 索引导航 + 搜索
     ------------------------------------------------------------ */

  const specs = $$('.spec');
  const indexEl = $('#index');

  /* 分卷：每组属于哪一卷 */
  const VOLUMES = {
    overlay: { btn: '卷一 · 浮层', short: '浮层' },
    form: { btn: '卷二 · 表单', short: '表单' },
  };

  const GROUPS = [
    { vol: 'overlay', name: '提示与反馈', ids: ['toast', 'snackbar', 'inline-alert', 'banner', 'notification', 'badge'] },
    { vol: 'overlay', name: '加载与空态', ids: ['skeleton', 'spinner', 'progress', 'empty-state'] },
    { vol: 'overlay', name: '遮罩层', ids: ['modal', 'alert-dialog', 'drawer', 'bottom-sheet', 'action-sheet', 'lightbox', 'command-palette'] },
    { vol: 'overlay', name: '锚定浮层', ids: ['tooltip', 'popover', 'popconfirm', 'hover-card', 'dropdown-menu', 'context-menu'] },
    { vol: 'overlay', name: '引导', ids: ['tour', 'coachmark'] },

    { vol: 'form', name: '选择控件', ids: ['select', 'combobox', 'radio-group', 'segmented-control', 'switch', 'checkbox'] },
    { vol: 'form', name: '输入与文本', ids: ['placeholder', 'password-input', 'search-input', 'otp-input', 'slider', 'spinbutton'] },
    { vol: 'form', name: '校验与反馈', ids: ['validation-timing', 'error-summary', 'required-marker', 'autosave', 'dirty-state'] },
    { vol: 'form', name: '状态与提交', ids: ['disabled-states', 'optimistic-ui', 'submit-button', 'dropzone'] },
  ];

  let currentVol = 'overlay';

  const specsIn = vol => specs.filter(s => (s.dataset.vol || 'overlay') === vol);
  const groupsIn = vol => GROUPS.filter(g => g.vol === vol);

  function buildIndex() {
    let html = '<div class="index__head">索引</div>';
    groupsIn(currentVol).forEach(g => {
      html += `<div class="index__group" data-vol="${g.vol}">`;
      html += `<div class="index__group-name">${g.name}<em>${g.ids.length}</em></div>`;
      g.ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const label = $('.spec__en', el).textContent;
        html += `<a class="index__link" href="#${id}" data-target="${id}">${label}</a>`;
      });
      html += '</div>';
    });
    indexEl.innerHTML = html;
    wireIndexTracking();
  }

  function setCount() {
    const n = specsIn(currentVol).length;
    const g = groupsIn(currentVol).length;
    $('#count').textContent = `${n} 项 / ${g} 组`;
  }

  let io = null;

  function wireIndexTracking() {
    if (io) io.disconnect();
    const links = new Map($$('.index__link').map(a => [a.dataset.target, a]));

    io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.remove('is-active'));
        const link = links.get(e.target.id);
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-72px 0px -70% 0px', threshold: 0 });

    specsIn(currentVol).forEach(s => io.observe(s));
  }

  function wireSearch() {
    const input = $('#search');
    const noResult = $('#noResult');

    const run = () => {
      const q = input.value.trim().toLowerCase();
      let shown = 0;

      specsIn(currentVol).forEach(s => {
        const hay = (s.id + ' ' + (s.dataset.k || '') + ' ' + s.textContent).toLowerCase();
        const hit = !q || hay.includes(q);
        s.classList.toggle('is-hidden', !hit);
        if (hit) shown++;
      });

      // 索引同步过滤
      $$('.index__link').forEach(a => {
        const el = document.getElementById(a.dataset.target);
        a.style.display = el && el.classList.contains('is-hidden') ? 'none' : '';
      });
      $$('.index__group').forEach(g => {
        const any = $$('.index__link', g).some(a => a.style.display !== 'none');
        g.style.display = any ? '' : 'none';
      });

      noResult.classList.toggle('is-on', shown === 0);
    };

    input.addEventListener('input', run);
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { input.value = ''; run(); input.blur(); }
    });

    return run;
  }

  /* ------------------------------------------------------------
     卷别切换
     ------------------------------------------------------------ */

  function setVolume(vol, opt) {
    const o = opt || {};
    currentVol = vol;

    $$('.volume').forEach(v => {
      v.classList.toggle('is-vol-hidden', v.id !== 'vol-' + vol);
    });
    $$('.lede').forEach(l => {
      l.classList.toggle('is-vol-hidden', l.dataset.vol !== vol);
    });

    $$('.volsw__btn').forEach(b => {
      b.classList.toggle('is-on', b.dataset.vol === vol);
      b.setAttribute('aria-pressed', b.dataset.vol === vol ? 'true' : 'false');
    });

    buildIndex();
    setCount();

    // 清掉另一卷残留的搜索过滤
    const input = $('#search');
    if (input.value) input.value = '';
    $$('.spec').forEach(s => s.classList.remove('is-hidden'));
    $('#noResult').classList.remove('is-on');

    if (!o.silent) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    // 记住选择，下次打开还是这一卷
    try {
      sessionStorage.setItem('ui-gallery-vol', vol);
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  function wireVolumeSwitch() {
    $$('.volsw__btn').forEach(b => {
      b.addEventListener('click', () => {
        setVolume(b.dataset.vol);
        setSearchPlaceholder();
      });
    });
  }

  // 搜索框占位随卷变化
  function setSearchPlaceholder() {
    const input = $('#search');
    if (!input) return;
    input.placeholder = currentVol === 'overlay'
      ? '搜索 toast、遮罩、确认…'
      : '搜索 select、校验、只读…';
  }

  // 直接跳转时闪一下，让人知道落在哪
  function wireHashFlash() {
    const flash = id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('is-flash');
      setTimeout(() => el.classList.remove('is-flash'), 1600);
    };
    window.addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      // 锚点属于哪一卷，就切到哪一卷
      const el = document.getElementById(id);
      if (el && el.classList.contains('spec')) {
        const vol = el.dataset.vol || 'overlay';
        if (vol !== currentVol) setVolume(vol, { silent: true });
      }
      flash(id);
    });
    if (location.hash) setTimeout(() => flash(location.hash.slice(1)), 200);
  }

  /* ------------------------------------------------------------
     通用：把浮层摆到锚点旁边（相对 stage 坐标）
     ------------------------------------------------------------ */

  function placeNear(stage, box, anchor, opt) {
    const o = Object.assign({ side: 'bottom', align: 'start', gap: 8 }, opt || {});
    const sr = stage.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const bw = box.offsetWidth;
    const bh = box.offsetHeight;

    let top, left;

    if (o.side === 'bottom') {
      top = ar.bottom - sr.top + o.gap;
      left = o.align === 'end' ? ar.right - sr.left - bw : ar.left - sr.left;
    } else if (o.side === 'top') {
      top = ar.top - sr.top - bh - o.gap;
      left = o.align === 'end' ? ar.right - sr.left - bw : ar.left - sr.left;
    } else if (o.side === 'left') {
      top = ar.top - sr.top;
      left = ar.left - sr.left - bw - o.gap;
    } else { // right
      top = ar.top - sr.top;
      left = ar.right - sr.left + o.gap;
    }

    // 夹在舞台内
    const pad = 8;
    left = Math.max(pad, Math.min(left, sr.width - bw - pad));
    top = Math.max(pad, Math.min(top, sr.height - bh - pad));

    box.style.top = top + 'px';
    box.style.left = left + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
    box.style.transform = '';
  }

  /* ------------------------------------------------------------
     1. Toast
     ------------------------------------------------------------ */

  function initToast() {
    const region = $('#toastRegion');
    if (!region) return;

    const icons = {
      ok: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="#0f7a48" stroke-width="2.2" stroke-linecap="round"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
      warn: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="#905f00" stroke-width="1.9" stroke-linecap="round"><path d="M12 3.5L21.5 20H2.5z"/><path d="M12 9v5"/><circle cx="12" cy="16.8" r=".9" fill="#905f00" stroke="none"/></svg>',
    };


    function show(kind, msg) {
      const node = document.createElement('div');
      node.className = 'toast';
      node.setAttribute('role', 'status');
      node.innerHTML =
        icons[kind === 'warn' ? 'warn' : 'ok'] +
        `<div class="toast__body"><div class="toast__title">${msg}</div></div>` +
        (reduceMotion ? '' : '<div class="toast__life"></div>');

      region.appendChild(node);

      // 同屏最多 3 条
      while (region.children.length > 3) region.removeChild(region.firstElementChild);

      const kill = () => {
        if (node.dataset.dead) return;
        node.dataset.dead = '1';
        node.classList.add('is-out');
        setTimeout(() => node.remove(), reduceMotion ? 0 : 190);
      };
      setTimeout(kill, 3000);
      node.addEventListener('click', kill);
    }

    $$('[data-toast]').forEach(btn => {
      btn.addEventListener('click', () => show(btn.dataset.toast, btn.dataset.msg));
    });
  }

  /* ------------------------------------------------------------
     2. Snackbar
     ------------------------------------------------------------ */

  function initSnackbar() {
    const del = $('#snackDelete');
    const region = $('#snackRegion');
    const list = $('#snackItems');
    if (!del || !region) return;

    let lastRemoved = null;
    let timer = null;

    function hide() {
      const bar = $('.snackbar', region);
      if (!bar) return;
      bar.remove();
    }

    function show(text, actionLabel, onAction) {
      clearTimeout(timer);
      region.innerHTML = '';
      const bar = document.createElement('div');
      bar.className = 'snackbar';
      bar.setAttribute('role', 'status');
      bar.innerHTML =
        `<span class="snackbar__text">${text}</span>` +
        `<button class="snackbar__action">${actionLabel}</button>`;
      region.appendChild(bar);
      $('.snackbar__action', bar).addEventListener('click', () => {
        onAction();
        hide();
      });
      timer = setTimeout(hide, 6000);
    }

    del.addEventListener('click', () => {
      const rows = $$('.item-list__row', list);
      if (!rows.length) {
        show('没有可删除的条目了', '知道了', () => {});
        return;
      }
      const row = rows[rows.length - 1];
      lastRemoved = { html: row.outerHTML, index: rows.length - 1 };
      row.remove();
      show(`已删除「${row.textContent.trim()}」`, '撤销', () => {
        if (!lastRemoved) return;
        list.insertAdjacentHTML('beforeend', lastRemoved.html);
        lastRemoved = null;
        show('已恢复', '知道了', () => {});
      });
    });

    // 补回一条，方便反复试
    del.addEventListener('dblclick', () => {
      list.innerHTML =
        '<div class="item-list__row"><span class="item-dot"></span>季度报告.pdf</div>' +
        '<div class="item-list__row"><span class="item-dot"></span>会议纪要.md</div>';
    });
  }

  /* ------------------------------------------------------------
     3. Inline alert
     ------------------------------------------------------------ */

  function initInlineAlert() {
    const form = $('#inlineForm');
    const slot = $('#inlineSlot');
    const email = $('#email');
    if (!form) return;

    const alert = (kind, title, body) => {
      const palette = {
        error: { cls: 'inline-alert--error', icon: '<use href="#i-alert"/>', stroke: '#b02a20' },
        ok: { cls: 'inline-alert--ok', icon: '<use href="#i-check"/>', stroke: '#0f7a48' },
        info: { cls: 'inline-alert--info', icon: '<use href="#i-info"/>', stroke: '#1e45c8' },
        warn: { cls: 'inline-alert--warn', icon: '<use href="#i-warn"/>', stroke: '#905f00' },
      }[kind];
      slot.innerHTML =
        `<div class="inline-alert ${palette.cls}" role="${kind === 'error' ? 'alert' : 'status'}">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="${palette.stroke}" stroke-width="1.8" stroke-linecap="round">${palette.icon}</svg>` +
        `<div class="inline-alert__text"><strong>${title}</strong>${body || ''}</div></div>`;
    };

    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = email.value.trim();
      if (!v) {
        email.classList.add('is-error');
        alert('error', '请填写邮箱', '我们需要一个地址才能发送周报。');
        email.focus();
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
        email.classList.add('is-error');
        alert('error', '邮箱格式不对', '检查一下 @ 前后是不是缺了字符。');
        email.focus();
        return;
      }
      email.classList.remove('is-error');
      alert('ok', '已订阅', '下周一开始，每周一早上八点会收到一封。');
    });

    email.addEventListener('input', () => {
      email.classList.remove('is-error');
      if (slot.firstElementChild && slot.firstElementChild.classList.contains('inline-alert--error')) {
        slot.innerHTML = '';
      }
    });
  }

  /* ------------------------------------------------------------
     4. Banner
     ------------------------------------------------------------ */

  function initBanner() {
    const slot = $('#bannerSlot');
    const close = $('#bannerClose');
    const reset = $('#bannerReset');
    if (!slot) return;
    const original = slot.innerHTML;

    function wireClose() {
      const btn = $('#bannerClose');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const b = slot.querySelector('.banner');
        if (!b) return;
        if (reduceMotion) { slot.innerHTML = ''; return; }
        b.style.transition = 'opacity .16s, transform .16s';
        b.style.opacity = '0';
        b.style.transform = 'translateY(-6px)';
        setTimeout(() => { slot.innerHTML = ''; }, 160);
      });
    }
    wireClose();

    reset.addEventListener('click', () => {
      slot.innerHTML = original;
      wireClose();
    });
  }

  /* ------------------------------------------------------------
     5. Notification
     ------------------------------------------------------------ */

  function initNotification() {
    const add = $('#notifAdd');
    const clear = $('#notifClear');
    const region = $('#notifRegion');
    if (!add) return;

    const SEEDS = [
      { title: '林知远 评论了你的方案', desc: '「第二节的层级可以再压一层。」', icon: 'user', color: '#1e45c8', bg: '#eaf0fb' },
      { title: '部署已完成', desc: 'design-system 已上线，用时 47 秒。', icon: 'check', color: '#0f7a48', bg: '#eaf5f0' },
      { title: '构建失败', desc: 'src/theme.ts 第 42 行类型不匹配。', icon: 'alert', color: '#b02a20', bg: '#fbeceb' },
    ];

    let i = 0;

    add.addEventListener('click', () => {
      const s = SEEDS[i % SEEDS.length];
      i++;
      const el = document.createElement('div');
      el.className = 'notif';
      el.setAttribute('role', 'status');
      el.innerHTML =
        `<div class="notif__icon" style="background:${s.bg}">` +
        `<svg style="width:15px;height:15px;fill:none;stroke:${s.color};stroke-width:1.9;stroke-linecap:round" viewBox="0 0 24 24">` +
        (s.icon === 'check' ? '<path d="M4.5 12.5l5 5L19.5 7"/>' : '') +
        (s.icon === 'alert' ? '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v6"/>' : '') +
        (s.icon === 'user' ? '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20a7.4 7.4 0 0114.4 0"/>' : '') +
        '</svg></div>' +
        `<div class="notif__body"><div class="notif__title">${s.title}</div>` +
        `<div class="notif__desc">${s.desc}</div>` +
        `<div class="notif__time">刚刚</div></div>` +
        `<button class="notif__close" aria-label="关闭">&times;</button>`;

      $('.notif__close', el).addEventListener('click', () => el.remove());
      region.prepend(el);

      while (region.children.length > 3) region.removeChild(region.lastElementChild);
    });

    clear.addEventListener('click', () => { region.innerHTML = ''; });
  }

  /* ------------------------------------------------------------
     6. Badge
     ------------------------------------------------------------ */

  function initBadge() {
    const bell = $('#badgeBell');
    const num = $('#badgeNum');
    const add = $('#badgeAdd');
    if (!bell) return;

    let n = 3;

    const paint = () => {
      if (n <= 0) { num.style.display = 'none'; return; }
      num.style.display = '';
      num.textContent = n > 99 ? '99+' : String(n);
      // 数字变宽时不要撑变形
      num.style.minWidth = n > 9 ? '22px' : '18px';
    };

    bell.addEventListener('click', () => {
      n = 0;
      paint();
      bell.setAttribute('aria-label', '通知，没有未读');
    });

    add.addEventListener('click', () => {
      n++;
      paint();
      bell.setAttribute('aria-label', `通知，${n} 条未读`);
    });

    paint();
  }

  /* ------------------------------------------------------------
     7. Skeleton
     ------------------------------------------------------------ */

  function initSkeleton() {
    const list = $('#skelList');
    const reload = $('#skelReload');
    if (!list) return;

    const PEOPLE = [
      { n: '林知远', c: '#2f5bd4' },
      { n: '陈见月', c: '#9a4f8f' },
      { n: '周予安', c: '#1f7a63' },
    ];

    const skeletons = () =>
      `<div class="skel-row"><div class="skel-avatar"></div><div class="skel-lines">` +
      `<div class="skel-line skel-line--mid"></div><div class="skel-line skel-line--short"></div></div></div>` +
      `<div class="skel-row"><div class="skel-thumb"></div><div class="skel-lines">` +
      `<div class="skel-line"></div><div class="skel-line skel-line--mid"></div></div></div>` +
      `<div class="skel-row"><div class="skel-avatar"></div><div class="skel-lines">` +
      `<div class="skel-line skel-line--short"></div><div class="skel-line"></div></div></div>`;

    const loaded = () =>
      PEOPLE.map((p, i) =>
        `<div class="loaded-row"><div class="avatar-dot" style="background:${p.c}">${p.n[0]}</div>` +
        `<div style="flex:1"><div style="font-size:13px;font-weight:600">${p.n}</div>` +
        `<div style="font-size:11.5px;color:var(--ink-3)">${['刚刚更新了组件规范', '提交了 3 个改动', '加入了设计系统组'][i]}</div></div></div>`
      ).join('');

    let timer = null;

    function run() {
      clearTimeout(timer);
      list.setAttribute('aria-busy', 'true');
      list.innerHTML = skeletons();
      timer = setTimeout(() => {
        list.setAttribute('aria-busy', 'false');
        list.innerHTML = loaded();
      }, reduceMotion ? 300 : 1900);
    }

    reload.addEventListener('click', run);
    run();
  }

  /* ------------------------------------------------------------
     8. Spinner
     ------------------------------------------------------------ */

  function initSpinner() {
    const btn = $('#spinBtn');
    const text = $('#spinBtnText');
    const btn2 = $('#spinBtn2');
    const inline = $('#spinInline');
    const idle = $('#spinInlineIdle');
    const center = $('#spinCenter');
    if (!btn) return;

    let busy = false;

    btn.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      const original = text.textContent;
      text.innerHTML = '<span class="spinner spinner--sm" style="border-color:rgba(255,255,255,.35);border-top-color:#fff;display:inline-block;vertical-align:-2px;margin-right:7px"></span>拉取中';
      setTimeout(() => {
        text.textContent = original;
        busy = false;
        center.innerHTML = '<span style="font-size:12px;color:var(--ink-3)">已拉取 128 条记录</span>';
        setTimeout(() => { center.innerHTML = ''; }, 2200);
      }, 1800);
    });

    let busy2 = false;
    btn2.addEventListener('click', () => {
      if (busy2) return;
      busy2 = true;
      inline.style.display = 'inline-flex';
      idle.style.display = 'none';
      setTimeout(() => {
        inline.style.display = 'none';
        idle.style.display = '';
        busy2 = false;
      }, 1600);
    });
  }

  /* ------------------------------------------------------------
     9. Progress
     ------------------------------------------------------------ */

  function initProgress() {
    const bar = $('#progBar');
    const pct = $('#progPct');
    const start = $('#progStart');
    const reset = $('#progReset');
    if (!bar) return;

    let raf = null;
    let v = 0;

    function paint() {
      bar.style.width = v + '%';
      pct.textContent = Math.round(v) + '%';
    }

    function stop() { if (raf) { clearInterval(raf); raf = null; } }

    start.addEventListener('click', () => {
      stop();
      v = 0;
      paint();
      raf = setInterval(() => {
        // 不均匀推进：真实的进度从来不是匀速的
        v = Math.min(100, v + Math.random() * 7 + 1.5);
        paint();
        if (v >= 100) { stop(); pct.textContent = '完成'; }
      }, 180);
    });

    reset.addEventListener('click', () => { stop(); v = 0; paint(); });

    paint();
  }

  /* ------------------------------------------------------------
     10. Empty state
     ------------------------------------------------------------ */

  function initEmptyState() {
    const slot = $('#emptySlot');
    if (!slot) return;
    const initial = slot.innerHTML;

    slot.addEventListener('click', e => {
      const btn = e.target.closest('#emptyCreate');
      if (!btn) return;
      slot.innerHTML =
        '<div class="item-list">' +
        ['design-system', 'marketing-site', '内部工具'].map((n, i) =>
          `<div class="item-list__row"><span class="item-dot"></span>` +
          `<span style="flex:1;font-weight:500">${n}</span>` +
          `<span style="font-family:var(--font-mono);font-size:11px;color:var(--ink-3)">${i + 1} 个文件</span></div>`
        ).join('') +
        '</div><button class="btn btn--link" id="emptyAgain" style="margin-top:6px">清空，回到空状态</button>';

      $('#emptyAgain').addEventListener('click', () => { slot.innerHTML = initial; });
    });
  }

  /* ------------------------------------------------------------
     遮罩层通用：打开 / 关闭 + Esc
     所有浮层登记到 openStack，Esc 只作用于最上面那一个，
     不依赖焦点落在哪里。
     ------------------------------------------------------------ */

  const openStack = [];

  function makeOverlay(opts) {
    const { stage, scrim, box, trigger, onOpen, onClose, escCloses = true, outsideCloses = true } = opts;

    let open = false;
    let lastFocus = null;

    function show() {
      if (open) return;
      open = true;
      lastFocus = document.activeElement;
      if (scrim) { scrim.classList.add('is-open'); }
      box.classList.add('is-open');
      if (openStack.indexOf(api) === -1) openStack.push(api);
      if (onOpen) onOpen();
      stage.__activeOverlay = api;
    }

    function hide() {
      if (!open) return;
      open = false;
      if (scrim) { scrim.classList.remove('is-open'); }
      box.classList.remove('is-open');
      const at = openStack.indexOf(api);
      if (at !== -1) openStack.splice(at, 1);
      if (onClose) onClose();
      if (stage.__activeOverlay === api) stage.__activeOverlay = null;
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }

    if (trigger) trigger.addEventListener('click', show);

    if (outsideCloses && scrim) {
      scrim.addEventListener('click', hide);
    }

    const api = { show, hide, isOpen: () => open, escCloses, stage, onEsc: escCloses ? hide : null };
    return api;
  }

  // Esc：只关最上层的那个，而且如果它声明不响应 Esc，就什么都不做
  function keyEsc(e) {
    if (e.key !== 'Escape') return;
    const top = openStack[openStack.length - 1];
    if (!top) return;
    if (top.escCloses) {
      e.preventDefault();
      top.hide();
    } else {
      // 明确吃掉这次 Esc：下面的浮层也不该被关掉
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /* ------------------------------------------------------------
     11/12. Modal 与 Alert dialog
     ------------------------------------------------------------ */

  const overlays = {};

  function initModal() {
    const stage = $('#stage-modal');
    if (!stage) return;
    const ov = makeOverlay({
      stage,
      scrim: $('#modalScrim'),
      box: $('#modalBox'),
      trigger: $('#modalOpen'),
      onOpen: () => setTimeout(() => $('#projName').select(), 180),
    });
    $$('[data-close="modal"]').forEach(b => b.addEventListener('click', ov.hide));
    overlays.modal = ov;
  }

  function initAlertDialog() {
    const stage = $('#stage-alert');
    if (!stage) return;
    const result = $('#alertResult');

    const ov = makeOverlay({
      stage,
      scrim: $('#alertScrim'),
      box: $('#alertBox'),
      trigger: $('#alertOpen'),
      escCloses: false,      // 关键：Esc 关不掉
      outsideCloses: false,  // 点外面也关不掉
      onOpen: () => {
        result.textContent = '';
        setTimeout(() => {
          const cancel = $('[data-close="alert"]', $('#alertBox'));
          if (cancel) cancel.focus({ preventScroll: true });
        }, 180);
      },
    });

    $$('[data-close="alert"]').forEach(b => {
      b.addEventListener('click', () => {
        ov.hide();
        result.textContent = '已取消，什么都没删除。';
      });
    });

    $('#alertConfirm').addEventListener('click', () => {
      ov.hide();
      result.textContent = '已永久删除。';
    });

    // Esc 在这里毫无反应 —— 这正是演示的重点
    stage.addEventListener('keydown', e => {
      if (e.key === 'Escape' && ov.isOpen()) e.stopPropagation();
    });

    overlays.alert = ov;
  }

  /* ------------------------------------------------------------
     13. Drawer
     ------------------------------------------------------------ */

  function initDrawer() {
    const stage = $('#stage-drawer');
    if (!stage) return;
    const ov = makeOverlay({
      stage,
      scrim: $('#drawerScrim'),
      box: $('#drawerBox'),
      trigger: $('#drawerOpen'),
    });
    $$('[data-close="drawer"]').forEach(b => b.addEventListener('click', ov.hide));
    overlays.drawer = ov;
  }

  /* ------------------------------------------------------------
     14. Bottom sheet
     ------------------------------------------------------------ */

  function initBottomSheet() {
    const stage = $('#stage-sheet');
    if (!stage) return;
    const box = $('#sheetBox');
    const ov = makeOverlay({
      stage,
      scrim: $('#sheetScrim'),
      box,
      trigger: $('#sheetOpen'),
    });
    overlays.sheet = ov;

    // 往下拖一点就关
    let startY = null;
    let dy = 0;
    box.addEventListener('pointerdown', e => {
      if (!ov.isOpen()) return;
      if (e.target.closest('.sheet__grab') || e.target === box) {
        startY = e.clientY;
        dy = 0;
        box.style.transition = 'none';
      }
    });
    window.addEventListener('pointermove', e => {
      if (startY === null) return;
      dy = Math.max(0, e.clientY - startY);
      box.style.transform = `translateY(${dy}px)`;
    });
    window.addEventListener('pointerup', () => {
      if (startY === null) return;
      box.style.transition = '';
      if (dy > 50) { box.style.transform = ''; ov.hide(); }
      else { box.style.transform = ''; }
      startY = null;
    });
  }

  /* ------------------------------------------------------------
     15. Action sheet
     ------------------------------------------------------------ */

  function initActionSheet() {
    const stage = $('#stage-action');
    if (!stage) return;
    const box = $('#actionBox');
    const ov = makeOverlay({
      stage,
      scrim: $('#actionScrim'),
      box,
      trigger: $('#actionOpen'),
    });
    $$('[data-close="action"]').forEach(b => b.addEventListener('click', ov.hide));
    $$('.action-sheet__item', box).forEach(b => {
      b.addEventListener('click', () => {
        b.textContent = b.dataset.action + ' ✓';
        setTimeout(() => ov.hide(), 260);
      });
    });
    overlays.action = ov;
  }

  /* ------------------------------------------------------------
     16. Lightbox
     ------------------------------------------------------------ */

  function initLightbox() {
    const strip = $('#thumbStrip');
    if (!strip) return;

    // 用 SVG 造三张"照片"，不依赖外网
    const art = [
      { a: '#1b3b8f', b: '#6d9ee8', t: '海岸线', s: '长曝光 · 30s' },
      { a: '#7a3b2e', b: '#d99a6c', t: '正午的墙', s: 'f/2.8 · 1/500' },
      { a: '#21503f', b: '#8fc9a8', t: '温室', s: '逆光 · 35mm' },
    ];

    const make = (i, w, h) => {
      const p = art[i];
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient>` +
        `<radialGradient id="v" cx=".3" cy=".25" r=".8">` +
        `<stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
        `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
        `<rect width="${w}" height="${h}" fill="url(#v)"/>` +
        `<path d="M0 ${h * 0.72} Q ${w * 0.3} ${h * 0.58} ${w * 0.55} ${h * 0.74} T ${w} ${h * 0.66} V ${h} H 0 Z" fill="#000" opacity=".28"/>` +
        `<circle cx="${w * 0.74}" cy="${h * 0.26}" r="${w * 0.06}" fill="#fff" opacity=".5"/>` +
        `<text x="${w * 0.06}" y="${h - 16}" font-family="monospace" font-size="13" fill="#fff" opacity=".55">${p.t}</text>` +
        `</svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    };

    strip.innerHTML = art.map((p, i) =>
      `<button class="thumb" data-i="${i}" aria-label="查看：${p.t}"><img src="${make(i, 200, 200)}" alt="${p.t}"></button>`
    ).join('');

    const box = $('#lbOverlay');
    const img = $('#lbImg');
    const count = $('#lbCount');
    let cur = 0;
    let lastFocus = null;

    function paint() {
      img.src = make(cur, 1200, 800);
      img.alt = art[cur].t + ' — ' + art[cur].s;
      count.textContent = `${cur + 1} / ${art.length}`;
    }

    function open(i) {
      cur = i;
      lastFocus = document.activeElement;
      paint();
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      $('#lbClose').focus({ preventScroll: true });
    }
    function close() {
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }
    function step(d) { cur = (cur + d + art.length) % art.length; paint(); }

    strip.addEventListener('click', e => {
      const t = e.target.closest('.thumb');
      if (t) open(Number(t.dataset.i));
    });
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => step(-1));
    $('#lbNext').addEventListener('click', () => step(1));
    box.addEventListener('click', e => { if (e.target === box) close(); });

    // 只在这个舞台有焦点时接管方向键
    document.addEventListener('keydown', e => {
      if (!box.classList.contains('is-open')) return;
      const inStage = e.target.closest && e.target.closest('#stage-lightbox');
      if (!inStage && e.target !== document.body) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  /* ------------------------------------------------------------
     17. Command palette
     ------------------------------------------------------------ */

  function initPalette() {
    const stage = $('#stage-palette');
    if (!stage) return;

    const box = $('#paletteBox');
    const input = $('#paletteInput');
    const list = $('#paletteList');
    const scrim = $('#paletteScrim');
    const result = $('#paletteResult');

    const CMDS = [
      { icon: 'folder', label: '打开最近项目', hint: '⌘O', group: '导航' },
      { icon: 'search', label: '搜索全部文档', hint: '⌘F', group: '导航' },
      { icon: 'plus', label: '新建部署', hint: '⌘N', group: '操作' },
      { icon: 'settings', label: '切换到深色主题', hint: '', group: '操作' },
      { icon: 'user', label: '邀请成员', hint: '', group: '操作' },
      { icon: 'download', label: '导出为 Markdown', hint: '', group: '操作' },
      { icon: 'trash', label: '清空回收站', hint: '', group: '危险' },
    ];

    let filtered = CMDS.slice();
    let active = 0;
    let open = false;
    let lastFocus = null;

    function paint() {
      if (!filtered.length) {
        list.innerHTML = '<div class="palette__empty">没有匹配的命令</div>';
        return;
      }
      let html = '';
      let lastGroup = '';
      filtered.forEach((c, i) => {
        if (c.group !== lastGroup) {
          lastGroup = c.group;
        }
        html += `<div class="palette__item${i === active ? ' is-active' : ''}" role="option" data-i="${i}">` +
          `<svg viewBox="0 0 24 24"><use href="#i-${c.icon}"/></svg>` +
          `<span>${c.label}</span>` +
          (c.hint ? `<kbd>${c.hint}</kbd>` : '') +
          `</div>`;
      });
      list.innerHTML = html;
      const el = $('.palette__item.is-active', list);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }

    function filter() {
      const q = input.value.trim().toLowerCase();
      filtered = q ? CMDS.filter(c => c.label.toLowerCase().includes(q)) : CMDS.slice();
      active = 0;
      paint();
    }

    function show() {
      if (open) return;
      open = true;
      lastFocus = document.activeElement;
      scrim.classList.add('is-open');
      box.classList.add('is-open');
      input.value = '';
      filter();
      setTimeout(() => input.focus({ preventScroll: true }), 60);
    }

    function hide() {
      if (!open) return;
      open = false;
      scrim.classList.remove('is-open');
      box.classList.remove('is-open');
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }

    function run(i) {
      const c = filtered[i];
      if (!c) return;
      result.textContent = `执行了「${c.label}」`;
      hide();
      setTimeout(() => { result.textContent = ''; }, 2400);
    }

    $('#paletteOpen').addEventListener('click', show);
    scrim.addEventListener('click', hide);
    input.addEventListener('input', filter);

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        active = Math.min(filtered.length - 1, active + 1);
        paint();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active = Math.max(0, active - 1);
        paint();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        run(active);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hide();
      }
    });

    list.addEventListener('click', e => {
      const item = e.target.closest('.palette__item');
      if (item) run(Number(item.dataset.i));
    });

    // 全局 ⌘K / Ctrl K
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) { hide(); }
        else {
          stage.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
          setTimeout(show, reduceMotion ? 0 : 260);
        }
      }
    });

    paint();
  }

  /* ------------------------------------------------------------
     18. Tooltip
     ------------------------------------------------------------ */

  function initTooltip() {
    $$('#stage-tooltip .tip-anchor').forEach(anchor => {
      let t = null;
      const on = () => {
        clearTimeout(t);
        t = setTimeout(() => anchor.classList.add('is-shown'), 120);
      };
      const off = () => {
        clearTimeout(t);
        anchor.classList.remove('is-shown');
      };
      anchor.addEventListener('mouseenter', on);
      anchor.addEventListener('mouseleave', off);
      anchor.addEventListener('focusin', on);
      anchor.addEventListener('focusout', off);
      anchor.addEventListener('keydown', e => {
        if (e.key === 'Escape') off();
      });
    });
  }

  /* ------------------------------------------------------------
     19. Popover
     ------------------------------------------------------------ */

  function initPopover() {
    const stage = $('#stage-popover');
    if (!stage) return;
    const anchor = $('#popoverAnchor');
    const btn = $('#popoverBtn');
    const box = $('#popoverBox');

    function toggle() {
      const isOpen = box.classList.contains('is-open');
      if (isOpen) { close(); return; }
      box.classList.add('is-open');
      placeNear(stage, box, anchor, { side: 'bottom', align: 'start', gap: 8 });
      btn.setAttribute('aria-expanded', 'true');
      stage.__openPopover = true;
    }
    function close() {
      box.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      stage.__openPopover = false;
    }

    btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });

    // 点别处关闭
    document.addEventListener('click', e => {
      if (!box.classList.contains('is-open')) return;
      if (box.contains(e.target) || btn.contains(e.target)) return;
      close();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && box.classList.contains('is-open')) {
        const inStage = e.target.closest && e.target.closest('#stage-popover');
        if (inStage) { close(); btn.focus({ preventScroll: true }); }
      }
    });
  }

  /* ------------------------------------------------------------
     20. Popconfirm
     ------------------------------------------------------------ */

  function initPopconfirm() {
    const stage = $('#stage-popconfirm');
    if (!stage) return;
    const anchor = $('#pcAnchor');
    const btn = $('#pcBtn');
    const box = $('#pcBox');
    const result = $('#pcResult');

    function close() { box.classList.remove('is-open'); }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (box.classList.contains('is-open')) { close(); return; }
      box.classList.add('is-open');
      placeNear(stage, box, anchor, { side: 'bottom', align: 'start', gap: 8 });
      setTimeout(() => {
        const c = $('[data-pc="no"]', box);
        if (c) c.focus({ preventScroll: true });
      }, 140);
    });

    $$('[data-pc]', box).forEach(b => {
      b.addEventListener('click', () => {
        close();
        result.textContent = b.dataset.pc === 'yes' ? '已移除，可在设置里加回来。' : '没有改动。';
        setTimeout(() => { result.textContent = ''; }, 2600);
      });
    });

    document.addEventListener('click', e => {
      if (!box.classList.contains('is-open')) return;
      if (box.contains(e.target) || btn.contains(e.target)) return;
      close();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && box.classList.contains('is-open')) {
        if (e.target.closest && e.target.closest('#stage-popconfirm')) {
          close();
          btn.focus({ preventScroll: true });
        }
      }
    });
  }

  /* ------------------------------------------------------------
     21. Hover card
     ------------------------------------------------------------ */

  function initHoverCard() {
    const stage = $('#stage-hover');
    if (!stage) return;
    const anchor = $('#hoverAnchor');
    const box = $('#heroBox');
    let enter = null;
    let leave = null;

    const open = () => {
      box.classList.add('is-open');
      placeNear(stage, box, anchor, { side: 'bottom', align: 'start', gap: 10 });
    };
    const close = () => box.classList.remove('is-open');

    anchor.addEventListener('mouseenter', () => {
      clearTimeout(leave);
      enter = setTimeout(open, 380);
    });
    anchor.addEventListener('mouseleave', () => {
      clearTimeout(enter);
      leave = setTimeout(() => {
        if (!box.matches(':hover')) close();
      }, 220);
    });
    box.addEventListener('mouseenter', () => clearTimeout(leave));
    box.addEventListener('mouseleave', () => { leave = setTimeout(close, 200); });

    // 键盘 / 触屏兜底
    anchor.addEventListener('focus', open);
    anchor.addEventListener('blur', close);
    anchor.addEventListener('click', e => {
      e.preventDefault();
      box.classList.contains('is-open') ? close() : open();
    });
  }

  /* ------------------------------------------------------------
     22. Dropdown menu
     ------------------------------------------------------------ */

  function initDropdown() {
    const stage = $('#stage-dropdown');
    if (!stage) return;
    const anchor = $('#ddAnchor');
    const btn = $('#ddBtn');
    const box = $('#ddBox');

    const close = () => {
      box.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (box.classList.contains('is-open')) { close(); return; }
      box.classList.add('is-open');
      placeNear(stage, box, anchor, { side: 'bottom', align: 'end', gap: 6 });
      btn.setAttribute('aria-expanded', 'true');
      setTimeout(() => {
        const first = $('.menu__item', box);
        if (first) first.focus({ preventScroll: true });
      }, 120);
    });

    $$('.menu__item', box).forEach(item => {
      item.addEventListener('click', close);
    });

    document.addEventListener('click', e => {
      if (!box.classList.contains('is-open')) return;
      if (box.contains(e.target) || btn.contains(e.target)) return;
      close();
    });

    box.addEventListener('keydown', e => {
      const items = $$('.menu__item', box);
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus({ preventScroll: true }); }
    });
  }

  /* ------------------------------------------------------------
     23. Context menu
     ------------------------------------------------------------ */

  function initContextMenu() {
    const stage = $('#stage-context');
    if (!stage) return;
    const area = $('#ctxArea');
    const box = $('#ctxBox');

    const close = () => {
      box.classList.remove('is-open');
      area.classList.remove('is-hit');
    };

    area.addEventListener('contextmenu', e => {
      e.preventDefault();
      const sr = stage.getBoundingClientRect();
      box.classList.add('is-open');
      area.classList.add('is-hit');
      box.style.left = Math.min(e.clientX - sr.left, sr.width - box.offsetWidth - 8) + 'px';
      box.style.top = Math.min(e.clientY - sr.top, sr.height - box.offsetHeight - 8) + 'px';
      box.style.right = 'auto';
      box.style.bottom = 'auto';
    });

    $$('.menu__item', box).forEach(item => {
      item.addEventListener('click', () => {
        area.textContent = '执行了「' + item.textContent.trim() + '」';
        close();
        setTimeout(() => { area.textContent = '在这里点右键'; }, 2200);
      });
    });

    document.addEventListener('click', e => {
      if (!box.classList.contains('is-open')) return;
      if (!box.contains(e.target)) close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });
  }

  /* ------------------------------------------------------------
     24. Tour
     ------------------------------------------------------------ */

  function initTour() {
    const stage = $('#stage-tour');
    if (!stage) return;

    const steps = [
      { el: '#tourStep0', title: '工作区切换', desc: '在这里换团队。每个工作区的成员、文件和历史都是独立的。' },
      { el: '#tourStep1', title: '搜索全部内容', desc: '文档、提交、评论都能搜到，不用先想清楚它在哪个项目里。' },
      { el: '#tourStep2', title: '邀请成员', desc: '把同事拉进来之后，他们能看到这里的所有文件。' },
    ];

    const mask = $('#tourMask');
    const pop = $('#tourPop');
    const popTitle = $('#tourTitle');
    const popDesc = $('#tourDesc');
    const popNum = $('#tourStepNum');
    const dots = $('#tourDots');
    const nextBtn = $('#tourNext');
    const startBtn = $('#tourStart');

    let i = 0;
    function paint() {
      const s = steps[i];
      $$('.tour-bar', stage).forEach(b => b.classList.remove('is-spot'));
      const target = $(s.el);
      target.classList.add('is-spot');

      popNum.textContent = `第 ${i + 1} / ${steps.length} 步`;
      popTitle.textContent = s.title;
      popDesc.textContent = s.desc;
      $$('.tour-pop__dot', dots).forEach((d, k) => d.classList.toggle('is-on', k === i));
      nextBtn.textContent = i === steps.length - 1 ? '完成' : '下一步';

      // 气泡跟着高亮元素走
      const sr = stage.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      const top = tr.bottom - sr.top + 10;
      const left = tr.left - sr.left;
      const maxLeft = sr.width - pop.offsetWidth - 10;
      pop.style.top = Math.min(top, sr.height - pop.offsetHeight - 52) + 'px';
      pop.style.left = Math.max(10, Math.min(left, maxLeft)) + 'px';
    }

    function start() {
      i = 0;
      mask.classList.add('is-on');
      pop.classList.add('is-open');
      startBtn.style.display = 'none';
      paint();
    }

    function end() {
      mask.classList.remove('is-on');
      pop.classList.remove('is-open');
      $$('.tour-bar', stage).forEach(b => b.classList.remove('is-spot'));
      startBtn.style.display = '';
    }

    startBtn.addEventListener('click', start);
    $('#tourSkip').addEventListener('click', end);
    nextBtn.addEventListener('click', () => {
      if (i === steps.length - 1) { end(); return; }
      i++;
      paint();
    });
  }

  /* ------------------------------------------------------------
     25. Coachmark
     ------------------------------------------------------------ */

  function initCoachmark() {
    const stage = $('#stage-coach');
    if (!stage) return;
    const anchor = $('#coachAnchor');
    const box = $('#coachBox');

    function open() {
      box.classList.add('is-open');
      stage.classList.add('is-coached');
      placeNear(stage, box, anchor, { side: 'top', align: 'start', gap: 12 });
      // 气泡的尖角要对准按钮中线，而不是它自己的左边缘
      const sr = stage.getBoundingClientRect();
      const ar = anchor.getBoundingClientRect();
      const tip = Math.max(12, Math.min(ar.left + ar.width / 2 - sr.left - box.getBoundingClientRect().left - 6, box.offsetWidth - 24));
      box.style.setProperty('--tip-x', tip + 'px');
    }
    function close() {
      box.classList.remove('is-open');
      stage.classList.remove('is-coached');
    }

    $('#coachTarget').addEventListener('click', () => {
      // 点目标本身也算"知道了"
      close();
    });
    $('#coachSkip').addEventListener('click', close);
    $('#coachOk').addEventListener('click', close);
    $('#coachReset').addEventListener('click', open);

    // 初次进入时出现一次
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setTimeout(open, 420);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(stage);
  }

  /* ------------------------------------------------------------
     启动
     ------------------------------------------------------------ */

  function boot() {
    wireVolumeSwitch();
    wireSearch();
    wireHashFlash();

    // 恢复上次看的卷；地址里带锚点时以锚点所属的卷为准
    let startVol = 'overlay';
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el && el.classList.contains('spec')) startVol = el.dataset.vol || 'overlay';
    } else {
      try {
        const saved = sessionStorage.getItem('ui-gallery-vol');
        if (saved && VOLUMES[saved]) startVol = saved;
      } catch (e) { /* 忽略 */ }
    }
    setVolume(startVol, { silent: true });
    setSearchPlaceholder();

    initToast();
    initSnackbar();
    initInlineAlert();
    initBanner();
    initNotification();
    initBadge();
    initSkeleton();
    initSpinner();
    initProgress();
    initEmptyState();
    initModal();
    initAlertDialog();
    initDrawer();
    initBottomSheet();
    initActionSheet();
    initLightbox();
    initPalette();
    initTooltip();
    initPopover();
    initPopconfirm();
    initHoverCard();
    initDropdown();
    initContextMenu();
    initTour();
    initCoachmark();

    document.addEventListener('keydown', keyEsc);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
