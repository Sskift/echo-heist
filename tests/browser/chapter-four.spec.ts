import { expect, test, type Page } from '@playwright/test';
import { MISSIONS } from '../../src/campaign-content.ts';
import { advance, clock, move } from './helpers.ts';

async function load(page: Page, id: string, prefix = 0) {
  const main = MISSIONS.filter(m => !m.id.startsWith('LAB-'));
  const before = main.slice(0, main.findIndex(m => m.id === id));
  const runs = Object.fromEntries(before.map(m => [m.id, m.stages.map(s => s.level.id)]));
  runs[id] = main.find(m => m.id === id)!.stages.slice(0, prefix).map(s => s.level.id);
  await clock(page);
  await page.addInitScript(save => { if (!localStorage.getItem('echo-heist-campaign-v1')) localStorage.setItem('echo-heist-campaign-v1', JSON.stringify(save)); }, { version: 1, selected: id, runs, completed: before.map(m => m.id) });
  await page.goto('/'); await advance(page); await start(page);
}
async function start(page: Page) { await page.locator('#overlay-action').click(); await advance(page); }
// Two render ticks cross a fixed simulation step even at a fractional accumulator boundary.
async function operate(page: Page) { await move(page, 'e', 2); await advance(page, 2); }
async function record(page: Page) { await page.keyboard.press('r'); await advance(page); }
async function receiver(page: Page, wait: number, queue = false) {
  await move(page, 'd', 51); await move(page, 'w', 9);
  if (queue) await operate(page);
  await advance(page, wait);
  if (!queue) await operate(page);
  await move(page, 'd', 60); await move(page, 'w', 60); await operate(page); await record(page);
}
async function deliver(page: Page) {
  await move(page, 'w', 77); await operate(page); await move(page, 's', 68); await move(page, 'd', 51); await operate(page);
}
async function exitEast(page: Page) {
  await move(page, 'd', 69); await move(page, 'w', 26); await advance(page, 100);
  await move(page, 'd', 69); await move(page, 'w', 34); await move(page, 'd', 9); await move(page, 's', 69);
}
async function scrub(page: Page, frame: number) {
  await page.locator('#preview-frame').evaluate((el: HTMLInputElement, value) => { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); }, frame); await advance(page);
}

test('empty-handed recording fails in preview, then receives live delivery and saves a real checkpoint', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await load(page, 'C4-1'); await receiver(page, 160);
  await page.locator('#preview-button').click(); await advance(page); await scrub(page, 480);
  await expect(page.locator('#credential-owner')).toHaveText('预演 · 唯一凭据：终端 S');
  await expect(page.locator('#preview-log')).toContainText('授权未满足');
  await page.locator('#preview-button').click(); await advance(page);
  await deliver(page); await expect(page.locator('#credential-owner')).toHaveText('唯一凭据：终端 R');
  await advance(page, 40); await expect(page.locator('#credential-owner')).toHaveText('唯一凭据：回声 1');
  await exitEast(page); await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  await page.reload(); await advance(page);
  await expect(page.locator('#mission-title')).toHaveText('没有姓名的预约');
  expect(errors).toEqual([]);
});

test('the terminal time window is readable, delay edits survive reload, and the rendezvous succeeds', async ({ page }) => {
  await load(page, 'C4-3'); await receiver(page, 0);
  await page.locator('[data-delay-input="0"]').fill('2.50'); await page.locator('[data-delay-input="0"]').press('Tab'); await advance(page);
  await page.reload(); await advance(page);
  await expect(page.locator('.delay-row strong')).toHaveText('2.50s');
  await page.locator('#relay-panel > summary').click(); await advance(page);
  await expect(page.locator('#relay-status')).toContainText('3–4s');
  await expect(page.locator('#relay-status')).toContainText('距开放 3.0s');
  await page.screenshot({ path: '.local/chapter-four-terminal.png', fullPage: true });
  await start(page); await deliver(page); await exitEast(page);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
});

test('a waiting receiver accepts later delivery while the sender holds the remote authorization switch', async ({ page }) => {
  await load(page, 'C4-4'); await receiver(page, 210, true);
  await move(page, 'w', 77); await operate(page);
  await expect(page.locator('#relay-status')).toContainText('回声 1 等候接收');
  await page.locator('#relay-panel > summary').click(); await advance(page);
  await expect(page.locator('#overlay-card h2')).toHaveText('时间已暂停');
  await expect(page.locator('#relay-status')).toContainText('需守 A');
  await start(page); await page.screenshot({ path: '.local/chapter-four-waiting.png', fullPage: true });
  await move(page, 's', 68); await move(page, 'd', 51); await operate(page);
  await expect(page.locator('#credential-owner')).toHaveText('唯一凭据：回声 1');
  await move(page, 'a', 51); await move(page, 'w', 26); await advance(page, 135);
  await expect(page.locator('#relay-status')).toContainText('已授权');
  await move(page, 'd', 189); await move(page, 'w', 34); await move(page, 'd', 9); await move(page, 's', 34);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
});

test('one credential authorizes the first reader, changes hands, and authorizes the second reader', async ({ page }) => {
  await load(page, 'C4-5', 2);
  await move(page, 'w', 69); await operate(page); await move(page, 'd', 43); await operate(page);
  await expect(page.locator('#credential-owner')).toHaveText('唯一凭据：当前的你');
  await expect(page.locator('#credential-event')).toContainText('完成 L1 授权');
  await move(page, 'd', 17); await move(page, 's', 60); await operate(page); await move(page, 's', 17); await record(page);
  await move(page, 'd', 60); await move(page, 'w', 9); await operate(page); await advance(page, 180);
  await expect(page.locator('#credential-owner')).toHaveText('唯一凭据：当前的你');
  await move(page, 'd', 17); await move(page, 'w', 26); await move(page, 'd', 51); await move(page, 'w', 34); await operate(page);
  await expect(page.locator('#relay-status')).toContainText('L1 · 授权');
  await expect(page.locator('#credential-event')).toContainText('完成 L2 授权');
  await move(page, 'd', 17); await move(page, 's', 69); await move(page, 'd', 43); await move(page, 's', 9); await move(page, 'd', 9);
  await expect(page.locator('#overlay-card h2')).toHaveText('一道门，两次身份 · 完成');
});

for (const method of ['relay', 'service'] as const) test(`the station finale ${method} route completes the story and stays within a mobile viewport`, async ({ page }) => {
  await load(page, 'C4-6', 3);
  if (method === 'relay') {
    await deliver(page); await record(page);
    await move(page, 'd', 51); await move(page, 'w', 9); await operate(page); await advance(page, 180);
    await move(page, 'd', 26); await move(page, 'w', 60); await operate(page);
    await move(page, 's', 34); await move(page, 'd', 34); await move(page, 's', 26); await operate(page);
    await move(page, 's', 17); await move(page, 'd', 86); await move(page, 'w', 9);
  } else {
    await move(page, 'w', 77); await operate(page); await move(page, 'd', 77); await move(page, 's', 9); await operate(page);
    await move(page, 's', 34); await move(page, 'd', 34); await move(page, 's', 26); await operate(page); await record(page);
    await advance(page, 300); await move(page, 'd', 111); await move(page, 's', 9); await move(page, 'd', 86); await move(page, 'w', 9);
  }
  await expect(page.locator('#overlay-card h2')).toHaveText('不存在的列车票 · 完成');
  await expect(page.locator('#story-line')).toContainText('他的现况仍未知');
  await expect(page.locator('#evidence-list')).toContainText('防投影设施编号');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!));
  expect(save.completed).toContain('C4-6'); expect(save.runs['C4-6']).toHaveLength(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `.local/chapter-four-mobile-${method}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
