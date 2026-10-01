import { Game, type Carry } from './engine.ts';
import type { Stage } from './campaign-content.ts';
import type { CredentialSnapshot } from './levels.ts';

// Author tool: all routes use movement and interaction inputs, never teleports.
export function playWitness(stage: Stage, carry?: Carry, credential?: CredentialSnapshot): Game {
  const game = new Game(stage.level, carry, credential); game.start();
  const step = (x = 0, y = 0, interact = false, lure = false) => {
    if (game.status === 'ready') game.start();
    if (game.status !== 'running') throw new Error(`${stage.level.id}: ${game.status} / ${game.lastMessage}`);
    const attempt = game.attempts;
    game.step({ x, y, interact, lure });
    if (game.attempts !== attempt) throw new Error(`${stage.level.id}: route exceeded 12 seconds`);
  };
  for (const action of stage.witness) {
    if (game.status === 'won') break;
    if ('go' in action) {
      let steps = 0;
      const [x, y] = action.go;
      while (Math.hypot(game.player.x - x, game.player.y - y) > 4 && (game.status as string) !== 'won') {
        if (++steps > 240) throw new Error(`${stage.level.id}: blocked toward ${x},${y} at ${game.player.x},${game.player.y}`);
        const dx = x - game.player.x, dy = y - game.player.y;
        step(Math.abs(dx) > 2 ? Math.sign(dx) : 0, Math.abs(dy) > 2 ? Math.sign(dy) : 0);
      }
    } else if ('wait' in action) { for (let n = 0; n < action.wait && (game.status as string) !== 'won'; n++) step(); }
    else if ('press' in action) { step(0, 0, action.press === 'interact', action.press === 'lure'); if ((game.status as string) !== 'won') step(); }
    else if ('record' in action) { if (!game.rewind()) throw new Error(`${stage.level.id}: cannot record`); }
    else if ('remove' in action) {
      if (!Number.isInteger(action.remove) || !game.echoes[action.remove]) throw new Error(`${stage.level.id}: invalid removal`);
      game.removeEcho(action.remove);
    }
    else if (!game.setDelay(action.echo, action.delay)) throw new Error(`${stage.level.id}: invalid delay`);
  }
  if (game.status !== 'won') throw new Error(`${stage.level.id}: reference plan did not finish at ${Math.round(game.player.x)},${Math.round(game.player.y)} / objective=${game.objectiveComplete} / owner=${game.tokenOwner} / ${game.credentialBlockers().join('; ')} / ${game.signals.slice(-3).map(s => s.text).join('; ')}`);
  return game;
}
