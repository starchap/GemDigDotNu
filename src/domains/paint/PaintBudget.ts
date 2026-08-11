import type { Vector2 } from "../movement/Movement";

export const PAINT_BUDGET_MULTIPLIER = 1.2;

export function computeSpriteSurfaceAreaPx2(radiusPx: number): number {
  return Math.PI * radiusPx * radiusPx;
}

export function computePaintBudgetPx2(radiusPx: number): number {
  return computeSpriteSurfaceAreaPx2(radiusPx) * PAINT_BUDGET_MULTIPLIER;
}

export function computeStrokeSegmentAreaPx2(from: Vector2, to: Vector2, brushWidthPx: number): number {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY) * brushWidthPx;
}

export class PaintBudgetTracker {
  private remainingPx2: number;

  constructor(private readonly totalPx2: number) {
    this.remainingPx2 = totalPx2;
  }

  get remaining(): number {
    return this.remainingPx2;
  }

  get fractionRemaining(): number {
    return this.remainingPx2 / this.totalPx2;
  }

  isExhausted(): boolean {
    return this.remainingPx2 <= 0;
  }

  spend(amountPx2: number): number {
    const spent = Math.min(amountPx2, this.remainingPx2);
    this.remainingPx2 -= spent;
    return spent;
  }
}
