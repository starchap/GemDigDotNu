export interface NetworkTransport<Message> {
  send(message: Message): void;
  onMessage(handler: (message: Message) => void): void;
  close(): void;
}
