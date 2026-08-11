import { PLAYER_RADIUS, SPRITE_DIAMETER } from "../../domains/player/PlayerSprite";
import { computePaintBudgetPx2, computeStrokeSegmentAreaPx2, PaintBudgetTracker } from "../../domains/paint/PaintBudget";
import type { Vector2 } from "../../domains/movement/Movement";

export interface PaintPanelProps {
  onPaintChange: (imageDataUrl: string) => void;
}

const BRUSH_WIDTH_PX = 3;
const EMIT_THROTTLE_MS = 150;
const DISPLAY_SIZE_PX = 196;

export function mountPaintPanel(root: HTMLElement, props: PaintPanelProps): () => void {
  const panel = document.createElement("div");
  panel.className = "paint-panel";

  const canvas = document.createElement("canvas");
  canvas.className = "paint-canvas";
  canvas.width = SPRITE_DIAMETER;
  canvas.height = SPRITE_DIAMETER;
  canvas.style.width = `${DISPLAY_SIZE_PX}px`;
  canvas.style.height = `${DISPLAY_SIZE_PX}px`;
  panel.appendChild(canvas);

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = "#4c7cf3";
  panel.appendChild(colorInput);

  const budgetBar = document.createElement("div");
  budgetBar.className = "paint-budget-bar";
  const budgetFill = document.createElement("div");
  budgetFill.className = "paint-budget-fill";
  budgetBar.appendChild(budgetFill);
  panel.appendChild(budgetBar);

  root.appendChild(panel);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable");
  }

  const tracker = new PaintBudgetTracker(computePaintBudgetPx2(PLAYER_RADIUS));

  let isDrawing = false;
  let lastPoint: Vector2 | null = null;
  let lastEmitAt = 0;

  const toCanvasPoint = (event: PointerEvent): Vector2 => {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const emitPaint = () => {
    props.onPaintChange(canvas.toDataURL("image/png"));
  };

  const drawSegment = (from: Vector2, to: Vector2) => {
    context.strokeStyle = colorInput.value;
    context.lineWidth = BRUSH_WIDTH_PX;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  };

  const onPointerDown = (event: PointerEvent) => {
    isDrawing = true;
    lastPoint = toCanvasPoint(event);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!isDrawing || !lastPoint) return;
    const point = toCanvasPoint(event);
    if (!tracker.isExhausted()) {
      const segmentArea = computeStrokeSegmentAreaPx2(lastPoint, point, BRUSH_WIDTH_PX);
      tracker.spend(segmentArea);
      drawSegment(lastPoint, point);
      budgetFill.style.width = `${tracker.fractionRemaining * 100}%`;

      const now = Date.now();
      if (now - lastEmitAt >= EMIT_THROTTLE_MS) {
        lastEmitAt = now;
        emitPaint();
      }
    }
    lastPoint = point;
  };

  const onPointerUp = () => {
    if (isDrawing) emitPaint();
    isDrawing = false;
    lastPoint = null;
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    panel.remove();
  };
}
