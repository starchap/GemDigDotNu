import type { NetworkTransport } from "./NetworkTransport";

export class BroadcastChannelTransport<Message> implements NetworkTransport<Message> {
  private readonly channel: BroadcastChannel;

  constructor(channelName: string) {
    this.channel = new BroadcastChannel(channelName);
  }

  send(message: Message): void {
    this.channel.postMessage(message);
  }

  onMessage(handler: (message: Message) => void): void {
    this.channel.onmessage = (event: MessageEvent<Message>) => handler(event.data);
  }

  close(): void {
    this.channel.close();
  }
}
