import { HEIGHT, TILE, WIDTH, type Point } from './levels.ts';

// Four-way tile routes are deterministic. Final interaction coordinates remain exact.
export function findRoute(from: Point, to: Point, blocked: (x: number, y: number) => boolean): Point[] {
  const cols = WIDTH / TILE, rows = HEIGHT / TILE;
  const cell = (p: Point) => Math.floor(p.y / TILE) * cols + Math.floor(p.x / TILE);
  const start = cell(from), end = cell(to);
  const center = (n: number) => ({ x: (n % cols + 0.5) * TILE, y: (Math.floor(n / cols) + 0.5) * TILE });
  const parents = new Map<number, number>([[start, -1]]), queue = [start];
  for (let at = 0; at < queue.length; at++) {
    const current = queue[at];
    if (current === end) {
      const path: Point[] = [];
      for (let n = end; n !== start; n = parents.get(n)!) path.unshift(center(n));
      return [...path, to];
    }
    const x = current % cols, y = Math.floor(current / cols);
    for (const [nx, ny] of [[x + 1, y], [x, y + 1], [x - 1, y], [x, y - 1]]) {
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const next = ny * cols + nx, point = center(next);
      if (parents.has(next) || blocked(point.x, point.y)) continue;
      parents.set(next, current); queue.push(next);
    }
  }
  return [];
}
