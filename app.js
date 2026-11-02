/* ============================================================
   界面模式图鉴 — 交互
   每个演示都是真实可用的：能开、能关、能确认、能撤销。
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 只滚列表自己，不碰窗口。scrollIntoView 会连带滚动所有祖先 —— 隐藏的命令面板在初始化时
  // 调它，曾把整页从顶部拽到 Lightbox 附近（约 11000px）。
  function keepInList(list, el) {
    const lr = list.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.top < lr.top) list.scrollTop -= lr.top - er.top;
    else if (er.bottom > lr.bottom) list.scrollTop += er.bottom - lr.bottom;
  }

  /* ------------------------------------------------------------
     0. 索引导航 + 搜索
     ------------------------------------------------------------ */

  const specs = $$('.spec');
  const indexEl = $('#index');

  /* 分卷：每组属于哪一卷 */
  const VOLUMES = {
    overlay: { btn: '卷一 · 浮层', short: '浮层', placeholder: '搜索 toast、遮罩、确认…', hint: '试试 toast、遮罩 或 确认。' },
    form: { btn: '卷二 · 表单', short: '表单', placeholder: '搜索 select、校验、只读…', hint: '试试 select、校验 或 日期。' },
    nav: { btn: '卷三 · 导航', short: '导航', placeholder: '搜索 tabs、分页、步骤…', hint: '试试 tabs、分页 或 手风琴。' },
  };

  const GROUPS = [
    { vol: 'overlay', name: '提示与反馈', ids: ['toast', 'snackbar', 'inline-alert', 'banner', 'notification', 'badge'] },
    { vol: 'overlay', name: '加载与空态', ids: ['skeleton', 'spinner', 'progress', 'empty-state'] },
    { vol: 'overlay', name: '遮罩层', ids: ['modal', 'alert-dialog', 'drawer', 'bottom-sheet', 'action-sheet', 'lightbox', 'command-palette'] },
    { vol: 'overlay', name: '锚定浮层', ids: ['tooltip', 'popover', 'popconfirm', 'hover-card', 'dropdown-menu', 'context-menu'] },
    { vol: 'overlay', name: '引导', ids: ['tour', 'coachmark'] },

    { vol: 'form', name: '选择控件', ids: ['select', 'combobox', 'radio-group', 'segmented-control', 'switch', 'checkbox'] },
    { vol: 'form', name: '输入与文本', ids: ['placeholder', 'password-input', 'search-input', 'otp-input', 'slider', 'spinbutton', 'date-input', 'character-count'] },
    { vol: 'form', name: '校验与反馈', ids: ['validation-timing', 'error-summary', 'required-marker', 'autosave', 'dirty-state'] },
    { vol: 'form', name: '状态与提交', ids: ['disabled-states', 'optimistic-ui', 'submit-button', 'dropzone'] },

    { vol: 'nav', name: '内容组织', ids: ['tabs', 'accordion'] },
    { vol: 'nav', name: '翻页与流程', ids: ['pagination', 'infinite-scroll', 'stepper'] },
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

  // 导语里的「N 个概念」按页面上实际的条目数填，加减条目不用再手改数字
  function fillLedeCounts() {
    $$('[data-count]').forEach(b => {
      b.textContent = String(specsIn(b.dataset.count).length);
    });
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
    // 锚点跳到另一卷时也要换占位和提示，不只是点卷别按钮
    setSearchPlaceholder();

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

  // 搜索框占位和「没有结果」的提示随卷变化
  function setSearchPlaceholder() {
    const input = $('#search');
    const v = VOLUMES[currentVol];
    if (!input || !v) return;
    input.placeholder = v.placeholder;
    const hint = $('#noResultHint');
    if (hint) hint.textContent = v.hint;
  }

  // 窄屏目录：左栏索引在 1080px 以下是隐藏的，这里把同一份索引浮出来，不另维护一份
  function wireIndexToggle() {
    const btn = $('#indexToggle');
    if (!btn) return;
    const wide = window.matchMedia('(min-width: 1081px)');
    const isOpen = () => document.body.classList.contains('is-index-open');

    function set(open) {
      document.body.classList.toggle('is-index-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '收起目录' : '目录';
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      set(!isOpen());
      if (!isOpen()) return;
      // 把当前位置露出来，键盘用户直接落在当前条目上
      const cur = $('.index__link.is-active', indexEl) || $('.index__link', indexEl);
      if (cur) {
        keepInList(indexEl, cur);
        cur.focus({ preventScroll: true });
      }
    });

    indexEl.addEventListener('click', e => {
      if (isOpen() && e.target.closest('.index__link')) set(false);
    });
    document.addEventListener('click', e => {
      if (!isOpen() || indexEl.contains(e.target) || btn.contains(e.target)) return;
      set(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !isOpen()) return;
      const inside = indexEl.contains(document.activeElement);
      set(false);
      if (inside) btn.focus({ preventScroll: true });
    });
    // 窗口拉宽回到桌面布局时，索引回到左栏，浮层状态清掉
    const onWide = () => { if (wide.matches) set(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
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

  function positionNear(stage, box, anchor, opt) {
    const o = Object.assign({ side: 'bottom', align: 'start', gap: 8 }, opt || {});
    const sr = stage.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const bw = box.offsetWidth;
    const bh = box.offsetHeight;

    let top, left;

    const pad = 8;
    const anchorTop = ar.top - sr.top;
    const anchorBottom = ar.bottom - sr.top;
    const anchorLeft = ar.left - sr.left;
    const anchorRight = ar.right - sr.left;

    if (o.side === 'bottom') {
      top = anchorBottom + o.gap;
      left = o.align === 'end' ? ar.right - sr.left - bw : ar.left - sr.left;
      // 下方放不下就翻到上方，别让浮层盖住自己的触发按钮
      if (top + bh > sr.height - pad && anchorTop - bh - o.gap >= 0) {
        top = anchorTop - bh - o.gap;
      }
    } else if (o.side === 'top') {
      top = anchorTop - bh - o.gap;
      left = o.align === 'end' ? ar.right - sr.left - bw : ar.left - sr.left;
      if (top < 0 && anchorBottom + o.gap + bh <= sr.height) {
        top = anchorBottom + o.gap;
      }
    } else if (o.side === 'left') {
      top = anchorTop;
      left = ar.left - sr.left - bw - o.gap;
    } else { // right
      top = anchorTop;
      left = ar.right - sr.left + o.gap;
    }

    // 夹在舞台内
    left = Math.max(pad, Math.min(left, sr.width - bw - pad));
    top = Math.max(pad, Math.min(top, sr.height - bh - pad));

    // 夹紧之后如果压到了触发按钮，就换一个放得下的方向。宁可放侧面，也别盖住入口
    const coversAnchor = !(left + bw <= anchorLeft || left >= anchorRight || top + bh <= anchorTop || top >= anchorBottom);
    if (coversAnchor) {
      const spaceBelow = sr.height - anchorBottom - o.gap - pad;
      const spaceAbove = anchorTop - o.gap - pad;
      if (spaceBelow >= bh) {
        top = anchorBottom + o.gap;
      } else if (spaceAbove >= bh) {
        top = anchorTop - bh - o.gap;
      } else {
        const spaceRight = sr.width - anchorRight - o.gap - pad;
        const spaceLeft = anchorLeft - o.gap - pad;
        top = Math.max(pad, Math.min(anchorTop, sr.height - bh - pad));
        if (spaceRight >= bw) left = anchorRight + o.gap;
        else if (spaceLeft >= bw) left = anchorLeft - bw - o.gap;
      }
      left = Math.max(pad, Math.min(left, sr.width - bw - pad));
      top = Math.max(pad, Math.min(top, sr.height - bh - pad));
    }

    box.style.top = top + 'px';
    box.style.left = left + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
    box.style.transform = '';
  }

  // 打开的那一帧页面可能还在滚动/回流（移动端尤其是），再对齐两次，别停在半路
  function placeNear(stage, box, anchor, opt) {
    positionNear(stage, box, anchor, opt);
    cancelAnimationFrame(box.__placeRaf);
    clearTimeout(box.__placeTimer);
    box.__placeRaf = requestAnimationFrame(() => {
      if (box.classList.contains('is-open')) positionNear(stage, box, anchor, opt);
    });
    box.__placeTimer = setTimeout(() => {
      if (box.classList.contains('is-open')) positionNear(stage, box, anchor, opt);
    }, 200);
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

    // 「查看详情」是真链接，不是装饰：展开一段维护说明
    function wireDetail() {
      const link = $('.banner__link', slot);
      const detail = $('.banner__detail', slot);
      if (!link || !detail) return;
      link.addEventListener('click', e => {
        e.preventDefault();
        const opening = detail.hidden;
        detail.hidden = !opening;
        link.setAttribute('aria-expanded', opening ? 'true' : 'false');
        link.textContent = opening ? '收起详情' : '查看详情';
      });
    }

    wireClose();
    wireDetail();

    reset.addEventListener('click', () => {
      slot.innerHTML = original;
      wireClose();
      wireDetail();
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

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusablesIn(box) {
    return $$(FOCUSABLE, box).filter(el => !el.inert && el.offsetParent !== null);
  }

  // 关浮层时要把焦点还回「打开它的那个控件」。Safari/WebKit 点击按钮不会给按钮焦点，
  // 此时 activeElement 是 body，直接记下来就会把焦点还到 body，键盘用户丢掉位置。
  function focusOrigin(trigger) {
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement) return active;
    return trigger || null;
  }

  // 把 Tab 锁在浮层里；关着的时候 inert 会让里面的按钮彻底退出 Tab 顺序。
  // 监听挂在 document 上：Safari 点击按钮不会给按钮焦点，点完浮层里的控件后
  // 焦点会落到 body，这时候挂在浮层上的 keydown 根本收不到 Tab，焦点就跑了。
  function trapTab(box, isOpen) {
    document.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !isOpen()) return;
      const items = focusablesIn(box);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!box.contains(active)) { e.preventDefault(); first.focus({ preventScroll: true }); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus({ preventScroll: true }); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
    });
  }

  function makeOverlay(opts) {
    const { stage, scrim, box, trigger, onOpen, onClose, escCloses = true, outsideCloses = true, initialFocus = null, onEsc = null } = opts;

    let open = false;
    let lastFocus = null;

    box.inert = true;
    if (!box.hasAttribute('tabindex')) box.tabIndex = -1;

    function focusInto() {
      const target = initialFocus ? $(initialFocus, box) : null;
      const el = target || focusablesIn(box)[0] || box;
      el.focus({ preventScroll: true });
    }

    function show() {
      if (open) return;
      open = true;
      lastFocus = focusOrigin(trigger);
      box.inert = false;
      if (scrim) { scrim.classList.add('is-open'); }
      box.classList.add('is-open');
      if (openStack.indexOf(api) === -1) openStack.push(api);
      if (onOpen) onOpen();
      stage.__activeOverlay = api;
      setTimeout(() => { if (open) focusInto(); }, 0);
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
      // 焦点还在浮层里时，WebKit 会在盒子变 inert 之后把它清到 body，
      // 所以先把焦点交还到浮层外面，再设 inert。
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
      box.inert = true;
    }

    if (trigger) trigger.addEventListener('click', show);

    if (outsideCloses && scrim) {
      scrim.addEventListener('click', hide);
    }

    trapTab(box, () => open);

    // onEsc 让浮层自己决定 Esc 的含义（Alert dialog 把它当作「取消」），默认就是关闭
    const api = { show, hide, isOpen: () => open, escCloses, stage, onEsc: escCloses ? (onEsc || hide) : null };
    return api;
  }

  // Esc：只关最上层的那个，而且如果它声明不响应 Esc，就什么都不做
  function keyEsc(e) {
    if (e.key !== 'Escape') return;
    const top = openStack[openStack.length - 1];
    if (!top) return;
    if (top.escCloses) {
      e.preventDefault();
      top.onEsc();
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
      initialFocus: '#projName',
      // 立刻全选，别再延时抢焦点：用户在这 180ms 内按 Tab 会被拽回来
      onOpen: () => $('#projName').select(),
    });
    $$('[data-close="modal"]').forEach(b => b.addEventListener('click', ov.hide));
    overlays.modal = ov;
  }

  function initAlertDialog() {
    const stage = $('#stage-alert');
    if (!stage) return;
    const result = $('#alertResult');

    // 关键：点外面关不掉；Esc 能关，但只能落到「取消」上（WAI-ARIA APG 与 Radix AlertDialog 的行为）
    const cancel = how => {
      ov.hide();
      result.textContent = `已取消${how}，什么都没删除。`;
    };

    const ov = makeOverlay({
      stage,
      scrim: $('#alertScrim'),
      box: $('#alertBox'),
      trigger: $('#alertOpen'),
      outsideCloses: false,
      initialFocus: '[data-close="alert"]',
      onOpen: () => { result.textContent = ''; },
      onEsc: () => cancel('（Esc）'),
    });

    $$('[data-close="alert"]').forEach(b => {
      b.addEventListener('click', () => cancel(''));
    });

    $('#alertConfirm').addEventListener('click', () => {
      ov.hide();
      result.textContent = '已永久删除。';
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
      initialFocus: '#drawerName',
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
      initialFocus: '[data-close="sheet"]',
    });
    $$('[data-close="sheet"]').forEach(b => b.addEventListener('click', ov.hide));
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
      initialFocus: '.action-sheet__item',
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

    box.inert = true;
    trapTab(box, () => box.classList.contains('is-open'));

    function paint() {
      img.src = make(cur, 1200, 800);
      img.alt = art[cur].t + ' — ' + art[cur].s;
      count.textContent = `${cur + 1} / ${art.length}`;
    }

    function open(i, trigger) {
      cur = i;
      lastFocus = focusOrigin(trigger);
      paint();
      box.inert = false;
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      $('#lbClose').focus({ preventScroll: true });
    }
    function close() {
      if (!box.classList.contains('is-open')) return;
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      box.inert = true;
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }
    function step(d) { cur = (cur + d + art.length) % art.length; paint(); }

    strip.addEventListener('click', e => {
      const t = e.target.closest('.thumb');
      if (t) open(Number(t.dataset.i), t);
    });
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => step(-1));
    $('#lbNext').addEventListener('click', () => step(1));
    box.addEventListener('click', e => { if (e.target === box) close(); });

    // 只在这个舞台有焦点时接管方向键
    document.addEventListener('keydown', e => {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      const inStage = e.target.closest && e.target.closest('#stage-lightbox');
      if (!inStage && e.target !== document.body) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
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

    box.inert = true;
    input.setAttribute('aria-expanded', 'false');
    trapTab(box, () => open);

    function paint() {
      if (!filtered.length) {
        list.innerHTML = '<div class="palette__empty">没有匹配的命令</div>';
        input.removeAttribute('aria-activedescendant');
        return;
      }
      let html = '';
      let lastGroup = '';
      filtered.forEach((c, i) => {
        if (c.group !== lastGroup) {
          lastGroup = c.group;
        }
        html += `<div class="palette__item${i === active ? ' is-active' : ''}" role="option" id="palette-opt-${i}" aria-selected="${i === active}" data-i="${i}">` +
          `<svg viewBox="0 0 24 24"><use href="#i-${c.icon}"/></svg>` +
          `<span>${c.label}</span>` +
          (c.hint ? `<kbd>${c.hint}</kbd>` : '') +
          `</div>`;
      });
      list.innerHTML = html;
      input.setAttribute('aria-activedescendant', 'palette-opt-' + active);
      const el = $('.palette__item.is-active', list);
      if (el && open) keepInList(list, el);
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
      lastFocus = focusOrigin($('#paletteOpen'));
      box.inert = false;
      scrim.classList.add('is-open');
      box.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
      input.value = '';
      filter();
      setTimeout(() => { if (open) input.focus({ preventScroll: true }); }, 60);
    }

    function hide() {
      if (!open) return;
      open = false;
      scrim.classList.remove('is-open');
      box.classList.remove('is-open');
      box.inert = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
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

    // ⌘K / Ctrl K 只在焦点落在这块舞台里时接管。整页拦截会吞掉浏览器自己的 Ctrl K（聚焦地址栏/搜索框）。
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        hide();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (!open && !stage.contains(document.activeElement)) return;
        e.preventDefault();
        if (open) hide();
        else show();
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
    const btn = $('#popoverBtn');
    const box = $('#popoverBox');

    box.inert = true;

    function toggle() {
      const isOpen = box.classList.contains('is-open');
      if (isOpen) { close(); return; }
      box.inert = false;
      box.classList.add('is-open');
      // 用按钮本身量位置：外面那层 inline span 的行盒会比按钮高，容易压住触发按钮
      placeNear(stage, box, btn, { side: 'bottom', align: 'start', gap: 8 });
      btn.setAttribute('aria-expanded', 'true');
      stage.__openPopover = true;
    }
    function close() {
      if (!box.classList.contains('is-open')) return;
      const inside = box.contains(document.activeElement);
      box.classList.remove('is-open');
      box.inert = true;
      btn.setAttribute('aria-expanded', 'false');
      stage.__openPopover = false;
      if (inside) btn.focus({ preventScroll: true });
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
        e.preventDefault();
        close();
        btn.focus({ preventScroll: true });
      }
    });
  }

  /* ------------------------------------------------------------
     20. Popconfirm
     ------------------------------------------------------------ */

  function initPopconfirm() {
    const stage = $('#stage-popconfirm');
    if (!stage) return;
    const btn = $('#pcBtn');
    const box = $('#pcBox');
    const result = $('#pcResult');

    box.inert = true;
    btn.setAttribute('aria-expanded', 'false');

    function close() {
      if (!box.classList.contains('is-open')) return;
      const inside = box.contains(document.activeElement);
      box.classList.remove('is-open');
      box.inert = true;
      btn.setAttribute('aria-expanded', 'false');
      if (inside) btn.focus({ preventScroll: true });
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (box.classList.contains('is-open')) { close(); return; }
      box.inert = false;
      box.classList.add('is-open');
      placeNear(stage, box, btn, { side: 'bottom', align: 'start', gap: 8 });
      btn.setAttribute('aria-expanded', 'true');
      setTimeout(() => {
        if (!box.classList.contains('is-open')) return;
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
        e.preventDefault();
        close();
        btn.focus({ preventScroll: true });
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
    // 触屏没有「移开」这个动作，点击必须变成开关；鼠标点击则不该把悬停打开的卡关掉
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let enter = null;
    let leave = null;

    box.inert = true;
    anchor.setAttribute('aria-expanded', 'false');

    const open = () => {
      clearTimeout(leave);
      box.inert = false;
      box.classList.add('is-open');
      placeNear(stage, box, anchor, { side: 'bottom', align: 'start', gap: 10 });
      anchor.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      if (!box.classList.contains('is-open')) return;
      box.classList.remove('is-open');
      box.inert = true;
      anchor.setAttribute('aria-expanded', 'false');
    };

    // 触屏浏览器在 tap 后会补发 mouseenter/mouseleave；若照单全收，第二次 tap 关掉的卡
    // 会被 380ms 的 hover 定时器重新打开。触屏只认 click 开关，不理会合成的鼠标事件。
    anchor.addEventListener('mouseenter', () => {
      if (!canHover) return;
      clearTimeout(leave);
      enter = setTimeout(open, 380);
    });
    anchor.addEventListener('mouseleave', () => {
      if (!canHover) return;
      clearTimeout(enter);
      leave = setTimeout(() => {
        if (!box.matches(':hover')) close();
      }, 220);
    });
    box.addEventListener('mouseenter', () => { if (canHover) clearTimeout(leave); });
    box.addEventListener('mouseleave', () => {
      if (!canHover) return;
      leave = setTimeout(close, 200);
    });

    // 键盘：Tab 聚焦时立刻打开，移走焦点关闭
    anchor.addEventListener('focus', () => {
      if (anchor.matches(':focus-visible')) open();
    });
    anchor.addEventListener('blur', () => {
      if (!box.matches(':hover')) close();
    });
    anchor.addEventListener('click', e => {
      e.preventDefault();
      clearTimeout(enter);
      if (!box.classList.contains('is-open')) { open(); return; }
      if (!canHover) close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && box.classList.contains('is-open')) {
        e.preventDefault();
        close();
      }
    });
  }

  /* ------------------------------------------------------------
     22. Dropdown menu
     ------------------------------------------------------------ */

  function initDropdown() {
    const stage = $('#stage-dropdown');
    if (!stage) return;
    const btn = $('#ddBtn');
    const box = $('#ddBox');

    box.inert = true;

    const close = () => {
      if (!box.classList.contains('is-open')) return;
      const inside = box.contains(document.activeElement);
      box.classList.remove('is-open');
      box.inert = true;
      btn.setAttribute('aria-expanded', 'false');
      if (inside) btn.focus({ preventScroll: true });
    };

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (box.classList.contains('is-open')) { close(); return; }
      box.inert = false;
      box.classList.add('is-open');
      // 贴身按钮量位置，别用外层 inline span（行盒更高，菜单会压住按钮）
      placeNear(stage, box, btn, { side: 'bottom', align: 'end', gap: 6 });
      btn.setAttribute('aria-expanded', 'true');
      setTimeout(() => {
        if (!box.classList.contains('is-open')) return;
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

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && box.classList.contains('is-open')) {
        e.preventDefault();
        close();
      }
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

    box.inert = true;

    function close() {
      if (!box.classList.contains('is-open')) return;
      const inside = box.contains(document.activeElement);
      box.classList.remove('is-open');
      box.inert = true;
      area.classList.remove('is-hit');
      area.setAttribute('aria-expanded', 'false');
      if (inside) area.focus({ preventScroll: true });
    }

    function openAt(x, y) {
      const sr = stage.getBoundingClientRect();
      box.inert = false;
      box.classList.add('is-open');
      area.classList.add('is-hit');
      area.setAttribute('aria-expanded', 'true');
      box.style.left = Math.max(8, Math.min(x - sr.left, sr.width - box.offsetWidth - 8)) + 'px';
      box.style.top = Math.max(8, Math.min(y - sr.top, sr.height - box.offsetHeight - 8)) + 'px';
      box.style.right = 'auto';
      box.style.bottom = 'auto';
      const first = $('.menu__item', box);
      if (first) first.focus({ preventScroll: true });
    }

    area.addEventListener('contextmenu', e => {
      e.preventDefault();
      openAt(e.clientX, e.clientY);
    });

    // 键盘入口：菜单键 / Shift+F10。不能只让右键用户用得上
    area.addEventListener('keydown', e => {
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault();
        const r = area.getBoundingClientRect();
        openAt(r.left + 24, r.top + 24);
      }
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
      if (e.key === 'Escape' && box.classList.contains('is-open')) {
        e.preventDefault();
        close();
      }
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

    pop.inert = true;
    trapTab(pop, () => pop.classList.contains('is-open'));

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
      pop.inert = false;
      mask.classList.add('is-on');
      pop.classList.add('is-open');
      startBtn.style.display = 'none';
      paint();
      nextBtn.focus({ preventScroll: true });
    }

    function end() {
      const wasOpen = pop.classList.contains('is-open');
      mask.classList.remove('is-on');
      pop.classList.remove('is-open');
      pop.inert = true;
      $$('.tour-bar', stage).forEach(b => b.classList.remove('is-spot'));
      startBtn.style.display = '';
      if (wasOpen) startBtn.focus({ preventScroll: true });
    }

    startBtn.addEventListener('click', start);
    $('#tourSkip').addEventListener('click', end);
    nextBtn.addEventListener('click', () => {
      if (i === steps.length - 1) { end(); return; }
      i++;
      paint();
      nextBtn.focus({ preventScroll: true });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && pop.classList.contains('is-open')) {
        e.preventDefault();
        end();
      }
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

    box.inert = true;

    function open() {
      box.inert = false;
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
      if (!box.classList.contains('is-open')) return;
      const inside = box.contains(document.activeElement);
      box.classList.remove('is-open');
      box.inert = true;
      stage.classList.remove('is-coached');
      if (inside) $('#coachTarget').focus({ preventScroll: true });
    }

    $('#coachTarget').addEventListener('click', () => {
      // 点目标本身也算"知道了"
      close();
    });
    $('#coachSkip').addEventListener('click', close);
    $('#coachOk').addEventListener('click', close);
    $('#coachReset').addEventListener('click', open);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && box.classList.contains('is-open')) {
        e.preventDefault();
        close();
      }
    });

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
    wireIndexToggle();

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
    fillLedeCounts();

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
