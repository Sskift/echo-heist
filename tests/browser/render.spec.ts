import { test, expect } from '@playwright/test';
import { advance, clock } from './helpers.ts';

// Keep the default full-detail renderer, including real models and shadows.
test('3D models load, screen-up input records correct world poses, and camera changes keep plans intact on phone', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await clock(page); await page.goto('/?mode=training'); await advance(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-scene-ready', 'ready');
  await page.locator('#overlay-action').click(); await advance(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-annotations', 'false');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-labels', '0');
  await expect(page.locator('#mission-description')).not.toBeVisible();
  await page.locator('#mission-brief summary').click();
  await expect(page.locator('#mission-description')).toBeVisible();
  await page.locator('#mission-brief summary').click();
  await page.locator('#overlay-action').click(); await advance(page);
  await page.keyboard.down('ArrowUp'); await advance(page, 12); await page.keyboard.up('ArrowUp');
  await page.keyboard.press('r'); await advance(page);
  const plan = await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'));
  await page.locator('#annotations-button').click(); await advance(page);
  await expect(page.locator('#annotations-button')).toHaveAttribute('aria-pressed', 'true');
  expect(Number(await page.locator('#game-canvas').getAttribute('data-labels'))).toBeGreaterThan(2);
  await page.locator('#annotations-button').click(); await advance(page);
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-labels', '0');
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'))).toBe(plan);
  const frames = Object.values(JSON.parse(plan!))[0] as { echoes: { frames: { x: number; y: number }[] }[] };
  const first = frames.echoes[0].frames[0], last = frames.echoes[0].frames.at(-1)!;
  expect(last.x).toBeLessThan(first.x); expect(last.y).toBeLessThan(first.y);
  expect(last.x - first.x).toBeCloseTo(last.y - first.y, 5);
  await page.locator('#camera-button').click(); await advance(page);
  await expect(page.locator('#camera-button')).toHaveText('全景');
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'))).toBe(plan);
  await page.locator('.arena').screenshot({ path: '.local/scene3d-echo-close.png' });
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#preview-frame').fill('180'); await page.locator('#preview-frame').dispatchEvent('input'); await advance(page);
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'))).toBe(plan);
  await page.locator('#preview-button').click(); await advance(page);
  await page.setViewportSize({ width: 390, height: 844 }); await advance(page);
  await page.locator('.hint summary').click();
  await expect(page.locator('#annotations-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.map-directions')).toHaveText('地图方向：北 ↗ · 东 ↘ · 南 ↙ · 西 ↖');
  const drawingWidth = await page.locator('#game-canvas').evaluate(c => (c as HTMLCanvasElement).width);
  expect(drawingWidth).toBeLessThanOrEqual(585); // Phone rendering must not retain the 1280px desktop buffer.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('.arena').screenshot({ path: '.local/scene3d-phone.png' });
  expect(errors).toEqual([]);
});

