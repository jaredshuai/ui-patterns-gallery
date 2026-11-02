/* ============================================================
   卷二 · 表单与输入 — 交互
   每个演示都要能真的输入、失焦、提交、报错。
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  /* 演示用的延时：让状态变化能被看见，但不要慢到烦人 */
  const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? Math.min(ms, 120) : ms));

  /* ------------------------------------------------------------
     1. Select
     ------------------------------------------------------------ */

  function initSelect() {
    const sel = $('#selTz');
    const out = $('#selOut');
    if (!sel) return;
    sel.addEventListener('change', () => {
      out.textContent = '当前：' + sel.value;
    });
  }

  /* ------------------------------------------------------------
     2. Combobox —— 输入过滤 + 方向键 + activedescendant
     ------------------------------------------------------------ */

  function initCombobox() {
    const input = $('#cbInput');
    const list = $('#cbList');
    const out = $('#cbOut');
    if (!input) return;

    const CITIES = [
      '上海', '上饶', '深圳', '沈阳', '石家庄', '苏州', '台北', '天津',
      '武汉', '无锡', '乌鲁木齐', '温州', '西安', '厦门', '西宁', '徐州',
      '香港', '湘潭', '扬州', '烟台', '银川', '宜昌', '郑州', '珠海',
      '重庆', '长沙', '长春', '成都', '常州', '赤峰', '北京', '北海',
      '杭州', '合肥', '呼和浩特', '哈尔滨', '海口', '济南', '济宁', '昆明',
    ];

    let matches = [];
    let active = -1;

    const isOpen = () => list.classList.contains('is-open');

    function open() {
      if (isOpen()) return;
      list.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
    }

    function close() {
      list.classList.remove('is-open');
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }

    function paint() {
      if (!matches.length) {
        list.innerHTML = '<div class="listbox__empty">没有匹配的城市</div>';
        return;
      }
      list.innerHTML = matches.map((c, i) =>
        `<div class="listbox__opt${i === active ? ' is-active' : ''}" role="option"`
        + ` id="cb-opt-${i}" data-i="${i}" aria-selected="${i === active}">`
        + `<svg viewBox="0 0 24 24"><use href="#i-check"/></svg>${c}</div>`
      ).join('');

      if (active >= 0) {
        input.setAttribute('aria-activedescendant', 'cb-opt-' + active);
        const el = $(`#cb-opt-${active}`, list);
        if (el) el.scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function filter() {
      const q = input.value.trim();
      matches = q ? CITIES.filter(c => c.includes(q)) : CITIES.slice(0, 12);
      active = matches.length ? 0 : -1;
      paint();
      open();
    }

    function choose(i) {
      if (i < 0 || i >= matches.length) return;
      input.value = matches[i];
      out.textContent = '已选：' + matches[i];
      close();
      input.blur();
    }

    input.addEventListener('focus', filter);
    input.addEventListener('input', filter);

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen()) { filter(); return; }
        active = Math.min(matches.length - 1, active + 1);
        paint();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active = Math.max(0, active - 1);
        paint();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        choose(active);
      } else if (e.key === 'Escape') {
        if (isOpen()) { e.stopPropagation(); close(); }
      }
    });

    // 用 mousedown 抢在 blur 之前，否则点了没反应
    list.addEventListener('mousedown', e => {
      const opt = e.target.closest('.listbox__opt');
      if (!opt) return;
      e.preventDefault();
      choose(Number(opt.dataset.i));
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!list.matches(':hover')) close();
      }, 120);
    });
  }

  /* ------------------------------------------------------------
     3. Radio group
     ------------------------------------------------------------ */

  function initRadio() {
    const out = $('#radioOut');
    if (!out) return;
    $$('input[name="cycle"]').forEach(r => {
      r.addEventListener('change', () => {
        out.textContent = '已选：' + r.value;
      });
    });
  }

  /* ------------------------------------------------------------
     4. Segmented control
     ------------------------------------------------------------ */

  function initSegmented() {
    const preview = $('#segPreview');
    if (!preview) return;

    const VIEWS = {
      '列表': '<div style="width:100%;padding:10px 12px;display:flex;flex-direction:column;gap:7px">'
        + [1, 2, 3].map(() =>
          `<div style="display:flex;gap:8px;align-items:center">
             <span style="width:5px;height:5px;border-radius:50%;background:#1e45c8;flex:none"></span>
             <span style="height:7px;background:#dde3e9;border-radius:2px;flex:1"></span>
           </div>`).join('')
        + '</div>',
      '网格': '<div style="width:100%;padding:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px">'
        + [1, 2, 3, 4, 5, 6].map(() =>
          '<div style="aspect-ratio:1;background:#e4e9ed;border-radius:3px"></div>').join('')
        + '</div>',
      '时间线': '<div style="width:100%;padding:10px 14px;display:flex;flex-direction:column;gap:8px">'
        + [1, 2].map(() =>
          `<div style="display:flex;gap:8px">
             <span style="width:7px;height:7px;border-radius:50%;border:1.5px solid #1e45c8;flex:none;margin-top:2px"></span>
             <span style="height:7px;background:#dde3e9;border-radius:2px;flex:1"></span>
           </div>`).join('')
        + '</div>',
    };

    $$('.seg__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.seg;
        $$('.seg__btn').forEach(b => {
          const on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        preview.innerHTML = VIEWS[v] || v + '视图';
      });
    });
  }

  /* ------------------------------------------------------------
     5. Switch
     ------------------------------------------------------------ */

  function initSwitch() {
    const out = $('#switchOut');
    if (!out) return;

    $$('.switch').forEach(sw => {
      sw.addEventListener('click', () => {
        const now = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', now ? 'true' : 'false');
        const label = sw.getAttribute('aria-label');
        // 立即生效的反馈：没有保存按钮，所以必须让用户看到它生效了
        out.textContent = `${label}已${now ? '开启' : '关闭'} · 改动已保存`;
      });
    });

    // 设置项文字也在点击热区里；只点小开关不该是唯一入口
    $$('.switch-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.switch')) return;
        const sw = $('.switch', row);
        if (sw) sw.click();
      });
    });
  }

  /* ------------------------------------------------------------
     6. Checkbox —— 含 indeterminate
     ------------------------------------------------------------ */

  function initCheckbox() {
    const parent = $('#checkAll');
    const out = $('#checkOut');
    if (!parent) return;

    const children = $$('.child-check');

    function sync() {
      const n = children.filter(c => c.checked).length;
      const total = children.length;

      parent.checked = n === total;
      // indeterminate 不是 HTML 属性，只能这样设
      parent.indeterminate = n > 0 && n < total;
      parent.setAttribute('aria-checked', n === total ? 'true' : n === 0 ? 'false' : 'mixed');

      out.textContent = n === 0 ? '未选任何通知' : `已选 ${n} 项`;
    }

    parent.addEventListener('change', () => {
      children.forEach(c => { c.checked = parent.checked; });
      parent.indeterminate = false;
      sync();
    });

    children.forEach(c => c.addEventListener('change', sync));

    sync();
  }

  /* ------------------------------------------------------------
     7. Placeholder
     ------------------------------------------------------------ */

  function initPlaceholder() {
    const good = $('#phGood');
    const bad = $('#phBad');
    const goodNote = $('#phNote');
    const badNote = $('#phBadNote');
    if (!good) return;

    good.addEventListener('input', () => {
      goodNote.innerHTML = good.value
        ? '还看得见上方常驻的 <b>「邮箱」</b> —— 知道自己在填什么。'
        : '上面这个：标签常驻，占位只给格式参考。';
    });

    bad.addEventListener('input', () => {
      badNote.innerHTML = bad.value
        ? '占位被吃掉了 —— 现在这栏只剩一串字符，<b>没人知道它是邮箱</b>。'
        : '这个只有占位 —— 输入一下就不知道这栏是什么了。';
    });
  }

  /* ------------------------------------------------------------
     8. Password
     ------------------------------------------------------------ */

  function initPassword() {
    const pwd = $('#pwd');
    const toggle = $('#pwdToggle');
    const bars = $$('#pwdBars .pwd-strength__bar');
    const out = $('#pwdOut');
    if (!pwd) return;

    toggle.addEventListener('click', () => {
      const show = pwd.type === 'password';
      pwd.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', show ? 'true' : 'false');
      toggle.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
      pwd.focus({ preventScroll: true });
    });

    function score(v) {
      if (!v) return 0;
      let s = 0;
      if (v.length >= 8) s++;
      if (v.length >= 12) s++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
      if (/\d/.test(v)) s++;
      if (/[^\w\s]/.test(v)) s++;
      // 纯重复或纯序列不算强
      if (/^(.)\1+$/.test(v) || /^0123|1234|abcd/i.test(v)) s = Math.min(s, 1);
      return Math.max(1, Math.min(4, s));
    }

    const LABEL = ['还没输入', '太短，容易被猜到', '一般，还能更稳', '不错', '很强'];
    const CLS = ['', 'is-1', 'is-2', 'is-3', 'is-4'];

    pwd.addEventListener('input', () => {
      const v = pwd.value;
      const s = score(v);
      bars.forEach((b, i) => {
        b.className = 'pwd-strength__bar' + (i < s && s > 0 ? ' ' + CLS[s] : '');
      });
      if (!v) {
        out.textContent = '还没输入';
        out.className = 'fi__msg fi__msg--hint';
      } else {
        out.textContent = LABEL[s] + (v.length < 8 ? ` · 至少还要 ${8 - v.length} 位` : '');
        out.className = 'fi__msg ' + (s <= 1 ? 'fi__msg--error' : s >= 3 ? 'fi__msg--ok' : 'fi__msg--hint');
      }
    });
  }

  /* ------------------------------------------------------------
     9. Validation timing —— 三种时机并排
     ------------------------------------------------------------ */

  function initValidationTiming() {
    const change = $('[data-vt="change"]');
    if (!change) return;

    const blur = $('[data-vt="blur"]');
    const submit = $('[data-vt="submit"]');
    const outOf = k => $(`[data-vt-out="${k}"]`);

    const setMsg = (k, kind, text) => {
      const el = outOf(k);
      el.className = 'vt__state' + (kind ? ' is-' + kind : '');
      el.textContent = text;
      // 错误不能只靠颜色：把 invalid 状态也告诉读屏
      const input = $(`[data-vt="${k}"]`);
      if (input) {
        if (kind === 'err') input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    };

    const check = (k, input, onlyIfTouched) => {
      const v = input.value.trim();
      if (!v) {
        if (onlyIfTouched) setMsg(k, '', '还没填');
        return;
      }
      if (EMAIL_RE.test(v)) setMsg(k, 'ok', '格式正确');
      else setMsg(k, 'err', '缺 @ 或域名');
    };

    // 输入时：每敲一个字符就判 —— 故意做成"烦人"的样子
    change.addEventListener('input', () => {
      const v = change.value;
      change.classList.remove('is-error');
      if (!v) { setMsg('change', '', '还没动'); return; }
      if (EMAIL_RE.test(v)) {
        setMsg('change', 'ok', '格式正确');
      } else {
        change.classList.add('is-error');
        setMsg('change', 'err', '格式不正确，缺 @ 或域名');
      }
    });

    // 失焦时：离开才判
    let blurTouched = false;

    blur.addEventListener('blur', () => {
      blurTouched = true;
      blur.classList.remove('is-error');
      const v = blur.value.trim();
      if (!v) { setMsg('blur', '', '还没填'); return; }
      if (EMAIL_RE.test(v)) {
        setMsg('blur', 'ok', '格式正确');
      } else {
        blur.classList.add('is-error');
        setMsg('blur', 'err', '格式不正确，缺 @ 或域名');
      }
    });

    // 首次失焦后切实时（推荐做法），这里不做，保持对照，只提示
    blur.addEventListener('input', () => {
      if (blurTouched) check('blur', blur, false);
    });

    // 提交时：统一判
    $('#vtSubmit').addEventListener('click', () => {
      submit.classList.remove('is-error');
      const v = submit.value.trim();
      if (!v) {
        submit.classList.add('is-error');
        setMsg('submit', 'err', '提交失败：必填');
      } else if (EMAIL_RE.test(v)) {
        setMsg('submit', 'ok', '提交通过');
      } else {
        submit.classList.add('is-error');
        setMsg('submit', 'err', '提交失败：格式不对');
      }
    });
  }

  /* ------------------------------------------------------------
     10. Error summary
     ------------------------------------------------------------ */

  function initErrorSummary() {
    const form = $('#summaryForm');
    const slot = $('#summarySlot');
    if (!form) return;

    const name = $('#sName');
    const mail = $('#sMail');

    form.addEventListener('submit', e => {
      e.preventDefault();

      const errs = [];
      if (!name.value.trim()) errs.push({ id: 'sName', label: '姓名', msg: '请填写姓名' });
      if (!mail.value.trim()) errs.push({ id: 'sMail', label: '邮箱', msg: '请填写邮箱' });
      else if (!EMAIL_RE.test(mail.value.trim())) errs.push({ id: 'sMail', label: '邮箱', msg: '邮箱格式不正确' });

      [name, mail].forEach(i => i.classList.remove('is-error'));

      if (!errs.length) {
        slot.innerHTML = '';
        slot.innerHTML = '<div class="inline-alert inline-alert--ok" role="status">'
          + '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:#0f7a48;stroke-width:2.2">'
          + '<use href="#i-check"/></svg><div class="inline-alert__text"><strong>提交成功</strong></div></div>';
        return;
      }

      errs.forEach(x => $('#' + x.id).classList.add('is-error'));

      slot.innerHTML =
        `<div class="summary" role="alert" tabindex="-1">
           <p class="summary__title">
             <svg viewBox="0 0 24 24"><use href="#i-alert"/></svg>
             有 ${errs.length} 个问题需要修复
           </p>
           <ul class="summary__list">
             ${errs.map(x => `<li><a href="#${x.id}" data-jump="${x.id}">${x.label}：${x.msg}</a></li>`).join('')}
           </ul>
         </div>`;

      // 摘要本身要能接住焦点，读屏才会念
      const box = $('.summary', slot);
      box.focus({ preventScroll: true });

      $$('[data-jump]', slot).forEach(a => {
        a.addEventListener('click', ev => {
          ev.preventDefault();
          const target = document.getElementById(a.dataset.jump);
          if (target) target.focus({ preventScroll: true });
        });
      });
    });

    [name, mail].forEach(i => {
      i.addEventListener('input', () => i.classList.remove('is-error'));
    });
  }

  /* ------------------------------------------------------------
     11. Required marker —— 纯展示，无需交互
     ------------------------------------------------------------ */

  /* ------------------------------------------------------------
     12. Autosave
     ------------------------------------------------------------ */

  function initAutosave() {
    const input = $('#asInput');
    const body = $('#asBody');
    const state = $('#asState');
    const text = $('#asText');
    if (!input) return;

    let timer = null;
    let seq = 0;

    const setState = (kind, label) => {
      state.className = 'autosave' + (kind ? ' is-' + kind : '');
      text.textContent = label;
    };

    function schedule() {
      clearTimeout(timer);
      setState('saving', '正在保存…');
      seq++;
      const mine = seq;

      timer = setTimeout(() => {
        // 模拟偶尔失败，让"可信的状态"这件事被看见
        const failed = Math.random() < 0.12;
        if (mine !== seq) return;
        if (failed) {
          setState('error', '保存失败，正在重试…');
          setTimeout(() => {
            if (mine !== seq) return;
            setState('saved', '已保存 · 刚刚');
          }, 1400);
        } else {
          setState('saved', '已保存 · 刚刚');
        }
      }, 800);
    }

    input.addEventListener('input', schedule);
    body.addEventListener('input', schedule);
  }

  /* ------------------------------------------------------------
     13. Dirty state
     ------------------------------------------------------------ */

  function initDirtyState() {
    const input = $('#dirtyInput');
    const bar = $('#dirtyBar');
    if (!input) return;

    let saved = input.value;
    let dirty = false;

    function sync() {
      const isDirty = input.value !== saved;
      if (isDirty === dirty) return;
      dirty = isDirty;
      bar.classList.toggle('is-on', dirty);
    }

    input.addEventListener('input', sync);

    $('#dirtySave').addEventListener('click', () => {
      saved = input.value;
      sync();
      const btn = $('#dirtySave');
      btn.textContent = '已保存';
      setTimeout(() => { btn.textContent = '保存'; }, 1200);
    });

    $('#dirtyDiscard').addEventListener('click', () => {
      input.value = saved;
      sync();
    });

    // 真正关标签页时的兜底（只在有未保存改动时挂上）
    window.addEventListener('beforeunload', e => {
      if (!dirty) return;
      e.preventDefault();
      // Safari 仍需要 returnValue；现代浏览器用 preventDefault 即可
      try { e.returnValue = ''; } catch (err) { /* 忽略 */ }
    });
  }

  /* ------------------------------------------------------------
     14. Disabled / readonly 三态
     ------------------------------------------------------------ */

  function initDisabledStates() {
    const btn = $('#dsSubmit');
    const out = $('#dsResult');
    if (!btn) return;

    btn.addEventListener('click', () => {
      // 用 FormData 模拟真实提交：disabled 的字段根本不会出现
      const probe = document.createElement('form');
      const d = document.createElement('input');
      d.name = 'disabled';
      d.value = $('#dsDisabled').value;
      d.disabled = true;

      const r = document.createElement('input');
      r.name = 'readonly';
      r.value = $('#dsReadonly').value;
      r.readOnly = true;

      const a = document.createElement('input');
      a.name = 'aria-disabled';
      a.value = $('#dsAria').value;
      a.setAttribute('aria-disabled', 'true');

      probe.appendChild(d);
      probe.appendChild(r);
      probe.appendChild(a);
      document.body.appendChild(probe);

      const fd = new FormData(probe);
      const sent = [];
      fd.forEach((_, k) => sent.push(k));
      probe.remove();

      out.innerHTML =
        `实际提交的字段：<code>${sent.join(' , ') || '（无）'}</code><br>`
        + `<span style="color:var(--danger)">disabled</span> 的值被静默丢弃了；`
        + `readonly 和 aria-disabled 都发出去了。`;
    });
  }

  /* ------------------------------------------------------------
     15. Optimistic UI
     ------------------------------------------------------------ */

  function initOptimistic() {
    const list = $('#optiList');
    const status = $('#optiStatus');
    if (!list) return;

    let n = 2;

    function add(willFail) {
      n++;
      const title = '新任务 ' + n;

      const row = document.createElement('div');
      row.className = 'opti-item is-pending';
      row.innerHTML = `<span class="opti-item__dot"></span><span class="opti-item__txt">${title}</span>`;
      list.appendChild(row);

      // 立刻显示 = 零感知延迟；请求在后台跑
      status.textContent = `正在同步「${title}」…`;

      wait(1100).then(() => {
        if (willFail) {
          row.className = 'opti-item is-failed';
          row.querySelector('.opti-item__txt').textContent = title + ' · 未保存';
          status.textContent = `「${title}」没保存成功，已标红。点一下可以移除。`;
          // 可点就要可聚焦：键盘用户也得能移除失败项
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          row.setAttribute('aria-label', title + ' · 未保存，按回车移除');
          let removed = false;
          const remove = () => {
            if (removed) return;
            removed = true;
            row.classList.add('is-out');
            setTimeout(() => row.remove(), reduceMotion ? 0 : 200);
            status.textContent = '已移除失败的那一条，其余不受影响。';
          };
          row.addEventListener('click', remove);
          row.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              remove();
            }
          });
        } else {
          row.classList.remove('is-pending');
          status.textContent = `「${title}」已同步。`;
        }
      });
    }

    $('#optiAdd').addEventListener('click', () => add(false));
    $('#optiFail').addEventListener('click', () => add(true));
  }

  /* ------------------------------------------------------------
     16. OTP
     ------------------------------------------------------------ */

  function initOtp() {
    const group = $('#otpGroup');
    const out = $('#otpOut');
    if (!group) return;

    const boxes = $$('.otp__box', group);

    function paint() {
      const filled = boxes.filter(b => b.value).length;
      group.classList.remove('is-error');
      boxes.forEach(b => b.classList.toggle('is-filled', !!b.value));

      if (filled < boxes.length) {
        out.textContent = `还差 ${boxes.length - filled} 位`;
        out.className = 'fi__msg fi__msg--hint';
      } else {
        const code = boxes.map(b => b.value).join('');
        if (code === '123456') {
          out.textContent = '验证码正确';
          out.className = 'fi__msg fi__msg--ok';
        } else {
          out.textContent = '验证码不对，试试 123456';
          out.className = 'fi__msg fi__msg--error';
          group.classList.add('is-error');
        }
      }
    }

    boxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        // 只留最后一位数字
        box.value = box.value.replace(/\D/g, '').slice(-1);
        if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
        paint();
      });

      box.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          e.preventDefault();
          boxes[i - 1].value = '';
          boxes[i - 1].focus();
          paint();
        } else if (e.key === 'ArrowLeft' && i > 0) {
          e.preventDefault();
          boxes[i - 1].focus();
        } else if (e.key === 'ArrowRight' && i < boxes.length - 1) {
          e.preventDefault();
          boxes[i + 1].focus();
        }
      });

      // 粘贴整串
      box.addEventListener('paste', e => {
        const cb = e.clipboardData || (window.clipboardData);
        const txt = cb ? cb.getData('text') : '';
        const digits = (txt || '').replace(/\D/g, '');
        if (!digits) return;
        e.preventDefault();
        boxes.forEach((b, k) => { b.value = digits[k] || ''; });
        const nextEmpty = boxes.findIndex(b => !b.value);
        (nextEmpty === -1 ? boxes[boxes.length - 1] : boxes[nextEmpty]).focus();
        paint();
      });
    });

    $('#otpReset').addEventListener('click', () => {
      boxes.forEach(b => { b.value = ''; });
      boxes[0].focus();
      paint();
    });

    paint();
  }

  /* ------------------------------------------------------------
     17. Dropzone
     ------------------------------------------------------------ */

  function initDropzone() {
    const zone = $('#dropzoneArea');
    const list = $('#fileList');
    if (!zone) return;

    // dragleave 会因为子元素冒泡而抖动，用计数器抵消
    let depth = 0;

    const fmt = bytes => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    };

    function addFiles(files) {
      Array.from(files).forEach(f => {
        const row = document.createElement('div');
        row.className = 'file-row';
        // 文件名来自拖拽/文件系统，不能拼进 innerHTML
        row.innerHTML =
          `<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:var(--ink-3);fill:none;stroke-width:1.6;flex:none">`
          + `<use href="#i-folder"/></svg>`
          + '<span class="file-row__name"></span>'
          + '<span class="file-row__size"></span>';
        $('.file-row__name', row).textContent = f.name || '未命名文件';
        $('.file-row__size', row).textContent = fmt(f.size || 0);

        const bar = document.createElement('div');
        bar.className = 'file-row__bar';
        bar.style.width = '0%';
        row.appendChild(bar);
        list.appendChild(row);

        // 模拟上传进度
        let p = 0;
        const t = setInterval(() => {
          p = Math.min(100, p + 12 + Math.random() * 18);
          bar.style.width = p + '%';
          if (p >= 100) {
            clearInterval(t);
            setTimeout(() => { bar.style.opacity = '0'; }, 400);
          }
        }, 140);
      });
    }

    zone.addEventListener('click', () => {
      // 演示环境不弹真实文件选择框，直接注入两条示例文件
      addFiles([
        { name: 'brand-guide.pdf', size: 2.4 * 1024 * 1024 },
        { name: 'hero@2x.png', size: 860 * 1024 },
      ]);
    });

    zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        zone.click();
      }
    });

    zone.addEventListener('dragenter', e => {
      e.preventDefault();
      depth++;
      zone.classList.add('is-over');
    });

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('is-over');
    });

    zone.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) zone.classList.remove('is-over');
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      depth = 0;
      zone.classList.remove('is-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        addFiles(e.dataTransfer.files);
      } else {
        addFiles([{ name: 'dropped-file.pdf', size: 1.2 * 1024 * 1024 }]);
      }
    });
  }

  /* ------------------------------------------------------------
     18. Slider
     ------------------------------------------------------------ */

  function initSlider() {
    const slider = $('#sliderInput');
    const val = $('#slVal');
    const preview = $('#slPreview');
    if (!slider) return;

    function paint() {
      const v = slider.value;
      val.textContent = v + 'px';
      preview.style.fontSize = v + 'px';
      slider.setAttribute('aria-valuetext', v + ' 像素');
    }

    slider.addEventListener('input', paint);
    paint();
  }

  /* ------------------------------------------------------------
     19. Spinbutton
     ------------------------------------------------------------ */

  function initSpinbutton() {
    const input = $('#spinVal');
    const minus = $('#spinMinus');
    const plus = $('#spinPlus');
    const out = $('#spinOut');
    if (!input) return;

    const MIN = 1;
    const MAX = 9;

    function paint() {
      let v = parseInt(input.value, 10);
      if (isNaN(v)) v = MIN;
      v = Math.max(MIN, Math.min(MAX, v));
      input.value = v;
      input.setAttribute('aria-valuenow', v);
      input.setAttribute('aria-valuemin', MIN);
      input.setAttribute('aria-valuemax', MAX);

      // 到边界就把对应按钮禁掉，避免"点了没反应"
      minus.disabled = v <= MIN;
      plus.disabled = v >= MAX;

      const gb = (v * 0.4).toFixed(1);
      out.textContent = `每份 0.4 GB · 共 ${gb} GB`;
    }

    minus.addEventListener('click', () => { input.value = Number(input.value) - 1; paint(); });
    plus.addEventListener('click', () => { input.value = Number(input.value) + 1; paint(); });
    input.addEventListener('input', paint);
    input.addEventListener('blur', paint);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') { e.preventDefault(); input.value = Number(input.value) + 1; paint(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); input.value = Number(input.value) - 1; paint(); }
    });

    paint();
  }

  /* ------------------------------------------------------------
     20. Search input —— 防抖
     ------------------------------------------------------------ */

  function initSearchInput() {
    const input = $('#searchDemo');
    const log = $('#searchLog');
    const clear = $('#searchClear');
    if (!input) return;

    let timer = null;
    let fired = 0;
    let skipped = 0;

    input.addEventListener('input', () => {
      skipped++;
      clearTimeout(timer);
      if (clear) clear.hidden = !input.value;
      log.textContent = `输入中… 已敲 ${skipped} 下，等待停止`;

      timer = setTimeout(() => {
        fired++;
        const q = input.value.trim();
        if (!q) {
          log.textContent = '等待输入';
          return;
        }
        log.textContent =
          `第 ${fired} 次搜索：「${q}」\n`
          + `共敲了 ${skipped} 下，只发了 ${fired} 次请求`;
      }, 300);
    });

    if (clear) {
      clear.addEventListener('click', () => {
        clearTimeout(timer);
        input.value = '';
        clear.hidden = true;
        log.textContent = '等待输入';
        input.focus({ preventScroll: true });
      });
    }
  }

  /* ------------------------------------------------------------
     21. Submit button —— 防连点
     ------------------------------------------------------------ */

  function initSubmitButton() {
    const btn = $('#subBtn');
    const text = $('#subText');
    const out = $('#subOut');
    if (!btn) return;

    let busy = false;
    let count = 0;

    btn.addEventListener('click', () => {
      if (busy) {
        out.textContent = '请求进行中，这次点击被忽略了';
        return;
      }
      busy = true;
      count++;
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
      text.innerHTML =
        '<span class="spinner spinner--sm" style="border-color:rgba(255,255,255,.35);'
        + 'border-top-color:#fff;display:inline-block;vertical-align:-2px;margin-right:7px"></span>创建中';

      wait(1600).then(() => {
        busy = false;
        btn.classList.remove('is-loading');
        btn.setAttribute('aria-busy', 'false');
        text.textContent = '创建项目';
        out.textContent = `已完成第 ${count} 次提交`;
      });
    });
  }

  /* ------------------------------------------------------------
     启动
     ------------------------------------------------------------ */

  function boot() {
    initSelect();
    initCombobox();
    initRadio();
    initSegmented();
    initSwitch();
    initCheckbox();
    initPlaceholder();
    initPassword();
    initValidationTiming();
    initErrorSummary();
    initAutosave();
    initDirtyState();
    initDisabledStates();
    initOptimistic();
    initOtp();
    initDropzone();
    initSlider();
    initSpinbutton();
    initSearchInput();
    initSubmitButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
