/* ============================================================
   卷三 · 导航与结构 — 交互
   每个演示都要能用键盘走完：切标签、展开、翻页、加载、分步。
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? Math.min(ms, 120) : ms));

  /* ------------------------------------------------------------
     1. Tabs —— 漫游 tabindex + 方向键自动激活（WAI-ARIA APG）
     ------------------------------------------------------------ */

  function initTabs() {
    const list = $('#stage-tabs [role="tablist"]');
    if (!list) return;
    const tabs = $$('[role="tab"]', list);

    function select(tab, focus) {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        // Tab 键只停在当前标签上；其余标签靠方向键到达
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    }

    tabs.forEach(t => t.addEventListener('click', () => select(t, false)));

    list.addEventListener('keydown', e => {
      const i = tabs.indexOf(document.activeElement);
      if (i === -1) return;
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      e.preventDefault();
      // 内容是现成的，切换没有延迟，所以采用「移到哪就切到哪」的自动激活
      select(next, true);
    });
  }

  /* ------------------------------------------------------------
     2. Accordion —— 原生 details；name 互斥 + 旧浏览器兜底
     ------------------------------------------------------------ */

  function initAccordion() {
    const box = $('#accList');
    if (!box) return;
    const items = $$('details', box);
    const multi = $('#accMulti');

    // 新浏览器靠同名 name 自动互斥；不支持 name 的旧浏览器由这里补上同样的行为
    items.forEach(d => {
      d.addEventListener('toggle', () => {
        if (!d.open || !d.getAttribute('name')) return;
        items.forEach(o => { if (o !== d && o.getAttribute('name') === d.getAttribute('name')) o.open = false; });
      });
    });

    multi.addEventListener('change', () => {
      items.forEach(d => {
        if (multi.checked) d.removeAttribute('name');
        else d.setAttribute('name', 'faq');
      });
      // 切回「只能开一个」时，只保留第一个展开的
      if (!multi.checked) {
        let kept = false;
        items.forEach(d => {
          if (d.open && !kept) kept = true;
          else d.open = false;
        });
      }
    });
  }

  /* ------------------------------------------------------------
     3. Pagination
     ------------------------------------------------------------ */

  function initPagination() {
    const list = $('#pgList');
    const nav = $('#pgNav');
    const status = $('#pgStatus');
    if (!list) return;

    const TOTAL = 47;
    const PER = 5;
    const PAGES = Math.ceil(TOTAL / PER);
    const STATES = ['已发货', '待付款', '已完成', '退款中'];
    let cur = 1;

    // 首页、末页、当前页左右各一页，其余用省略号
    function pagesToShow() {
      const set = new Set([1, PAGES, cur - 1, cur, cur + 1]);
      const arr = Array.from(set).filter(p => p >= 1 && p <= PAGES).sort((a, b) => a - b);
      const out = [];
      arr.forEach((p, k) => {
        if (k && p - arr[k - 1] > 1) out.push('…');
        out.push(p);
      });
      return out;
    }

    function render(focusKey) {
      const from = (cur - 1) * PER + 1;
      const to = Math.min(TOTAL, cur * PER);
      let rows = '';
      for (let n = from; n <= to; n++) {
        rows += `<div class="pg-row"><span class="pg-row__no">#${1000 + n}</span>`
          + `<span class="pg-row__txt">订单 ${n}</span>`
          + `<span class="pg-row__st">${STATES[n % STATES.length]}</span></div>`;
      }
      list.innerHTML = rows;

      let html = `<button class="pg__btn" data-go="prev" aria-label="上一页"${cur === 1 ? ' disabled' : ''}>‹</button>`;
      pagesToShow().forEach(p => {
        if (p === '…') html += '<span class="pg__gap" aria-hidden="true">…</span>';
        else html += `<button class="pg__btn${p === cur ? ' is-cur' : ''}" data-go="${p}" aria-label="第 ${p} 页"`
          + `${p === cur ? ' aria-current="page"' : ''}>${p}</button>`;
      });
      html += `<button class="pg__btn" data-go="next" aria-label="下一页"${cur === PAGES ? ' disabled' : ''}>›</button>`;
      nav.innerHTML = html;

      status.textContent = `第 ${from}–${to} 条，共 ${TOTAL} 条 · 第 ${cur} / ${PAGES} 页`;

      // 按钮是重画的：把焦点还给同一个位置；如果那个按钮刚被禁用（到头了），落到当前页码上
      if (focusKey) {
        let el = $(`[data-go="${focusKey}"]`, nav);
        if (!el || el.disabled) el = $('[aria-current="page"]', nav);
        if (el) el.focus({ preventScroll: true });
      }
    }

    nav.addEventListener('click', e => {
      const b = e.target.closest('[data-go]');
      if (!b || b.disabled) return;
      const go = b.dataset.go;
      if (go === 'prev') cur = Math.max(1, cur - 1);
      else if (go === 'next') cur = Math.min(PAGES, cur + 1);
      else cur = Number(go);
      // 点页码时焦点跟着新的当前页走；点箭头时留在箭头上，方便连续翻
      render(go === 'prev' || go === 'next' ? go : String(cur));
    });

    render(null);
  }

  /* ------------------------------------------------------------
     4. Load more / Infinite scroll
     ------------------------------------------------------------ */

  function initFeed() {
    const box = $('#feedBox');
    const list = $('#feedList');
    const foot = $('#feedFoot');
    const status = $('#feedStatus');
    if (!box) return;

    const TOTAL = 40;
    const BATCH = 10;
    const WHO = ['林知远', '陈见月', '周予安', '许清和'];
    const WHAT = ['更新了组件规范', '提交了 3 个改动', '评论了你的方案', '发布了新版本'];
    let mode = 'button';
    let shown = 0;
    let loading = false;
    let io = null;

    function append(n) {
      let html = '';
      for (let k = shown + 1; k <= Math.min(TOTAL, shown + n); k++) {
        html += `<div class="feed__row"><b>${WHO[k % WHO.length]}</b> ${WHAT[k % WHAT.length]}`
          + `<span class="feed__no">${k}</span></div>`;
      }
      list.insertAdjacentHTML('beforeend', html);
      shown = Math.min(TOTAL, shown + n);
    }

    function paintFoot() {
      if (io) { io.disconnect(); io = null; }
      if (shown >= TOTAL) {
        foot.innerHTML = '<div class="feed__end">已经到底了 · 共 40 条</div>';
        return;
      }
      if (mode === 'button') {
        foot.innerHTML = `<button class="btn btn--ghost btn--sm" id="feedMore">加载更多（还有 ${TOTAL - shown} 条）</button>`;
        $('#feedMore', foot).addEventListener('click', loadMore);
      } else {
        foot.innerHTML = '<div class="feed__sentinel"><span class="spinner spinner--sm"></span>滚到这里会自动加载</div>';
        io = new IntersectionObserver(es => {
          if (es[0].isIntersecting) loadMore();
        }, { root: box, rootMargin: '0px 0px 40px 0px' });
        io.observe(foot.firstElementChild);
      }
    }

    async function loadMore() {
      if (loading || shown >= TOTAL) return;
      loading = true;
      const hadFocus = foot.contains(document.activeElement);
      list.setAttribute('aria-busy', 'true');
      const btn = $('#feedMore', foot);
      if (btn) btn.textContent = '加载中…';
      await wait(600);
      append(BATCH);
      list.setAttribute('aria-busy', 'false');
      status.textContent = `已加载 ${shown} / ${TOTAL} 条`;
      loading = false;
      paintFoot();
      // 按钮被替换或到底消失时，焦点别掉回 body
      if (hadFocus) {
        const again = $('#feedMore', foot);
        (again || box).focus({ preventScroll: true });
      }
    }

    function reset() {
      list.innerHTML = '';
      shown = 0;
      box.scrollTop = 0;
      append(BATCH);
      status.textContent = mode === 'button'
        ? '先显示 10 条，点按钮才加载下一批'
        : '先显示 10 条，滚到列表底部自动加载';
      paintFoot();
    }

    $$('#stage-infinite [data-feed]').forEach(b => {
      b.addEventListener('click', () => {
        mode = b.dataset.feed;
        $$('#stage-infinite [data-feed]').forEach(o => {
          const on = o === b;
          o.classList.toggle('is-on', on);
          o.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        reset();
      });
    });

    reset();
  }

  /* ------------------------------------------------------------
     5. Stepper —— 按顺序走，能回头，不能跳到前面没走过的步
     ------------------------------------------------------------ */

  function initStepper() {
    const form = $('#wizForm');
    if (!form) return;

    const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const items = $$('#stepsBar .steps__item');
    const panes = $$('.wiz__step', form);
    const back = $('#wzBack');
    const next = $('#wzNext');
    const mail = $('#wzMail');
    const name = $('#wzName');
    let cur = 0;
    let reached = 0;
    let done = false;

    const field = (input, msgEl, msg) => {
      const el = $(msgEl);
      el.textContent = msg || '';
      el.className = 'fi__msg' + (msg ? ' fi__msg--error' : '');
      input.classList.toggle('is-error', !!msg);
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      return !msg;
    };

    function validate(step) {
      if (step === 0) {
        const v = mail.value.trim();
        return field(mail, '#wzMailMsg', !v ? '请填写邮箱' : EMAIL_RE.test(v) ? '' : '邮箱格式不对');
      }
      if (step === 1) return field(name, '#wzNameMsg', name.value.trim() ? '' : '请填写称呼');
      return true;
    }

    function paint(focusTitle) {
      items.forEach((li, i) => {
        const btn = $('.steps__btn', li);
        li.classList.toggle('is-done', i < reached || (done && i <= reached));
        li.classList.toggle('is-cur', i === cur && !done);
        if (i === cur && !done) btn.setAttribute('aria-current', 'step');
        else btn.removeAttribute('aria-current');
        // 还没走到的步骤：可聚焦（读屏能读到），但点不了
        if (i > reached) btn.setAttribute('aria-disabled', 'true');
        else btn.removeAttribute('aria-disabled');
      });
      panes.forEach((p, i) => { p.hidden = i !== cur; });

      if (cur === 2) {
        $('#wzSum').textContent = done
          ? `已提交：${mail.value.trim()} · ${name.value.trim()}`
          : `邮箱 ${mail.value.trim()} · 称呼 ${name.value.trim()}。确认无误就提交，有错可以点上面的步骤回去改。`;
      }
      back.hidden = cur === 0 || done;
      next.textContent = done ? '重新开始' : cur === 2 ? '提交' : '下一步';

      if (focusTitle) {
        const t = $('.wiz__title', panes[cur]);
        if (t) t.focus({ preventScroll: true });
      }
    }

    function go(step) {
      cur = step;
      reached = Math.max(reached, step);
      paint(true);
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (done) {
        done = false;
        reached = 0;
        mail.value = '';
        name.value = '';
        go(0);
        return;
      }
      if (!validate(cur)) {
        const bad = $('[aria-invalid="true"]', panes[cur]);
        if (bad) bad.focus();
        return;
      }
      if (cur < 2) go(cur + 1);
      else { done = true; paint(true); }
    });

    // 上一步：只换步骤，不清空任何已填的内容
    back.addEventListener('click', () => { if (cur > 0) go(cur - 1); });

    items.forEach((li, i) => {
      $('.steps__btn', li).addEventListener('click', () => {
        if (done || i > reached || i === cur) return;
        // 往回跳不校验；往前（回到已到达过的步骤）要先过当前步的校验
        if (i > cur && !validate(cur)) return;
        go(i);
      });
    });

    paint(false);
  }

  /* ------------------------------------------------------------
     启动
     ------------------------------------------------------------ */

  function boot() {
    initTabs();
    initAccordion();
    initPagination();
    initFeed();
    initStepper();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
