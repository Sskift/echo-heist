import { expect, test, type Page } from '@playwright/test';
import { MISSIONS } from '../../src/campaign-content.ts';
import { advance, clock, move } from './helpers.ts';

async function load(page: Page, id: string, prefix = 0) {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === id));
  const runs = Object.fromEntries(before.map(m => [m.id, [] as string[]]));
  runs[id] = MISSIONS.find(m => m.id === id)!.stages.slice(0, prefix).map(s => s.level.id);
  await clock(page);
  await page.addInitScript(save => { if (!localStorage.getItem('echo-heist-campaign-v1')) localStorage.setItem('echo-heist-campaign-v1', JSON.stringify(save)); }, { version: 1, selected: id, runs, completed: before.map(m => m.id) });
  await page.goto('/'); await advance(page); await start(page);
}
async function start(page: Page) { await page.locator('#overlay-action').click(); await advance(page); }
async function operate(page: Page) { await move(page, 'e', 2); await advance(page, 2); }
async function record(page: Page) { await page.keyboard.press('r'); await advance(page); }
async function scrub(page: Page, frame: number) {
  await page.locator('#preview-frame').evaluate((el: HTMLInputElement, value) => { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); }, frame); await advance(page);
}
async function plans(page: Page) {
  return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.includes('plan')).map(key => [key, localStorage.getItem(key)])));
}

test('failed preview requests explain missing credentials; the unchanged recording succeeds with real delivery', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await load(page, 'C4-1');
  await move(page, 'd', 51); await move(page, 'w', 9); await advance(page, 160); await operate(page);
  await move(page, 'd', 60); await move(page, 'w', 60); await operate(page); await record(page);
  const saved = await plans(page);
  await page.locator('#preview-button').click(); await advance(page); await scrub(page, 480);
  const take = page.locator('#tracks button[data-result="blocked"]').filter({ hasText: '×' }).first();
  await expect(take).toHaveAttribute('aria-label', /回声 1 · 接收 R · 未执行.*尚无凭据/);
  await take.focus(); await page.keyboard.press('Enter'); await advance(page);
  await expect(page.locator('#operation-detail')).toBeFocused();
  await expect(page.locator('#operation-detail')).toContainText('终端 S');
  await expect(page.locator('#operation-mode')).toContainText('只读预演');
  await expect(page.locator('#operation-log button')).toHaveCount(2);
  expect(await plans(page)).toEqual(saved);
  await page.screenshot({ path: '.local/operations-preview.png', fullPage: true });
  await page.locator('#preview-button').click(); await advance(page);
  await expect(page.locator('#operation-detail')).toBeHidden();
  await move(page, 'w', 77); await operate(page); await move(page, 's', 68); await move(page, 'd', 51); await operate(page);
  await advance(page, 40);
  await expect(page.locator('#tracks button[aria-label*="回声 1 · 接收 R"]')).toHaveAttribute('data-result', 'success');
  await expect(page.locator('#operation-log')).toContainText('回声 1 · 接收 R · 已完成');
  await move(page, 'd', 69); await move(page, 'w', 26); await advance(page, 100);
  await move(page, 'd', 69); await move(page, 'w', 34); await move(page, 'd', 9); await move(page, 's', 69);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  expect(await plans(page)).toEqual(saved); expect(errors).toEqual([]);
});

test('suppressed requests leave a failure marker; retiming the same route restores receiving and authorization', async ({ page }) => {
  await load(page, 'C5-1', 1);
  await move(page, 'd', 43); await move(page, 'w', 34); await operate(page);
  await move(page, 'd', 69); await move(page, 'w', 34); await operate(page); await record(page);
  await page.locator('#preview-button').click(); await advance(page); await scrub(page, 360);
  const missed = page.locator('#tracks button[aria-label*="接收 S"]');
  await expect(missed).toHaveAttribute('data-result', 'blocked');
  await expect(missed).toHaveAttribute('aria-label', /抑制.*不会补发/);
  await missed.click(); await advance(page);
  await page.locator('#operation-problems').check(); await advance(page);
  await expect(page.locator('#operation-log button')).toHaveCount(2);
  await page.locator('#preview-button').click(); await advance(page);
  const input = page.locator('[data-delay-input="0"]'); await input.fill('3.00'); await input.press('Tab'); await advance(page);
  await start(page); await move(page, 'w', 34); await advance(page, 345);
  await expect(page.locator('#tracks button[aria-label*="接收 S"]')).toHaveAttribute('data-result', 'success');
  await expect(page.locator('#tracks button[aria-label*="授权 L"]')).toHaveAttribute('data-result', 'success');
  await expect(page.locator('#operation-log')).toContainText('目前没有受阻');
  await move(page, 'd', 120); await move(page, 'd', 69); await move(page, 'w', 34); await move(page, 'd', 9); await move(page, 's', 34);
  await expect(page.locator('#overlay-card h2')).toHaveText('消失的一秒 · 完成');
});

test('waiting and cancellation are distinct events; inspecting a live failure pauses and stays readable on mobile', async ({ page }) => {
  await load(page, 'C5-5', 2);
  await move(page, 'd', 51); await move(page, 'w', 9); await operate(page); await advance(page, 200); await operate(page);
  await move(page, 'd', 60); await move(page, 'w', 60); await operate(page); await record(page);
  await advance(page, 180);
  await expect(page.locator('#tracks button[data-result="waiting"]')).toHaveCount(1);
  const cancelled = page.locator('#tracks button[data-result="cancelled"]');
  await expect(cancelled).toHaveCount(1);
  await cancelled.focus(); await page.keyboard.press('Enter'); await advance(page);
  await expect(page.locator('#overlay-card h2')).toHaveText('时间已暂停');
  await expect(page.locator('#operation-detail')).toContainText('恢复后需要新的接收请求');
  const text = await page.locator('#operation-log').textContent(); await advance(page, 120);
  expect(await page.locator('#operation-log').textContent()).toBe(text);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#operation-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.local/operations-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await page.locator('#operation-log button').first().evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape'); await advance(page);
  await expect(page.locator('#overlay')).toBeHidden();
});

test('an operation delayed beyond twelve seconds is marked before execution and survives plan reload', async ({ page }) => {
  await load(page, 'LAB-POWER'); await move(page, 'd', 43); await move(page, 'w', 69); await advance(page, 300); await operate(page); await record(page);
  const input = page.locator('[data-delay-input="0"]'); await input.fill('6.00'); await input.press('Tab'); await advance(page);
  const truncated = page.locator('#tracks button[data-result="truncated"]');
  await expect(truncated).toHaveCount(1); await expect(truncated).toHaveText('!');
  await truncated.click(); await advance(page);
  await expect(page.locator('#operation-detail')).toContainText('本轮不会播放');
  await expect(page.locator('#operation-count')).toHaveText('1 项需查看');
  await page.reload(); await advance(page); await expect(truncated).toHaveCount(1);
  await expect(page.locator('#operation-detail')).toBeHidden();
});

test('a physical deposit is a live success but replay and preview show only a recorded request', async ({ page }) => {
  await load(page, 'C7-3'); await move(page, 'd', 103); await move(page, 'w', 34); await operate(page);
  await expect(page.locator('#player-operation-track button')).toHaveAttribute('data-result', 'success');
  await expect(page.locator('#player-operation-track button')).toHaveAttribute('aria-label', /实体证据已植入.*仍需独立回执/);
  await record(page); await page.reload(); await advance(page);
  await page.locator('#preview-button').click(); await advance(page); await scrub(page, 400);
  await expect(page.locator('#tracks button[data-result="ignored"]')).toHaveAttribute('aria-label', /回声只重放请求/);
  await expect(page.locator('#player-operation-track')).toHaveCount(0);
  await page.locator('#preview-button').click(); await advance(page); await start(page); await advance(page, 400);
  await expect(page.locator('#tracks button[data-result="ignored"]')).toHaveCount(1);
  await expect(page.locator('#delivery-status')).toContainText('携带证据');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!).runs['C7-3'])).toEqual([]);
});
