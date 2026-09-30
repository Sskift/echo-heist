import type { Page } from '@playwright/test';

export async function clock(page: Page) {
  await page.addInitScript(() => {
    let callbacks: FrameRequestCallback[] = [];
    let now = 0;
    window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
    (window as unknown as { advance: (frames: number) => void }).advance = frames => {
      if (!now) now = performance.now();
      for (let frame = 0; frame < frames; frame++) {
        // Stay just above the fixed-step boundary: floating-point cancellation
        // must not drop a simulated frame at a keyboard rendezvous.
        now += 1000 / 60 + 1e-6;
        const pending = callbacks; callbacks = [];
        pending.forEach(callback => callback(now));
      }
    };
  });
}
export async function advance(page: Page, frames = 1) {
  await page.evaluate(count => (window as unknown as { advance: (n: number) => void }).advance(count), frames);
}
export async function move(page: Page, key: string, frames: number) {
  await page.keyboard.down(key); await advance(page, frames); await page.keyboard.up(key);
}
