import { Game, type Frame } from './engine.ts';
import { doorPlates, ECHO_COLORS, HEIGHT, TILE, WIDTH, type Point } from './levels.ts';

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
    if (ghost) c.globalAlpha *= 0.8;
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
    const palette = game.level.theme === 'gala' ? { floor: '#24221e', grid: '#343129', wall: '#4a473b', wallTop: '#66634d' } : game.level.theme === 'industrial' ? { floor: '#1b232b', grid: '#293541', wall: '#3c4a57', wallTop: '#657989' } : C;
    const dt = Math.min(0.1, time - this.lastTime);
    this.lastTime = time;
    c.clearRect(0, 0, WIDTH, HEIGHT);
    c.fillStyle = palette.floor; c.fillRect(0, 0, WIDTH, HEIGHT);
    // A deliberately quiet blueprint grid keeps routes and silhouettes legible.
    c.strokeStyle = palette.grid; c.lineWidth = 0.6;
    c.beginPath();
    for (let x = 0; x <= WIDTH; x += TILE) { c.moveTo(x, 0); c.lineTo(x, HEIGHT); }
    for (let y = 0; y <= HEIGHT; y += TILE) { c.moveTo(0, y); c.lineTo(WIDTH, y); }
    c.stroke();

    // Pools of light are procedural and independent of external assets.
    for (const [x, y, r, tint] of [[game.level.spawn.x, game.level.spawn.y, 160, '139,187,132'], [game.level.loot.x, game.level.loot.y, 215, '188,154,88']] as const) {
      const light = c.createRadialGradient(x, y, 0, x, y, r);
      light.addColorStop(0, `rgba(${tint},0.09)`); light.addColorStop(1, `rgba(${tint},0)`);
      c.fillStyle = light; c.fillRect(x - r, y - r, r * 2, r * 2);
    }

    this.text(game.level.district ?? 'WEST ANNEX', 65, 76, '#718578', 12);
    this.text(game.level.title, 65, 94, '#75927e', 10);
    this.text(game.level.doors.length > 1 ? 'SECURE ARCHIVE' : 'PRIVATE COLLECTION', 520, 76, '#718578', 12);
    this.text('NIGHT SHIFT  ·  02:14 AM', 520, 94, '#475e50', 9);
    this.text('AUTHORIZED PERSONNEL ONLY', 510, 523, '#40584a', 9);

    for (const marker of game.level.soundMarkers ?? []) {
      this.circle(marker, 15, '#efbd7208', '#efbd7250');
      this.text(marker.id, marker.x, marker.y + 4, '#cead79', 9, 'center');
      this.text('参考响点', marker.x, marker.y + 29, '#a68c62', 8, 'center');
    }

    // In-floor wiring explains the relationship between each switch and door.
    for (const plate of game.level.plates) {
      const lit = game.activePlates.has(plate.id);
      const color = lit ? `${C.lime}80` : '#53684665';
      for (const door of game.level.doors.filter(d => doorPlates(d).includes(plate.id))) {
        const end = { x: door.x + door.w / 2, y: door.y + door.h / 2 };
        this.line([plate, { x: plate.x, y: end.y }, end], color, 1, lit ? [] : [3, 5]);
      }
      this.circle(plate, 29, lit ? '#c3ed8210' : '#b4c49a05', lit ? '#c3ed8235' : '#59694940');
      c.fillStyle = lit ? '#c3ed8230' : '#273627'; c.fillRect(plate.x - 18, plate.y - 18, 36, 36);
      c.strokeStyle = lit ? C.lime : '#738558'; c.lineWidth = 1.5; c.strokeRect(plate.x - 18, plate.y - 18, 36, 36);
      this.text(plate.id, plate.x, plate.y + 5, lit ? C.lime : '#acbc84', 16, 'center');
      this.text(lit ? `SWITCH ${plate.id} / ACTIVE` : `SWITCH ${plate.id}`, plate.x, plate.y + 43, lit ? C.lime : '#899c74', 9, 'center');
      if (plate.window) this.text(`${plate.window[0]}–${plate.window[1]}s 响应`, plate.x, plate.y + 58, C.amber, 9, 'center');
    }

    // Evacuation hatch.
    const exit = game.level.exit ?? game.level.spawn;
    c.save();
    c.fillStyle = game.hasLoot ? '#c3ed8220' : '#8cae9212';
    c.fillRect(exit.x - 30, exit.y - 30, 60, 60);
    c.strokeStyle = game.hasLoot ? C.lime : '#68937a'; c.lineWidth = 1.5;
    c.setLineDash([7, 5]); c.strokeRect(exit.x - 30, exit.y - 30, 60, 60); c.setLineDash([]);
    this.line([{ x: exit.x + 12, y: exit.y }, { x: exit.x - 12, y: exit.y }, { x: exit.x - 4, y: exit.y - 8 }], '#95bca0', 2);
    this.text(!game.exitReady ? '供电未就绪 / WAIT' : game.level.objective === 'reach' ? '安全锚点 / ANCHOR' : '撤离点 / EXIT', exit.x, exit.y + 49, !game.exitReady ? C.amber : game.hasLoot ? C.lime : '#9bbca4', 10, 'center');
    c.restore();

    // Guard light is ray-cast against the same collision geometry as detection.
    game.guards.forEach((guard, i) => {
      if (!game.powered(game.level.guards[i].power)) return;
      const route = game.level.guards[i].route;
      if (this.trails && route.length > 1) this.line([...route, route[0]], '#efbd7235', 1, [3, 7]);
      const range = game.visionRange(i);
      const color = guard.suspicion > 0.2 ? '239,133,103' : '234,188,112';
      const light = c.createRadialGradient(guard.x, guard.y, 0, guard.x, guard.y, range);
      light.addColorStop(0, `rgba(${color},0.23)`); light.addColorStop(1, `rgba(${color},0.02)`);
      c.fillStyle = light;
      c.beginPath(); c.moveTo(guard.x, guard.y);
      for (let angle = guard.angle - 0.56; angle <= guard.angle + 0.57; angle += 0.028) {
        let length = 0;
        for (length = 0; length < range; length += 5) {
          if (game.occluded(guard.x + Math.cos(angle) * length, guard.y + Math.sin(angle) * length)) break;
        }
        c.lineTo(guard.x + Math.cos(angle) * length, guard.y + Math.sin(angle) * length);
      }
      c.closePath(); c.fill();
    });

    for (const glass of game.level.glass ?? []) {
      c.fillStyle = '#8ed4ed1c'; c.fillRect(glass.x, glass.y, glass.w, glass.h);
      c.strokeStyle = '#8ed4edb0'; c.lineWidth = 2; c.strokeRect(glass.x, glass.y, glass.w, glass.h);
      this.text(`${glass.id} / 玻璃·不遮视线`, Math.min(glass.x, WIDTH - 160), glass.y + glass.h + 15, '#8ed4ed', 9);
      for (let y = glass.y + 12; y < glass.y + glass.h - 8; y += 28) this.line([{ x: glass.x + 4, y: y + 5 }, { x: glass.x + glass.w - 4, y }], '#8ed4ed60');
    }
    for (const scanner of game.level.scanners ?? []) {
      const active = game.scanning(scanner);
      const phase = (game.seconds + (scanner.phase ?? 0)) % scanner.period;
      const next = active ? scanner.active[1] - phase : phase < scanner.active[0] ? scanner.active[0] - phase : scanner.period - phase + scanner.active[0];
      c.fillStyle = active ? '#ef947c28' : '#efbd7208'; c.fillRect(scanner.x, scanner.y, scanner.w, scanner.h);
      c.strokeStyle = active ? '#ef947caa' : '#efbd7260'; c.lineWidth = 1; c.setLineDash(active ? [] : [5, 5]); c.strokeRect(scanner.x, scanner.y, scanner.w, scanner.h); c.setLineDash([]);
      if (active) for (let y = scanner.y + 6; y < scanner.y + scanner.h; y += 12) this.line([{ x: scanner.x, y }, { x: scanner.x + scanner.w, y }], '#ef947c55');
      this.text(`${scanner.id} / ${active ? '扫描' : '空档'} ${Math.max(0, next).toFixed(1)}s`, scanner.x + scanner.w / 2, scanner.y - 12, active ? '#ef947c' : '#efbd72', 10, 'center');
    }
    for (const field of game.level.suppressors ?? []) {
      const active = game.powered(field.power);
      c.fillStyle = active ? '#ba91e322' : '#ba91e306'; c.fillRect(field.x, field.y, field.w, field.h);
      c.strokeStyle = active ? '#ba91e390' : '#ba91e330'; c.setLineDash([4, 4]); c.strokeRect(field.x, field.y, field.w, field.h); c.setLineDash([]);
      if (active) for (let x = field.x + 8; x < field.x + field.w; x += 16) this.line([{ x, y: field.y }, { x, y: field.y + field.h }], '#ba91e325');
      this.text(`${field.id} / ${active ? '抑制投影' : '抑制已关闭'}`, field.x + field.w / 2, field.y - 12, '#c6a8e4', 10, 'center');
    }
    for (const circuit of game.level.circuits ?? []) {
      const on = game.circuits.get(circuit.id), color = on ? '#c3ed82' : '#efbd72';
      for (const door of game.level.doors.filter(d => d.power?.id === circuit.id)) this.line([circuit, { x: door.x, y: circuit.y }, { x: door.x, y: door.y }], `${color}60`, 1, [6, 4]);
      if (this.trails) game.level.guards.forEach((def, i) => {
        const link = def.power?.id === circuit.id ? def.power : def.lighting?.id === circuit.id ? def.lighting : null;
        if (!link) return;
        const at = game.guards[i], active = game.powered(link);
        this.line([circuit, { x: at.x, y: circuit.y }, at], active ? '#efbd7260' : '#7898a335', 1, [3, 6]);
        if (def.lighting) { this.circle({ x: at.x + 25, y: at.y - 19 }, 5, active ? '#efbd72' : '#485866'); this.text(active ? '灯亮' : '灯灭', at.x + 25, at.y - 32, active ? C.amber : '#91a8bc', 8, 'center'); }
      });
      c.fillStyle = '#283629'; c.fillRect(circuit.x - 18, circuit.y - 18, 36, 36);
      c.strokeStyle = color; c.strokeRect(circuit.x - 18, circuit.y - 18, 36, 36);
      this.text('⏻', circuit.x, circuit.y + 6, color, 20, 'center');
      const align = game.blocked(circuit.x + 32, circuit.y + 40, 1) ? 'right' : game.blocked(circuit.x - 32, circuit.y + 40, 1) ? 'left' : 'center';
      this.text(`${circuit.id} ${game.circuitState(circuit.id)} / E 操作`, circuit.x, circuit.y + 40, color, 10, align);
      if (circuit.label) this.text(circuit.label, circuit.x, circuit.y + 55, '#91a8bc', 9, align);
    }
    for (const terminal of game.level.terminals ?? []) {
      const holding = game.tokenOwner === `terminal:${terminal.id}`;
      const color = holding ? '#efbd72' : '#8ed4ed';
      this.circle(terminal, 22, '#18323b', color);
      this.text(terminal.id, terminal.x, terminal.y + 5, color, 15, 'center');
      this.text(`${terminal.kind === 'source' ? '凭据源' : terminal.kind === 'lock' ? '授权' : '接力'} / E`, terminal.x, terminal.y + 40, color, 10, 'center');
      if (holding) this.circle({ x: terminal.x + 18, y: terminal.y - 18 }, 5, C.amber);
    }

    // Structural walls with offset shadows and fine surface detail.
    for (const wall of game.level.walls) {
      c.fillStyle = '#080f0c65'; c.fillRect(wall.x + 6, wall.y + 7, TILE, TILE);
    }
    for (const wall of game.level.walls) {
      const border = wall.x === 0 || wall.x === WIDTH - TILE || wall.y === 0 || wall.y === HEIGHT - TILE;
      c.fillStyle = border ? '#2b382e' : palette.wall;
      c.fillRect(wall.x, wall.y, TILE, TILE);
      c.fillStyle = border ? '#354336' : palette.wallTop; c.fillRect(wall.x, wall.y, TILE, 2);
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
      const windows = door.windows ?? (door.window ? [door.window] : []);
      if (windows.length) this.text(windows.map(([start, end]) => `${start}–${end}s`).join(' / '), door.x + door.w / 2, door.y + door.h + 18, C.amber, 10, 'center');
      const inputs = doorPlates(door);
      if (inputs.length > 1 || door.plateMode === 'none') this.text(`${inputs.join('+')} ${door.plateMode === 'one' ? '恰好一个' : door.plateMode === 'none' ? '全部松开' : door.plateMode === 'any' ? '至少一个' : '同时满足'}`, door.x + door.w / 2, door.y - 29, '#b5cfa1', 9, 'center');
    }

    if (game.level.objective !== 'reach') {
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
    this.text(game.hasLoot ? 'COLLECTED' : game.level.lootLabel ?? '藏品 / THE PRIZE', loot.x, loot.y + 44, C.amber, 10, 'center');
    if (!game.hasLoot && !game.canCollect) this.text(`取物需 ${game.powerRequirements(game.level.lootPower)}`, loot.x, loot.y + 59, '#ef947c', 9, 'center');
    else if (!game.hasLoot && game.level.onLoot) this.text('拆离后需恢复供电', loot.x, loot.y + 59, '#ef947c', 9, 'center');
    }

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
    game.activeEchoes.forEach(({ echo, index }) => {
      const at = game.echoAt(echo), suppressed = game.suppressed(at);
      c.save(); if (suppressed) c.globalAlpha = 0.3;
      this.actor(at, ECHO_COLORS[echo.colorIndex], time, true, `E${index + 1}${suppressed ? ' / 失效' : ''}`);
      if (game.tokenOwner === `echo:${echo.colorIndex}`) this.circle({ x: at.x + 16, y: at.y + 10 }, 5, C.amber);
      c.restore();
    });
    game.guards.forEach((guard, index) => {
      const enabled = game.powered(game.level.guards[index].power);
      const sentry = game.level.guards[index].kind === 'sentry';
      const camera = game.level.guards[index].kind === 'camera';
      const label = !enabled ? `${game.guardName(index)} / 停机` : guard.investigate ? `${game.guardName(index)} / ${guard.searching ? '搜索' : '调查'}` : `${game.guardName(index)} / ${camera ? '摄像头' : sentry ? '固定哨兵' : '巡逻'}`;
      if (sentry) { c.strokeStyle = '#efbd7280'; c.lineWidth = 1; c.strokeRect(guard.x - 19, guard.y - 19, 38, 38); }
      if (camera) { c.strokeStyle = enabled ? C.amber : '#526153'; c.lineWidth = 2; c.strokeRect(guard.x - 21, guard.y - 13, 42, 26); this.circle(guard, 6, enabled ? C.amber : '#526153'); }
      if (guard.investigate && this.trails) {
        this.line([guard, ...(guard.path ?? []), guard.investigate], '#efbd7260', 1, [4, 5]);
        this.circle(guard.investigate, 9, '#efbd7210', '#efbd72');
      }
      this.actor({ ...guard, lure: false }, !enabled ? '#526153' : guard.suspicion > 0.2 ? '#ed947c' : C.amber, time, false, label);
      if (guard.suspicion > 0) {
        c.fillStyle = '#100e0a'; c.fillRect(guard.x - 15, guard.y + 21, 30, 3);
        c.fillStyle = '#ef957e'; c.fillRect(guard.x - 15, guard.y + 21, guard.suspicion * 30, 3);
      }
    });
    if (game.editingIndex !== null && this.trails) {
      const color = ECHO_COLORS[game.echoes[game.editingIndex].colorIndex];
      this.line(game.recording.filter((_, i) => i % 3 === 0), `${color}b0`, 2);
    }
    if (!game.spectator) this.actor(game.player, game.editingIndex === null ? '#eff3df' : ECHO_COLORS[game.echoes[game.editingIndex].colorIndex], time, false, game.editingIndex === null ? 'YOU' : `REC ECHO 0${game.editingIndex + 1}`);
    if (game.hasLoot) this.circle({ x: game.player.x - 13, y: game.player.y + 9 }, 4, C.amber);
    if (game.tokenOwner === 'player') this.circle({ x: game.player.x + 16, y: game.player.y + 10 }, 5, C.amber);
    if (game.failure) {
      this.circle(game.failure.point, 28, '#ed947c15', '#ed947c');
      this.text(`${(game.failure.frame / 60).toFixed(2)}s 暴露`, game.failure.point.x, game.failure.point.y - 39, '#ed947c', 11, 'center');
    }

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
