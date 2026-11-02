import { test, expect } from '@playwright/test';

/* ---------------------------------------------------------------------------
   这些用例保护的是「能点、能关、能用键盘走到」这三件事。
   不要只断言 class：位置遮挡、焦点陷阱和隐藏层抢 Tab 都必须一起卡住。
   --------------------------------------------------------------------------- */

// 打开后允许有一帧的回流/滚动，异步等它摆好；最终不能压住触发器、也不能被舞台裁掉
// 站点的锚点跳转是 scroll-behavior: smooth；等滚动真正停下再做悬停/坐标判断
async function settleScroll(page) {
  await page.evaluate(() => new Promise(resolve => {
    let last = -1;
    let still = 0;
    const tick = () => {
      const y = window.scrollY;
      still = y === last ? still + 1 : 0;
      last = y;
      if (still >= 5) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  }));
}

async function expectPlaced(page, boxSel, triggerSel) {
  await expect.poll(async () => {
    const r = await rects(page, boxSel, triggerSel);
    return r.covers || r.clipped;
  }, { message: boxSel + ' 压住触发器或被舞台裁切' }).toBe(false);
}

const rects = (page, boxSel, triggerSel) => page.evaluate(([b, t]) => {
  const box = document.querySelector(b).getBoundingClientRect();
  const tr = document.querySelector(t).getBoundingClientRect();
  const stage = document.querySelector(b).closest('.stage').getBoundingClientRect();
  return {
    covers: !(box.right <= tr.left || box.left >= tr.right || box.bottom <= tr.top || box.top >= tr.bottom),
    clipped: box.left < stage.left - 0.5 || box.right > stage.right + 0.5 || box.top < stage.top - 0.5 || box.bottom > stage.bottom + 0.5,
  };
}, [boxSel, triggerSel]);

test('卷一：遮罩关闭后不会拦住触发按钮', async ({ page }) => {
  await page.goto('/#toast');

  const overlays = [
    { trigger: '#modalOpen', dialog: '#modalBox', close: '#modalBox [data-close="modal"]' },
    { trigger: '#alertOpen', dialog: '#alertBox', close: '#alertBox [data-close="alert"]' },
    { trigger: '#drawerOpen', dialog: '#drawerBox', close: '#drawerBox [data-close="drawer"]' },
    { trigger: '#sheetOpen', dialog: '#sheetBox', close: '#sheetBox [data-close="sheet"]' },
    { trigger: '#actionOpen', dialog: '#actionBox', close: '#actionBox [data-close="action"]' },
    { trigger: '#paletteOpen', dialog: '#paletteBox', close: null },
  ];

  for (const item of overlays) {
    await page.locator(item.trigger).scrollIntoViewIfNeeded();
    await settleScroll(page);
    // 关闭状态下，触发按钮中心不能被任何透明层接住
    const hit = await page.evaluate(sel => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return el.contains(top);
    }, item.trigger);
    expect(hit, item.trigger + ' 被浮层挡住了').toBe(true);

    await page.locator(item.trigger).click();
    await expect(page.locator(item.dialog)).toHaveClass(/is-open/);

    if (item.close) await page.locator(item.close).first().click();
    else await page.keyboard.press('Escape');
    await expect(page.locator(item.dialog)).not.toHaveClass(/is-open/);

    // 关掉之后必须还能再打开，而不是只关得掉
    await page.locator(item.trigger).click();
    await expect(page.locator(item.dialog)).toHaveClass(/is-open/);
    if (item.close) await page.locator(item.close).first().click();
    else await page.keyboard.press('Escape');
  }
});

test('卷一：Alert dialog 点遮罩不关、Esc 等于取消，Modal 点遮罩能关', async ({ page }) => {
  await page.goto('/#alert-dialog');

  await page.locator('#alertOpen').click();
  await expect(page.locator('#alertBox')).toHaveClass(/is-open/);
  // 初始焦点在「取消」上，手滑按回车不会误删
  await expect(page.locator('#alertBox [data-close="alert"]')).toBeFocused();

  await page.locator('#alertScrim').click({ position: { x: 6, y: 6 } });
  await expect(page.locator('#alertBox')).toHaveClass(/is-open/);

  // Esc 能关，但只能落到「取消」上，焦点回到触发按钮
  await page.keyboard.press('Escape');
  await expect(page.locator('#alertBox')).not.toHaveClass(/is-open/);
  await expect(page.locator('#alertResult')).toContainText('已取消');
  await expect(page.locator('#alertResult')).not.toContainText('永久删除');
  await expect(page.locator('#alertOpen')).toBeFocused();

  await page.locator('#alertOpen').click();
  await page.locator('#alertBox [data-close="alert"]').first().click();
  await expect(page.locator('#alertBox')).not.toHaveClass(/is-open/);
  await expect(page.locator('#alertResult')).toContainText('已取消');

  await page.goto('/#modal');
  await page.locator('#modalOpen').click();
  await page.locator('#modalScrim').click({ position: { x: 6, y: 6 } });
  await expect(page.locator('#modalBox')).not.toHaveClass(/is-open/);
  await expect(page.locator('#modalOpen')).toBeFocused();
});

test('卷一：Modal 焦点陷阱与焦点归位', async ({ page }) => {
  await page.goto('/#modal');
  await page.locator('#modalOpen').click();

  await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('projName');

  // Shift+Tab 从第一个可聚焦元素跳到最后一个，再 Tab 回到第一个
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.getElementById('modalBox').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('projName');

  await page.keyboard.press('Escape');
  await expect(page.locator('#modalBox')).not.toHaveClass(/is-open/);
  await expect(page.locator('#modalOpen')).toBeFocused();

  // 关着的浮层不能靠 Tab 或脚本聚焦进去
  const sneaked = await page.evaluate(() => {
    const btn = document.querySelector('#modalBox button');
    btn.focus();
    return document.activeElement === btn;
  });
  expect(sneaked).toBe(false);
});

test('卷一：消息、加载和空状态都有可见反馈', async ({ page }) => {
  await page.goto('/#toast');

  await page.locator('#toast [data-toast="ok"]').first().click();
  await expect(page.locator('#toastRegion .toast')).toHaveCount(1);
  // WebKit 在这种低帧率下每帧有 0.2px 级取整抖动，点击的「稳定」判定会一直重试，
  // 等到 3s 自动消失就点空了；force 只跳过稳定判定，坐标点击照旧落到 toast 上。
  await page.locator('#toastRegion .toast').click({ force: true });
  await expect(page.locator('#toastRegion .toast')).toHaveCount(0);

  await page.locator('#snackDelete').click();
  await expect(page.locator('#snackItems .item-list__row')).toHaveCount(1);
  await page.locator('#snackRegion .snackbar__action').click();
  await expect(page.locator('#snackItems .item-list__row')).toHaveCount(2);

  await page.locator('#inlineForm button[type="submit"]').click();
  await expect(page.locator('#inlineSlot .inline-alert--error')).toBeVisible();

  await page.locator('#bannerClose').click();
  await expect(page.locator('#bannerSlot .banner')).toHaveCount(0);
  await page.locator('#bannerReset').click();
  await expect(page.locator('#bannerSlot .banner')).toBeVisible();

  // 「查看详情」不是死链接：点开有内容，再点收起
  await page.locator('#bannerSlot .banner__link').click();
  await expect(page.locator('#bannerDetail')).toBeVisible();
  await expect(page.locator('#bannerSlot .banner__link')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#bannerSlot .banner__link').click();
  await expect(page.locator('#bannerDetail')).toBeHidden();

  await page.locator('#notifAdd').click();
  await expect(page.locator('#notifRegion .notif')).toHaveCount(1);
  await page.locator('#notifRegion .notif__close').click();
  await expect(page.locator('#notifRegion .notif')).toHaveCount(0);

  await page.locator('#badgeBell').click();
  await expect(page.locator('#badgeNum')).toBeHidden();
  await page.locator('#badgeAdd').click();
  await expect(page.locator('#badgeNum')).toBeVisible();

  await page.locator('#skelReload').click();
  await expect(page.locator('#skelList .skel-row')).toHaveCount(3);
  await expect(page.locator('#skelList')).toContainText('林知远', { timeout: 3_000 });

  await page.locator('#spinBtn').click();
  await expect(page.locator('#spinBtnText')).toContainText('拉取中');
  await expect(page.locator('#spinCenter')).toContainText('128', { timeout: 3_000 });

  await page.locator('#progStart').click();
  await expect.poll(() => page.locator('#progPct').textContent()).not.toBe('0%');
  await page.locator('#progReset').click();
  await expect(page.locator('#progPct')).toHaveText('0%');

  await page.locator('#emptyCreate').click();
  await expect(page.locator('#emptySlot .item-list__row')).toHaveCount(3);
  await page.locator('#emptyAgain').click();
  await expect(page.locator('#emptyCreate')).toBeVisible();
});

test('卷一：Popover / Popconfirm / Dropdown 不压触发按钮', async ({ page }) => {
  await page.goto('/#popover');

  await page.locator('#popoverBtn').click();
  await expect(page.locator('#popoverBox')).toHaveClass(/is-open/);
  expect((await rects(page, '#popoverBox', '#popoverBtn')).covers).toBe(false);
  await page.locator('#popoverBox .check-row').last().click();
  await expect(page.locator('#popoverBox input').last()).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.locator('#popoverBox')).not.toHaveClass(/is-open/);
  await expect(page.locator('#popoverBtn')).toBeFocused();

  // 键盘路径：Enter 打开，Tab 进入内容，Esc 关闭并回到按钮
  await page.locator('#popoverBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#popoverBox')).toHaveClass(/is-open/);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.getElementById('popoverBox').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#popoverBtn')).toBeFocused();

  await page.goto('/#popconfirm');
  await page.locator('#pcBtn').click();
  await expect(page.locator('#pcBox')).toHaveClass(/is-open/);
  expect((await rects(page, '#pcBox', '#pcBtn')).covers).toBe(false);
  await expect(page.locator('#pcBox [data-pc="no"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pcBox')).not.toHaveClass(/is-open/);
  await expect(page.locator('#pcBtn')).toBeFocused();

  await page.locator('#pcBtn').click();
  await page.locator('#pcBox [data-pc="yes"]').click();
  await expect(page.locator('#pcResult')).toContainText('已移除');

  await page.goto('/#dropdown-menu');
  await page.locator('#ddBtn').click();
  await expect(page.locator('#ddBox')).toHaveClass(/is-open/);
  expect((await rects(page, '#ddBox', '#ddBtn')).covers).toBe(false);
  await expect(page.locator('#ddBox .menu__item').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#ddBox .menu__item').nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ddBox')).not.toHaveClass(/is-open/);
  await expect(page.locator('#ddBtn')).toBeFocused();

  await page.locator('#ddBtn').click();
  await page.locator('#ddBox .menu__item').first().click();
  await expect(page.locator('#ddBox')).not.toHaveClass(/is-open/);
});

test('卷一：Hover card 的鼠标与触屏路径分开处理', async ({ page }) => {
  await page.goto('/#hover-card');
  // 先把锚点摆到视口中间再悬停：hover 自带的滚动会让指针下的元素位移，触发 mouseleave
  await page.locator('#hoverAnchor').evaluate(el => el.scrollIntoView({ block: 'center' }));
  await settleScroll(page);

  const box = page.locator('#heroBox');
  await page.locator('#hoverAnchor').hover();
  await expect(box).toHaveClass(/is-open/, { timeout: 2_000 });

  // 鼠标点击不该把悬停打开的卡立刻关掉
  await page.locator('#hoverAnchor').click();
  await expect(box).toHaveClass(/is-open/);

  await page.keyboard.press('Escape');
  await expect(box).not.toHaveClass(/is-open/);

  // 点击必须立刻打开，不能等 380ms 的 hover 延时来兜底
  await page.locator('#hoverAnchor').click();
  expect(await box.evaluate(el => el.classList.contains('is-open'))).toBe(true);
  await expect(box).toHaveClass(/is-open/);

  await page.mouse.move(4, 4);
  await expect(box).not.toHaveClass(/is-open/, { timeout: 2_000 });
});

test('卷一：右键菜单有键盘入口，Tour 有 Esc 与焦点', async ({ page }) => {
  await page.goto('/#context-menu');

  await page.locator('#ctxArea').click({ button: 'right' });
  await expect(page.locator('#ctxBox')).toHaveClass(/is-open/);
  await expect(page.locator('#ctxBox .menu__item').first()).toBeFocused();
  await page.locator('#ctxBox .menu__item').first().click();
  await expect(page.locator('#ctxArea')).toContainText('执行了');

  // 键盘用户：Shift+F10 也能打开，Esc 关闭并把焦点还给区域
  await page.locator('#ctxArea').focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('#ctxBox')).toHaveClass(/is-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#ctxBox')).not.toHaveClass(/is-open/);
  await expect(page.locator('#ctxArea')).toBeFocused();

  await page.goto('/#tour');
  await settleScroll(page);
  // 把整个舞台放在视口中间，聚光灯和「演示引导」都在可测范围内
  await page.locator('#stage-tour').evaluate(el => el.scrollIntoView({ block: 'center' }));
  await settleScroll(page);
  await page.locator('#tourStart').click();
  await settleScroll(page);
  await expect(page.locator('#tourMask')).toHaveClass(/is-on/);
  await expect(page.locator('#tourNext')).toBeFocused();

  // 聚光灯要真的在遮罩之上，否则高亮元素会一起被压暗
  const spot = await page.evaluate(() => {
    const bar = document.getElementById('tourStep0');
    const r = bar.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return bar.contains(top);
  });
  expect(spot).toBe(true);

  await page.locator('#tourNext').click();
  await expect(page.locator('#tourStepNum')).toHaveText('第 2 / 3 步');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tourMask')).not.toHaveClass(/is-on/);
  await expect(page.locator('#tourPop')).not.toHaveClass(/is-open/);
  await expect(page.locator('#tourStart')).toBeVisible();
  await expect(page.locator('#tourStart')).toBeFocused();

  // 跳过路径也能完整退出
  await page.locator('#tourStart').click();
  await page.locator('#tourSkip').click();
  await expect(page.locator('#tourPop')).not.toHaveClass(/is-open/);
});

test('卷一：命令面板的键盘、ARIA 与尺寸', async ({ page }) => {
  await page.goto('/#command-palette');

  await page.locator('#paletteOpen').click();
  await expect(page.locator('#paletteBox')).toHaveClass(/is-open/);
  await expect(page.locator('#paletteInput')).toBeFocused();
  await expect(page.locator('#paletteInput')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#paletteInput')).toHaveAttribute('aria-activedescendant', 'palette-opt-0');
  expect(await page.evaluate(() => {
    const b = document.getElementById('paletteBox').getBoundingClientRect();
    const s = document.getElementById('stage-palette').getBoundingClientRect();
    return b.top >= s.top && b.bottom <= s.bottom;
  })).toBe(true);

  await page.locator('#paletteInput').fill('深');
  await expect(page.locator('#paletteList .palette__item')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.locator('#paletteResult')).toContainText('深色主题');
  await expect(page.locator('#paletteBox')).not.toHaveClass(/is-open/);
  await expect(page.locator('#paletteInput')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#paletteOpen')).toBeFocused();

  // 全局 Ctrl K 也能开，Esc 也能关
  await page.keyboard.press('Control+k');
  await expect(page.locator('#paletteBox')).toHaveClass(/is-open/, { timeout: 2_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#paletteBox')).not.toHaveClass(/is-open/);
});

test('卷一：Lightbox 的切换、Esc 与焦点', async ({ page }) => {
  await page.goto('/#lightbox');

  await page.locator('#thumbStrip .thumb').first().click();
  await expect(page.locator('#lbOverlay')).toHaveClass(/is-open/);
  await expect(page.locator('#lbCount')).toHaveText('1 / 3');
  await expect(page.locator('#lbClose')).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#lbCount')).toHaveText('2 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#lbCount')).toHaveText('1 / 3');

  await page.locator('#lbNext').click();
  await expect(page.locator('#lbCount')).toHaveText('2 / 3');

  // 回归：Safari/WebKit 点按钮不给按钮焦点，点完 #lbNext 焦点会落到 body，
  // 这时 Tab 必须被拉回浮层里，而不是跳到页面上的别的控件
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.getElementById('lbOverlay').contains(document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.locator('#lbOverlay')).not.toHaveClass(/is-open/);
  await expect(page.locator('#thumbStrip .thumb').first()).toBeFocused();
});

test('卷二：样式控件、滑块和上传区事件正确', async ({ page }) => {
  await page.goto('/#select');

  await page.locator('#selTz').selectOption({ index: 1 });
  await expect(page.locator('#selOut')).toContainText('Asia/Tokyo');

  await page.locator('#cbInput').fill('上');
  await expect(page.locator('#cbList')).toHaveClass(/is-open/);
  await page.locator('#cbList .listbox__opt').first().click();
  await expect(page.locator('#cbOut')).toContainText('已选');

  await page.locator('#radio-group .radio').nth(1).click();
  await expect(page.locator('#radioOut')).toHaveText('已选：年付');

  await page.locator('[data-seg="网格"]').click();
  await expect(page.locator('[data-seg="网格"]')).toHaveAttribute('aria-pressed', 'true');

  const mailSwitch = page.getByRole('switch', { name: '邮件通知' });
  await expect(mailSwitch).toHaveAttribute('aria-checked', 'false');
  await page.locator('#switch .switch-row').nth(1).locator('.switch-row__txt').click();
  await expect(mailSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#switchOut')).toContainText('邮件通知已开启');

  // 开关也必须能用键盘拨
  await mailSwitch.focus();
  await page.keyboard.press('Space');
  await expect(mailSwitch).toHaveAttribute('aria-checked', 'false');

  await page.locator('#checkAll').uncheck();
  await page.locator('.child-check').nth(1).check();
  await expect(page.locator('#checkAll')).toHaveJSProperty('indeterminate', true);

  // 点标签文字也能勾选，不是只有 15px 的小方块
  await page.locator('#checkbox .check').nth(3).click();
  await expect(page.locator('.child-check').nth(2)).toBeChecked();

  await page.locator('#sliderInput').fill('22');
  await expect(page.locator('#slVal')).toHaveText('22px');
  await expect(page.locator('#slPreview')).toHaveCSS('font-size', '22px');

  await expect(page.locator('#dropzoneArea')).toBeVisible();
  await page.locator('#dropzoneArea').click();
  await expect(page.locator('#fileList .file-row')).toHaveCount(2);

  // 上传区支持 Enter / 空格，不是只能点鼠标
  await page.locator('#dropzoneArea').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#fileList .file-row')).toHaveCount(4);

  const duplicates = await page.evaluate(() => {
    const counts = {};
    for (const element of document.querySelectorAll('[id]')) counts[element.id] = (counts[element.id] || 0) + 1;
    return Object.entries(counts).filter(([, count]) => count > 1);
  });
  expect(duplicates).toEqual([]);
});

test('卷二：输入、校验和异步反馈完整', async ({ page }) => {
  await page.goto('/#placeholder');

  await page.locator('#phGood').fill('hello@example.com');
  await expect(page.locator('#phNote')).toContainText('还看得见');

  await page.locator('#pwd').fill('Abcdef12!');
  await page.locator('#pwdToggle').click();
  await expect(page.locator('#pwd')).toHaveAttribute('type', 'text');

  await page.locator('[data-vt="change"]').fill('bad');
  await expect(page.locator('[data-vt-out="change"]')).toContainText('格式不正确');
  await expect(page.locator('[data-vt="change"]')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('[data-vt="change"]').fill('ok@example.com');
  await expect(page.locator('[data-vt="change"]')).not.toHaveAttribute('aria-invalid', 'true');

  await page.locator('#summaryForm button[type="submit"]').click();
  await expect(page.locator('#summarySlot')).toContainText('问题需要修复');
  // 摘要里的链接要真的把焦点送到出错的字段
  await page.locator('#summarySlot a').first().click();
  await expect(page.locator('#sName')).toBeFocused();

  await page.locator('#asInput').fill('自动保存测试');
  await expect(page.locator('#asState')).toContainText('已保存', { timeout: 4_000 });

  const dirtyInitial = await page.locator('#dirtyInput').inputValue();
  await page.locator('#dirtyInput').fill('未保存内容');
  await expect(page.locator('#dirtyBar')).toHaveClass(/is-on/);
  await page.locator('#dirtyDiscard').click();
  await expect(page.locator('#dirtyBar')).not.toHaveClass(/is-on/);
  await expect(page.locator('#dirtyInput')).toHaveValue(dirtyInitial);

  await page.locator('#dsSubmit').click();
  await expect(page.locator('#dsResult')).toContainText('实际提交的字段');

  await page.locator('#optiFail').click();
  const failedRow = page.locator('#optiList .opti-item.is-failed');
  await expect(failedRow).toHaveCount(1, { timeout: 3_000 });
  // 失败项本身是按钮语义，键盘也能移除
  await failedRow.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#optiList .opti-item.is-failed')).toHaveCount(0);

  const boxes = page.locator('#otpGroup .otp__box');
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill(String(i + 1));
  await expect(page.locator('#otpOut')).toContainText('验证码正确');

  // 退格从空盒子退回上一格
  await boxes.nth(5).fill('');
  await boxes.nth(5).press('Backspace');
  await expect(boxes.nth(4)).toBeFocused();
  await expect(boxes.nth(4)).toHaveValue('');

  await page.locator('#spinPlus').click();
  await expect(page.locator('#spinVal')).toHaveValue('2');

  await page.locator('#searchDemo').fill('pattern');
  await expect(page.locator('#searchLog')).toContainText('pattern', { timeout: 2_000 });
  // 清空按钮只在有内容时出现，点完回到等待状态
  await expect(page.locator('#searchClear')).toBeVisible();
  await page.locator('#searchClear').click();
  await expect(page.locator('#searchDemo')).toHaveValue('');
  await expect(page.locator('#searchClear')).toBeHidden();
  await expect(page.locator('#searchLog')).toHaveText('等待输入');

  await page.locator('#subBtn').click();
  await expect(page.locator('#subBtn')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#subOut')).toContainText('已完成', { timeout: 3_000 });
});

test('卷二：Combobox 与 Spinbutton 的键盘边界', async ({ page }) => {
  await page.goto('/#combobox');

  await page.locator('#cbInput').focus();
  await expect(page.locator('#cbList')).toHaveClass(/is-open/);
  await page.keyboard.press('ArrowDown');
  const activeId = await page.locator('#cbInput').getAttribute('aria-activedescendant');
  expect(activeId).toBeTruthy();
  await page.keyboard.press('Enter');
  await expect(page.locator('#cbOut')).toContainText('已选');
  await expect(page.locator('#cbList')).not.toHaveClass(/is-open/);

  await page.goto('/#spinbutton');
  const minus = page.locator('#spinMinus');
  const plus = page.locator('#spinPlus');
  await expect(page.locator('#spinVal')).toHaveValue('1');
  await expect(minus).toBeDisabled();

  await plus.click();
  await expect(page.locator('#spinVal')).toHaveValue('2');

  await page.locator('#spinVal').fill('9');
  await page.locator('#spinVal').blur();
  await expect(plus).toBeDisabled();
  await page.locator('#spinVal').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#spinVal')).toHaveValue('8');
});

test('全站：没有重复 id、隐藏浮层不抢 Tab、控件热区够大', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /卷二/ }).click();
  await expect(page.locator('#vol-form')).toBeVisible();

  const issues = await page.evaluate(() => {
    const counts = {};
    document.querySelectorAll('[id]').forEach(el => { counts[el.id] = (counts[el.id] || 0) + 1; });
    const duplicates = Object.entries(counts).filter(([, n]) => n > 1);

    const small = [];
    document.querySelectorAll('.stage button, .stage [role="switch"], .stage [role="button"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.width < 24 || r.height < 24) small.push([el.id || el.className, Math.round(r.width), Math.round(r.height)]);
    });

    const closed = ['modalBox', 'alertBox', 'drawerBox', 'sheetBox', 'actionBox', 'paletteBox', 'lbOverlay', 'ddBox', 'pcBox', 'popoverBox', 'heroBox'];
    const focusable = closed.filter(id => {
      const el = document.getElementById(id);
      if (!el) return false;
      const btn = el.querySelector('button, input, [tabindex]');
      if (!btn) return false;
      btn.focus();
      return document.activeElement === btn;
    });

    return { duplicates, small, focusable };
  });

  expect(issues.duplicates).toEqual([]);
  expect(issues.small).toEqual([]);
  expect(issues.focusable).toEqual([]);
});

test.describe('移动端', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('浮层可点、不被裁切、不压触发器', async ({ page }) => {
    await page.goto('/#modal');
    await page.locator('#modalOpen').tap();
    await expect(page.locator('#modalBox')).toHaveClass(/is-open/);
    await page.locator('#modalBox [data-close="modal"]').first().tap();
    await expect(page.locator('#modalBox')).not.toHaveClass(/is-open/);

    await page.goto('/#popover');
    await page.locator('#popoverBtn').tap();
    await expect(page.locator('#popoverBox')).toHaveClass(/is-open/);
    await expectPlaced(page, '#popoverBox', '#popoverBtn');
    await page.keyboard.press('Escape');

    await page.goto('/#dropdown-menu');
    await page.locator('#ddBtn').tap();
    await expect(page.locator('#ddBox')).toHaveClass(/is-open/);
    await expectPlaced(page, '#ddBox', '#ddBtn');

    await page.goto('/#command-palette');
    await page.locator('#paletteOpen').tap();
    await expect(page.locator('#paletteBox')).toHaveClass(/is-open/);
    expect(await page.evaluate(() => {
      const b = document.getElementById('paletteBox').getBoundingClientRect();
      const s = document.getElementById('stage-palette').getBoundingClientRect();
      return b.top >= s.top && b.bottom <= s.bottom;
    })).toBe(true);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('Hover card 在触屏上点击即开，再点即关', async ({ page }) => {
    await page.goto('/#hover-card');
    const box = page.locator('#heroBox');

    await page.locator('#hoverAnchor').tap();
    expect(await box.evaluate(el => el.classList.contains('is-open'))).toBe(true);
    await expect(box).toHaveClass(/is-open/);
    // 卡不能盖住触发它的名字，否则第二次点击会点在卡上
    await expectPlaced(page, '#heroBox', '#hoverAnchor');

    await page.locator('#hoverAnchor').tap();
    await expect(box).not.toHaveClass(/is-open/, { timeout: 2_000 });
  });
});

test('卷二：aria-disabled 要自己拦输入，原生复选框不叠 aria-checked', async ({ page }) => {
  await page.goto('/#disabled-states');
  const aria = page.locator('#dsAria');
  const before = await aria.inputValue();
  await aria.focus();
  await expect(aria).toBeFocused();
  await page.keyboard.type('XYZ');
  await expect(aria).toHaveValue(before);

  await page.goto('/#checkbox');
  await page.locator('.child-check').nth(1).check();
  await expect(page.locator('#checkAll')).toHaveJSProperty('indeterminate', true);
  expect(await page.locator('#checkAll').getAttribute('aria-checked')).toBeNull();
});

test('卷二：日期三栏不自动跳格，能识别不存在的日期；原生日期提交 yyyy-mm-dd', async ({ page }) => {
  await page.goto('/#date-input');
  await page.locator('#dobD').fill('30');
  // 不自动跳格：填满两位后焦点仍在「日」上
  await expect(page.locator('#dobD')).toBeFocused();
  await page.locator('#dobM').fill('2');
  await page.locator('#dobY').fill('1990');
  await page.locator('#tripDate').focus();
  await expect(page.locator('#dobOut')).toContainText('真实存在');
  await expect(page.locator('#dobD')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#dobY')).not.toHaveAttribute('aria-invalid', 'true');

  // 失焦过一次之后转为实时
  await page.locator('#dobD').fill('28');
  await expect(page.locator('#dobOut')).toContainText('1990 年 2 月 28 日');

  await page.locator('#dobM').fill('');
  await expect(page.locator('#dobOut')).toContainText('还缺月');
  await expect(page.locator('#dobM')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#dobD')).not.toHaveAttribute('aria-invalid', 'true');

  await page.locator('#tripDate').fill('2026-11-12');
  await expect(page.locator('#tripOut')).toContainText('2026-11-12（星期四）');
});

test('卷二：字数统计超出只提醒不截断，maxlength 会静默截断', async ({ page }) => {
  await page.goto('/#character-count');
  await page.locator('#ccGood').fill('短');
  await expect(page.locator('#ccGoodCount')).toContainText('还可以输入 39 个字');

  await page.locator('#ccPaste').click();
  const good = await page.locator('#ccGood').inputValue();
  expect([...good].length).toBeGreaterThan(40);
  await expect(page.locator('#ccGoodCount')).toContainText('超出');
  await expect(page.locator('#ccGoodCount')).toHaveClass(/is-over/);
  expect([...(await page.locator('#ccBad').inputValue())].length).toBe(40);
  // 读屏播报是延迟的，停手后才播
  await expect(page.locator('#ccGoodLive')).toContainText('超出', { timeout: 3_000 });
});

test('卷三：Tabs 方向键切换、Tab 键只停在当前标签', async ({ page }) => {
  await page.goto('/#tabs');
  await expect(page.locator('#vol-nav')).toBeVisible();
  const tabs = page.locator('#stage-tabs [role="tab"]');
  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-mb')).toBeVisible();
  await expect(page.locator('#panel-ov')).toBeHidden();

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.nth(2)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');

  // 只有当前标签在 Tab 顺序里；下一次 Tab 落到面板
  expect(await tabs.evaluateAll(ts => ts.map(t => t.tabIndex))).toEqual([0, -1, -1]);
  await page.keyboard.press('Tab');
  await expect(page.locator('#panel-ov')).toBeFocused();

  await tabs.nth(2).click();
  await expect(page.locator('#panel-st')).toBeVisible();
});

test('卷三：手风琴默认只能开一个，勾选后可同时展开', async ({ page }) => {
  await page.goto('/#accordion');
  const items = page.locator('#accList details');
  await expect(items.nth(0)).toHaveJSProperty('open', true);
  await items.nth(1).locator('summary').click();
  await expect(items.nth(1)).toHaveJSProperty('open', true);
  await expect(items.nth(0)).toHaveJSProperty('open', false);

  await page.locator('#accMulti').check();
  await items.nth(2).locator('summary').click();
  await expect(items.nth(1)).toHaveJSProperty('open', true);
  await expect(items.nth(2)).toHaveJSProperty('open', true);

  // 键盘也能展开
  await items.nth(0).locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(items.nth(0)).toHaveJSProperty('open', true);
});

test('卷三：分页有当前页语义，到头时焦点不丢', async ({ page }) => {
  await page.goto('/#pagination');
  const nav = page.locator('#pgNav');
  await expect(nav.locator('[aria-current="page"]')).toHaveText('1');
  await expect(nav.locator('[data-go="prev"]')).toBeDisabled();
  await expect(page.locator('#pgStatus')).toContainText('第 1–5 条，共 47 条');

  await nav.locator('[data-go="10"]').click();
  await expect(nav.locator('[aria-current="page"]')).toHaveText('10');
  await expect(page.locator('#pgStatus')).toContainText('第 46–47 条');
  await expect(page.locator('#pgList .pg-row')).toHaveCount(2);

  await nav.locator('[data-go="prev"]').click();
  await expect(nav.locator('[data-go="prev"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(nav.locator('[aria-current="page"]')).toHaveText('8');
  await expect(nav.locator('.pg__gap')).toHaveCount(1);

  // 用键盘连按「下一页」到末页：按钮被禁用后焦点落到当前页码，而不是丢到 body
  await nav.locator('[data-go="next"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(nav.locator('[data-go="next"]')).toBeDisabled();
  await expect(nav.locator('[aria-current="page"]')).toBeFocused();
});

test('卷三：加载更多与无限滚动都能加载到底', async ({ page }) => {
  await page.goto('/#infinite-scroll');
  const rows = page.locator('#feedList .feed__row');
  await expect(rows).toHaveCount(10);

  // 加载中再点会被忽略（防重复加载），所以每次等这一批到了再点下一次
  for (let n = 20; n <= 40; n += 10) {
    await page.locator('#feedMore').click();
    await expect(rows).toHaveCount(n);
  }
  await expect(page.locator('#feedFoot')).toContainText('已经到底了');
  await expect(page.locator('#feedStatus')).toContainText('已加载 40 / 40');

  await page.locator('[data-feed="auto"]').click();
  await expect(rows).toHaveCount(10);
  await page.locator('#feedBox').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(rows).toHaveCount(20, { timeout: 3_000 });
});

test('卷三：分步表单要先过校验、能回头且不丢内容、不能跳到没走过的步', async ({ page }) => {
  await page.goto('/#stepper');
  const steps = page.locator('#stepsBar .steps__btn');

  await page.locator('#wzNext').click();
  await expect(page.locator('#wzMailMsg')).toContainText('请填写邮箱');
  await expect(page.locator('#wzMail')).toBeFocused();

  // 还没走到的第 3 步点不过去（aria-disabled 仍可聚焦可点，所以要 force 去点，验证代码真的拦住了）
  await steps.nth(2).click({ force: true });
  await expect(page.locator('.wiz__step[data-step="0"]')).toBeVisible();
  await expect(steps.nth(2)).toHaveAttribute('aria-disabled', 'true');

  await page.locator('#wzMail').fill('lin@example.com');
  await page.keyboard.press('Enter');
  await expect(page.locator('.wiz__step[data-step="1"]')).toBeVisible();
  await expect(page.locator('.wiz__step[data-step="1"] .wiz__title')).toBeFocused();
  await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step');

  await page.locator('#wzName').fill('知远');
  await page.locator('#wzBack').click();
  await expect(page.locator('#wzMail')).toHaveValue('lin@example.com');
  await steps.nth(1).click();
  await expect(page.locator('#wzName')).toHaveValue('知远');

  await page.locator('#wzNext').click();
  await expect(page.locator('#wzSum')).toContainText('lin@example.com');
  await page.locator('#wzNext').click();
  await expect(page.locator('#wzSum')).toContainText('已提交');
});

test('全站：导语里的数量、索引与页面条目一致', async ({ page }) => {
  await page.goto('/');
  for (const vol of ['overlay', 'form', 'nav']) {
    await page.locator(`.volsw__btn[data-vol="${vol}"]`).click();
    const r = await page.evaluate(v => {
      const specs = [...document.querySelectorAll('.spec')].filter(s => (s.dataset.vol || 'overlay') === v);
      const links = [...document.querySelectorAll('#index .index__link')].map(a => a.dataset.target);
      return {
        lede: Number(document.querySelector(`[data-count="${v}"]`).textContent),
        specs: specs.length,
        missingFromIndex: specs.map(s => s.id).filter(id => !links.includes(id)),
        brokenLinks: links.filter(id => !document.getElementById(id)),
        masthead: document.getElementById('count').textContent,
      };
    }, vol);
    expect(r.lede, vol + ' 导语数量').toBe(r.specs);
    expect(r.missingFromIndex, vol + ' 没进索引的条目').toEqual([]);
    expect(r.brokenLinks, vol + ' 索引里指向不存在条目').toEqual([]);
    expect(r.masthead).toContain(`${r.specs} 项`);
  }

  // 卷三的控件热区也要够大
  const small = await page.evaluate(() => [...document.querySelectorAll('#vol-nav .stage button, #vol-nav .stage summary')]
    .map(el => [el.id || el.className, el.getBoundingClientRect()])
    .filter(([, r]) => r.width && r.height && (r.width < 24 || r.height < 24))
    .map(([n, r]) => [n, Math.round(r.width), Math.round(r.height)]));
  expect(small).toEqual([]);
});

test('打开首页停在顶部，不会被隐藏的命令面板拽走', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(600);
  await settleScroll(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('#vol-overlay .lede h1')).toBeInViewport();
});

test('⌘K / Ctrl K 只在命令面板舞台内生效', async ({ page }) => {
  await page.goto('/');
  // 焦点在页面别处（顶部搜索框）时，不接管浏览器快捷键
  await page.locator('#search').focus();
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  await expect(page.locator('#paletteBox')).not.toHaveClass(/is-open/);

  // 点一下舞台空白处，焦点进入舞台后就能唤起
  await page.goto('/#command-palette');
  await settleScroll(page);
  await page.locator('#stage-palette').click({ position: { x: 12, y: 12 } });
  await page.keyboard.press('Control+k');
  await expect(page.locator('#paletteBox')).toHaveClass(/is-open/);
  await expect(page.locator('#paletteInput')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#paletteBox')).not.toHaveClass(/is-open/);
});

test('桌面宽度下目录按钮不出现', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('#indexToggle')).toBeHidden();
  await expect(page.locator('#index')).toBeVisible();
});

test.describe('窄屏目录', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('目录按钮能打开索引、点条目跳转后自动收起', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('#indexToggle');
    const index = page.locator('#index');

    await expect(index).toBeHidden();
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(index).toBeVisible();
    // 面板不超出视口，也不造成横向滚动
    expect(await index.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
    })).toBe(true);

    await index.getByRole('link', { name: 'Drawer' }).tap();
    await expect(index).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await settleScroll(page);
    await expect(page.locator('#drawer .spec__en')).toBeInViewport();

    // 切到卷二后目录跟着换
    await page.locator('.volsw__btn[data-vol="form"]').tap();
    await toggle.tap();
    await expect(index.getByRole('link', { name: 'Combobox' })).toBeVisible();
    await expect(index.getByRole('link', { name: 'Toast' })).toHaveCount(0);

    // 点外面收起
    await page.locator('#vol-form .lede h1').tap();
    await expect(index).toBeHidden();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test('页面运行时没有未捕获脚本错误', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto('/');
  await page.getByRole('button', { name: /卷二/ }).click();
  await expect(page.locator('#vol-form')).toBeVisible();
  await page.getByRole('button', { name: /卷一/ }).click();
  await expect(page.locator('#vol-overlay')).toBeVisible();

  expect(errors).toEqual([]);
});
