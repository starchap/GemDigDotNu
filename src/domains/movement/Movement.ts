export interface Vector2 {
  x: number;
  y: number;
}

export interface MovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export const MOVE_SPEED_PX_PER_SEC = 160;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function stepPosition(
  position: Vector2,
  input: MovementInput,
  deltaSeconds: number,
  bounds: Vector2,
): Vector2 {
  let directionX = 0;
  let directionY = 0;
  if (input.left) directionX -= 1;
  if (input.right) directionX += 1;
  if (input.up) directionY -= 1;
  if (input.down) directionY += 1;

  if (directionX !== 0 && directionY !== 0) {
    const inverseLength = 1 / Math.sqrt(2);
    directionX *= inverseLength;
    directionY *= inverseLength;
  }

  const distance = MOVE_SPEED_PX_PER_SEC * deltaSeconds;
  return {
    x: clamp(position.x + directionX * distance, 0, bounds.x),
    y: clamp(position.y + directionY * distance, 0, bounds.y),
  };
}

export function computeCameraTopLeft(playerPosition: Vector2, viewport: Vector2, mapBounds: Vector2): Vector2 {
  const maxX = Math.max(0, mapBounds.x - viewport.x);
  const maxY = Math.max(0, mapBounds.y - viewport.y);
  return {
    x: clamp(playerPosition.x - viewport.x / 2, 0, maxX),
    y: clamp(playerPosition.y - viewport.y / 2, 0, maxY),
  };
}
