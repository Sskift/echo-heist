import { expect, test, type Page } from '@playwright/test';
import { MISSIONS } from '../../src/campaign-content.ts';
import { advance, clock, move } from './helpers.ts';

test.setTimeout(60_000);
async function load(page: Page, id: string) {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === id));
  await clock(page);
  await page.addInitScript(save => {
    if (!localStorage.getItem('echo-heist-campaign-v1')) localStorage.setItem('echo-heist-campaign-v1', JSON.stringify(save));
  }, { version: 1, selected: id, runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
  await page.goto('/'); await advance(page); await start(page);
}
async function start(page: Page) { await page.locator('#overlay-action').click(); await advance(page); }
async function record(page: Page) { await page.keyboard.press('r'); await advance(page); }
async function operate(page: Page, key = 'e') { await move(page, key, 1); await advance(page); }
async function walk(page: Page, steps: [string, number][]) { for (const [key, frames] of steps) await move(page, key, frames); }
async function cleared(page: Page, mission: string, count: number) {
  await expect(page.locator('#overlay')).toBeVisible();
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!).runs[id].length, mission)).toBe(count);
}
async function next(page: Page, id: string) {
  await page.reload(); await advance(page); await expect(page.locator('#map-code')).toHaveText(`ANNEX_${id}`); await start(page);
}
async function courier(page: Page, lower = false) {
  await move(page, 'w', 69); await operate(page); await walk(page, [['d', 43], ['s', 60]]); await operate(page);
  await walk(page, [['a', 17], [lower ? 's' : 'w', lower ? 9 : 60]]); await record(page);
}
async function receive(page: Page, wait = 160) {
  await walk(page, [['d', 43], ['w', 9]]); await advance(page, wait); await operate(page);
}
async function holdA(page: Page) { await walk(page, [['d', 26], ['w', 69]]); await record(page); }

test('three echoes exchange roles through signing, handoff, suppression and a witnessed deposit', async ({ page }) => {
  await load(page, 'C7-4'); await holdA(page);
  await advance(page, 95); await move(page, 'd', 111); await record(page);
  await move(page, 'w', 69); await operate(page); await walk(page, [['s', 69], ['d', 146], ['w', 69]]); await operate(page);
  await move(page, 's', 34); await record(page);
  await advance(page, 95); await walk(page, [['d', 146], ['w', 69]]); await advance(page, 60); await move(page, 'd', 43); await operate(page);
  await walk(page, [['d', 9], ['s', 69]]); await cleared(page, 'C7-4', 1);

  await next(page, 'C7-4-b'); await courier(page, true);
  await advance(page, 201); await move(page, 'd', 111); await record(page);
  await advance(page, 201); await walk(page, [['d', 146], ['w', 9]]); await record(page);
  await receive(page, 190); await walk(page, [['d', 86], ['s', 9]]); await operate(page);
  await walk(page, [['w', 69], ['d', 17]]); await operate(page); await move(page, 'd', 43); await operate(page);
  await walk(page, [['d', 9], ['s', 69]]); await cleared(page, 'C7-4', 2);

  await next(page, 'C7-4-c'); await move(page, 'w', 69); await operate(page); await move(page, 'd', 77); await operate(page);
  await walk(page, [['a', 51], ['s', 69]]); await record(page);
  await walk(page, [['d', 43], ['w', 34]]); await record(page);
  await walk(page, [['d', 111], ['w', 69]]); await operate(page, 'Space'); await move(page, 's', 69); await record(page);
  await walk(page, [['d', 111], ['w', 69]]); await advance(page, 100); await operate(page);
  await walk(page, [['s', 69], ['a', 111]]); await advance(page, 220); await cleared(page, 'C7-4', 3);
  await expect(page.locator('#echo-count')).toHaveText('3 / 3');
  await expect(page.locator('#delivery-requirements')).toContainText('回执已登记');
});

for (const signed of [false, true]) test(`the ${signed ? 'signature' : 'two-keeper'} future route survives each checkpoint and restores the witness feed`, async ({ page }) => {
  await load(page, 'C7-5'); await move(page, 'w', 34); await advance(page, 270); await operate(page); await record(page);
  await walk(page, [['d', 111], ['w', 69], ['d', 77]]); await operate(page); await walk(page, [['s', 34], ['d', 9]]);
  if (signed) await operate(page);
  await walk(page, [['w', 34], ['a', 197]]); await operate(page); await move(page, 's', 69); await cleared(page, 'C7-5', 1);
  await next(page, signed ? 'C7-5-b-signed' : 'C7-5-b');
  if (signed) {
    await courier(page); await receive(page); await walk(page, [['d', 34], ['w', 60]]); await operate(page);
    await move(page, 'd', 111); await operate(page); await walk(page, [['s', 69], ['a', 43]]); await operate(page); await move(page, 'd', 51);
  } else {
    await holdA(page); await walk(page, [['d', 60], ['w', 69]]); await record(page);
    await move(page, 'w', 34); await operate(page); await walk(page, [['s', 34], ['d', 146], ['w', 69], ['d', 43]]); await advance(page, 50); await operate(page);
    await walk(page, [['s', 69], ['a', 43]]); await operate(page); await move(page, 'd', 51);
  }
  await cleared(page, 'C7-5', 2); await next(page, 'C7-5-c');
  await move(page, 'd', 43); await record(page);
  await walk(page, [['d', 180], ['w', 34]]); await operate(page, 'Space'); await walk(page, [['a', 34], ['s', 34]]); await record(page);
  const delay = page.locator('[data-delay-input="1"]'); await delay.fill('4.00'); await delay.press('Tab'); await advance(page); await start(page);
  await walk(page, [['d', 180], ['w', 34]]); await operate(page);
  await expect(page.locator('#power-status')).toContainText('CIV · 外部见证与民用核验：断开');
  await move(page, 'a', 180); await operate(page); await move(page, 's', 34); await advance(page, 250);
  await cleared(page, 'C7-5', 3); await expect(page.locator('#delivery-requirements')).toContainText('回执已登记');
});

async function finalEntry(page: Page) {
  await holdA(page); await advance(page, 121); await move(page, 'd', 111); await record(page);
  await advance(page, 121); await walk(page, [['d', 129], ['w', 69], ['d', 60], ['d', 9], ['s', 69]]);
  await cleared(page, 'C7-6', 1); await next(page, 'C7-6-b');
}
async function restoreNames(page: Page) {
  await courier(page); await receive(page); await walk(page, [['d', 34], ['w', 60]]); await operate(page);
  await walk(page, [['d', 34], ['s', 34]]); await operate(page); await move(page, 's', 34); await record(page);
  await walk(page, [['d', 77], ['w', 69]]); await advance(page, 150); await walk(page, [['d', 34], ['s', 34]]); await advance(page, 60); await operate(page);
  await walk(page, [['d', 34], ['w', 34]]); await operate(page); await move(page, 'd', 43); await operate(page);
  await walk(page, [['d', 9], ['s', 69]]); await cleared(page, 'C7-6', 2); await next(page, 'C7-6-c');
}
async function testify(page: Page) {
  await move(page, 'd', 26); await record(page); await move(page, 'w', 69); await operate(page); await move(page, 'd', 60); await operate(page);
  await walk(page, [['d', 43], ['s', 34]]); await operate(page); await operate(page, 'Space'); await walk(page, [['s', 34], ['a', 103]]); await advance(page, 150);
  await cleared(page, 'C7-6', 3); await next(page, 'C7-6-d');
}
async function scope(page: Page, open: boolean) {
  await walk(page, [['d', 43], ['w', 69]]); await record(page); await move(page, 'w', 34); await operate(page);
  await walk(page, [['s', 34], ['d', 146], ['w', 34]]); await operate(page); await move(page, 'w', 34); await operate(page);
  await walk(page, [['d', 51], ['s', 34]]); if (open) await operate(page); await move(page, 's', 34);
  await cleared(page, 'C7-6', 4); await next(page, open ? 'C7-6-e' : 'C7-6-e-return');
}
async function deliver(page: Page, open: boolean) {
  if (open) {
    await move(page, 'd', 43); await record(page);
    await walk(page, [['d', 103], ['w', 69]]); await operate(page, 'Space'); await walk(page, [['s', 34], ['a', 43], ['s', 34]]); await record(page);
    await move(page, 'w', 34); await operate(page); await walk(page, [['d', 103], ['w', 34]]); await operate(page);
    await walk(page, [['s', 34], ['a', 103], ['s', 34]]); await advance(page, 150);
  } else {
    await courier(page); await receive(page); await walk(page, [['d', 34], ['w', 60]]); await operate(page);
    await move(page, 'd', 111); await operate(page); await walk(page, [['a', 189], ['s', 34]]); await operate(page); await move(page, 's', 34);
  }
  await cleared(page, 'C7-6', 5); await expect(page.locator('#overlay-action')).toHaveText('前往旧渡口');
}

for (const open of [false, true]) test(`all five final stages reach the ${open ? 'public' : 'private'} ending; reload, accessible dialog and rollback preserve the story`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', err => errors.push(err.message));
  await load(page, 'C7-6'); await finalEntry(page); await restoreNames(page); await testify(page); await scope(page, open); await deliver(page, open);
  await start(page); await expect(page.getByRole('dialog', { name: open ? '天亮，档案属于所有人' : '天亮，记忆回到主人手里' })).toBeVisible();
  await expect(page.locator('#ending-title')).toBeFocused();
  await expect(page.locator('#ending-reunion')).toContainText('沈舟');
  const before = await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'));
  await page.keyboard.press('r'); await page.keyboard.press('p'); await page.keyboard.press('Space'); await advance(page, 60);
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'))).toBe(before);
  await page.screenshot({ path: `.local/ending-${open ? 'public' : 'private'}.png`, fullPage: true });
  await page.keyboard.press('Escape'); await expect(page.locator('#ending-dialog')).not.toBeVisible();
  await expect(page.locator('#overlay-action')).toBeFocused();
  await page.reload(); await advance(page); await expect(page.locator('#overlay-card h2')).toHaveText('回声劫案 · 已完成'); await start(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#ending-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: `.local/ending-${open ? 'public' : 'private'}-mobile.png`, fullPage: true });
  await page.locator('#ending-return').click(); await advance(page);
  await expect(page.locator('#ending-dialog')).not.toBeVisible(); await expect(page.locator('#map-code')).toHaveText('ANNEX_C7-6-d');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!));
  expect(save.runs['C7-6']).toHaveLength(3); expect(save.endings).toEqual([open ? 'open-archive' : 'return-memories']); expect(save.outcomes['C7-6-d']).toBeUndefined();
  if (!open) {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.locator('#reset-button').click(); await advance(page); await start(page);
    await scope(page, true); await deliver(page, true);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!).endings)).toEqual(['return-memories', 'open-archive']);
    await expect(page.locator('#evidence-list')).toContainText('天亮，记忆回到主人手里');
    await expect(page.locator('#evidence-list')).toContainText('天亮，档案属于所有人');
  }
  expect(errors).toEqual([]);
});
