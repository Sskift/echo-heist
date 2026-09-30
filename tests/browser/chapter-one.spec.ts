import { expect, test, type Page } from '@playwright/test';
import { MISSIONS } from '../../src/campaign-content.ts';
import { advance, clock, move } from './helpers.ts';

async function loadChapter(page: Page, id = 'C1-1', prefix = 0) {
  const main = MISSIONS.filter(m => !m.id.startsWith('LAB-'));
  const before = main.slice(0, main.findIndex(m => m.id === id));
  const runs = Object.fromEntries(before.map(m => [m.id, m.stages.map(s => s.level.id)]));
  runs[id] = main.find(m => m.id === id)!.stages.slice(0, prefix).map(s => s.level.id);
  await clock(page);
  await page.addInitScript(save => {
    if (!localStorage.getItem('echo-heist-campaign-v1')) localStorage.setItem('echo-heist-campaign-v1', JSON.stringify(save));
  }, { version: 1, selected: id, runs, completed: before.map(m => m.id) });
  await page.goto('/'); await advance(page);
}
async function start(page: Page) { await page.locator('#overlay-action').click(); await advance(page); }
async function record(page: Page) { await page.keyboard.press('r'); await advance(page); }

test('a delayed echo avoids the scanner; a real keyboard run reaches the next saved checkpoint', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await loadChapter(page);
  await expect(page.locator('#operation-title')).toHaveText('晚到三秒');
  await page.locator('.hint').first().locator('summary').click();
  await expect(page.locator('#hint-text')).toContainText('扫描发生的时刻');
  await page.locator('#more-hint').click();
  await expect(page.locator('#hint-text')).toContainText('整条回声晚到');
  await page.locator('#more-hint').click();
  await expect(page.locator('#hint-text')).toContainText('延迟 3 秒');
  await expect(page.locator('#more-hint')).toBeHidden();
  await page.locator('.hint').first().locator('summary').click();
  await start(page); await move(page, 'd', 43); await move(page, 'w', 69); await record(page);
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#preview-frame').focus(); await page.keyboard.press('End'); await advance(page);
  await expect(page.locator('#preview-time')).toContainText('发现暴露');
  await expect(page.locator('#preview-log')).toContainText('S1');
  await expect(page.locator('[data-delay-input="0"]')).toBeDisabled();
  await page.locator('#preview-button').click(); await advance(page);
  await page.getByRole('spinbutton', { name: '回声 1 出场秒数' }).fill('2.75');
  await page.getByRole('spinbutton', { name: '回声 1 出场秒数' }).press('ArrowUp');
  await page.getByRole('spinbutton', { name: '回声 1 出场秒数' }).press('Tab'); await advance(page);
  await expect(page.locator('.delay-row strong')).toHaveText('3.00s');
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#preview-frame').evaluate((el: HTMLInputElement) => { el.value = '420'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await advance(page);
  await expect(page.locator('#preview-time')).toHaveText('7.00s');
  await page.locator('#preview-button').click(); await advance(page);
  await page.screenshot({ path: '.local/chapter-one-ready.png', fullPage: true });
  await start(page);
  await move(page, 'd', 77); await move(page, 'w', 34); await advance(page, 100);
  await page.screenshot({ path: '.local/chapter-one-live.png', fullPage: true });
  await advance(page, 60); await move(page, 'd', 112);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  await page.locator('#overlay-action').click(); await advance(page);
  await expect(page.locator('#mission-title')).toHaveText('两边的空档');
  await page.reload(); await advance(page);
  await expect(page.locator('#mission-title')).toHaveText('两边的空档');
  expect(errors).toEqual([]);
});

test('the banquet service route carries the physical receipt home and adds story evidence', async ({ page }) => {
  await loadChapter(page, 'C1-6', 3); await start(page);
  await move(page, 'd', 17); await move(page, 'w', 34); await record(page);
  await move(page, 'd', 34); await move(page, 's', 34); await record(page);
  // The first move includes waiting for OUTER's 2-second opening.
  for (const [key, frames] of [['d', 178], ['s', 34], ['d', 86], ['w', 43], ['a', 9], ['d', 9], ['s', 43], ['a', 86], ['w', 34], ['a', 112]] as const) await move(page, key, frames);
  await expect(page.locator('#overlay-card h2')).toHaveText('十二秒的宴会 · 完成');
  await expect(page.locator('#evidence-list')).toContainText('B-17 已被转运');
  await page.screenshot({ path: '.local/chapter-one-finale.png', fullPage: true });
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!));
  expect(save.completed).toContain('C1-6');
});

test('local playtest exports distinguish real wall time from accelerated simulation and survive reload', async ({ page }) => {
  await clock(page); await page.goto('/'); await advance(page);
  await page.locator('.playtest-panel > summary').click();
  await expect(page.locator('#playtest-role')).toHaveValue('developer');
  await page.locator('#playtest-toggle').click();
  await expect(page.locator('#playtest-status')).toContainText('自动化环境');
  await start(page); await move(page, 'Shift', 240);
  await page.locator('#playtest-break').click();
  await expect(page.locator('#playtest-status')).toContainText('休息中');
  await page.locator('#playtest-break').click();
  await page.locator('#playtest-toggle').click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-playtest-v1')!));
  expect(stored.recording).toBe(false);
  expect(stored.data.environment).toBe('automation');
  expect(stored.data.events.some((e: { kind: string }) => e.kind === 'plan')).toBe(true);
  expect(stored.data.segments.reduce((ms: number, s: { ms: number }) => ms + s.ms, 0)).toBeLessThan(12_000);
  const download = page.waitForEvent('download'); await page.locator('#playtest-export').click();
  await (await download).saveAs('.local/browser-playtest-export.json');
  await page.reload(); await advance(page);
  await page.locator('.playtest-panel > summary').click();
  await expect(page.locator('#playtest-toggle')).toHaveText('继续记录');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-playtest-v1')!).data.id)).toBe(stored.data.id);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/playtest-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
