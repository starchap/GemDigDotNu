import type { Vector2 } from "../movement/Movement";

const SAMPLE_OFFSETS: Vector2[] = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
];

export function sampleQuickColors(imageData: ImageData, centerPosition: Vector2, sampleRadiusPx: number): string[] {
  return SAMPLE_OFFSETS.map(({ x: offsetX, y: offsetY }) =>
    readPixelAsHex(
      imageData,
      clamp(Math.round(centerPosition.x + offsetX * sampleRadiusPx), 0, imageData.width - 1),
      clamp(Math.round(centerPosition.y + offsetY * sampleRadiusPx), 0, imageData.height - 1),
    ),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readPixelAsHex(imageData: ImageData, x: number, y: number): string {
  const pixelIndex = (y * imageData.width + x) * 4;
  const [red, green, blue] = imageData.data.subarray(pixelIndex, pixelIndex + 3);
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
