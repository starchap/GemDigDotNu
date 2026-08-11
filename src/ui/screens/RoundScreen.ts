import type { LobbySnapshot } from "../../domains/lobby/Lobby";
import type { HostLobbySession } from "../../domains/lobby/HostLobbySession";
import type { GuestLobbySession } from "../../domains/lobby/GuestLobbySession";
import { getRoundPhase } from "../../domains/round/Round";
import { mountGameCanvas } from "../game/GameCanvas";

export interface RoundScreenProps {
  snapshot: LobbySnapshot;
  selfPlayerId: string;
  session: HostLobbySession | GuestLobbySession;
}

export function renderRoundScreen(root: HTMLElement, props: RoundScreenProps): () => void {
  const { snapshot, selfPlayerId, session } = props;
  const round = snapshot.round;
  if (!round) {
    throw new Error("renderRoundScreen requires a snapshot with a round");
  }

  root.innerHTML = "";

  const heading = document.createElement("h1");
  root.appendChild(heading);

  const display = document.createElement("div");
  display.className = "round-display";
  root.appendChild(display);

  const seeker = snapshot.players.find((player) => player.id === round.seekerId);
  const seekerName = seeker?.name ?? "Unknown";

  let gameCanvasDispose: (() => void) | null = null;
  let intervalId: number;

  const tick = () => {
    const now = Date.now();
    const phase = getRoundPhase(round, now);

    if (phase === "seeker-reveal") {
      heading.textContent = "Choosing a seeker…";
      const cycleIndex = Math.floor(now / 150) % snapshot.players.length;
      display.textContent = snapshot.players[cycleIndex].name;
      display.className = "round-display round-spin-name";
      return;
    }

    if (phase === "countdown") {
      heading.textContent = `${seekerName} is the SEEKER!`;
      const secondsLeft = Math.ceil((round.countdownEndsAt - now) / 1000);
      display.textContent = String(secondsLeft);
      display.className = "round-display round-countdown-number";
      return;
    }

    window.clearInterval(intervalId);
    root.innerHTML = "";
    const isSeeker = selfPlayerId === round.seekerId;
    gameCanvasDispose = mountGameCanvas(root, {
      round,
      role: isSeeker ? "seeker" : "hider",
      selfPlayerId,
      players: snapshot.players,
      session,
    });
  };

  tick();
  intervalId = window.setInterval(tick, 50);

  return () => {
    window.clearInterval(intervalId);
    gameCanvasDispose?.();
  };
}
