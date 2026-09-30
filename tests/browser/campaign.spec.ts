import { expect, test, type Page } from '@playwright/test';
import { advance, clock, move } from './helpers.ts';

async function select(page: Page, id: string) {
  await page.locator('#mission-board > summary').click();
  const group = page.locator(`.chapter-group:has([data-mission="${id}"])`);
  if ((await group.getAttribute('open')) === null) await group.locator('summary').click();
  await page.locator(`[data-mission="${id}"]`).click(); await advance(page);
}
async function start(page: Page) { await page.locator('#overlay-action').click(); await advance(page); }
async function record(page: Page) { await page.keyboard.press('r'); await advance(page); }
async function interact(page: Page) { await move(page, 'e', 1); await advance(page); }

test('the prologue is the default; a keyboard heist unlocks the next mission and saves evidence', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await clock(page); await page.goto('/'); await advance(page);
  await expect(page.locator('#operation-title')).toHaveText('缺席的搭档');
  await page.screenshot({ path: '.local/campaign-ready.png', fullPage: true });
  await start(page); await move(page, 'd', 43); await move(page, 's', 26); await record(page);
  await move(page, 'd', 183);
  await expect(page.locator('#overlay-card h2')).toHaveText('缺席的搭档 · 完成');
  await expect(page.locator('#evidence-list')).toContainText('空白姓名');
  await page.locator('#overlay-action').click(); await advance(page);
  await expect(page.locator('#operation-title')).toHaveText('有人留守');
  await page.reload(); await advance(page);
  await expect(page.locator('#operation-title')).toHaveText('有人留守');
  expect(errors).toEqual([]);
});

test('successful stages survive reload and rollback removes dependent checkpoints', async ({ page }) => {
  await clock(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('echo-heist-campaign-v1')) localStorage.setItem('echo-heist-campaign-v1', JSON.stringify({ version: 1, selected: 'C0-4', runs: { 'C0-1': ['C0-1-a'], 'C0-2': ['C0-2-a'], 'C0-3': ['C0-3-a'] }, completed: ['C0-1', 'C0-2', 'C0-3'] }));
  });
  await page.goto('/'); await advance(page); await start(page);
  await move(page, 'd', 17); await move(page, 's', 17); await record(page);
  for (const [key, frames] of [['d', 77], ['w', 43], ['d', 77], ['w', 22], ['d', 43], ['s', 65]] as const) await move(page, key, frames);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  await page.reload(); await advance(page);
  await expect(page.locator('#mission-title')).toHaveText('检修通道');
  await expect(page.locator('#echo-count')).toHaveText('0 / 3');
  await page.screenshot({ path: '.local/campaign-checkpoint.png', fullPage: true });
  await page.locator('[data-stage="0"]').click(); await advance(page);
  await expect(page.locator('#mission-title')).toHaveText('从另一侧离开');
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!));
  expect(state.runs['C0-4']).toEqual([]);
  await expect(page.locator('[data-stage="1"]')).toBeDisabled();
});

test('delay trimming is visible, persists, and preview is read-only with live controls disabled', async ({ page }) => {
  await clock(page); await page.goto('/?mode=training'); await advance(page); await start(page);
  await move(page, 'Shift', 240);
  await page.getByRole('button', { name: '延迟回声 1 四分之一秒' }).click(); await advance(page);
  await expect(page.locator('#echo-delays')).toContainText('末尾 0.25s 不会播放');
  const saved = await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'));
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#preview-frame').focus(); await page.keyboard.press('End'); await advance(page);
  await expect(page.locator('#preview-time')).toHaveText('12.00s');
  await expect(page.locator('#record-button')).toBeDisabled();
  await expect(page.getByRole('button', { name: '重录回声 1', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'))).toBe(saved);
  await page.keyboard.press('p'); await advance(page);
  await expect(page.getByRole('button', { name: '重录回声 1', exact: true })).toBeEnabled();
  await expect(page.locator('#seconds')).toHaveText('12');
  await page.reload(); await advance(page);
  await expect(page.locator('.delay-row strong')).toHaveText('0.25s');
});

test('device requests are recorded by real E input and replay in the preview', async ({ page }) => {
  await clock(page); await page.goto('/'); await advance(page); await select(page, 'LAB-POWER'); await start(page);
  await move(page, 'd', 43); await move(page, 'w', 69); await interact(page);
  await expect(page.locator('#door-status')).toHaveText('1 / 1 道门开启 · 可以分时通过');
  await record(page); await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#preview-frame').focus(); await page.keyboard.press('End'); await advance(page);
  await expect(page.locator('#preview-log')).toContainText('P 电源接通');
  await page.screenshot({ path: '.local/campaign-preview.png', fullPage: true });
});

test('an empty-handed recording receives a credential next loop and authorizes a complete keyboard heist', async ({ page }) => {
  await clock(page); await page.goto('/'); await advance(page); await select(page, 'LAB-RELAY'); await start(page);
  await move(page, 'd', 60); await move(page, 'w', 17); await advance(page, 180); await interact(page);
  await move(page, 'd', 51); await move(page, 'w', 69); await interact(page); await record(page);
  await move(page, 'w', 86); await interact(page); await expect(page.locator('#interaction-tip')).toContainText('交付');
  await move(page, 's', 69); await move(page, 'd', 60); await interact(page);
  await move(page, 'd', 60); await move(page, 'w', 26); await advance(page, 80);
  await expect(page.locator('#door-status')).toHaveText('所有通道已打开');
  for (const [key, frames] of [['d', 39], ['d', 30], ['w', 43], ['s', 35], ['d', 8]] as const) await move(page, key, frames);
  await expect(page.locator('#overlay-card h2')).toHaveText('空手的信使 · 完成');
  await page.screenshot({ path: '.local/campaign-relay.png', fullPage: true });
});

test('campaign board and rehearsal controls fit a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clock(page); await page.goto('/'); await advance(page);
  await page.locator('#mission-board > summary').click();
  await expect(page.locator('[data-mission="C0-1"]')).toBeVisible();
  await page.screenshot({ path: '.local/campaign-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('#touch-interact')).toBeVisible();
});
