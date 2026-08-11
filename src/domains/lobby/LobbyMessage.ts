import type { Player } from "../player/Player";
import type { Vector2 } from "../movement/Movement";
import type { LobbySnapshot } from "./Lobby";

export type LobbyMessage =
  | { type: "join-request"; player: Player }
  | { type: "set-max-players"; maxPlayers: number }
  | { type: "start" }
  | { type: "state"; snapshot: LobbySnapshot }
  | { type: "position"; playerId: string; position: Vector2 }
  | { type: "paint"; playerId: string; imageDataUrl: string }
  | { type: "catch"; hiderId: string };
