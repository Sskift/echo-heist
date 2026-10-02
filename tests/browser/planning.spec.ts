import { test, expect } from '@playwright/test';
import { advance, clock, openPlanning, closePlanning, move } from './helpers.ts';

test('planning freezes the live take, preview leaves saves intact, and keyboard/touch editing returns to the scene', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('echo-heist-scene-detail', 'false'));
  await clock(page); await page.goto('/?mode=training'); await advance(page);
  await expect(page.locator('#planning-panel')).not.toBeVisible();
  await expect(page.locator('.timeline')).not.toBeVisible();
  await page.locator('#overlay-action').click(); await advance(page, 30);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('g');
  const before = await page.locator('.clock').textContent();
  const saved = await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'));
  // Test gameplay keys from the scene; Enter on the focused Return button
  // should still activate that button for keyboard accessibility.
  await page.locator('#game-canvas').focus();
  await page.keyboard.press('r'); await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await advance(page, 120);
  await expect(page.locator('.clock')).toHaveText(before!);
  await expect(page.locator('#hud-echoes')).toHaveText('0 / 3');
  await page.locator('#preview-button').click();
  await page.locator('#preview-frame').fill('180'); await page.locator('#preview-frame').dispatchEvent('input'); await advance(page);
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'))).toBe(saved);
  await page.keyboard.press('Escape'); await advance(page, 15); await page.keyboard.up('ArrowRight');
  await expect(page.locator('#planning-panel')).not.toBeVisible();
  await expect(page.locator('#preview-button')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('r'); await advance(page);
  const first = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('echo-heist-plans-v1')!))[0] as { echoes: { frames: { x: number; y: number }[] }[] });
  // Opening the plan releases the held direction; it cannot leak into the resumed take.
  const route = first.echoes[0].frames;
  expect(route.every(frame => frame.x === route[0].x && frame.y === route[0].y)).toBe(true);
  await openPlanning(page);
  await page.locator('[data-rerecord="0"]').click(); await advance(page);
  await expect(page.locator('#planning-panel')).not.toBeVisible();
  await expect(page.locator('#edit-banner')).toBeVisible();
  await page.locator('#overlay-action').click(); await move(page, 'd', 12);
  await page.keyboard.press('r'); await advance(page);
  await expect(page.locator('#hud-echoes')).toHaveText('1 / 3');
  await page.reload(); await advance(page);
  await expect(page.locator('#hud-echoes')).toHaveText('1 / 3');
  await openPlanning(page);
  await page.locator('[data-delay-input="0"]').fill('1.25');
  await page.keyboard.press('Escape'); await advance(page);
  await expect(page.locator('#planning-panel')).not.toBeVisible();
  await expect(page.locator('[data-delay-input="0"]')).toHaveValue('1.25');
  await page.setViewportSize({ width: 390, height: 844 });
  await openPlanning(page); await advance(page, 60);
  await expect(page.locator('#seconds')).toHaveText('12');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.local/planning-phone.png', fullPage: true });
  await closePlanning(page); await page.locator('#overlay-action').click();
  const button = await page.locator('[data-direction="right"]').boundingBox();
  await page.mouse.move(button!.x + button!.width / 2, button!.y + button!.height / 2);
  await page.mouse.down(); await advance(page, 12); await page.mouse.up();
  await page.locator('#record-button').click(); await advance(page);
  await expect(page.locator('#hud-echoes')).toHaveText('2 / 3');
  expect(errors).toEqual([]);
});
