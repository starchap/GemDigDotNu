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

export interface CatchChannel {
  sendCatch(hiderId: string): void;
}

export interface GameCanvasProps {
  round: RoundSnapshot;
  role: "seeker" | "hider";
  selfPlayerId: string;
  players: Player[];
  session: PositionChannel & PaintChannel & CatchChannel;
}

export interface GameCanvasHandle {
  dispose(): void;
  update(round: RoundSnapshot, players: Player[]): void;
}

const VIEWPORT_WIDTH = 320;
const VIEWPORT_HEIGHT = 320;
const POSITION_SEND_INTERVAL_MS = 50;
const CATCH_HIT_RADIUS = PLAYER_RADIUS + 6;

const DPAD_DIRECTIONS: Array<{ direction: keyof MovementInput; label: string; gridArea: string }> = [
  { direction: "up", label: "▲", gridArea: "up" },
  { direction: "left", label: "◀", gridArea: "left" },
  { direction: "down", label: "▼", gridArea: "down" },
  { direction: "right", label: "▶", gridArea: "right" },
];

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

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mountGameCanvas(root: HTMLElement, props: GameCanvasProps): GameCanvasHandle {
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

  const dpad = document.createElement("div");
  dpad.className = "virtual-dpad";
  const dpadCleanups: Array<() => void> = [];
  for (const { direction, label, gridArea } of DPAD_DIRECTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dpad-button";
    button.style.gridArea = gridArea;
    button.textContent = label;
    const press = (event: Event) => {
      event.preventDefault();
      input[direction] = true;
    };
    const release = (event: Event) => {
      event.preventDefault();
      input[direction] = false;
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
    dpadCleanups.push(() => {
      button.removeEventListener("pointerdown", press);
      button.removeEventListener("pointerup", release);
      button.removeEventListener("pointercancel", release);
      button.removeEventListener("pointerleave", release);
    });
    dpad.appendChild(button);
  }
  wrapper.appendChild(dpad);

  let disposed = false;
  let animationFrameId = 0;
  let lastTimestamp: number | null = null;
  let lastSentAt: number | null = null;
  let position: Vector2 = { x: 0, y: 0 };
  let mapBounds: Vector2 = { x: 0, y: 0 };
  let selfSpriteImage: HTMLImageElement | null = null;
  let paintPanelDispose: (() => void) | null = null;
  let currentRound = props.round;
  let currentPlayers = props.players;
  let wasSeeker = currentRound.seekerIds.includes(props.selfPlayerId);
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
  };

  let lastCameraTopLeft: Vector2 = { x: 0, y: 0 };

  const isSelfSeeker = () => currentRound.seekerIds.includes(props.selfPlayerId);

  const draw = () => {
    const phase = getRoundPhase(currentRound, Date.now());
    const viewport: Vector2 = { x: canvas.width, y: canvas.height };
    const cameraTopLeft = computeCameraTopLeft(position, viewport, mapBounds);
    lastCameraTopLeft = cameraTopLeft;
    const selfIsSeeker = isSelfSeeker();

    if (!selfIsSeeker && phase === "hide" && !paintPanelDispose) {
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
      for (const player of currentPlayers) {
        if (player.id === props.selfPlayerId) continue;
        const remotePosition = remotePositions.get(player.id);
        if (!remotePosition) continue;
        drawPlayerSprite(
          { x: remotePosition.x - cameraTopLeft.x, y: remotePosition.y - cameraTopLeft.y },
          currentRound.seekerIds.includes(player.id),
          remoteSpriteImages.get(player.id) ?? null,
        );
      }
    }

    drawPlayerSprite(
      { x: position.x - cameraTopLeft.x, y: position.y - cameraTopLeft.y },
      selfIsSeeker,
      selfSpriteImage,
    );

    context.fillStyle = "#e8eaed";
    context.font = "bold 14px system-ui, sans-serif";
    context.fillText(selfIsSeeker ? "SEEKER" : "HIDER", 10, 20);
  };

  const onCanvasClick = (event: MouseEvent) => {
    const phase = getRoundPhase(currentRound, Date.now());
    if (phase !== "seek" || !isSelfSeeker()) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const worldClick: Vector2 = {
      x: (event.clientX - rect.left) * scaleX + lastCameraTopLeft.x,
      y: (event.clientY - rect.top) * scaleY + lastCameraTopLeft.y,
    };

    let closestHiderId: string | null = null;
    let closestDistance = CATCH_HIT_RADIUS;
    for (const hiderId of currentRound.hiderIds) {
      const hiderPosition = remotePositions.get(hiderId);
      if (!hiderPosition) continue;
      const hiderDistance = distance(worldClick, hiderPosition);
      if (hiderDistance <= closestDistance) {
        closestDistance = hiderDistance;
        closestHiderId = hiderId;
      }
    }

    if (closestHiderId) {
      props.session.sendCatch(closestHiderId);
    }
  };
  canvas.addEventListener("click", onCanvasClick);

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

  return {
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("click", onCanvasClick);
      for (const cleanup of dpadCleanups) cleanup();
      paintPanelDispose?.();
    },
    update(round, players) {
      currentRound = round;
      currentPlayers = players;
      const nowSeeker = round.seekerIds.includes(props.selfPlayerId);
      if (nowSeeker && !wasSeeker) {
        position = { x: mapBounds.x / 2, y: mapBounds.y / 2 };
        props.session.sendPosition(position);
      }
      wasSeeker = nowSeeker;
    },
  };
}
