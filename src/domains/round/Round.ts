export interface RoundSnapshot {
  seekerId: string;
  hiderIds: string[];
  spinEndsAt: number;
  countdownEndsAt: number;
  hideEndsAt: number;
  mapImageDataUrl: string;
}

export type RoundPhase = "seeker-reveal" | "countdown" | "hide" | "seek";

export const SPIN_DURATION_MS = 2500;
export const COUNTDOWN_DURATION_MS = 3000;
export const HIDE_DURATION_MS = 30000;

export function getRoundPhase(round: RoundSnapshot, now: number): RoundPhase {
  if (now < round.spinEndsAt) return "seeker-reveal";
  if (now < round.countdownEndsAt) return "countdown";
  if (now < round.hideEndsAt) return "hide";
  return "seek";
}
