export interface RoundSnapshot {
  seekerIds: string[];
  hiderIds: string[];
  spinEndsAt: number;
  countdownEndsAt: number;
  hideEndsAt: number;
  seekEndsAt: number;
  mapImageDataUrl: string;
}

export type RoundPhase = "seeker-reveal" | "countdown" | "hide" | "seek" | "results";

export const SPIN_DURATION_MS = 2500;
export const COUNTDOWN_DURATION_MS = 3000;
export const HIDE_DURATION_MS = 30000;
export const SEEK_DURATION_MS = 120000;

export function getRoundPhase(round: RoundSnapshot, now: number): RoundPhase {
  if (now < round.spinEndsAt) return "seeker-reveal";
  if (now < round.countdownEndsAt) return "countdown";
  if (now < round.hideEndsAt) return "hide";
  if (round.hiderIds.length === 0) return "results";
  if (now >= round.seekEndsAt) return "results";
  return "seek";
}
