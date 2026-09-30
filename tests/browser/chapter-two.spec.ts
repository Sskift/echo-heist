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
async function record(page: Page) { await page.keyboard.press('r'); await advance(page); }
async function sound(page: Page) { await move(page, 'Space', 1); await advance(page); }

test('sound across glass creates a complete keyboard extraction with visible guard rules', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await load(page, 'C2-2', 1);
  await page.locator('#security-panel > summary').click(); await advance(page);
  await expect(page.locator('#security-rule')).toContainText('最近的可响应守卫');
  await expect(page.locator('#security-status')).toContainText('听觉');
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 34); await move(page, 'w', 17); await sound(page);
  await move(page, 'd', 43); await move(page, 's', 17); await record(page);
  await move(page, 'd', 112);
  await expect(page.locator('#security-status')).toContainText('N1');
  await page.screenshot({ path: '.local/chapter-two-glass.png', fullPage: true });
  await move(page, 'd', 68); await move(page, 'w', 86); await move(page, 'd', 17); await move(page, 's', 94);
  await expect(page.locator('#overlay-card h2')).toHaveText('玻璃那一侧 · 完成');
  await expect(page.locator('#evidence-list')).toContainText('转运签名');
  expect(errors).toEqual([]);
});

test('two recorded sounds change the responder in preview and allow the live heist', async ({ page }) => {
  await load(page, 'C2-5');
  await move(page, 'w', 94); await sound(page); await move(page, 's', 51); await record(page);
  await move(page, 'w', 51); await move(page, 'd', 77); await advance(page, 174); await sound(page); await move(page, 's', 51); await record(page);
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#preview-frame').evaluate((el: HTMLInputElement) => { el.value = '330'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await advance(page);
  await page.locator('#security-panel > summary').click(); await advance(page);
  await expect(page.locator('#security-status')).toContainText('B · 前往 N2');
  await expect(page.locator('#preview-log')).toContainText('B 号守卫调查声响');
  await page.screenshot({ path: '.local/chapter-two-chain.png', fullPage: true });
  await page.locator('#preview-button').click(); await advance(page, 330);
  await move(page, 'd', 184);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!));
  expect(save.runs['C2-5']).toEqual(['C2-5-a']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/chapter-two-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the chapter finale also has a quiet keyboard route without any echo', async ({ page }) => {
  await load(page, 'C2-6', 3);
  await move(page, 'w', 94); await move(page, 'd', 77); await advance(page, 200);
  for (const [key, frames] of [['d', 120], ['s', 26], ['a', 9], ['d', 9], ['s', 77]] as const) await move(page, key, frames);
  await expect(page.locator('#overlay-card h2')).toHaveText('馆长的保镖 · 完成');
  await expect(page.locator('#echo-count')).toHaveText('0 / 3');
  await expect(page.locator('#evidence-list')).toContainText('记忆封存依赖市政供电');
});
