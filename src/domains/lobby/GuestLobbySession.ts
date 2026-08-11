import type { Player } from "../player/Player";
import type { NetworkTransport } from "../networking/NetworkTransport";
import type { Vector2 } from "../movement/Movement";
import type { LobbySnapshot } from "./Lobby";
import type { LobbyMessage } from "./LobbyMessage";
import type { TransportFactory } from "./HostLobbySession";

export class GuestLobbySession {
  private readonly player: Player;
  private readonly transport: NetworkTransport<LobbyMessage>;
  private readonly stateListeners: Array<(snapshot: LobbySnapshot) => void> = [];
  private readonly positionListeners: Array<(playerId: string, position: Vector2) => void> = [];
  private readonly paintListeners: Array<(playerId: string, imageDataUrl: string) => void> = [];

  constructor(player: Player, inviteId: string, createTransport: TransportFactory) {
    this.player = player;
    this.transport = createTransport(inviteId);
    this.transport.onMessage((message) => this.handleMessage(message));
    this.transport.send({ type: "join-request", player });
  }

  onStateChange(listener: (snapshot: LobbySnapshot) => void): void {
    this.stateListeners.push(listener);
  }

  sendPosition(position: Vector2): void {
    this.transport.send({ type: "position", playerId: this.player.id, position });
  }

  onPositionUpdate(listener: (playerId: string, position: Vector2) => void): void {
    this.positionListeners.push(listener);
  }

  sendPaint(imageDataUrl: string): void {
    this.transport.send({ type: "paint", playerId: this.player.id, imageDataUrl });
  }

  onPaintUpdate(listener: (playerId: string, imageDataUrl: string) => void): void {
    this.paintListeners.push(listener);
  }

  sendCatch(hiderId: string): void {
    this.transport.send({ type: "catch", hiderId });
  }

  close(): void {
    this.transport.close();
  }

  private handleMessage(message: LobbyMessage): void {
    if (message.type === "state") {
      for (const listener of this.stateListeners) {
        listener(message.snapshot);
      }
    } else if (message.type === "position") {
      for (const listener of this.positionListeners) {
        listener(message.playerId, message.position);
      }
    } else if (message.type === "paint") {
      for (const listener of this.paintListeners) {
        listener(message.playerId, message.imageDataUrl);
      }
    }
  }
}
