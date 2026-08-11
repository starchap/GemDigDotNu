import { computeCameraTopLeft, stepPosition, type MovementInput, type Vector2 } from "../../domains/movement/Movement";
import type { Player } from "../../domains/player/Player";
import { PLAYER_RADIUS, SPRITE_DIAMETER } from "../../domains/player/PlayerSprite";
import { getRoundPhase, type RoundSnapshot } from "../../domains/round/Round";
import { mountPaintPanel } from "./PaintPanel";

export interface PositionChannel {
  sendPosition(position: Vector2): void;
  onPositionUpdate(listener: (playerId: string, position: Vector2) => void): void;
}

export interface PaintChannel {
  sendPaint(imageDataUrl: string): void;
  onPaintUpdate(listener: (playerId: string, imageDataUrl: string) => void): void;
}

export interface GameCanvasProps {
  round: RoundSnapshot;
  role: "seeker" | "hider";
  selfPlayerId: string;
  players: Player[];
  session: PositionChannel & PaintChannel;
}

const VIEWPORT_WIDTH = 360;
const VIEWPORT_HEIGHT = 270;
const POSITION_SEND_INTERVAL_MS = 50;

const KEY_TO_DIRECTION: Record<string, keyof MovementInput> = {
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
};

function loadImage(dataUrl: string): HTMLImageElement {
  const image = new Image();
  image.src = dataUrl;
  return image;
}

export function mountGameCanvas(root: HTMLElement, props: GameCanvasProps): () => void {
  const wrapper = document.createElement("div");
  wrapper.className = "game-canvas-wrapper";
  root.appendChild(wrapper);

  const canvas = document.createElement("canvas");
  canvas.className = "game-canvas";
  canvas.width = VIEWPORT_WIDTH;
  canvas.height = VIEWPORT_HEIGHT;
  wrapper.appendChild(canvas);

  const paintPanelSlot = document.createElement("div");
  paintPanelSlot.className = "paint-panel-slot";
  wrapper.appendChild(paintPanelSlot);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable");
  }

  const input: MovementInput = { up: false, down: false, left: false, right: false };

  const onKeyDown = (event: KeyboardEvent) => {
    const direction = KEY_TO_DIRECTION[event.key];
    if (direction) input[direction] = true;
  };
  const onKeyUp = (event: KeyboardEvent) => {
    const direction = KEY_TO_DIRECTION[event.key];
    if (direction) input[direction] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  let disposed = false;
  let animationFrameId = 0;
  let lastTimestamp: number | null = null;
  let lastSentAt: number | null = null;
  let position: Vector2 = { x: 0, y: 0 };
  let mapBounds: Vector2 = { x: 0, y: 0 };
  let selfSpriteImage: HTMLImageElement | null = null;
  let paintPanelDispose: (() => void) | null = null;
  const remotePositions = new Map<string, Vector2>();
  const remoteSpriteImages = new Map<string, HTMLImageElement>();

  props.session.onPositionUpdate((playerId, remotePosition) => {
    remotePositions.set(playerId, remotePosition);
  });

  props.session.onPaintUpdate((playerId, imageDataUrl) => {
    remoteSpriteImages.set(playerId, loadImage(imageDataUrl));
  });

  const drawPlayerSprite = (screenPosition: Vector2, isSeeker: boolean, spriteImage: HTMLImageElement | null) => {
    context.save();
    context.beginPath();
    context.arc(screenPosition.x, screenPosition.y, PLAYER_RADIUS, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    context.fillStyle = isSeeker ? "#f36c6c" : "#8fa6d6";
    context.fillRect(
      screenPosition.x - PLAYER_RADIUS,
      screenPosition.y - PLAYER_RADIUS,
      SPRITE_DIAMETER,
      SPRITE_DIAMETER,
    );
    if (spriteImage?.complete) {
      context.drawImage(
        spriteImage,
        screenPosition.x - PLAYER_RADIUS,
        screenPosition.y - PLAYER_RADIUS,
        SPRITE_DIAMETER,
        SPRITE_DIAMETER,
      );
    }
    context.restore();
    context.beginPath();
    context.arc(screenPosition.x, screenPosition.y, PLAYER_RADIUS, 0, Math.PI * 2);
    context.strokeStyle = "#14171c";
    context.lineWidth = 2;
    context.stroke();
  };

  const draw = () => {
    const phase = getRoundPhase(props.round, Date.now());
    const viewport: Vector2 = { x: canvas.width, y: canvas.height };
    const cameraTopLeft = computeCameraTopLeft(position, viewport, mapBounds);

    if (props.role === "hider" && phase === "hide" && !paintPanelDispose) {
      paintPanelDispose = mountPaintPanel(paintPanelSlot, {
        onPaintChange: (imageDataUrl) => {
          selfSpriteImage = loadImage(imageDataUrl);
          props.session.sendPaint(imageDataUrl);
        },
      });
    } else if (phase !== "hide" && paintPanelDispose) {
      paintPanelDispose();
      paintPanelDispose = null;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      cameraTopLeft.x,
      cameraTopLeft.y,
      viewport.x,
      viewport.y,
      0,
      0,
      viewport.x,
      viewport.y,
    );

    if (phase !== "hide") {
      for (const player of props.players) {
        if (player.id === props.selfPlayerId) continue;
        const remotePosition = remotePositions.get(player.id);
        if (!remotePosition) continue;
        drawPlayerSprite(
          { x: remotePosition.x - cameraTopLeft.x, y: remotePosition.y - cameraTopLeft.y },
          player.id === props.round.seekerId,
          remoteSpriteImages.get(player.id) ?? null,
        );
      }
    }

    drawPlayerSprite(
      { x: position.x - cameraTopLeft.x, y: position.y - cameraTopLeft.y },
      props.role === "seeker",
      selfSpriteImage,
    );

    context.fillStyle = "#e8eaed";
    context.font = "bold 14px system-ui, sans-serif";
    context.fillText(props.role === "seeker" ? "SEEKER" : "HIDER", 10, 20);
  };

  const loop = (timestamp: number) => {
    if (disposed) return;
    const deltaSeconds = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    position = stepPosition(position, input, deltaSeconds, mapBounds);
    if (lastSentAt === null || timestamp - lastSentAt >= POSITION_SEND_INTERVAL_MS) {
      lastSentAt = timestamp;
      props.session.sendPosition(position);
    }
    draw();
    animationFrameId = window.requestAnimationFrame(loop);
  };

  const image = new Image();
  image.onload = () => {
    if (disposed) return;
    mapBounds = { x: image.naturalWidth, y: image.naturalHeight };
    position = { x: mapBounds.x / 2, y: mapBounds.y / 2 };
    animationFrameId = window.requestAnimationFrame(loop);
  };
  image.src = props.round.mapImageDataUrl;

  return () => {
    disposed = true;
    window.cancelAnimationFrame(animationFrameId);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    paintPanelDispose?.();
  };
}
