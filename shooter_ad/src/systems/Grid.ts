/**
 * Uniform spatial hash. Bullet-vs-enemy is the only many-to-many test in the
 * game and it runs every frame at a few hundred entities each, so the naive
 * nested loop is the one performance trap worth pre-empting. Rebuilt from
 * scratch each frame, which is cheaper than incremental updates at this size.
 */
export class Grid<T extends { x: number; y: number }> {
  private readonly cells = new Map<number, T[]>();
  private readonly cols: number;

  constructor(private readonly cellSize: number, width: number) {
    // Column count only needs to cover the playfield; anything off-screen
    // hashes into a fringe bucket, which is harmless for a broad-phase.
    this.cols = Math.ceil(width / cellSize) + 2;
  }

  private key(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return cy * this.cols + cx;
  }

  clear(): void { this.cells.clear(); }

  insert(item: T): void {
    const k = this.key(item.x, item.y);
    const bucket = this.cells.get(k);
    if (bucket) bucket.push(item);
    else this.cells.set(k, [item]);
  }

  /** Visits every item in the 3x3 cell neighbourhood around (x, y). */
  forEachNear(x: number, y: number, visit: (item: T) => void): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = this.cells.get((cy + dy) * this.cols + (cx + dx));
        if (!bucket) continue;
        for (const item of bucket) visit(item);
      }
    }
  }
}
