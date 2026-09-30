import { expect, test, type Page } from '@playwright/test';
import { MISSIONS } from '../../src/campaign-content.ts';
import { advance, clock, move } from './helpers.ts';

async function load(page: Page, id: string) {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === id));
  await clock(page);
  await page.addInitScript(save => { if (!localStorage.getItem('echo-heist-campaign-v1')) localStorage.setItem('echo-heist-campaign-v1', JSON.stringify(save)); }, { version: 1, selected: id, runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
  await page.goto('/'); await advance(page); await start(page);
}
async function start(page: Page) { await page.locator('#overlay-action').click(); await advance(page); }
async function record(page: Page) { await page.keyboard.press('r'); await advance(page); }
async function operate(page: Page, key = 'e') { await move(page, key, 2); await advance(page, 2); }
async function walk(page: Page, steps: [string, number][]) { for (const [key, frames] of steps) await move(page, key, frames); }
async function holdA(page: Page) { await walk(page, [['d', 43], ['w', 69]]); await record(page); await advance(page, 45); }
async function eastLoot(page: Page) { await walk(page, [['w', 69], ['a', 9], ['d', 9], ['s', 69]]); }
async function delay(page: Page, index: number, value: string) { const input = page.locator(`[data-delay-input="${index}"]`); await input.fill(value); await input.press('Tab'); await advance(page); await start(page); }
async function save(page: Page) { return page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!)); }
async function next(page: Page, id: string) {
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  await page.reload(); await advance(page); await expect(page.locator('#map-code')).toHaveText(`ANNEX_${id}`); await start(page);
}
async function courier(page: Page) {
  await move(page, 'w', 69); await operate(page); await walk(page, [['d', 43], ['s', 60]]); await operate(page);
  await walk(page, [['a', 17], ['w', 60]]); await record(page);
}

for (const south of [false, true]) test(`the ${south ? 'signed south' : 'held north'} backup is announced, survives reload, and extracts after lockdown`, async ({ page }) => {
  await load(page, 'C6-4'); await holdA(page); await walk(page, [['d', 111], ['w', 34]]);
  if (south) await operate(page);
  await expect(page.locator('#consequence-options [data-selected=true]')).toContainText(south ? '预置下方签名通道' : '预置上方留守通道');
  await walk(page, [['d', 86], ['w', 34], ['a', 9], ['d', 9], ['s', 69]]);
  await next(page, south ? 'C6-4-b-south' : 'C6-4-b');
  await expect(page.locator('#power-consequence')).toContainText('取物后预告');
  if (south) {
    await walk(page, [['d', 43], ['w', 34]]); await record(page); await move(page, 'w', 69); await operate(page); await move(page, 'd', 189);
  } else { await holdA(page); await move(page, 'd', 189); }
  await expect(page.locator('#power-consequence')).toContainText('已经发生');
  await expect(page.locator('#power-status')).toContainText('ENTRY · 取件联锁：断开');
  await page.screenshot({ path: `.local/chapter-six-lockdown-${south ? 'south' : 'north'}.png`, fullPage: true });
  if (south) { await walk(page, [['a', 43], ['s', 69]]); await operate(page); await move(page, 'a', 146); }
  else await walk(page, [['d', 9], ['w', 69], ['a', 197], ['s', 69]]);
  await next(page, 'C6-4-c');
  await move(page, 'w', 34); await advance(page, 240); await operate(page); await record(page);
  await move(page, 'd', 189); await expect(page.locator('#loot-status')).toContainText('撤离前需');
  await walk(page, [['d', 9], ['w', 69], ['a', 197], ['s', 69]]);
  await expect(page.locator('#overlay-card h2')).toHaveText('计划赶不上自己 · 完成');
  expect((await save(page)).outcomes['C6-4-a']).toBe(south ? 'C6-4-south' : 'C6-4-north');
});

for (const quiet of [false, true]) test(`the ${quiet ? 'two-echo low-exposure' : 'fewer-echo'} plan completes the three witness-proof stages`, async ({ page }) => {
  await load(page, 'C6-5');
  if (quiet) {
    await walk(page, [['d', 17], ['w', 34]]); await record(page); await walk(page, [['d', 51], ['w', 9]]); await record(page);
    await walk(page, [['d', 111], ['d', 86]]); await eastLoot(page);
  } else await walk(page, [['d', 77], ['w', 69], ['d', 111], ['d', 9], ['s', 69]]);
  await expect(page.locator('#echo-count')).toHaveText(quiet ? '2 / 3' : '0 / 3');
  await next(page, 'C6-5-b'); await move(page, 'd', 77); await record(page);
  if (quiet) {
    await walk(page, [['d', 111], ['w', 69], ['d', 34]]); await operate(page); await record(page); await advance(page, 120);
  }
  await walk(page, [['d', 189], ['d', 9]]);
  await expect(page.locator('#echo-count')).toHaveText(quiet ? '2 / 3' : '1 / 3');
  if (quiet) await expect(page.locator('#security-status')).toContainText('停机');
  await next(page, 'C6-5-c');
  if (quiet) {
    await walk(page, [['d', 26], ['w', 69]]); await record(page); await move(page, 'd', 51); await record(page); await advance(page, 30);
    await walk(page, [['d', 111], ['d', 86]]); await eastLoot(page);
  } else {
    await courier(page); await walk(page, [['d', 43], ['w', 9]]); await advance(page, 180); await operate(page);
    await walk(page, [['d', 34], ['w', 60]]); await operate(page); await walk(page, [['d', 111], ['d', 9], ['s', 69]]);
  }
  await expect(page.locator('#overlay-card h2')).toHaveText('不只一种完美 · 完成');
  await expect(page.locator('#evidence-list')).toContainText('匿名证人的索引');
});

async function enterHall(page: Page, service: boolean) {
  if (service) {
    await walk(page, [['d', 17], ['w', 34]]); await record(page); await walk(page, [['d', 51], ['w', 9]]); await record(page);
    await move(page, 'd', 43); await operate(page); await walk(page, [['d', 69], ['d', 86]]); await eastLoot(page);
  } else {
    await walk(page, [['d', 43], ['w', 34]]); await record(page); await move(page, 'w', 69); await operate(page);
    await move(page, 'd', 77); await operate(page); await walk(page, [['d', 111], ['d', 9], ['s', 69]]);
  }
}
async function dispatchHall(page: Page, service: boolean, manual: boolean) {
  if (service) {
    await walk(page, [['d', 26], ['w', 69]]); await record(page); await advance(page, 45); await move(page, 'd', 111); await record(page);
    await operate(page); await advance(page, 45); await walk(page, [['d', 146], ['w', 69], ['d', 43], ['d', 9], ['s', 34]]);
  } else {
    await move(page, 'w', 69); await operate(page); await walk(page, [['d', 111], ['s', 34]]); await operate(page); await walk(page, [['a', 69], ['s', 34]]); await record(page); await delay(page, 0, '1.50');
    await walk(page, [['d', 111], ['w', 34]]); await advance(page, 240); await operate(page); await walk(page, [['d', 34], ['w', 34]]); await operate(page);
    await walk(page, [['d', 43], ['d', 9], ['s', 34]]);
  }
  if (manual) await operate(page);
  await expect(page.locator('#consequence-options [data-selected=true]')).toContainText(manual ? '切换人工停机' : '保留声响调度');
  await move(page, 's', 43);
}
async function pickupHall(page: Page, manual: boolean, signed: boolean) {
  if (manual) {
    await move(page, 'd', 77); await record(page); await move(page, 'w', 69); await operate(page); await walk(page, [['s', 69], ['d', 111]]);
  } else {
    await walk(page, [['w', 69], ['d', 146]]); await operate(page, ' '); await walk(page, [['d', 51], ['w', 26]]); await record(page);
    await move(page, 'd', 77); await record(page); await delay(page, 1, '3.00'); await advance(page, 180); await move(page, 'd', 111);
  }
  if (signed) await operate(page);
  await expect(page.locator('#consequence-options [data-selected=true]')).toContainText(signed ? '凭据交接线' : '人工交接线');
  await move(page, 'd', 77); await expect(page.locator('#power-consequence')).toContainText('已经发生');
  if (manual) {
    await expect(page.locator('#suppression-status')).toContainText('KEEPER · 抑制中');
    await walk(page, [['d', 9], ['w', 69], ['a', 197]]);
  } else {
    await expect(page.locator('#suppression-status')).toContainText('NULL · 抑制中');
    await walk(page, [['d', 9], ['w', 34]]); await operate(page); await walk(page, [['s', 34], ['a', 120], ['a', 77]]);
  }
}
async function exitHall(page: Page, signed: boolean) {
  if (signed) {
    await courier(page); await walk(page, [['d', 43], ['w', 9]]); await advance(page, 160); await operate(page);
    await walk(page, [['d', 34], ['w', 60]]); await operate(page); await walk(page, [['d', 51], ['d', 60]]);
    await expect(page.locator('#loot-status')).toContainText('CIV');
    await walk(page, [['a', 189], ['s', 34]]);
  } else {
    await walk(page, [['d', 26], ['w', 69]]); await record(page); await advance(page, 45); await move(page, 'd', 111); await record(page); await advance(page, 45);
    await move(page, 'd', 129); await operate(page); await walk(page, [['w', 69], ['d', 60]]);
    await expect(page.locator('#loot-status')).toContainText('CIV');
    await walk(page, [['a', 60], ['s', 69], ['a', 129], ['w', 34]]);
  }
  await operate(page); await expect(page.locator('#power-status')).toContainText('CIV · 民用验证线路：接通'); await move(page, 's', 34);
}

for (let bits = 0; bits < 8; bits++) test(`civic heist combination ${bits} is playable by keyboard across all four saved checkpoints`, async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const service = !!(bits & 1), manual = !!(bits & 2), signed = !!(bits & 4);
  await load(page, 'C6-6'); await enterHall(page, service);
  await next(page, service ? 'C6-6-b-service' : 'C6-6-b'); await dispatchHall(page, service, manual);
  await next(page, manual ? 'C6-6-c-manual' : 'C6-6-c'); await pickupHall(page, manual, signed);
  await next(page, signed ? 'C6-6-d-signed' : 'C6-6-d'); await exitHall(page, signed);
  await expect(page.locator('#overlay-card h2')).toHaveText('市政厅不眠夜 · 完成');
  await expect(page.locator('#evidence-list')).toContainText('中央总库传输地址');
  const state = await save(page); expect(state.runs['C6-6']).toHaveLength(4);
  expect(state.outcomes).toEqual({ 'C6-6-a': service ? 'C6-6-service' : 'C6-6-certified', 'C6-6-b': manual ? 'C6-6-manual' : 'C6-6-radio', 'C6-6-c': signed ? 'C6-6-signed-exit' : 'C6-6-manual-exit' });
  expect(errors).toEqual([]);
  if (bits === 0) await page.screenshot({ path: '.local/chapter-six-finale.png', fullPage: true });
  if (bits === 7) { await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '.local/chapter-six-finale-mobile.png', fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); }
});
