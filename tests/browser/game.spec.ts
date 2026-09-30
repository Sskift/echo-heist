import { expect, test, type Page } from '@playwright/test';

// Control the animation clock in the test harness only. Input still travels
// through real browser keyboard events; production code exposes no test hooks.
async function clock(page: Page) {
  await page.addInitScript(() => {
    let callbacks: FrameRequestCallback[] = [];
    let now = 0;
    window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
    (window as unknown as { advance: (frames: number) => void }).advance = frames => {
      if (!now) now = performance.now();
      for (let frame = 0; frame < frames; frame++) {
        now += 1000 / 60;
        const pending = callbacks; callbacks = [];
        pending.forEach(callback => callback(now));
      }
    };
  });
}
async function advance(page: Page, frames = 1) {
  await page.evaluate(count => (window as unknown as { advance: (n: number) => void }).advance(count), frames);
}
async function move(page: Page, key: string, frames: number) {
  await page.keyboard.down(key); await advance(page, frames); await page.keyboard.up(key);
}

test('desktop renders offline with no runtime errors; keyboard recording, pause and replay work', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5173')) external.push(request.url()); });
  await clock(page); await page.goto('/'); await advance(page);
  await expect(page.getByRole('heading', { name: '你的同伙，是过去的你。' })).toBeVisible();
  const canvasHasPixels = await page.locator('canvas').evaluate(canvas => {
    const c = canvas as HTMLCanvasElement;
    return c.getContext('2d')!.getImageData(100, 100, 1, 1).data[3] > 0;
  });
  expect(canvasHasPixels).toBe(true);
  await page.screenshot({ path: '.local/desktop-ready.png', fullPage: true });
  await page.locator('#overlay-action').click(); await advance(page);
  await expect(page.locator('#overlay')).toBeHidden();
  await move(page, 'd', 43); await move(page, 'w', 77);
  await expect(page.locator('#door-status')).toHaveText('所有通道已打开');
  await page.keyboard.press('r'); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await expect(page.locator('.echo-slot.filled')).toHaveCount(1);
  await advance(page, 135);
  await expect(page.locator('#door-status')).toHaveText('所有通道已打开');
  await page.screenshot({ path: '.local/desktop-echo.png', fullPage: true });
  await page.keyboard.press('Escape'); await advance(page);
  await expect(page.locator('#overlay-card h2')).toHaveText('时间已暂停');
  const time = await page.locator('#seconds').textContent();
  await advance(page, 180);
  await expect(page.locator('#seconds')).toHaveText(time!);
  await page.locator('#overlay-action').click(); await advance(page);
  await page.keyboard.press('Enter'); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await expect(page.locator('#seconds')).toHaveText('11');
  await page.locator('[data-delete="0"]').click(); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('0 / 3');
  await expect(page.locator('#overlay-action')).toHaveText('开始行动');
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('help modal pauses and resumes; level selection updates the mission', async ({ page }) => {
  await clock(page); await page.goto('/'); await advance(page);
  await page.locator('#overlay-action').click(); await advance(page, 60);
  await page.locator('#help-button').click(); await advance(page);
  await expect(page.locator('#help-dialog')).toBeVisible();
  const time = await page.locator('#seconds').textContent();
  await advance(page, 120); await expect(page.locator('#seconds')).toHaveText(time!);
  await page.locator('#close-help').click();
  // The queued dialog close event resumes the game and restores canvas focus.
  // Let it finish before stepping our manually controlled animation clock.
  await expect(page.locator('#game-canvas')).toBeFocused();
  await advance(page);
  await expect(page.locator('#overlay')).toBeHidden();
  await page.locator('[data-level="2"]').click(); await advance(page);
  await expect(page.locator('#mission-title')).toHaveText('别惊动过去');
  await page.screenshot({ path: '.local/desktop-guard.png', fullPage: true });
});

test('a complete keyboard heist wins, saves the best result and advances to the next level', async ({ page }) => {
  await clock(page); await page.goto('/'); await advance(page);
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 43); await move(page, 'w', 77);
  await page.keyboard.press('r'); await advance(page);
  for (const [key, frames] of [['d', 77], ['w', 30], ['d', 34], ['w', 56], ['d', 77], ['w', 8], ['s', 8], ['a', 77], ['s', 56], ['a', 34], ['s', 30], ['a', 77]] as const) await move(page, key, frames);
  await expect(page.locator('#overlay-card h2')).toHaveText('配合得天衣无缝。');
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-progress-v1')!));
  expect(result['01'].echoes).toBe(1);
  expect(result['01'].seconds).toBeLessThan(12);
  await page.screenshot({ path: '.local/desktop-win.png', fullPage: true });
  await page.locator('#overlay-action').click(); await advance(page);
  await expect(page.locator('#mission-title')).toHaveText('三人合谋');
  await page.reload(); await advance(page);
  await expect(page.locator('[data-level="0"] .level-check')).toHaveText('✓');
});

test('mobile layout has no horizontal overflow and exposes touch controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto('/');
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  await expect(page.locator('.touch-controls')).toBeVisible();
  await expect(page.locator('#overlay-action')).toBeVisible();
  await page.screenshot({ path: '.local/mobile.png', fullPage: true });
  await context.close();
});

test('rerecord, cancel and undo preserve teammates and only persist committed routes', async ({ page }) => {
  await clock(page); await page.goto('/'); await advance(page);
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 43); await move(page, 'w', 77);
  await page.keyboard.press('r'); await advance(page);
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-plans-v1')!)['01']);
  await advance(page, 130);
  await expect(page.locator('[data-echo-state="0"]')).toHaveText('守住 A 开关');
  await page.getByRole('button', { name: '重录回声 1', exact: true }).click(); await advance(page);
  await expect(page.locator('#edit-banner')).toBeVisible();
  await expect(page.locator('#overlay-card h2')).toHaveText('重录回声 01');
  await expect(page.locator('#undo-button')).toBeDisabled();
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 30); await move(page, 'w', 30);
  await page.screenshot({ path: '.local/desktop-rerecord.png', fullPage: true });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-plans-v1')!)['01'])).toEqual(original);
  await page.keyboard.press('r'); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await expect(page.locator('#edit-banner')).toBeHidden();
  const updated = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-plans-v1')!)['01']);
  expect(updated.echoes[0].frames.length).toBeLessThan(original.echoes[0].frames.length);
  expect(updated.echoes[0].colorIndex).toBe(original.echoes[0].colorIndex);
  await page.keyboard.press('z'); await advance(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-plans-v1')!)['01'])).toEqual(original);
  await page.getByRole('button', { name: '重录回声 1', exact: true }).click(); await advance(page);
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'w', 20);
  await page.locator('#cancel-rerecord').click(); await advance(page);
  await expect(page.locator('#edit-banner')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-plans-v1')!)['01'])).toEqual(original);
});

test('plans survive reload and level switching; uncommitted edits retain the old save', async ({ page }) => {
  await clock(page); await page.goto('/'); await advance(page);
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 25); await page.keyboard.press('r'); await advance(page);
  const original = await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'));
  await page.reload(); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await expect(page.locator('#plan-status')).toHaveText('已恢复 1 条回声');
  await expect(page.locator('#undo-button')).toBeDisabled();
  await page.locator('[data-level="1"]').click(); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('0 / 3');
  await page.locator('[data-level="0"]').click(); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await page.getByRole('button', { name: '重录回声 1', exact: true }).click(); await advance(page);
  await page.locator('#overlay-action').click(); await advance(page); await move(page, 'w', 30);
  await page.reload(); await advance(page);
  await expect(page.locator('#edit-banner')).toBeHidden();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-plans-v1')!)['01']);
  expect(restored).toEqual(JSON.parse(original!)['01']);
  await page.locator('#reset-button').click(); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('0 / 3');
  await page.locator('#undo-button').click(); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
});

test('holding Shift advances the whole simulation at 3x and releases at the loop boundary', async ({ page }) => {
  await clock(page); await page.goto('/'); await advance(page);
  const remaining = () => page.locator('.clock').innerText().then(text => Number(text.replace(/\s|s/g, '')));
  await page.keyboard.down('Shift'); await advance(page, 20);
  await expect(page.locator('#overlay')).toBeVisible();
  await page.keyboard.up('Shift');
  await page.locator('#overlay-action').click(); await advance(page, 2);
  const start = await remaining();
  await page.keyboard.down('Shift'); await advance(page, 20);
  const fast = await remaining();
  expect(start - fast).toBeCloseTo(1, 1);
  await expect(page.locator('#fast-forward')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('Shift'); await advance(page, 20);
  const normal = await remaining();
  expect(fast - normal).toBeCloseTo(1 / 3, 1);
  await expect(page.locator('#fast-forward')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.down('Shift');
  await advance(page, Math.ceil(normal * 20) + 1);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await expect(page.locator('#fast-forward')).toHaveAttribute('aria-pressed', 'false');
  expect(await remaining()).toBeGreaterThan(11.8);
  const length = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-plans-v1')!)['01'].echoes[0].frames.length);
  expect(length).toBe(720);
  await page.keyboard.up('Shift');
  await page.keyboard.down('Shift'); await advance(page, 2);
  await page.keyboard.press('Escape'); await advance(page);
  const paused = await remaining(); await advance(page, 60);
  expect(await remaining()).toBe(paused);
  await expect(page.locator('#fast-forward')).toHaveAttribute('aria-pressed', 'false');
});

test('the fast-forward button works with pointer and keyboard without leaving a stuck hold', async ({ page }) => {
  await clock(page); await page.goto('/'); await advance(page);
  await page.locator('#overlay-action').click(); await advance(page);
  await page.locator('#fast-forward').hover(); await page.mouse.down(); await advance(page, 10);
  await expect(page.locator('#fast-forward')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up(); await advance(page);
  await expect(page.locator('#fast-forward')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#fast-forward').focus();
  await page.keyboard.down('Space'); await advance(page, 10);
  await expect(page.locator('#fast-forward')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('Space'); await advance(page);
  await expect(page.locator('#fast-forward')).toHaveAttribute('aria-pressed', 'false');
});

test('corrupt or unwritable local storage does not prevent recording a plan', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await clock(page);
  await page.addInitScript(() => {
    localStorage.setItem('echo-heist-plans-v1', '{broken');
    Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
  });
  await page.goto('/'); await advance(page);
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 20); await page.keyboard.press('r'); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await expect(page.locator('#plan-status')).toContainText('无法写入本机存档');
  expect(errors).toEqual([]);
});

test('recorded echoes and edit controls remain usable at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clock(page); await page.goto('/'); await advance(page);
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 30); await page.keyboard.press('r'); await advance(page);
  await expect(page.getByRole('button', { name: '重录回声 1', exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/mobile-plan.png', fullPage: true });
  await page.getByRole('button', { name: '重录回声 1', exact: true }).click(); await advance(page);
  await expect(page.locator('#cancel-rerecord')).toBeVisible();
  const width = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
  expect(width[1]).toBeLessThanOrEqual(width[0]);
});
