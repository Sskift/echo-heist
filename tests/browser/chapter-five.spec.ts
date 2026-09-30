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
async function operate(page: Page, key = 'e') { await move(page, key, 2); await advance(page, 2); }
async function record(page: Page) { await page.keyboard.press('r'); await advance(page); }
async function delay(page: Page, index: number, value: string) {
  const input = page.locator(`[data-delay-input="${index}"]`); await input.fill(value); await input.press('Tab'); await advance(page);
}
async function scrub(page: Page, frame: number) {
  await page.locator('#preview-frame').evaluate((el: HTMLInputElement, value) => { el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true })); }, frame); await advance(page);
}
async function recordA(page: Page) { await move(page, 'd', 43); await move(page, 'w', 69); await record(page); }

test('the suppression pulse visibly releases the held echo, then a keyboard run saves the next checkpoint', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await load(page, 'C5-1'); await move(page, 'd', 43); await move(page, 'w', 34); await record(page);
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#suppression-panel > summary').click(); await advance(page); await scrub(page, 90);
  await expect(page.locator('#suppression-status')).toContainText('N · 抑制中');
  await expect(page.locator('#suppression-status')).toContainText('回声 1 失效');
  await expect(page.locator('#suppression-status')).toContainText('距恢复 0.5s');
  await page.screenshot({ path: '.local/chapter-five-pulse.png', fullPage: true });
  await scrub(page, 150); await expect(page.locator('#suppression-status')).toContainText('N · 空档');
  await expect(page.locator('#preview-log')).toContainText('A 门开启');
  await page.locator('#preview-button').click(); await advance(page);
  await move(page, 'd', 77); await move(page, 'w', 34); await advance(page, 35); await move(page, 'd', 112);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  await page.reload(); await advance(page); await expect(page.locator('#mission-title')).toHaveText('错过的按键不会补发');
  expect(errors).toEqual([]);
});

test('the human can operate a suppressed manual panel and release the remote keeper', async ({ page }) => {
  await load(page, 'C5-2', 1); await recordA(page);
  await move(page, 'w', 34); await operate(page);
  await expect(page.locator('#suppression-status')).toContainText('N · 已断电');
  await expect(page.locator('#suppression-status')).toContainText('MANUAL · 抑制中');
  await expect(page.locator('#power-status')).toContainText('N 抑制供电断开');
  await move(page, 's', 34); await move(page, 'd', 189); await move(page, 'w', 69); await move(page, 'd', 9); await move(page, 's', 69);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
});

test('a tracker catches the undelayed echo in preview; retiming survives reload and lets the human pass', async ({ page }) => {
  await load(page, 'C5-4'); await move(page, 'd', 77); await record(page);
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#security-panel > summary').click(); await advance(page); await scrub(page, 240);
  await expect(page.locator('#preview-time')).toContainText('发现暴露');
  await expect(page.locator('#security-status')).toContainText('只识别回声');
  await expect(page.locator('#security-status')).toContainText('追向 回声 1 最后位置');
  await page.screenshot({ path: '.local/chapter-five-tracker.png', fullPage: true });
  await page.locator('#preview-button').click(); await advance(page); await delay(page, 0, '3.00');
  await page.reload(); await advance(page); await expect(page.locator('.delay-row strong')).toHaveText('3.00s'); await start(page);
  await move(page, 'd', 77); await advance(page, 180); await move(page, 'd', 103);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
});

test('the visible credential remains with the suppressed courier, then transfers to a live receiver', async ({ page }) => {
  await load(page, 'C5-5');
  await move(page, 'w', 69); await operate(page); await move(page, 'd', 111); await move(page, 's', 34); await operate(page); await move(page, 's', 43); await record(page);
  await move(page, 'd', 111); await move(page, 'w', 34); await operate(page);
  await expect(page.locator('#credential-owner')).toHaveText('唯一凭据：回声 1');
  await expect(page.locator('#suppression-status')).toContainText('回声 1 失效');
  await advance(page, 180); await expect(page.locator('#credential-owner')).toHaveText('唯一凭据：当前的你');
  await move(page, 'd', 17); await move(page, 'w', 35); await operate(page);
  await move(page, 'd', 18); await move(page, 's', 34); await move(page, 'd', 43); await move(page, 'w', 34); await move(page, 'd', 9); await move(page, 's', 69);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
});

test('a receiver loses its waiting request in the pulse and receives only after a recorded second E', async ({ page }) => {
  await load(page, 'C5-5', 2);
  await move(page, 'd', 51); await move(page, 'w', 9); await operate(page); await advance(page, 200); await operate(page);
  await move(page, 'd', 60); await move(page, 'w', 60); await operate(page); await record(page);
  await page.locator('#preview-button').click(); await advance(page); await scrub(page, 180);
  await expect(page.locator('#preview-log')).toContainText('等候已取消：投影不可用');
  await page.locator('#preview-button').click(); await advance(page);
  await move(page, 'w', 77); await operate(page); await move(page, 's', 68); await move(page, 'd', 51); await operate(page);
  await expect(page.locator('#credential-owner')).toHaveText('唯一凭据：终端 R');
  await move(page, 'a', 51); await move(page, 'w', 26); await advance(page, 135);
  await expect(page.locator('#credential-owner')).toHaveText('唯一凭据：回声 1');
  await expect(page.locator('#relay-status')).toContainText('已授权');
  await move(page, 'd', 189); await move(page, 'w', 34); await move(page, 'd', 9); await move(page, 's', 34);
  await expect(page.locator('#overlay-card h2')).toHaveText('带着密钥消失 · 完成');
});

test('pickup visibly hides both keepers and activates tracking; the safe restoration order allows extraction', async ({ page }) => {
  await load(page, 'C5-6', 2); await recordA(page);
  await move(page, 'd', 77); await move(page, 'w', 34); await move(page, 'd', 51); await move(page, 'w', 35); await record(page);
  await move(page, 'd', 77); await move(page, 'w', 34); await move(page, 'd', 51); await move(page, 's', 34); await move(page, 'd', 60);
  await expect(page.locator('#power-consequence')).toContainText('已经发生');
  await expect(page.locator('#suppression-status')).toContainText('回声 1 失效');
  await expect(page.locator('#suppression-status')).toContainText('回声 2 失效');
  await expect(page.locator('#loot-status')).toContainText('撤离前需');
  await page.locator('#suppression-panel > summary').click(); await advance(page); await start(page);
  await page.screenshot({ path: '.local/chapter-five-pickup.png', fullPage: true });
  await move(page, 'd', 9); await move(page, 's', 9); await operate(page);
  await expect(page.locator('#security-status')).toContainText('停机');
  await move(page, 'w', 60); await operate(page);
  await expect(page.locator('#suppression-status')).toContainText('N2 · 已断电');
  await move(page, 's', 51); await move(page, 'a', 51); await move(page, 'w', 34); await move(page, 'a', 69); await move(page, 'a', 77); await move(page, 's', 34);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  await expect(page.locator('#story-line')).toContainText('签字人，是你');
});

for (const method of ['diversion', 'shutdown'] as const) test(`the chapter finale ${method} route extracts the signed order and displays the story on mobile`, async ({ page }) => {
  await load(page, 'C5-6', 3);
  if (method === 'diversion') {
    await move(page, 'w', 69); await move(page, 'd', 146); await operate(page, ' '); await move(page, 'd', 51); await move(page, 'w', 25); await record(page);
    await move(page, 'd', 77); await record(page); await delay(page, 1, '3.00'); await start(page); await operate(page);
    await move(page, 'd', 77); await advance(page, 180);
  } else {
    await move(page, 'd', 77); await record(page);
    await move(page, 'd', 26); await move(page, 'w', 69); await operate(page); await move(page, 'a', 26); await move(page, 's', 69); await operate(page);
    await move(page, 'd', 77);
  }
  await move(page, 'd', 111); await move(page, 'a', 111); await move(page, 'a', 77);
  await expect(page.locator('#overlay-card h2')).toHaveText('审计员巡夜 · 完成');
  await expect(page.locator('#story-line')).toContainText('继续与联络员合作');
  await expect(page.locator('#evidence-list')).toContainText('抹除批准书原件');
  await expect(page.locator('#echo-count')).toHaveText(method === 'diversion' ? '2 / 3' : '1 / 3');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!));
  expect(save.completed).toContain('C5-6'); expect(save.runs['C5-6']).toHaveLength(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `.local/chapter-five-mobile-${method}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
