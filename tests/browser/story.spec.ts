import { test, expect, type Page } from '@playwright/test';
import { advance, clock, move } from './helpers.ts';
import { Campaign } from '../../src/campaign.ts';
import { MISSIONS } from '../../src/campaign-content.ts';
import { playWitness } from '../../src/witness.ts';

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

test('opening pauses input, real keyboard cooperation saves evidence, and the journal has no future revelations', async ({ page }) => {
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

test('a dialogue answer changes the following chapter and the real ending; replay preserves it', async ({ page }) => {
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
  const finale = new Campaign(checkpoint('C7-6'));
  while (finale.cleared() < finale.mission.stages.length) expect(finale.commit(playWitness(finale.stage))).toBe(true);
  await page.evaluate(save => localStorage.setItem('echo-heist-campaign-v1', JSON.stringify(save)), finale.export());
  await page.reload(); await advance(page); await page.locator('#overlay-action').click(); await advance(page);
  await expect(page.locator('#ending-dialog')).toBeVisible();
  await expect(page.locator('#ending-reunion')).toContainText('逐项核对');
  await expect(page.locator('#ending-reunion')).toContainText('沈舟');
  await page.screenshot({ path: '.local/story-ending.png' });
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
});
