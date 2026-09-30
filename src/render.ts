import { Game, type Frame } from './engine.ts';
import { ECHO_COLORS, HEIGHT, TILE, WIDTH, type Point } from './levels.ts';

const C = { floor: '#17221e', grid: '#203029', wall: '#36443b', wallTop: '#465247', lime: '#c3ed82', ink: '#0c1712', muted: '#718578', amber: '#efbd72' };

export class Renderer {
  ctx: CanvasRenderingContext2D;
  trails = true;
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  rewindFlash = 0;
  lastTime = 0;
  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width === WIDTH * ratio && this.canvas.height === HEIGHT * ratio) return;
    this.canvas.width = WIDTH * ratio;
    this.canvas.height = HEIGHT * ratio;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  text(text: string, x: number, y: number, color = C.muted, size = 10, align: CanvasTextAlign = 'left') {
    const c = this.ctx;
    c.font = `500 ${size}px "IBM Plex Mono", "Consolas", "Microsoft YaHei", monospace`;
    c.textAlign = align;
    c.fillStyle = color;
    c.fillText(text, x, y);
    c.textAlign = 'left';
  }

  line(points: Point[], color: string, width = 1, dash: number[] = []) {
    const c = this.ctx;
    if (!points.length) return;
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) c.lineTo(p.x, p.y);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.setLineDash(dash);
    c.stroke();
    c.setLineDash([]);
  }

  circle(p: Point, r: number, fill: string, stroke?: string) {
    const c = this.ctx;
    c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2);
    c.fillStyle = fill; c.fill();
    if (stroke) { c.lineWidth = 1; c.strokeStyle = stroke; c.stroke(); }
  }

  actor(actor: Frame, color: string, time: number, ghost = false, label = '') {
    const c = this.ctx;
    c.save();
    if (ghost) c.globalAlpha = 0.8;
    c.translate(actor.x, actor.y);
    const pulse = this.reducedMotion ? 0 : Math.sin(time * 3) * 1.5;
    this.circle({ x: 0, y: 2 }, 16 + pulse, `${color}0b`);
    c.shadowColor = color;
    c.shadowBlur = ghost ? 12 : 8;
    c.rotate(actor.angle);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(13, 0); c.lineTo(2, -9); c.lineTo(-8, -7); c.lineTo(-10, 0); c.lineTo(-8, 7); c.lineTo(2, 9); c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = C.ink;
    c.fillRect(3, -5, 3, 10);
    c.fillStyle = ghost ? '#ffffff65' : '#f5f9e8';
    c.fillRect(-6, -4, 5, 8);
    c.rotate(-actor.angle);
    if (ghost) {
      c.strokeStyle = `${color}90`; c.lineWidth = 1; c.setLineDash([2, 3]);
      c.beginPath(); c.arc(0, 0, 19, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    if (label) this.text(label, 0, -27, color, 9, 'center');
    c.restore();
  }

  draw(game: Game, time: number) {
    const c = this.ctx;
    const dt = Math.min(0.1, time - this.lastTime);
    this.lastTime = time;
    c.clearRect(0, 0, WIDTH, HEIGHT);
    c.fillStyle = C.floor; c.fillRect(0, 0, WIDTH, HEIGHT);
    // A deliberately quiet blueprint grid keeps routes and silhouettes legible.
    c.strokeStyle = C.grid; c.lineWidth = 0.6;
    c.beginPath();
    for (let x = 0; x <= WIDTH; x += TILE) { c.moveTo(x, 0); c.lineTo(x, HEIGHT); }
    for (let y = 0; y <= HEIGHT; y += TILE) { c.moveTo(0, y); c.lineTo(WIDTH, y); }
    c.stroke();

    // Pools of light are procedural and independent of external assets.
    for (const [x, y, r, tint] of [[112, 464, 160, '139,187,132'], [816, 112, 215, '188,154,88'], [272, 176, 160, '139,187,132']] as const) {
      const light = c.createRadialGradient(x, y, 0, x, y, r);
      light.addColorStop(0, `rgba(${tint},0.09)`); light.addColorStop(1, `rgba(${tint},0)`);
      c.fillStyle = light; c.fillRect(x - r, y - r, r * 2, r * 2);
    }

    this.text('WEST ANNEX', 65, 76, '#718578', 12);
    this.text('SERVICE / 01', 65, 94, '#475e50', 9);
    this.text(game.level.doors.length > 1 ? 'SECURE ARCHIVE' : 'PRIVATE COLLECTION', 520, 76, '#718578', 12);
    this.text('NIGHT SHIFT  ·  02:14 AM', 520, 94, '#475e50', 9);
    this.text('AUTHORIZED PERSONNEL ONLY', 510, 523, '#40584a', 9);

    // In-floor wiring explains the relationship between each switch and door.
    for (const plate of game.level.plates) {
      const door = game.level.doors.find(d => d.plate === plate.id)!;
      const lit = game.activePlates.has(plate.id);
      const color = lit ? `${C.lime}80` : '#53684665';
      const end = { x: door.x + door.w / 2, y: door.y + door.h / 2 };
      this.line([plate, { x: plate.x, y: end.y }, end], color, 1, lit ? [] : [3, 5]);
      this.circle(plate, 29, lit ? '#c3ed8210' : '#b4c49a05', lit ? '#c3ed8235' : '#59694940');
      c.fillStyle = lit ? '#c3ed8230' : '#273627'; c.fillRect(plate.x - 18, plate.y - 18, 36, 36);
      c.strokeStyle = lit ? C.lime : '#738558'; c.lineWidth = 1.5; c.strokeRect(plate.x - 18, plate.y - 18, 36, 36);
      this.text(plate.id, plate.x, plate.y + 5, lit ? C.lime : '#acbc84', 16, 'center');
      this.text(lit ? `SWITCH ${plate.id} / ACTIVE` : `SWITCH ${plate.id}`, plate.x, plate.y + 43, lit ? C.lime : '#899c74', 9, 'center');
    }

    // Evacuation hatch.
    const exit = game.level.spawn;
    c.save();
    c.fillStyle = game.hasLoot ? '#c3ed8220' : '#8cae9212';
    c.fillRect(exit.x - 30, exit.y - 30, 60, 60);
    c.strokeStyle = game.hasLoot ? C.lime : '#68937a'; c.lineWidth = 1.5;
    c.setLineDash([7, 5]); c.strokeRect(exit.x - 30, exit.y - 30, 60, 60); c.setLineDash([]);
    this.line([{ x: exit.x + 12, y: exit.y }, { x: exit.x - 12, y: exit.y }, { x: exit.x - 4, y: exit.y - 8 }], '#95bca0', 2);
    this.text('撤离点 / EXIT', exit.x, exit.y + 49, game.hasLoot ? C.lime : '#9bbca4', 10, 'center');
    c.restore();

    // Guard light is ray-cast against the same collision geometry as detection.
    game.guards.forEach((guard, i) => {
      const range = game.level.guards[i].range;
      const color = guard.suspicion > 0.2 ? '239,133,103' : '234,188,112';
      const light = c.createRadialGradient(guard.x, guard.y, 0, guard.x, guard.y, range);
      light.addColorStop(0, `rgba(${color},0.23)`); light.addColorStop(1, `rgba(${color},0.02)`);
      c.fillStyle = light;
      c.beginPath(); c.moveTo(guard.x, guard.y);
      for (let angle = guard.angle - 0.56; angle <= guard.angle + 0.57; angle += 0.028) {
        let length = 0;
        for (length = 0; length < range; length += 5) {
          if (game.blocked(guard.x + Math.cos(angle) * length, guard.y + Math.sin(angle) * length, 1)) break;
        }
        c.lineTo(guard.x + Math.cos(angle) * length, guard.y + Math.sin(angle) * length);
      }
      c.closePath(); c.fill();
    });

    // Structural walls with offset shadows and fine surface detail.
    for (const wall of game.level.walls) {
      c.fillStyle = '#080f0c65'; c.fillRect(wall.x + 6, wall.y + 7, TILE, TILE);
    }
    for (const wall of game.level.walls) {
      const border = wall.x === 0 || wall.x === WIDTH - TILE || wall.y === 0 || wall.y === HEIGHT - TILE;
      c.fillStyle = border ? '#2b382e' : C.wall;
      c.fillRect(wall.x, wall.y, TILE, TILE);
      c.fillStyle = border ? '#354336' : C.wallTop; c.fillRect(wall.x, wall.y, TILE, 2);
      c.strokeStyle = '#1b291f70'; c.lineWidth = 1; c.strokeRect(wall.x + 0.5, wall.y + 0.5, TILE - 1, TILE - 1);
      if (!border) {
        c.fillStyle = '#52604760'; c.fillRect(wall.x + 6, wall.y + 8, 20, 2);
        c.fillStyle = '#17211b'; c.fillRect(wall.x + 14, wall.y + 22, 5, 2);
      }
    }

    for (const door of game.level.doors) {
      const open = game.openDoors.has(door.id);
      c.fillStyle = open ? '#c3ed820c' : '#c3ed8220'; c.fillRect(door.x, door.y, door.w, door.h);
      c.strokeStyle = open ? '#c3ed8250' : '#b1c681'; c.lineWidth = 2;
      if (door.h > door.w) {
        this.line([{ x: door.x + 2, y: door.y }, { x: door.x + door.w - 2, y: door.y }], C.lime, 3);
        this.line([{ x: door.x + 2, y: door.y + door.h }, { x: door.x + door.w - 2, y: door.y + door.h }], C.lime, 3);
        if (!open) for (let y = door.y + 8; y < door.y + door.h; y += 8) this.line([{ x: door.x + 3, y }, { x: door.x + door.w - 3, y: y - 4 }], '#b1c68185', 2);
      } else {
        this.line([{ x: door.x, y: door.y }, { x: door.x, y: door.y + door.h }], C.lime, 3);
        this.line([{ x: door.x + door.w, y: door.y }, { x: door.x + door.w, y: door.y + door.h }], C.lime, 3);
        if (!open) for (let x = door.x + 8; x < door.x + door.w; x += 8) this.line([{ x, y: door.y + 3 }, { x: x - 4, y: door.y + door.h - 3 }], '#b1c68185', 2);
      }
      this.text(`${door.id} ${open ? 'OPEN' : 'LOCKED'}`, door.x + door.w / 2, door.y - 13, open ? C.lime : '#a5b28d', 9, 'center');
    }

    const loot = game.level.loot;
    c.fillStyle = '#3a352780'; c.fillRect(loot.x - 25, loot.y - 25, 50, 50);
    c.strokeStyle = '#93795350'; c.lineWidth = 1; c.strokeRect(loot.x - 25, loot.y - 25, 50, 50);
    if (!game.hasLoot) {
      c.save(); c.translate(loot.x, loot.y);
      c.rotate(this.reducedMotion ? Math.PI / 4 : Math.PI / 4 + Math.sin(time) * 0.08);
      c.shadowBlur = 23; c.shadowColor = C.amber;
      c.fillStyle = C.amber; c.fillRect(-10, -10, 20, 20);
      c.shadowBlur = 0; c.fillStyle = '#fff0c7'; c.fillRect(-6, -6, 8, 8);
      c.restore();
    }
    this.text(game.hasLoot ? 'COLLECTED' : '藏品 / THE PRIZE', loot.x, loot.y + 44, C.amber, 10, 'center');

    if (this.trails) for (const echo of game.echoes) {
      const color = ECHO_COLORS[echo.colorIndex];
      const route = echo.frames.filter((_, i) => i % 6 === 0);
      c.save(); c.globalAlpha = 0.25;
      this.line(route, color, 1.5, [3, 4]);
      const end = echo.frames[echo.frames.length - 1];
      this.circle(end, 5, `${color}30`, color);
      c.restore();
    }
    for (const n of game.noise) {
      c.save(); c.globalAlpha = n.life * 0.5;
      this.circle(n, 12 + (1 - n.life) * 100, '#00000000', C.amber); c.restore();
    }
    game.echoes.forEach((echo, i) => this.actor(game.echoAt(echo), ECHO_COLORS[echo.colorIndex], time, true, `ECHO 0${i + 1}`));
    game.guards.forEach(guard => {
      this.actor({ ...guard, lure: false }, guard.suspicion > 0.2 ? '#ed947c' : C.amber, time, false, guard.investigate ? '?' : 'SECURITY');
      if (guard.suspicion > 0) {
        c.fillStyle = '#100e0a'; c.fillRect(guard.x - 15, guard.y + 21, 30, 3);
        c.fillStyle = '#ef957e'; c.fillRect(guard.x - 15, guard.y + 21, guard.suspicion * 30, 3);
      }
    });
    this.actor(game.player, '#eff3df', time, false, 'YOU');
    if (game.hasLoot) this.circle({ x: game.player.x - 13, y: game.player.y + 9 }, 4, C.amber);

    const vignette = c.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.25, WIDTH / 2, HEIGHT / 2, WIDTH * 0.65);
    vignette.addColorStop(0, '#060d0800'); vignette.addColorStop(1, '#060d0865');
    c.fillStyle = vignette; c.fillRect(0, 0, WIDTH, HEIGHT);
    // Coordinate marks create a map-like frame without adding visual clutter.
    for (let x = 96; x < WIDTH - 32; x += 128) this.text(`${String(x / 32).padStart(2, '0')}`, x, 20, '#82907870', 8);
    this.text('N', WIDTH - 50, 63, '#91a583', 10);
    this.line([{ x: WIDTH - 47, y: 93 }, { x: WIDTH - 47, y: 74 }, { x: WIDTH - 51, y: 80 }], '#91a583', 1);

    if (game.alarm > 0.1) {
      c.strokeStyle = `rgba(239,133,103,${game.alarm * 0.7})`; c.lineWidth = 8; c.strokeRect(4, 4, WIDTH - 8, HEIGHT - 8);
    }
    if (this.rewindFlash > 0 && !this.reducedMotion) {
      this.rewindFlash = Math.max(0, this.rewindFlash - dt * 2);
      c.fillStyle = `rgba(195,237,130,${this.rewindFlash * 0.13})`; c.fillRect(0, 0, WIDTH, HEIGHT);
      c.fillStyle = `rgba(195,237,130,${this.rewindFlash * 0.3})`;
      c.fillRect(0, (1 - this.rewindFlash) * HEIGHT, WIDTH, 2);
    }
  }
}
