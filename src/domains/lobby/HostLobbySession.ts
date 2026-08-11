import type { Player } from "../player/Player";
import type { NetworkTransport } from "../networking/NetworkTransport";
import type { Vector2 } from "../movement/Movement";
import { Lobby, LobbyFullError, type LobbySnapshot } from "./Lobby";
import { generateInviteId } from "./InviteId";
import type { LobbyMessage } from "./LobbyMessage";

export type TransportFactory = (channelName: string) => NetworkTransport<LobbyMessage>;

export class HostLobbySession {
  readonly lobby: Lobby;
  private readonly transport: NetworkTransport<LobbyMessage>;
  private readonly stateListeners: Array<(snapshot: LobbySnapshot) => void> = [];
  private readonly positionListeners: Array<(playerId: string, position: Vector2) => void> = [];
  private readonly paintListeners: Array<(playerId: string, imageDataUrl: string) => void> = [];

  constructor(host: Player, maxPlayers: number, createTransport: TransportFactory) {
    this.lobby = new Lobby(generateInviteId(), host, maxPlayers);
    this.transport = createTransport(this.lobby.inviteId);
    this.transport.onMessage((message) => this.handleMessage(message));
  }

  onStateChange(listener: (snapshot: LobbySnapshot) => void): void {
    this.stateListeners.push(listener);
    listener(this.lobby.toSnapshot());
  }

  sendPosition(position: Vector2): void {
    this.transport.send({ type: "position", playerId: this.lobby.hostId, position });
  }

  onPositionUpdate(listener: (playerId: string, position: Vector2) => void): void {
    this.positionListeners.push(listener);
  }

  sendPaint(imageDataUrl: string): void {
    this.transport.send({ type: "paint", playerId: this.lobby.hostId, imageDataUrl });
  }

  onPaintUpdate(listener: (playerId: string, imageDataUrl: string) => void): void {
    this.paintListeners.push(listener);
  }

  setMaxPlayers(maxPlayers: number): void {
    this.lobby.setMaxPlayers(maxPlayers);
    this.broadcastState();
  }

  setMapImage(dataUrl: string): void {
    this.lobby.setMapImage(dataUrl);
    this.broadcastState();
  }

  start(): void {
    this.lobby.start(Date.now());
    this.broadcastState();
  }

  sendCatch(hiderId: string): void {
    this.lobby.catchHider(hiderId);
    this.broadcastState();
  }

  returnToLobby(): void {
    this.lobby.returnToLobby();
    this.broadcastState();
  }

  close(): void {
    this.transport.close();
  }

  private handleMessage(message: LobbyMessage): void {
    if (message.type === "join-request") {
      try {
        this.lobby.addPlayer(message.player);
        this.broadcastState();
      } catch (error) {
        if (!(error instanceof LobbyFullError)) {
          throw error;
        }
      }
    } else if (message.type === "position") {
      for (const listener of this.positionListeners) {
        listener(message.playerId, message.position);
      }
    } else if (message.type === "paint") {
      for (const listener of this.paintListeners) {
        listener(message.playerId, message.imageDataUrl);
      }
    } else if (message.type === "catch") {
      this.lobby.catchHider(message.hiderId);
      this.broadcastState();
    }
  }

  private broadcastState(): void {
    const snapshot = this.lobby.toSnapshot();
    this.transport.send({ type: "state", snapshot });
    for (const listener of this.stateListeners) {
      listener(snapshot);
    }
  }
}
