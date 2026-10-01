import agentURL from './assets/art/agent.png?inline';
import guardURL from './assets/art/guard.png?inline';
import trackerURL from './assets/art/tracker.png?inline';
import stoneURL from './assets/art/floor-stone.png?inline';
import woodURL from './assets/art/floor-wood.png?inline';
import concreteURL from './assets/art/floor-concrete.png?inline';
import crateURL from './assets/art/crate.png?inline';
import papersURL from './assets/art/papers.png?inline';
import { HEIGHT, TILE, WIDTH, type Level } from './levels.ts';

// Kenney CC0 artwork. Raster surfaces are cached, while all gameplay overlays
// stay in Renderer and continue to use the actual simulation geometry.
const urls = { agent: agentURL, guard: guardURL, tracker: trackerURL, stone: stoneURL, wood: woodURL, concrete: concreteURL, crate: crateURL, papers: papersURL };
type Asset = keyof typeof urls;
const looks = {
  archive: { floor: '#23302d', wall: '#4c5d56', edge: '#98b5a1', accent: '#9bb99b', material: 'wood', label: 'ARCHIVE / 旧馆' },
  gala: { floor: '#34332e', wall: '#665f4c', edge: '#c8b986', accent: '#d2bb80', material: 'stone', label: 'GALLERY / 夜场' },
  industrial: { floor: '#202e39', wall: '#485d6a', edge: '#9fb5c0', accent: '#86c8d5', material: 'concrete', label: 'SERVICE / 机房' },
  clockwork: { floor: '#332e27', wall: '#695942', edge: '#c5ac79', accent: '#d5ab73', material: 'wood', label: 'TRANSIT / 转运' },
  audit: { floor: '#2b2938', wall: '#574f67', edge: '#b6a4c8', accent: '#b8a0d7', material: 'stone', label: 'REGISTRY / 核验' },
} as const;

export class Scenery {
  ready = false;
  private images = {} as Record<Asset, HTMLImageElement>;
  private level: Level | null = null;
  private floor = document.createElement('canvas');
  private walls = document.createElement('canvas');
  private ghosts = new Map<string, HTMLCanvasElement>();

  constructor() {
    for (const [name, url] of Object.entries(urls)) {
      const img = new Image(); img.src = url; this.images[name as Asset] = img;
    }
    void Promise.all(Object.values(this.images).map(img => img.decode())).then(() => { this.ready = true; this.level = null; }).catch(() => { /* The vector renderer remains usable when decoding is unavailable. */ });
    for (const layer of [this.floor, this.walls]) { layer.width = WIDTH; layer.height = HEIGHT; }
  }

  sprite(kind: 'agent' | 'guard' | 'tracker', tint?: string): CanvasImageSource | null {
    if (!this.ready) return null;
    if (!tint) return this.images[kind];
    const key = `${kind}:${tint}`;
    if (!this.ghosts.has(key)) {
      const source = this.images[kind], layer = document.createElement('canvas');
      layer.width = source.width; layer.height = source.height;
      const c = layer.getContext('2d')!;
      c.drawImage(source, 0, 0); c.globalCompositeOperation = 'source-atop';
      c.fillStyle = tint; c.globalAlpha = 0.72; c.fillRect(0, 0, layer.width, layer.height);
      this.ghosts.set(key, layer);
    }
    return this.ghosts.get(key)!;
  }

  drawFloor(c: CanvasRenderingContext2D, level: Level) {
    if (!this.ready) return;
    if (this.level !== level) this.build(level);
    c.drawImage(this.floor, 0, 0);
  }

  drawWalls(c: CanvasRenderingContext2D, level: Level) {
    if (!this.ready) return false;
    if (this.level !== level) this.build(level);
    c.drawImage(this.walls, 0, 0); return true;
  }

  private build(level: Level) {
    this.level = level;
    const style = looks[level.theme ?? 'archive'];
    const c = this.floor.getContext('2d')!, w = this.walls.getContext('2d')!;
    c.clearRect(0, 0, WIDTH, HEIGHT); w.clearRect(0, 0, WIDTH, HEIGHT);
    c.fillStyle = style.floor; c.fillRect(0, 0, WIDTH, HEIGHT);
    c.save(); c.globalAlpha = 0.14;
    c.fillStyle = c.createPattern(this.images[style.material], 'repeat')!; c.fillRect(0, 0, WIDTH, HEIGHT); c.restore();
    // Broad floor panels and recessed joints establish scale without hiding paths.
    c.strokeStyle = '#070e1240'; c.lineWidth = 2;
    for (let x = TILE; x < WIDTH; x += TILE * 4) for (let y = TILE; y < HEIGHT; y += TILE * 4) {
      c.strokeRect(x + 1, y + 1, TILE * 4 - 2, TILE * 4 - 2);
      c.fillStyle = '#d0d9cc0b'; c.fillRect(x + 3, y + 3, TILE * 4 - 6, 1);
    }
    c.font = '600 9px Consolas, monospace'; c.fillStyle = `${style.accent}65`;
    c.fillText(style.label, 64, HEIGHT - 65);
    c.fillText(`SECTOR ${level.id}`, WIDTH - 225, HEIGHT - 65);

    const cells = new Set(level.walls.map(p => `${p.x},${p.y}`));
    const has = (x: number, y: number) => cells.has(`${x},${y}`);
    for (const p of level.walls) {
      // Shadows never obscure collision boundaries: their opacity is kept low.
      w.fillStyle = '#04080c66'; w.fillRect(p.x + 4, p.y + 6, TILE, TILE);
    }
    for (const p of level.walls) {
      const { x, y } = p, border = x === 0 || y === 0 || x === WIDTH - TILE || y === HEIGHT - TILE;
      const gradient = w.createLinearGradient(x, y, x, y + TILE);
      gradient.addColorStop(0, border ? '#3c4b46' : style.wall); gradient.addColorStop(1, border ? '#26332f' : '#303a3d');
      w.fillStyle = gradient; w.fillRect(x, y, TILE, TILE);
      const exposed = [[0, -TILE], [TILE, 0], [0, TILE], [-TILE, 0]].map(([dx, dy]) => !has(x + dx, y + dy));
      w.strokeStyle = style.edge; w.lineWidth = 1.5; w.beginPath();
      if (exposed[0]) { w.moveTo(x + 1, y + 1); w.lineTo(x + TILE - 1, y + 1); }
      if (exposed[3]) { w.moveTo(x + 1, y + 1); w.lineTo(x + 1, y + TILE - 1); }
      w.stroke();
      w.strokeStyle = '#111c21'; w.lineWidth = 3; w.beginPath();
      if (exposed[2]) { w.moveTo(x + 1, y + TILE - 2); w.lineTo(x + TILE - 1, y + TILE - 2); }
      if (exposed[1]) { w.moveTo(x + TILE - 2, y + 1); w.lineTo(x + TILE - 2, y + TILE - 1); }
      w.stroke();
      if (border) {
        if ((x + y) % 128 === 0) { w.fillStyle = '#121e20'; w.fillRect(x + 10, y + 10, 12, 4); w.fillStyle = `${style.accent}80`; w.fillRect(x + 11, y + 11, 10, 1); }
      } else {
        // Crates and archive drawers sit entirely inside existing solid cells.
        // They never introduce decorative obstacles or fake cover on walkable floor.
        const looseStack = exposed.filter(Boolean).length >= 3;
        if (looseStack) {
          w.save(); w.globalAlpha = 0.4; w.drawImage(this.images.crate, x + 3, y + 3, 26, 26); w.restore();
          w.drawImage(this.images.papers, x + 9, y + 6, 13, 10);
        } else {
          w.fillStyle = '#15212965'; w.fillRect(x + 6, y + 7, 20, 6); w.fillRect(x + 6, y + 18, 20, 6);
          w.fillStyle = `${style.edge}70`; w.fillRect(x + 13, y + 9, 6, 1); w.fillRect(x + 13, y + 20, 6, 1);
        }
      }
    }
  }
}
