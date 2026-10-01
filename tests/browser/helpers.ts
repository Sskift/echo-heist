import type { Page } from '@playwright/test';
import type { Game } from '../../src/engine.ts';
import type { WitnessAction } from '../../src/campaign-content.ts';

export async function clock(page: Page) {
  await page.addInitScript(() => {
    let callbacks: FrameRequestCallback[] = [];
    let now = 0;
    window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
    (window as unknown as { advance: (frames: number) => void }).advance = frames => {
      if (!now) now = performance.now();
      for (let frame = 0; frame < frames;) {
        // Exercise the real accumulator at 12 rendered frames/second. Every
        // simulation tick still runs at 60 Hz; software WebGL need not draw
        // five identical intermediate views during a held keyboard input.
        const ticks = Math.min(5, frames - frame);
        // Stay just above the fixed-step boundary: floating-point cancellation
        // must not drop a simulated frame at a keyboard rendezvous.
        now += ticks * (1000 / 60 + 1e-6);
        frame += ticks;
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
  // Authored routes use world axes; exercise the matching real screen keys.
  const keys = ({ d: ['d', 's'], a: ['a', 'w'], w: ['w', 'd'], s: ['s', 'a'] } as Record<string, string[]>)[key] ?? [key];
  for (const k of keys) await page.keyboard.down(k);
  await advance(page, frames);
  for (const k of keys) await page.keyboard.up(k);
}

// Drive authored routes through real controls. The headless model only chooses
// key durations; it never reads or changes the browser's game state.
export async function routeAction(page: Page, model: Game, action: WitnessAction) {
  if ('record' in action) {
    if (!model.rewind()) throw new Error('Reference recording rejected');
    await page.keyboard.press('r'); await advance(page);
    model.step({x:0,y:0,lure:false}); return;
  }
  if ('delay' in action) {
    if (!model.setDelay(action.echo,action.delay)) throw new Error('Reference delay rejected');
    const input=page.locator(`[data-delay-input="${action.echo}"]`);
    await input.fill((action.delay/60).toFixed(2)); await input.dispatchEvent('change'); return;
  }
  if ('remove' in action) { model.removeEcho(action.remove); await page.locator(`[data-delete="${action.remove}"]`).click(); return; }
  if (model.status==='ready') { model.start(); await page.locator('#overlay-action').click(); }
  if ('press' in action) {
    const key=action.press==='interact'?'e':'Space';
    model.step({x:0,y:0,lure:action.press==='lure',interact:action.press==='interact'});
    model.step({x:0,y:0,lure:false});
    await page.keyboard.down(key); await advance(page); await page.keyboard.up(key); await advance(page); return;
  }
  if ('wait' in action) { for(let i=0;i<action.wait;i++)model.step({x:0,y:0,lure:false}); await advance(page,action.wait); return; }
  const chunks:{x:number;y:number;n:number}[]=[]; let steps=0;
  while(Math.hypot(model.player.x-action.go[0],model.player.y-action.go[1])>4 && model.status!=='won') {
    if (++steps>240) throw new Error(`Reference movement blocked in ${model.level.id}`);
    const dx=action.go[0]-model.player.x,dy=action.go[1]-model.player.y;
    const x=Math.abs(dx)>2?Math.sign(dx):0,y=Math.abs(dy)>2?Math.sign(dy):0;
    model.step({x,y,lure:false}); const last=chunks.at(-1);
    if (last?.x===x && last.y===y)last.n++; else chunks.push({x,y,n:1});
  }
  for (const c of chunks) {
    const sx=c.x-c.y,sy=c.x+c.y, keys=[...(sx?[sx>0?'d':'a']:[]),...(sy?[sy>0?'s':'w']:[])];
    for (const key of keys)await page.keyboard.down(key);
    await advance(page,c.n);
    for (const key of keys)await page.keyboard.up(key);
  }
}
