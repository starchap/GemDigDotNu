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

  const colorPickerLabel = document.createElement("label");
  colorPickerLabel.className = "paint-color-picker";
  colorPickerLabel.title = "Pick brush color";

  const brushIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  brushIcon.setAttribute("viewBox", "0 0 24 24");
  brushIcon.setAttribute("class", "paint-brush-icon");
  brushIcon.innerHTML =
    '<path d="M20.71 4.63l-1.34-1.34a1 1 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a1 1 0 0 0 0-1.41zM7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3z" fill="currentColor"/>';

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = "#4c7cf3";
  colorInput.className = "paint-color-input";

  colorPickerLabel.style.color = colorInput.value;
  colorInput.addEventListener("input", () => {
    colorPickerLabel.style.color = colorInput.value;
  });

  colorPickerLabel.append(brushIcon, colorInput);
  panel.appendChild(colorPickerLabel);

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
