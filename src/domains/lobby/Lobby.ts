import type { Player } from "../player/Player";
import {
  SPIN_DURATION_MS,
  COUNTDOWN_DURATION_MS,
  HIDE_DURATION_MS,
  type RoundSnapshot,
} from "../round/Round";

export type LobbyStatus = "waiting" | "started";

export interface LobbySnapshot {
  inviteId: string;
  hostId: string;
  maxPlayers: number;
  players: Player[];
  status: LobbyStatus;
  round: RoundSnapshot | null;
  mapImageDataUrl: string | null;
}

export class LobbyFullError extends Error {
  constructor() {
    super("Lobby is full");
  }
}

export class MapImageRequiredError extends Error {
  constructor() {
    super("A map image is required to start a round");
  }
}

export class Lobby {
  readonly inviteId: string;
  readonly hostId: string;
  maxPlayers: number;
  status: LobbyStatus = "waiting";
  round: RoundSnapshot | null = null;
  mapImageDataUrl: string | null = null;
  private players: Player[] = [];

  constructor(inviteId: string, host: Player, maxPlayers: number) {
    this.inviteId = inviteId;
    this.hostId = host.id;
    this.maxPlayers = maxPlayers;
    this.players.push(host);
  }

  addPlayer(player: Player): void {
    if (this.players.length >= this.maxPlayers) {
      throw new LobbyFullError();
    }
    if (this.players.some((existingPlayer) => existingPlayer.id === player.id)) {
      return;
    }
    this.players.push(player);
  }

  setMaxPlayers(maxPlayers: number): void {
    this.maxPlayers = Math.max(this.players.length, Math.min(16, maxPlayers));
  }

  setMapImage(dataUrl: string): void {
    this.mapImageDataUrl = dataUrl;
  }

  start(now: number = Date.now()): void {
    if (!this.mapImageDataUrl) {
      throw new MapImageRequiredError();
    }

    const seekerIndex = Math.floor(Math.random() * this.players.length);
    const seeker = this.players[seekerIndex];
    const hiderIds = this.players
      .filter((player) => player.id !== seeker.id)
      .map((player) => player.id);
    const spinEndsAt = now + SPIN_DURATION_MS;
    const countdownEndsAt = spinEndsAt + COUNTDOWN_DURATION_MS;
    const hideEndsAt = countdownEndsAt + HIDE_DURATION_MS;

    this.round = {
      seekerId: seeker.id,
      hiderIds,
      spinEndsAt,
      countdownEndsAt,
      hideEndsAt,
      mapImageDataUrl: this.mapImageDataUrl,
    };
    this.status = "started";
  }

  toSnapshot(): LobbySnapshot {
    return {
      inviteId: this.inviteId,
      hostId: this.hostId,
      maxPlayers: this.maxPlayers,
      players: [...this.players],
      status: this.status,
      round: this.round,
      mapImageDataUrl: this.mapImageDataUrl,
    };
  }
}
