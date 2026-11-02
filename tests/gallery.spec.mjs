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

test('卷一：Alert dialog 只能用按钮关，Modal 点遮罩能关', async ({ page }) => {
  await page.goto('/#alert-dialog');

  await page.locator('#alertOpen').click();
  await expect(page.locator('#alertBox')).toHaveClass(/is-open/);

  await page.keyboard.press('Escape');
  await expect(page.locator('#alertBox')).toHaveClass(/is-open/);

  await page.locator('#alertScrim').click({ position: { x: 6, y: 6 } });
  await expect(page.locator('#alertBox')).toHaveClass(/is-open/);

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
