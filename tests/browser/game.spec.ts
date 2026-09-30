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
  await page.locator('#close-help').click(); await advance(page);
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
