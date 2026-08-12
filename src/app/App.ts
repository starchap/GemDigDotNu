import { createPlayer, type Player } from "../domains/player/Player";
import { HostLobbySession } from "../domains/lobby/HostLobbySession";
import { GuestLobbySession } from "../domains/lobby/GuestLobbySession";
import type { LobbySnapshot } from "../domains/lobby/Lobby";
import { WebSocketTransport } from "../domains/networking/WebSocketTransport";
import type { LobbyMessage } from "../domains/lobby/LobbyMessage";
import { renderNameEntryScreen } from "../ui/screens/NameEntryScreen";
import { renderHomeScreen } from "../ui/screens/HomeScreen";
import { renderCreateLobbyScreen } from "../ui/screens/CreateLobbyScreen";
import { renderJoinLobbyScreen } from "../ui/screens/JoinLobbyScreen";
import { renderLobbyScreen } from "../ui/screens/LobbyScreen";
import { renderRoundScreen, type RoundScreenHandle } from "../ui/screens/RoundScreen";

function relayUrl(): string {
  const configured = import.meta.env.VITE_RELAY_URL;
  if (configured) return configured;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

function createLobbyTransport(inviteId: string) {
  return new WebSocketTransport<LobbyMessage>(relayUrl(), inviteId);
}

function inviteIdFromUrl(): string | null {
  const value = new URLSearchParams(window.location.search).get("lobby");
  return value ? value.trim().toUpperCase() : null;
}

export class App {
  private readonly root: HTMLElement;
  private player: Player | null = null;
  private hostSession: HostLobbySession | null = null;
  private guestSession: GuestLobbySession | null = null;
  private roundScreenHandle: RoundScreenHandle | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    this.showNameEntry();
  }

  private showNameEntry(): void {
    renderNameEntryScreen(this.root, {
      onSubmit: (name) => {
        this.player = createPlayer(name);
        const inviteId = inviteIdFromUrl();
        if (inviteId) {
          this.joinLobby(inviteId);
        } else {
          this.showHome();
        }
      },
    });
  }

  private showHome(): void {
    renderHomeScreen(this.root, {
      onCreateLobby: () => this.showCreateLobby(),
      onJoinLobby: () => this.showJoinLobby(),
    });
  }

  private showCreateLobby(): void {
    renderCreateLobbyScreen(this.root, {
      onBack: () => this.showHome(),
      onCreate: (maxPlayers) => {
        if (!this.player) return;
        this.hostSession = new HostLobbySession(this.player, maxPlayers, createLobbyTransport);
        this.showLobby();
      },
    });
  }

  private showJoinLobby(error?: string): void {
    renderJoinLobbyScreen(this.root, {
      error,
      onBack: () => this.showHome(),
      onJoin: (inviteId) => this.joinLobby(inviteId),
    });
  }

  private joinLobby(inviteId: string): void {
    if (!this.player) return;
    this.guestSession = new GuestLobbySession(this.player, inviteId, createLobbyTransport);
    this.showLobby();
  }

  private showLobby(): void {
    const session = this.hostSession ?? this.guestSession;
    if (!session || !this.player) return;

    const isHost = session instanceof HostLobbySession;

    session.onStateChange((snapshot: LobbySnapshot) => {
      if (snapshot.status === "started" && snapshot.round) {
        if (this.roundScreenHandle) {
          this.roundScreenHandle.update(snapshot);
        } else {
          this.roundScreenHandle = renderRoundScreen(this.root, {
            snapshot,
            selfPlayerId: this.player!.id,
            session,
          });
        }
        return;
      }

      this.roundScreenHandle?.dispose();
      this.roundScreenHandle = null;

      renderLobbyScreen(this.root, {
        snapshot,
        isHost,
        onSetMaxPlayers: isHost
          ? (maxPlayers) => (session as HostLobbySession).setMaxPlayers(maxPlayers)
          : undefined,
        onSetMapImage: isHost
          ? (dataUrl) => (session as HostLobbySession).setMapImage(dataUrl)
          : undefined,
        onStart: isHost ? () => (session as HostLobbySession).start() : undefined,
      });
    });
  }
}
