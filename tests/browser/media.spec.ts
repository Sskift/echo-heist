import { expect, test, type Page } from '@playwright/test';
import { MISSIONS } from '../../src/campaign-content.ts';
import { advance, clock, move } from './helpers.ts';

// Probe the actual Web Audio graph at its limiter output, not a mocked player.
async function probe(page: Page) {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const state = { contexts: 0, sources: [] as AudioBufferSourceNode[], taps: [] as AnalyserNode[], decodedImages: 0 };
    Object.assign(window, { mediaProbe: state });
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) { super(options); state.contexts++; }
      createDynamicsCompressor() {
        const node = super.createDynamicsCompressor(), tap = this.createAnalyser();
        tap.fftSize = 2048; node.connect(tap); state.taps.push(tap); return node;
      }
      createBufferSource() { const node = super.createBufferSource(); state.sources.push(node); return node; }
    };
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () { await decode.call(this); state.decodedImages++; };
  });
}
async function energy(page: Page) {
  return page.evaluate(() => {
    const probe = (window as unknown as { mediaProbe: { taps: AnalyserNode[] } }).mediaProbe;
    let sum = 0;
    for (const tap of probe.taps) { const data = new Float32Array(tap.fftSize); tap.getFloatTimeDomainData(data); sum += data.reduce((n, v) => n + v * v, 0) / data.length; }
    return Math.sqrt(sum);
  });
}
async function changeVolume(page: Page, id: string, value: number) {
  await page.locator(`#${id}-volume`).evaluate((input: HTMLInputElement, value) => { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}
async function sourceCount(page: Page) { return page.evaluate(() => (window as unknown as { mediaProbe: { sources: unknown[] } }).mediaProbe.sources.length); }

test('real music plays only after opt-in, stays continuous through rewind and fast-forward, and master mute silences it', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await probe(page); await clock(page); await page.goto('/'); await advance(page);
  expect(await sourceCount(page)).toBe(0);
  await page.locator('#sound-button').click();
  await expect(page.locator('#now-playing')).toHaveText('Espionage · brandon75689');
  await expect.poll(() => energy(page)).toBeGreaterThan(0.00005);
  expect(await sourceCount(page)).toBe(1);
  await page.locator('#overlay-action').click(); await advance(page);
  await move(page, 'd', 40); await page.keyboard.press('r'); await advance(page);
  await move(page, 'Shift', 30);
  expect(await sourceCount(page)).toBe(1);
  const rate = await page.evaluate(() => (window as unknown as { mediaProbe: { sources: AudioBufferSourceNode[] } }).mediaProbe.sources[0].playbackRate.value);
  expect(rate).toBe(1);
  await page.locator('#sound-button').click();
  await expect.poll(() => energy(page)).toBeLessThan(0.000001);
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('music and effects can be silenced separately; background mute and settings survive reload without autoplay', async ({ page }) => {
  await probe(page); await clock(page); await page.goto('/'); await advance(page);
  await page.locator('#media-button').click(); await page.locator('#audio-toggle').click();
  await expect(page.locator('#now-playing')).toContainText('Espionage');
  await changeVolume(page, 'effects', 0);
  await expect.poll(() => energy(page)).toBeGreaterThan(0.00005);
  await changeVolume(page, 'music', 0);
  await expect.poll(() => energy(page)).toBeLessThan(0.000001);
  await changeVolume(page, 'music', 65);
  await expect.poll(() => energy(page)).toBeGreaterThan(0.00005);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(() => energy(page)).toBeLessThan(0.000001);
  await expect(page.locator('#now-playing')).toHaveText('后台静音');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => energy(page)).toBeGreaterThan(0.00005);
  await page.locator('#adaptive-audio').uncheck();
  await page.locator('#scene-detail').uncheck();
  await page.reload(); await advance(page);
  expect(await sourceCount(page)).toBe(0);
  await page.locator('#media-button').click();
  await expect(page.locator('#music-volume')).toHaveValue('65');
  await expect(page.locator('#effects-volume')).toHaveValue('0');
  await expect(page.locator('#adaptive-audio')).not.toBeChecked();
  await expect(page.locator('#scene-detail')).not.toBeChecked();
  await expect(page.locator('#now-playing')).toHaveText('点击开启声音或开始行动');
});

test('muting while audio is decoding cannot start a late song; re-enabling uses one context and one song', async ({ page }) => {
  await probe(page); await clock(page); await page.goto('/'); await advance(page);
  await page.locator('#media-button').click();
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('#audio-toggle')!;
    button.click(); button.click();
  });
  await expect(page.locator('#now-playing')).toHaveText('声音已关闭');
  // Await real decoder progress without faking time or audio nodes.
  await page.waitForTimeout(750);
  expect(await sourceCount(page)).toBe(0); expect(await energy(page)).toBe(0);
  await page.locator('#audio-toggle').click();
  await expect(page.locator('#now-playing')).toContainText('Espionage');
  await expect.poll(() => energy(page)).toBeGreaterThan(0.00005);
  expect(await sourceCount(page)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { mediaProbe: { contexts: number } }).mediaProbe.contexts)).toBe(1);
});

test('theme and ending tracks decode, crossfade and produce real audio; rapid selection cannot leave a stale load', async ({ page }) => {
  await probe(page); await page.goto('/');
  // Exercise the production mixer with its real embedded files, including the
  // race where a chapter changes while the previous decode is still pending.
  await page.evaluate(async () => {
    const modulePath = '/src/audio.ts';
    const { Sound } = await import(/* @vite-ignore */ modulePath);
    const sound = new Sound(); Object.assign(window, { testMixer: sound });
    sound.enabled = true; sound.unlock();
    sound.updateScene('industrial', 'running', 0.8, false, false);
    sound.updateScene('archive', 'running', 0, false, false);
  });
  const description = () => page.evaluate(() => (window as unknown as { testMixer: { description: string } }).testMixer.description);
  await expect.poll(description).toContain('Espionage');
  await expect.poll(() => energy(page)).toBeGreaterThan(0.00005);
  await page.evaluate(() => (window as unknown as { testMixer: { updateScene: (...args: unknown[]) => void } }).testMixer.updateScene('industrial', 'running', 0.8, false, false));
  await expect.poll(description).toContain('Strange Experiments');
  await expect.poll(() => energy(page)).toBeGreaterThan(0.00005);
  await page.evaluate(() => (window as unknown as { testMixer: { updateScene: (...args: unknown[]) => void } }).testMixer.updateScene('archive', 'won', 0, false, true));
  await expect.poll(description).toContain('PYNCHON');
  await expect.poll(() => energy(page)).toBeGreaterThan(0.00005);
  const durations = await page.evaluate(() => (window as unknown as { mediaProbe: { sources: AudioBufferSourceNode[] } }).mediaProbe.sources.map(s => s.buffer!.duration));
  expect(durations).toHaveLength(3);
  expect(durations[0]).toBeGreaterThan(70); expect(durations[1]).toBeGreaterThan(240); expect(durations[2]).toBeGreaterThan(30);
});

test('downloaded art decodes, detail mode changes only rendering, and a real keyboard solution still completes', async ({ page }) => {
  await probe(page); await clock(page); await page.goto('/'); await advance(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { mediaProbe: { decodedImages: number } }).mediaProbe.decodedImages)).toBe(8);
  await page.locator('#overlay-action').click(); await advance(page);
  await page.screenshot({ path: '.local/art-archive.png', fullPage: true });
  const detailed = await page.locator('canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.locator('#media-button').click(); await page.locator('#scene-detail').uncheck(); await advance(page);
  const simple = await page.locator('canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL());
  expect(simple).not.toBe(detailed);
  await page.locator('#scene-detail').check(); await page.keyboard.press('Escape');
  await expect(page.locator('#media-dialog')).not.toBeVisible(); await advance(page);
  await move(page, 'd', 43); await move(page, 's', 26); await page.keyboard.press('r'); await advance(page);
  await move(page, 'd', 188);
  await expect(page.locator('#overlay-card h2')).toHaveText('缺席的搭档 · 完成');
});

test('industrial art and audio controls remain readable on a narrow screen with no external requests', async ({ page }) => {
  const requests: string[] = []; page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:5173')) requests.push(r.url()); });
  const main = MISSIONS.filter(m => !m.id.startsWith('LAB-')); const before = main.slice(0, main.findIndex(m => m.id === 'C3-1'));
  await page.addInitScript(save => localStorage.setItem('echo-heist-campaign-v1', JSON.stringify(save)), { version: 1, selected: 'C3-1', completed: before.map(m => m.id), runs: Object.fromEntries(before.map(m => [m.id, m.stages.map(s => s.level.id)])) });
  await probe(page); await clock(page); await page.goto('/'); await advance(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { mediaProbe: { decodedImages: number } }).mediaProbe.decodedImages)).toBe(8);
  await page.locator('#overlay-action').click(); await advance(page);
  await page.screenshot({ path: '.local/art-industrial.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#media-button').click(); await page.locator('#audio-toggle').click();
  await expect(page.locator('#now-playing')).toContainText('Strange Experiments');
  await expect(page.locator('#music-volume')).toBeInViewport();
  await page.locator('.media-credits summary').click();
  await page.locator('.media-credits').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.local/media-mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false); expect(requests).toEqual([]);
});
