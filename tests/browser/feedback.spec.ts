import { test, expect } from '@playwright/test';
import { Game } from '../../src/engine.ts';
import { MISSIONS } from '../../src/campaign-content.ts';
import { clock, advance, routeAction, openPlanning, closePlanning } from './helpers.ts';

test('the introductory plate cues recording only after real pressure, then explains held echoes', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await clock(page); await page.goto('/');
  await page.locator('#game-canvas[data-scene-ready="ready"]').waitFor(); await advance(page);
  if (await page.locator('#story-dialog').isVisible()) await page.locator('#story-skip').click();
  const stage = MISSIONS[0].stages[0], model = new Game(stage.level);
  await expect(page.locator('#record-button')).not.toHaveClass(/lesson-ready/);
  for (const action of stage.witness.slice(0, 2)) await routeAction(page, model, action);
  await expect(page.locator('#record-button')).toHaveClass(/lesson-ready/);
  // Full-scene GPU readbacks took 91s + 57s on the CI software renderer.
  // Keep the actual 3D interaction and assert its outcomes here; visual-review
  // captures are separate, and Playwright still attaches images on failure.
  await openPlanning(page); await advance(page,30);
  await expect(page.locator('#record-button')).not.toHaveClass(/lesson-ready/);
  await closePlanning(page); await advance(page);
  await expect(page.locator('#record-button')).toHaveClass(/lesson-ready/);
  await routeAction(page, model, stage.witness[2]);
  await expect(page.locator('#record-button')).not.toHaveClass(/lesson-ready/);
  await advance(page,model.echoes[0].frames.length + 10);
  await expect(page.locator('[data-echo-state="0"]')).toHaveText('守住 A 开关');
  await page.setViewportSize({width:390,height:844}); await advance(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await openPlanning(page); await advance(page);
  await expect(page.locator('[data-echo-state="0"]')).toBeVisible();
  await expect(page.locator('[data-echo-state="0"]')).toHaveText('守住 A 开关');
  expect(errors).toEqual([]);
});

test('visible hardware follows actual opening, waiting, rejected requests and unique credential ownership', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript('window.__name = (target) => target;');
  await page.route('**/feedback-audit', route => route.fulfill({contentType:'text/html',body:'<style>body{margin:0}canvas{width:1100px;height:720px}.scene-labels{position:absolute;inset:0;pointer-events:none}</style><canvas id="audit"></canvas>'}));
  await page.goto('/feedback-audit');
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite browser module URL.
    const {Renderer} = await import('/src/scene3d.ts');
    // @ts-expect-error Vite browser module URL.
    const {Game} = await import('/src/engine.ts');
    // @ts-expect-error Vite browser module URL.
    const {LEVELS} = await import('/src/levels.ts');
    const renderer = new Renderer(document.querySelector('#audit'));
    await renderer.models.ready;
    const level = {...LEVELS[0], id:'C4-feedback', walls:LEVELS[0].walls.filter((p: {x:number;y:number}) => p.x===0 || p.x===928 || p.y===0 || p.y===544), spawn:{x:272,y:304},
      plates:[{id:'A',x:272,y:240}], doors:[{id:'A',x:448,y:256,w:32,h:64,plate:'A'}],
      terminals:[{id:'S',x:400,y:400,kind:'source'},{id:'R',x:528,y:400,kind:'relay',waitForDelivery:true},{id:'L',x:656,y:400,kind:'lock',authorization:'SIGNED'}], loot:{x:816,y:112}};
    const game = new Game(level); game.start();
    const idle = {x:0,y:0,lure:false};
    const draw = () => renderer.draw(game, game.seconds);
    draw(); const closed = renderer.doors.get('A').scale.y, raised = renderer.plates.get('A').position.y;
    for (let i=0;i<16;i++) {game.step({...idle,y:-1}); draw();}
    for (let i=0;i<15;i++) {game.step(idle); draw();}
    const opened = renderer.doors.get('A').scale.y, depressed = renderer.plates.get('A').position.y;
    const openedInEngine = game.openDoors.has('A');
    game.togglePause(); const pausedFrame = game.frame; draw(); draw();
    const frozen = game.frame === pausedFrame && renderer.doors.get('A').scale.y === opened; game.togglePause();
    const use = (x:number,y:number) => {game.player.x=x;game.player.y=y;game.step(idle);game.step({...idle,interact:true});draw();return game.operationLog.at(-1).result;};
    const blocked = use(656,400), waiting = use(528,400), receiverRegistered = game.waitingReceivers.has('player');
    const take = use(400,400), taken = game.tokenOwner === 'player' && !renderer.tickets.get('S').visible;
    const give = use(528,400), stored = game.tokenOwner === 'terminal:R' && renderer.tickets.get('R').visible && !renderer.tickets.get('S').visible;
    const receive = use(528,400), sign = use(656,400);
    const unique = game.tokenOwner === 'player' && game.authorized.has('SIGNED') && [...renderer.tickets.values()].every((ticket: {visible:boolean})=>!ticket.visible);
    const before = JSON.stringify({frame:game.frame,owner:game.tokenOwner,log:game.operationLog,echoes:game.echoes});
    renderer.reducedMotion = true; draw(); draw();
    const readOnly = before === JSON.stringify({frame:game.frame,owner:game.tokenOwner,log:game.operationLog,echoes:game.echoes});
    (window as any).feedbackAudit = {renderer,game};
    return {closed,raised,opened,depressed,openedInEngine,frozen,blocked,waiting,receiverRegistered,take,taken,give,stored,receive,sign,unique,readOnly,glError:renderer.gl.getContext().getError()};
  });
  expect(result.closed).toBe(1); expect(result.opened).toBeLessThan(.15); expect(result.depressed).toBeLessThan(result.raised);
  for (const flag of ['openedInEngine','frozen','receiverRegistered','taken','stored','unique','readOnly'] as const) expect(result[flag],flag).toBe(true);
  expect(result.blocked).toBe('blocked'); expect(result.waiting).toBe('waiting');
  for (const outcome of ['take','give','receive','sign'] as const) expect(result[outcome],outcome).toBe('success');
  expect(result.glError).toBe(0); expect(errors).toEqual([]);
  await page.screenshot({path:'.local/feedback-credential.png'});
});
