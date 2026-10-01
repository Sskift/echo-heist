import { test, expect, type Page } from '@playwright/test';
import { advance, clock, move } from './helpers.ts';
import { Campaign } from '../../src/campaign.ts';
import { MISSIONS } from '../../src/campaign-content.ts';
import { playWitness } from '../../src/witness.ts';

// Exercise story, input and persistence through the supported simple display.
// Full-detail meshes, shadows and camera behavior run in render.spec.ts;
// repeated software shadow rasterization must not dominate keyboard routes.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('echo-heist-scene-detail', 'false'));
});

function checkpoint(id: string, completed = false) {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === id) + Number(completed));
  return { version: 1, selected: id, runs: Object.fromEntries(before.map(m => [m.id, [] as string[]])), completed: before.map(m => m.id) };
}
async function seed(page: Page, save: unknown, story?: unknown) {
  await page.addInitScript(({ save, story }) => {
    if (!localStorage.getItem('echo-heist-campaign-v1')) localStorage.setItem('echo-heist-campaign-v1', JSON.stringify(save));
    if (story && !localStorage.getItem('echo-heist-story-v1')) localStorage.setItem('echo-heist-story-v1', JSON.stringify(story));
  }, { save, story });
}

test('evidence prepares a real layout and stays frozen until the player explicitly clears this operation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await clock(page); await seed(page, checkpoint('C0-6'), { version: 1, seen: ['c0-arrival', 'c0-watch'], choices: {} });
  await page.goto('/'); await advance(page);
  await expect(page.locator('#preparation-label')).toContainText('末班货梯');
  await page.locator('#preview-button').click(); await page.locator('#open-preparation').click();
  await expect(page.locator('#preparation-state')).toContainText('只读预演');
  await expect(page.locator('[data-prepare="museum-service"]')).toBeDisabled();
  await page.locator('#story-close').click(); await page.locator('#preview-button').click();
  await page.locator('#open-preparation').click();
  await expect(page.locator('.journal-preparation')).toContainText('通往封存区的检修图');
  await page.locator('[data-prepare="museum-service"]').click();
  await expect(page.locator('[data-prepare="museum-service"]')).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: '.local/preparation-desktop.png' });
  await page.locator('#story-close').click();
  await expect(page.locator('#mission-title')).toHaveText('图上的北侧检修口');
  await move(page, 'd', 10); await page.keyboard.press('r'); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await page.reload(); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await expect(page.locator('#preparation-label')).toContainText('已锁定');
  await move(page, 'd', 2);
  await page.locator('#retry-button').click(); await advance(page);
  await page.locator('#open-preparation').click();
  await expect(page.locator('[data-prepare="museum-freight"]')).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.local/preparation-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#prepare-reset').click();
  await page.locator('[data-prepare="museum-freight"]').click();
  await page.locator('#story-close').click(); await advance(page);
  await expect(page.locator('#mission-title')).toHaveText('潜入装卸间');
  await expect(page.locator('#echo-count')).toHaveText('0 / 3');
  const saved = await page.evaluate(() => ({ campaign: JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!), plans: JSON.parse(localStorage.getItem('echo-heist-plans-v1')!) }));
  expect(saved.campaign.preparations['C0-6']).toEqual({ id: 'museum-freight', locked: false });
  expect(saved.campaign.completed).toContain('C0-4');
  expect(saved.campaign.runs['C0-6']).toEqual([]);
  expect(saved.plans['C0-6-a-service']).toBeUndefined();
  await page.reload(); await advance(page);
  await expect(page.locator('#preparation-label')).toContainText('尚未出发');
  expect(errors).toEqual([]);
});

test('a retained teammate is visible across rooms, survives local-plan reload and rolls back with its source', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const campaign = new Campaign(checkpoint('C3-6'));
  expect(campaign.commit(playWitness(campaign.stage))).toBe(true);
  await clock(page); await seed(page, campaign.export(), { version: 1, seen: ['c3-arrival'], choices: {} });
  await page.goto('/'); await advance(page);
  await expect(page.locator('#mission-title')).toContainText('窗那边的同伙');
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await expect(page.locator('.retained-slot')).toContainText('配电室');
  await expect(page.locator('[data-rerecord="0"], [data-delay-input="0"]')).toHaveCount(0);
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 17); await page.keyboard.press('r'); await advance(page, 140);
  await expect(page.locator('#echo-count')).toHaveText('2 / 3');
  await page.screenshot({ path: '.local/last-light-core.png' });
  await page.reload(); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('2 / 3');
  await page.locator('#preview-button').click();
  await page.locator('#preview-frame').fill('180'); await page.locator('#preview-frame').dispatchEvent('input'); await advance(page);
  await expect(page.locator('#continuity-status')).toContainText('守住 HOLD');
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#reset-button').click(); await advance(page);
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await page.locator('[data-stage="0"]').click(); await advance(page);
  const data = await page.evaluate(() => ({ campaign: JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!), plans: JSON.parse(localStorage.getItem('echo-heist-plans-v1')!) }));
  expect(data.campaign.runs['C3-6']).toEqual([]); expect(data.campaign.carries['C3-6-entry']).toBeUndefined();
  expect(data.plans['C3-6-core']).toBeUndefined();
  await page.setViewportSize({ width: 390, height: 844 }); await advance(page);
  await expect(page.locator('#continuity-panel')).toContainText('另外两格');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.local/last-light-mobile.png', fullPage: true });
  const mainSave = await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'));
  await page.goto('/?demo=last-light'); await advance(page);
  await expect(page.locator('#chapter-label')).toContainText('独立试玩');
  await expect(page.locator('#story-dialog')).not.toBeVisible();
  await expect(page.locator('#mission-board')).not.toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'))).toBe(mainSave);
  await expect(page.locator('#training-mode')).toHaveText('返回完整主线');
  expect(errors).toEqual([]);
});

test('a room arrival follows the actual cabinet choice, clears held input and preserves the ready checkpoint', async ({ page }) => {
  await clock(page); await seed(page, checkpoint('C4-6'), {version: 1, seen: ['c4-arrival'], choices: {}});
  await page.goto('/'); await advance(page); await page.locator('#overlay-action').click();
  await move(page, 'w', 69); await move(page, 'e', 1); await move(page, 's', 69);
  await move(page, 'd', 77); await move(page, 'e', 1); await move(page, 'w', 34);
  await expect(page.locator('#overlay-card h2')).toHaveText('这一段，已经安全了。');
  const checkpointSave = await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'));
  await page.keyboard.down('d'); await page.keyboard.down('s');
  await page.locator('#overlay-action').click(); await advance(page);
  await expect(page.locator('#journey-route')).toHaveText('登记厅楼梯 → 站台南侧');
  await expect(page.locator('#journey-detail')).toContainText('原票仍留在 SERVICE 柜中');
  await expect(page.locator('#credential-owner')).toContainText('SERVICE');
  await page.locator('#journey-skip').click(); await advance(page, 90);
  await expect(page.locator('#seconds')).toHaveText('12');
  await expect(page.locator('#record-label')).toHaveText('STANDBY');
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'))).toBe(checkpointSave);
  await page.locator('#overlay-action').click(); await advance(page, 20); await page.keyboard.press('r'); await advance(page);
  await page.keyboard.up('d'); await page.keyboard.up('s');
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-plans-v1')!)['C4-6-receive-service']);
  expect(plan.echoes[0].frames.every((f: {x: number; y: number}) => f.x === 528 && f.y === 432)).toBe(true);
  await page.reload(); await advance(page);
  await expect(page.locator('#journey-panel')).not.toBeVisible();
  await expect(page.locator('#credential-owner')).toContainText('SERVICE');
  await expect(page.locator('#seconds')).toHaveText('12');
});

test('cross-room ticket UI survives retry, preview, reload and mission changes; backtracking clears its dependents', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const campaign = new Campaign(checkpoint('C4-6'));
  for (let stage = 0; stage < 2; stage++) expect(campaign.commit(playWitness(campaign.stage, undefined, campaign.credentialFor(campaign.stage.level.id)))).toBe(true);
  await clock(page); await seed(page, campaign.export(), { version: 1, seen: ['c4-arrival'], choices: {} });
  await page.goto('/'); await advance(page);
  await expect(page.locator('#credential-location')).toContainText('ARCHIVE');
  await expect(page.locator('#credential-location')).toContainText('前段签名：PLATFORM');
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 5); await page.keyboard.press('r'); await advance(page);
  const saved = await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'));
  await page.locator('#preview-button').click();
  await page.locator('#preview-frame').fill('200'); await page.locator('#preview-frame').dispatchEvent('input'); await advance(page);
  await expect(page.locator('#credential-location')).toContainText('只读预演');
  await expect(page.locator('#credential-owner')).toContainText('ARCHIVE');
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'))).toBe(saved);
  await page.locator('#preview-button').click(); await advance(page);
  await move(page, 'w', 43); await move(page, 'e', 1); await advance(page);
  await expect(page.locator('#credential-owner')).toContainText('当前的你');
  await page.locator('#credential-journey summary').click(); await advance(page);
  await expect(page.locator('#record-label')).toHaveText('PAUSED');
  const seconds = await page.locator('#seconds').textContent();
  await move(page, 'd', 30); await expect(page.locator('#seconds')).toHaveText(seconds!);
  await page.locator('#credential-journey summary').click();
  await page.locator('#retry-button').click(); await advance(page);
  await expect(page.locator('#credential-owner')).toContainText('ARCHIVE');
  await page.reload(); await advance(page);
  await expect(page.locator('#credential-owner')).toContainText('ARCHIVE');
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await page.screenshot({ path: '.local/station-transfer-desktop.png', fullPage: true });
  await page.locator('#mission-board > summary').click();
  if (!await page.locator('[data-mission="C4-1"]').isVisible()) await page.locator('.chapter-group:has([data-mission="C4-1"]) > summary').click();
  await page.locator('[data-mission="C4-1"]').click(); await advance(page);
  await page.locator('#mission-board > summary').click();
  await page.locator('[data-mission="C4-6"]').click(); await advance(page);
  await expect(page.locator('#credential-owner')).toContainText('ARCHIVE');
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await page.locator('[data-stage="0"]').click(); await advance(page);
  const reset = await page.evaluate(() => ({ campaign: JSON.parse(localStorage.getItem('echo-heist-campaign-v1')!), plans: JSON.parse(localStorage.getItem('echo-heist-plans-v1')!) }));
  expect(reset.campaign.credentials).toEqual({}); expect(reset.campaign.outcomes['C4-6-send']).toBeUndefined();
  expect(reset.plans['C4-6-cargo']).toBeUndefined();
  const mainSave = await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/?demo=station-transfer'); await advance(page);
  await expect(page.locator('#chapter-label')).toContainText('独立试玩');
  await expect(page.locator('#story-dialog')).not.toBeVisible();
  await expect(page.locator('#credential-journey')).toContainText('登记厅交出');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.local/station-transfer-mobile.png', fullPage: true });
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'))).toBe(mainSave);
  expect(errors).toEqual([]);
});

test('opening pauses input, real keyboard cooperation saves evidence, and the journal has no future revelations', async ({ page }) => {
  // Two complete missions, reloads and browser teardown use the same real
  // keyboard route and assertions on hardware and software WebGL.
  if (process.env.CI || process.env.ECHO_SOFTWARE_WEBGL) test.setTimeout(300_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await clock(page); await page.goto('/'); await advance(page);
  await expect(page.locator('#story-title')).toHaveText('还有一个人没有回来');
  await move(page, 'd', 60); await expect(page.locator('#seconds')).toHaveText('12');
  await page.locator('#story-next').click(); await page.reload(); await advance(page);
  await expect(page.locator('#story-mode')).toContainText('2 / 4');
  await page.screenshot({ path: '.local/story-opening.png' });
  await page.locator('#story-skip').click();
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 43); await move(page, 's', 26); await page.keyboard.press('r'); await advance(page); await move(page, 'd', 183);
  await expect(page.locator('#overlay-card h2')).toHaveText('缺席的搭档 · 完成');
  await page.locator('#story-button').click();
  await expect(page.locator('#story-body')).toContainText('失物柜上的空白姓名');
  await expect(page.locator('#story-body')).not.toContainText('批准书');
  await expect(page.locator('[data-chapter]')).toHaveCount(2); // dialog + one unlocked chapter button
  await page.locator('#story-close').click(); await page.locator('#overlay-action').click(); await advance(page);
  await page.reload(); await advance(page);
  await expect(page.locator('#operation-title')).toHaveText('有人留守');
  await expect(page.locator('#story-dialog')).not.toBeVisible();
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 17); await move(page, 'w', 17); await page.keyboard.press('r'); await advance(page);
  await move(page, 'd', 154); await move(page, 'w', 86); await move(page, 's', 86); await move(page, 'a', 154);
  await expect(page.locator('#story-title')).toHaveText('两道划痕');
  expect(errors).toEqual([]);
});

test('chapter aftermath resumes after reload and leads to the next chapter opening', async ({ page }) => {
  await clock(page);
  const save = checkpoint('C0-6', true);
  save.runs['C0-6'] = MISSIONS.find(m => m.id === 'C0-6')!.stages.map(s => s.level.id);
  await seed(page, save); await page.goto('/'); await advance(page);
  await expect(page.locator('#story-title')).toHaveText('编号还在走');
  await page.locator('#story-next').click(); await page.reload(); await advance(page);
  await expect(page.locator('#story-mode')).toContainText('2 / 3');
  await page.locator('#story-skip').click(); await page.locator('#overlay-action').click(); await advance(page);
  await expect(page.locator('#story-title')).toHaveText('请按时成为客人');
  await page.locator('#story-next').click(); await page.locator('#story-next').click(); await advance(page);
  await expect(page.locator('#operation-title')).toHaveText('晚到三秒');
  await page.reload(); await advance(page); await expect(page.locator('#story-dialog')).not.toBeVisible();
});

test('a dialogue answer changes the following chapter and replay preserves the saved answer', async ({ page }) => {
  await clock(page); await seed(page, checkpoint('C5-6', true)); await page.goto('/'); await advance(page);
  await page.locator('#story-next').click(); await page.locator('#story-next').click();
  await expect(page.locator('#story-next')).toBeDisabled();
  await page.locator('[data-answer="verify"]').click(); await page.screenshot({ path: '.local/story-choice.png' });
  await page.locator('#story-next').click();
  await page.locator('#mission-board > summary').click();
  await page.locator('.chapter-group:has([data-mission="C6-1"]) > summary').click();
  await page.locator('[data-mission="C6-1"]').click(); await advance(page);
  await expect(page.locator('.story-prose')).toContainText('你要的坐标在纸上');
  await page.locator('#story-skip').click(); await page.locator('#story-button').click();
  await page.locator('button[data-chapter="5"]').click(); await page.locator('[data-scene="c5-departure"]').click();
  await page.locator('#story-next').click(); await page.locator('#story-next').click();
  await expect(page.locator('[data-answer="testify"]')).toBeDisabled();
  await page.locator('#story-next').click(); await page.locator('#story-close').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('echo-heist-story-v1')!).choices['c5-departure'])).toBe('verify');
});

test('museum deposit, preview and reload preserve the real ending in simplified graphics', async ({ page }) => {
  // Exercise the supported low-detail display through the whole archive flow.
  // Full-detail models and camera rendering have a separate browser check.
  if (process.env.CI || process.env.ECHO_SOFTWARE_WEBGL) test.setTimeout(240_000);
  await clock(page);
  const finale = new Campaign(checkpoint('C7-6'));
  while (finale.cleared() < finale.mission.stages.length - 1) expect(finale.commit(playWitness(finale.stage, finale.carryFor(finale.stage.level.id), finale.credentialFor(finale.stage.level.id)))).toBe(true);
  await seed(page, finale.export(), {version: 1, seen: ['c5-departure', 'c7-arrival'], choices: {'c5-departure': 'verify'}});
  await page.goto('/'); await advance(page);
  await expect(page.locator('#mission-title')).toHaveText('把名字带回第一扇门');
  await expect(page.locator('#credential-location')).toContainText('公共身份恢复回执');
  await expect(page.locator('#credential-owner')).toContainText('当前的你');
  await expect(page.locator('#ending-dialog')).not.toBeVisible();
  if (await page.locator('#story-dialog').isVisible()) { await page.locator('#story-skip').click(); await advance(page); }
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 43); await move(page, 's', 26); await page.keyboard.press('r'); await advance(page);
  const returning = await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'));
  await page.locator('#preview-button').click(); await page.locator('#preview-frame').fill('180'); await page.locator('#preview-frame').dispatchEvent('input'); await advance(page);
  await expect(page.locator('#credential-location')).toContainText('只读预演');
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-campaign-v1'))).toBe(returning);
  await page.locator('#preview-button').click(); await advance(page);
  await move(page, 'd', 180); await move(page, 'e', 1); await advance(page);
  await expect(page.locator('#credential-owner')).toContainText('HOME');
  await expect(page.locator('#ending-dialog')).not.toBeVisible();
  await page.screenshot({path: '.local/museum-return-deposited.png', fullPage: true});
  await page.reload(); await advance(page);
  await expect(page.locator('#credential-owner')).toContainText('当前的你');
  await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 180); await move(page, 'e', 1); await move(page, 'a', 180);
  await page.locator('#overlay-action').click(); await advance(page);
  await expect(page.locator('#ending-dialog')).toBeVisible();
  await expect(page.locator('#ending-reunion')).toContainText('逐项核对');
  await expect(page.locator('#ending-reunion')).toContainText('沈舟');
  await expect(page.locator('#ending-reunion')).toContainText('旧馆的签收联');
  await page.screenshot({ path: '.local/story-ending.png' });
  await page.locator('#ending-close').click(); await page.reload(); await advance(page);
  await expect(page.locator('#credential-owner')).toContainText('HOME');
  await expect(page.locator('#overlay-card h2')).toHaveText('回声劫案 · 已完成');
});

test('phone journal fits, pauses an active run, restores focus, and media preferences survive reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await clock(page); await page.goto('/'); await advance(page);
  await page.screenshot({ path: '.local/story-mobile.png' });
  expect(await page.locator('#story-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator('#story-skip').click(); await page.locator('#overlay-action').click(); await advance(page, 30);
  const before = await page.locator('#seconds').textContent();
  await page.locator('#story-button').click(); await move(page, 'r', 60);
  await expect(page.locator('#seconds')).toHaveText(before!);
  await page.screenshot({ path: '.local/story-journal-mobile.png' });
  await page.locator('#story-sound').click(); await advance(page);
  await expect(page.locator('#story-sound')).toHaveText('声音：开');
  await page.keyboard.press('Escape'); await expect(page.locator('#story-button')).toBeFocused();
  await page.reload(); await advance(page); await page.locator('#story-button').click();
  await expect(page.locator('#story-sound')).toHaveText('声音：开');
  await expect(page.locator('#now-playing')).toContainText('Espionage');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('device inputs are recorded, previewed read-only, and restored as a saved plan', async ({ page }) => {
  await clock(page); await page.goto('/?mode=training'); await advance(page);
  await page.locator('#mission-board > summary').click();
  await page.locator('.chapter-group:has([data-mission="LAB-POWER"]) > summary').click();
  await page.locator('[data-mission="LAB-POWER"]').click(); await advance(page);
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 43); await move(page, 'w', 69); await move(page, 'e', 1); await advance(page);
  await expect(page.locator('#door-status')).toHaveText('1 / 1 道门开启 · 可以分时通过');
  await page.keyboard.press('r'); await advance(page);
  const saved = await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'));
  await page.locator('#preview-button').click(); await advance(page);
  await page.locator('#preview-frame').focus(); await page.keyboard.press('End'); await advance(page);
  await expect(page.locator('#preview-log')).toContainText('P 电源接通');
  await expect(page.locator('#record-button')).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('echo-heist-plans-v1'))).toBe(saved);
  await page.goto('/'); await advance(page); await expect(page.locator('#echo-count')).toHaveText('1 / 3');
  const delay = page.locator('[data-delay-input="0"]');
  await delay.fill('2.50'); await delay.dispatchEvent('change'); await advance(page);
  // A focused number input can commit again when its row is replaced. Its
  // displayed seconds and the persisted plan must describe the same delay.
  await page.locator('#overlay-action').click(); await advance(page);
  await page.reload(); await advance(page);
  await expect(page.locator('[data-delay-input="0"]')).toHaveValue('2.50');
});
