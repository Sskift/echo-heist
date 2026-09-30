import { expect, test, type Page } from '@playwright/test';
import { MISSIONS } from '../../src/campaign-content.ts';
import { advance, clock, move } from './helpers.ts';

async function load(page: Page, id: string, prefix = 0) {
  const main = MISSIONS.filter(m => !m.id.startsWith('LAB-'));
  const before = main.slice(0, main.findIndex(m => m.id === id));
  const runs = Object.fromEntries(before.map(m => [m.id, m.stages.map(s => s.level.id)]));
  runs[id] = main.find(m => m.id === id)!.stages.slice(0, prefix).map(s => s.level.id);
  await clock(page);
  await page.addInitScript(save => localStorage.setItem('echo-heist-campaign-v1', JSON.stringify(save)), { version: 1, selected: id, runs, completed: before.map(m => m.id) });
  await page.goto('/'); await advance(page); await page.locator('#overlay-action').click(); await advance(page);
}
async function operate(page: Page) { await move(page, 'e', 1); await advance(page); }
async function scrub(page: Page, frame: number) {
  await page.locator('#preview-frame').evaluate((el: HTMLInputElement, value) => { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); }, frame);
  await advance(page);
}

test('a real circuit operation changes the visible light range and opens the entry', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await load(page, 'C3-1');
  await expect(page.locator('#power-status')).toContainText('照明亮，视距 13.1 格');
  await move(page, 'w', 34); await move(page, 'd', 43); await operate(page);
  await expect(page.locator('#power-status')).toContainText('照明暗，视距 2.3 格');
  await expect(page.locator('#power-status')).toContainText('ENTRY 开');
  await move(page, 'd', 69); await move(page, 's', 34); await move(page, 'd', 77);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  expect(errors).toEqual([]);
});

test('the recorded on-off plan powers both door and camera, previews deterministically, and extracts', async ({ page }) => {
  await load(page, 'C3-2');
  await move(page, 'd', 43); await operate(page); await advance(page, 76); await operate(page);
  await page.keyboard.press('r'); await advance(page);
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#power-panel > summary').click(); await advance(page);
  await scrub(page, 60);
  await expect(page.locator('#power-status')).toContainText('ENTRY 开'); await expect(page.locator('#power-status')).toContainText('CAM 工作');
  await page.screenshot({ path: '.local/chapter-three-power.png', fullPage: true });
  await scrub(page, 140);
  await expect(page.locator('#power-status')).toContainText('ENTRY 关'); await expect(page.locator('#power-status')).toContainText('CAM 停机');
  await expect(page.locator('#preview-log')).toContainText('P 电源断开');
  await page.locator('#preview-button').click(); await advance(page);
  await move(page, 'd', 197);
  await move(page, 's', 9);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
});

test('core pickup visibly cuts civilian power; a blocked exit requires restoration before the saved checkpoint', async ({ page }) => {
  await load(page, 'C3-6', 2);
  await page.locator('#power-panel > summary').click(); await advance(page);
  await expect(page.locator('#overlay-card h2')).toHaveText('时间已暂停');
  await expect(page.locator('#power-consequence')).toContainText('取物后预告');
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 43); await operate(page); await move(page, 'd', 34); await move(page, 'w', 34); await move(page, 'd', 68); await move(page, 'w', 34);
  await expect(page.locator('#power-consequence')).toContainText('已经发生');
  await expect(page.locator('#power-status')).toContainText('CIV · 民用主线：断开');
  await expect(page.locator('#loot-status')).toContainText('撤离前需：CIV 接通');
  await expect(page.locator('#toast')).toContainText('CIV 民用主线断开');
  await page.screenshot({ path: '.local/chapter-three-core.png', fullPage: true });
  // Cross at the doorway's center (y=416), leaving clearance for the player's radius.
  await move(page, 'd', 26); await move(page, 's', 64); await move(page, 'd', 26);
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!).runs['C3-6'].length)).toBe(2);
  await move(page, 'w', 30); await operate(page);
  await expect(page.locator('#power-status')).toContainText('CIV · 民用主线：接通');
  await move(page, 's', 30); await move(page, 'd', 26);
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!).runs['C3-6'].length)).toBe(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/chapter-three-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('a zero-echo finale route still restores the backup feed and completes the chapter story', async ({ page }) => {
  await load(page, 'C3-6', 3);
  await operate(page); await move(page, 'w', 68); await move(page, 'd', 77); await advance(page, 110);
  await move(page, 'd', 68); await operate(page); await move(page, 'd', 51); await move(page, 's', 68);
  await expect(page.locator('#overlay-card h2')).toHaveText('全城停电之前 · 完成');
  await expect(page.locator('#echo-count')).toHaveText('0 / 3');
  await expect(page.locator('#evidence-list')).toContainText('已恢复的民用供电');
});
