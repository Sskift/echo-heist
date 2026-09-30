import { expect, test, type Page } from '@playwright/test';
import { MISSIONS } from '../../src/campaign-content.ts';
import { advance, clock, move } from './helpers.ts';

async function load(page: Page, id: string) {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === id));
  await clock(page);
  await page.addInitScript(save => { if (!localStorage.getItem('echo-heist-campaign-v1')) localStorage.setItem('echo-heist-campaign-v1', JSON.stringify(save)); }, { version: 1, selected: id, runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
  await page.goto('/'); await advance(page);
}
async function start(page: Page) { await page.locator('#overlay-action').click(); await advance(page); }
async function record(page: Page) { await page.keyboard.press('r'); await advance(page); }
async function operate(page: Page, key = 'e') { await move(page, key, 2); await advance(page, 2); }
async function walk(page: Page, steps: [string, number][]) { for (const [key, frames] of steps) await move(page, key, frames); }
async function holdA(page: Page) { await walk(page, [['d', 43], ['w', 69]]); await record(page); await advance(page, 45); }
async function eastLoot(page: Page) { await walk(page, [['w', 69], ['a', 9], ['d', 9], ['s', 69]]); }
async function save(page: Page) { return page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!)); }
async function next(page: Page, title: string) {
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  await page.reload(); await advance(page); await expect(page.locator('#mission-title')).toHaveText(title);
  await start(page);
}
async function frontEntry(page: Page) {
  await walk(page, [['d', 43], ['w', 34]]); await record(page);
  await walk(page, [['w', 69], ['d', 43]]); await operate(page); await move(page, 'd', 34); await operate(page);
  await walk(page, [['d', 111], ['d', 9], ['s', 69]]);
}
async function serviceEntry(page: Page) {
  await move(page, 'd', 17); await operate(page);
  await expect(page.locator('#consequence-options [data-selected=true]')).toContainText('走检修口');
  await page.screenshot({ path: '.local/chapter-six-choice-live.png', fullPage: true });
  await walk(page, [['d', 172], ['w', 69], ['d', 9], ['s', 69]]);
}

for (const alternative of [false, true]) test(`entry ${alternative ? 'service' : 'front'} changes the next layout, survives reload, and completes with real keys`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await load(page, 'C6-1');
  if (alternative) { await page.locator('.playtest-panel > summary').click(); await page.locator('#playtest-toggle').click(); await page.locator('.playtest-panel > summary').click(); }
  await expect(page.locator('#consequence-panel')).toContainText('成功抵达锚点时才提交');
  await expect(page.locator('#consequence-options')).toContainText('S 与 R 接力终端可用');
  await expect(page.locator('#consequence-options')).toContainText('A、B 两处人工门');
  await page.screenshot({ path: '.local/chapter-six-choice.png', fullPage: true });
  await start(page);
  if (alternative) await serviceEntry(page); else await frontEntry(page);
  expect((await save(page)).outcomes['C6-1-a']).toBe(alternative ? 'C6-1-service' : 'C6-1-front');
  await next(page, alternative ? '没有登记的检修间' : '登记留下的终端');
  await expect(page.locator('#mission-number')).toHaveText('2 / 2');
  if (alternative) {
    await walk(page, [['d', 26], ['w', 69]]); await record(page); await advance(page, 45); await move(page, 'd', 111); await record(page);
    await operate(page); await advance(page, 45); await walk(page, [['d', 146], ['w', 69], ['d', 43], ['d', 9], ['s', 69]]);
  } else {
    await move(page, 'w', 69); await operate(page); await walk(page, [['d', 77], ['s', 34]]); await operate(page);
    await walk(page, [['a', 34], ['s', 34]]); await record(page);
    await walk(page, [['d', 77], ['w', 34]]); await advance(page, 160); await operate(page);
    await walk(page, [['d', 69], ['w', 34]]); await operate(page); await walk(page, [['d', 43], ['d', 9], ['s', 69]]);
  }
  await expect(page.locator('#overlay-card h2')).toHaveText('正门还是检修口 · 完成');
  expect((await save(page)).runs['C6-1']).toEqual(['C6-1-a', 'C6-1-b']);
  if (alternative) {
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-playtest-v1')!).data);
    expect(data.environment).toBe('automation');
    expect(data.completedZones).toEqual(['C6-1-a', 'C6-1-b']);
    expect(data.events.some((e: { kind: string; zoneId: string; detail: string }) => e.kind === 'checkpoint' && e.zoneId === 'C6-1-a' && e.detail.includes('C6-1-service'))).toBe(true);
    expect(data.events.some((e: { kind: string; zoneId: string; detail: string }) => e.kind === 'checkpoint' && e.zoneId === 'C6-1-b' && e.detail.includes('C6-1-b-service'))).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('rollback clears the decision and dependent progress; a plan for the discarded layout stays separate', async ({ page }) => {
  await load(page, 'C6-1'); await start(page); await serviceEntry(page);
  await next(page, '没有登记的检修间'); await walk(page, [['d', 26], ['w', 69]]); await record(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await page.locator('[data-stage="0"]').click(); await advance(page);
  expect((await save(page)).outcomes).toEqual({}); expect((await save(page)).runs['C6-1']).toEqual([]);
  await expect(page.locator('[data-stage="1"]')).toBeDisabled();
  await start(page); await frontEntry(page); await next(page, '登记留下的终端');
  await expect(page.locator('#echo-count')).toHaveText('0 / 3');
  await page.locator('[data-stage="0"]').click(); await advance(page);
  await page.locator('#preview-button').click(); await advance(page);
  const before = await save(page);
  await page.locator('#preview-frame').evaluate((el: HTMLInputElement) => { el.value = '720'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await advance(page);
  expect(await save(page)).toEqual(before);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/chapter-six-mobile-choice.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

for (const voiceFirst of [false, true]) test(`the ${voiceFirst ? 'voice then records' : 'records then voice'} order reaches the independently verified B-17 contact`, async ({ page }) => {
  await load(page, 'C6-2'); await start(page);
  if (voiceFirst) { await holdA(page); await operate(page); await walk(page, [['d', 189], ['w', 34], ['d', 9], ['s', 34]]); }
  else await walk(page, [['d', 77], ['w', 69], ['d', 111], ['s', 34], ['d', 9], ['s', 34]]);
  await next(page, voiceFirst ? '先让一个声音传回来' : '先让一个名字重新存在');
  await move(page, 'd', 43); await record(page); await move(page, 'w', 69); await operate(page);
  if (voiceFirst) await walk(page, [['s', 69], ['d', 189], ['d', 9], ['w', 69]]);
  else { await move(page, 'd', 77); await operate(page); await walk(page, [['d', 111], ['d', 9], ['s', 69]]); }
  await next(page, voiceFirst ? '回答之后，是核验' : '编号之后，是回答');
  if (voiceFirst) {
    await walk(page, [['w', 69], ['d', 146]]); await operate(page, ' '); await walk(page, [['d', 51], ['w', 26]]); await record(page);
    await move(page, 'd', 77); await record(page);
    const input = page.locator('[data-delay-input="1"]'); await input.fill('3.00'); await input.press('Tab'); await advance(page); await start(page);
    await advance(page, 180); await walk(page, [['d', 189], ['a', 111], ['a', 77]]);
  } else { await holdA(page); await move(page, 'd', 111); await operate(page); await move(page, 'd', 86); await eastLoot(page); }
  await expect(page.locator('#overlay-card h2')).toHaveText('先救谁的时间 · 完成');
  await expect(page.locator('#evidence-list')).toContainText('B-17 活着的双重证明');
  await expect(page.locator('#story-line')).toContainText('旧渡口');
  await page.screenshot({ path: `.local/chapter-six-contact-${voiceFirst ? 'voice' : 'records'}.png`, fullPage: true });
});

for (const dark of [false, true]) test(`the saved ${dark ? 'door' : 'light'} supply changes real facilities and the proof room accepts a distinct plan`, async ({ page }) => {
  await load(page, 'C6-3'); await start(page); await holdA(page); await move(page, 'd', 154);
  if (dark) await operate(page);
  await expect(page.locator('#consequence-options [data-selected=true]')).toContainText(dark ? '保留检修门' : '保留照明与签名');
  await move(page, 'd', 43); await eastLoot(page);
  await next(page, dark ? '门留着，灯不在' : '有灯，有签名，也有眼睛');
  if (dark) {
    await expect(page.locator('#security-status')).toContainText('视野 2.0 格');
    await walk(page, [['s', 17], ['d', 77], ['w', 17], ['d', 34], ['s', 17], ['d', 94], ['w', 86], ['a', 17], ['d', 17], ['s', 86], ['a', 94], ['w', 17], ['a', 34], ['a', 77]]);
  } else {
    await move(page, 'd', 43); await record(page); await move(page, 'w', 69); await operate(page); await move(page, 'd', 77); await operate(page);
    await walk(page, [['d', 34], ['s', 69]]); await operate(page); await move(page, 'd', 86); await eastLoot(page);
  }
  await next(page, '两种方法，同一份证词');
  if (dark) {
    await walk(page, [['d', 17], ['w', 34]]); await record(page); await walk(page, [['d', 51], ['w', 9]]); await record(page);
    await walk(page, [['d', 111], ['d', 86]]); await eastLoot(page);
  } else {
    await move(page, 'd', 43); await record(page); await move(page, 'w', 69); await operate(page); await move(page, 'd', 77); await operate(page);
    await walk(page, [['d', 111], ['d', 9], ['s', 69]]);
  }
  await expect(page.locator('#overlay-card h2')).toHaveText('留灯还是留门 · 完成');
  expect((await save(page)).outcomes['C6-3-a']).toBe(dark ? 'C6-3-door' : 'C6-3-light');
});
