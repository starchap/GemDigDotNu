import type { NetworkTransport } from "./NetworkTransport";

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 8000;

export class WebSocketTransport<Message> implements NetworkTransport<Message> {
  private readonly relayUrl: string;
  private readonly room: string;
  private socket: WebSocket;
  private readonly outbox: Message[] = [];
  private isOpen = false;
  private closedByUser = false;
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private messageHandler: ((message: Message) => void) | null = null;

  constructor(relayUrl: string, room: string) {
    this.relayUrl = relayUrl;
    this.room = room;
    this.socket = this.connect();
  }

  private connect(): WebSocket {
    const socket = new WebSocket(this.relayUrl);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "join", room: this.room }));
      this.isOpen = true;
      this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      for (const message of this.outbox) socket.send(JSON.stringify(message));
      this.outbox.length = 0;
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      this.messageHandler?.(JSON.parse(event.data));
    };

    socket.onclose = () => {
      this.isOpen = false;
      if (this.closedByUser) return;
      const delay = this.reconnectDelayMs;
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
      window.setTimeout(() => {
        if (this.closedByUser) return;
        this.socket = this.connect();
      }, delay);
    };

    return socket;
  }

  send(message: Message): void {
    if (this.isOpen) {
      this.socket.send(JSON.stringify(message));
    } else {
      this.outbox.push(message);
    }
  }

  onMessage(handler: (message: Message) => void): void {
    this.messageHandler = handler;
  }

  close(): void {
    this.closedByUser = true;
    this.socket.close();
  }
}
