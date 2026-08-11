import type { NetworkTransport } from "./NetworkTransport";

type Endpoint<Message> = {
  handler: (message: Message) => void;
};

const channels = new Map<string, Set<Endpoint<unknown>>>();

export class InMemoryTransport<Message> implements NetworkTransport<Message> {
  private readonly channelName: string;
  private readonly endpoint: Endpoint<Message> = { handler: () => {} };

  constructor(channelName: string) {
    this.channelName = channelName;
    this.endpoints().add(this.endpoint as Endpoint<unknown>);
  }

  private endpoints(): Set<Endpoint<unknown>> {
    let endpointsForChannel = channels.get(this.channelName);
    if (!endpointsForChannel) {
      endpointsForChannel = new Set();
      channels.set(this.channelName, endpointsForChannel);
    }
    return endpointsForChannel;
  }

  send(message: Message): void {
    for (const endpoint of this.endpoints()) {
      if (endpoint !== (this.endpoint as Endpoint<unknown>)) {
        (endpoint as Endpoint<Message>).handler(message);
      }
    }
  }

  onMessage(handler: (message: Message) => void): void {
    this.endpoint.handler = handler;
  }

  close(): void {
    this.endpoints().delete(this.endpoint as Endpoint<unknown>);
  }
}
