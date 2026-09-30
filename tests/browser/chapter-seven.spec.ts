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
async function record(page: Page) { await page.keyboard.press('r'); await advance(page); }
async function operate(page: Page, key = 'e') { await move(page, key, 1); await advance(page); }
async function walk(page: Page, steps: [string, number][]) { for (const [key, frames] of steps) await move(page, key, frames); }
async function cleared(page: Page, mission: string, count: number) {
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!).runs[id].length, mission)).toBe(count);
}
async function holdA(page: Page) { await walk(page, [['d', 43], ['w', 69]]); await record(page); }

test('the final vault entry combines suppression, independent clocks and a courier signing window across reload', async ({ page }) => {
  await load(page, 'C7-1'); await holdA(page);
  await move(page, 'w', 34); await operate(page); await move(page, 'd', 77); await advance(page, 130);
  await move(page, 'd', 51); await advance(page, 78); await move(page, 'd', 69);
  await expect(page.locator('#overlay')).toBeVisible(); await cleared(page, 'C7-1', 1);
  await page.reload(); await advance(page); await expect(page.locator('#map-code')).toHaveText('ANNEX_C7-1-b'); await start(page);
  await move(page, 'w', 69); await operate(page); await walk(page, [['d', 43], ['s', 60]]); await operate(page);
  await walk(page, [['a', 17], ['w', 60]]); await record(page);
  await walk(page, [['d', 43], ['w', 9]]); await advance(page, 150); await operate(page); await walk(page, [['d', 69], ['w', 60]]); await advance(page, 120); await operate(page);
  await walk(page, [['d', 86], ['s', 69]]);
  await expect(page.locator('#overlay-card h2')).toHaveText('偷回入口 · 完成'); await cleared(page, 'C7-1', 2);
});

test('physical evidence needs a real deposit after signing and returns empty-handed through its keeper gate', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', err => errors.push(err.message));
  await load(page, 'C7-2');
  await page.locator('#delivery-panel > summary').click(); await advance(page);
  await expect(page.locator('#overlay-card h2')).toHaveText('时间已暂停');
  await expect(page.locator('#delivery-requirements')).toContainText('先签 SIGNED'); await start(page);
  await holdA(page); await move(page, 'w', 69); await operate(page);
  await walk(page, [['d', 77], ['s', 69], ['d', 69], ['w', 69]]); await operate(page); await move(page, 'd', 43);
  await expect(page.locator('#delivery-status')).toContainText('到 D 按 E 植入'); await cleared(page, 'C7-2', 0);
  await expect(page.locator('#interaction-tip')).toContainText('在 D 植入实体证据');
  await operate(page); await expect(page.locator('#delivery-status')).toContainText('证据送达已确认');
  await expect(page.locator('#interaction-tip')).toContainText('D 已植入');
  await page.screenshot({ path: '.local/chapter-seven-deposit.png', fullPage: true });
  await walk(page, [['a', 43], ['s', 69], ['a', 146]]);
  await expect(page.locator('#overlay')).toBeVisible(); await cleared(page, 'C7-2', 1); expect(errors).toEqual([]);
});

test('deposit consequences close the entry and a later recorded reset restores the return route', async ({ page }) => {
  await load(page, 'C7-2', 1);
  await walk(page, [['d', 43], ['w', 69]]); await advance(page, 240); await operate(page); await record(page);
  await walk(page, [['d', 146], ['w', 34]]); await operate(page); await move(page, 'w', 34); await advance(page, 35); await operate(page);
  await expect(page.locator('#delivery-consequence')).toContainText('已经发生');
  await expect(page.locator('#power-status')).toContainText('ENTRY · 进入通道：断开');
  await expect(page.locator('#loot-status')).toContainText('撤离前需：BACK 接通');
  await move(page, 'a', 34); await advance(page, 90); await walk(page, [['a', 111], ['s', 69]]);
  await expect(page.locator('#overlay-card h2')).toHaveText('把证据放回去 · 完成'); await cleared(page, 'C7-2', 2);
});

test('a real security investigation discovers evidence then returns to register the receipt, visible on mobile', async ({ page }) => {
  await load(page, 'C7-3'); await walk(page, [['d', 103], ['w', 34]]); await operate(page); await operate(page, 'Space');
  await walk(page, [['s', 34], ['a', 103]]);
  await expect(page.locator('#delivery-status')).toContainText('回执 0 / 1');
  await expect(page.locator('#delivery-requirements')).toContainText('已发现，待返回登记点');
  await expect(page.locator('#overlay')).toBeHidden(); await cleared(page, 'C7-3', 0);
  await advance(page, 100); await expect(page.locator('#overlay')).toBeVisible(); await cleared(page, 'C7-3', 1);
  await expect(page.locator('#delivery-requirements')).toContainText('回执已登记');
  await page.locator('#delivery-panel > summary').click(); await advance(page);
  await page.screenshot({ path: '.local/chapter-seven-receipt.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/chapter-seven-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.reload(); await advance(page); await expect(page.locator('#map-code')).toHaveText('ANNEX_C7-3-b');
});

test('staggered recordings and a visible shift change secure both independently registered receipts', async ({ page }) => {
  await load(page, 'C7-3', 1);
  await walk(page, [['d', 103], ['w', 34]]); await operate(page, 'Space'); await walk(page, [['a', 34], ['w', 34]]); await record(page);
  const delay = page.locator('[data-delay-input="0"]'); await delay.fill('4.50'); await delay.press('Tab'); await advance(page); await start(page);
  await walk(page, [['d', 103], ['w', 34]]); await operate(page, 'Space'); await walk(page, [['a', 34], ['s', 34]]); await record(page);
  await walk(page, [['d', 103], ['w', 34]]); await operate(page); await walk(page, [['s', 34], ['a', 103]]);
  await expect(page.locator('#delivery-status')).toContainText('回执 0 / 2'); await advance(page, 90);
  await expect(page.locator('#delivery-status')).toContainText('回执 1 / 2'); await expect(page.locator('#overlay')).toBeHidden();
  await operate(page); await expect(page.locator('#power-status')).toContainText('ROSTER · 调查值班线路：监察值班'); await advance(page, 300);
  await expect(page.locator('#overlay')).toBeVisible(); await cleared(page, 'C7-3', 2);
  await expect(page.locator('#delivery-requirements')).toContainText('G1 → 值班登记台：回执已登记');
  await expect(page.locator('#delivery-requirements')).toContainText('G2 → 监察登记台：回执已登记');
  await expect(page.locator('#echo-count')).toHaveText('2 / 3');
});

test('the delayed decoy needs its keeper restored after deposit so the witness can make the complete return trip', async ({ page }) => {
  await load(page, 'C7-3', 2); await move(page, 'd', 26); await record(page);
  await walk(page, [['d', 111], ['w', 69]]); await operate(page, 'Space'); await walk(page, [['s', 34], ['a', 34], ['s', 34]]); await record(page);
  const delay = page.locator('[data-delay-input="1"]'); await delay.fill('2.00'); await delay.press('Tab'); await advance(page); await start(page);
  await walk(page, [['d', 111], ['w', 69]]); await operate(page);
  await expect(page.locator('#power-status')).toContainText('Q · 登记架联锁抑制：接通'); await expect(page.locator('[data-echo-state="0"]')).toHaveText('投影受抑制');
  await walk(page, [['s', 69], ['a', 34]]); await operate(page); await move(page, 'a', 77); await advance(page, 250);
  await expect(page.locator('#overlay-card h2')).toHaveText('让他们看见真相 · 完成'); await cleared(page, 'C7-3', 3);
  await expect(page.locator('#delivery-requirements')).toContainText('G1 → 外部登记台：回执已登记');
});

test('a saved deposit request survives reload but cannot implant evidence from preview or a replay', async ({ page }) => {
  await load(page, 'C7-3'); await walk(page, [['d', 103], ['w', 34]]); await operate(page); await record(page);
  await page.reload(); await advance(page); await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#preview-frame').focus(); await page.keyboard.press('End'); await advance(page);
  await expect(page.locator('#delivery-status')).toContainText('真人植入及送达回执需在实际行动中确认');
  await page.locator('#preview-button').click(); await advance(page); await start(page); await advance(page, 400);
  await expect(page.locator('#delivery-status')).toContainText('携带证据'); await cleared(page, 'C7-3', 0);
});
