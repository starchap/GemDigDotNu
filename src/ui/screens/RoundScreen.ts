import type { LobbySnapshot } from "../../domains/lobby/Lobby";
import { HostLobbySession } from "../../domains/lobby/HostLobbySession";
import type { GuestLobbySession } from "../../domains/lobby/GuestLobbySession";
import type { RoundSnapshot } from "../../domains/round/Round";
import { getRoundPhase } from "../../domains/round/Round";
import { mountGameCanvas, type GameCanvasHandle } from "../game/GameCanvas";

export interface RoundScreenProps {
  snapshot: LobbySnapshot;
  selfPlayerId: string;
  session: HostLobbySession | GuestLobbySession;
}

export interface RoundScreenHandle {
  dispose(): void;
  update(snapshot: LobbySnapshot): void;
}

function playerName(players: LobbySnapshot["players"], playerId: string): string {
  return players.find((player) => player.id === playerId)?.name ?? "Unknown";
}

export function renderRoundScreen(root: HTMLElement, props: RoundScreenProps): RoundScreenHandle {
  const { selfPlayerId, session } = props;
  if (!props.snapshot.round) {
    throw new Error("renderRoundScreen requires a snapshot with a round");
  }

  let currentSnapshot = props.snapshot;
  let currentRound: RoundSnapshot = props.snapshot.round;

  root.innerHTML = "";

  const heading = document.createElement("h1");
  root.appendChild(heading);

  const display = document.createElement("div");
  display.className = "round-display";
  root.appendChild(display);

  let gameCanvas: GameCanvasHandle | null = null;
  let intervalId: number;

  const renderResults = () => {
    window.clearInterval(intervalId);
    gameCanvas?.dispose();
    gameCanvas = null;
    root.innerHTML = "";

    const resultsHeading = document.createElement("h1");
    resultsHeading.textContent = "Round over";
    root.appendChild(resultsHeading);

    const survivorsHeading = document.createElement("h2");
    survivorsHeading.textContent = "Still hiding";
    root.appendChild(survivorsHeading);

    const survivorsList = document.createElement("ul");
    survivorsList.className = "player-list";
    for (const hiderId of currentRound.hiderIds) {
      const item = document.createElement("li");
      item.textContent = playerName(currentSnapshot.players, hiderId);
      survivorsList.appendChild(item);
    }
    root.appendChild(survivorsList);

    const caughtHeading = document.createElement("h2");
    caughtHeading.textContent = "Caught";
    root.appendChild(caughtHeading);

    const caughtList = document.createElement("ul");
    caughtList.className = "player-list";
    for (const seekerId of currentRound.seekerIds) {
      const item = document.createElement("li");
      item.textContent = playerName(currentSnapshot.players, seekerId);
      caughtList.appendChild(item);
    }
    root.appendChild(caughtList);

    if (session instanceof HostLobbySession) {
      const returnButton = document.createElement("button");
      returnButton.textContent = "Return to lobby";
      returnButton.addEventListener("click", () => session.returnToLobby());
      root.appendChild(returnButton);
    }
  };

  const tick = () => {
    const now = Date.now();
    const phase = getRoundPhase(currentRound, now);

    if (phase === "seeker-reveal") {
      heading.textContent = "Choosing a seeker…";
      const cycleIndex = Math.floor(now / 150) % currentSnapshot.players.length;
      display.textContent = currentSnapshot.players[cycleIndex].name;
      display.className = "round-display round-spin-name";
      return;
    }

    if (phase === "countdown") {
      const seekerName = playerName(currentSnapshot.players, currentRound.seekerIds[0]);
      heading.textContent = `${seekerName} is the SEEKER!`;
      const secondsLeft = Math.ceil((currentRound.countdownEndsAt - now) / 1000);
      display.textContent = String(secondsLeft);
      display.className = "round-display round-countdown-number";
      return;
    }

    if (phase === "results") {
      renderResults();
      return;
    }

    if (!gameCanvas) {
      root.innerHTML = "";
      const isSeeker = currentRound.seekerIds.includes(selfPlayerId);
      gameCanvas = mountGameCanvas(root, {
        round: currentRound,
        role: isSeeker ? "seeker" : "hider",
        selfPlayerId,
        players: currentSnapshot.players,
        session,
      });
    }
  };

  tick();
  intervalId = window.setInterval(tick, 50);

  return {
    dispose() {
      window.clearInterval(intervalId);
      gameCanvas?.dispose();
    },
    update(snapshot) {
      if (!snapshot.round) return;
      currentSnapshot = snapshot;
      currentRound = snapshot.round;
      gameCanvas?.update(currentRound, currentSnapshot.players);
    },
  };
}
