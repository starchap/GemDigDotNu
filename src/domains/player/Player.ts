export interface Player {
  id: string;
  name: string;
}

export function createPlayer(name: string): Player {
  return { id: crypto.randomUUID(), name };
}
