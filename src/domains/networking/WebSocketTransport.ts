import type { NetworkTransport } from "./NetworkTransport";

export class WebSocketTransport<Message> implements NetworkTransport<Message> {
  private readonly socket: WebSocket;
  private readonly outbox: Message[] = [];
  private isOpen = false;

  constructor(relayUrl: string, room: string) {
    this.socket = new WebSocket(relayUrl);
    this.socket.onopen = () => {
      this.socket.send(JSON.stringify({ type: "join", room }));
      this.isOpen = true;
      for (const message of this.outbox) this.socket.send(JSON.stringify(message));
      this.outbox.length = 0;
    };
  }

  send(message: Message): void {
    if (this.isOpen) {
      this.socket.send(JSON.stringify(message));
    } else {
      this.outbox.push(message);
    }
  }

  onMessage(handler: (message: Message) => void): void {
    this.socket.onmessage = (event: MessageEvent<string>) => handler(JSON.parse(event.data));
  }

  close(): void {
    this.socket.close();
  }
}
