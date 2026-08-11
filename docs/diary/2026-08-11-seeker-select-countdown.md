# Diary: Seeker-select + countdown flow

Second iteration in the repo. Picks up right where the lobby-shell iteration left off: pressing START in the lobby did nothing but flip a status flag and show a static "not implemented yet" placeholder on both host and guest. This iteration wires START into the real flow from `PRD.md` stories 7-8: a wheel-spin animation that randomly picks the seeker, then a countdown, then the round begins with each player told their role.

## Step 1: Propose next slice, plan, implement, and verify cross-tab

**Author:** main

### Prompt Context

**Verbatim prompt:** `/suggest-next-iteration`

**Interpretation:** Run the `suggest-next-iteration` skill: check `PRD.md`/`CONSTITUTION.md` exist, scan the codebase for what's already built, and propose two or three logical next slices for the user to pick from.

**Inferred intent:** Continue the fixed 4-skill loop described in the root `CLAUDE.md` — the previous session had already run `/diary` to close out the lobby-shell iteration, so this fresh session's job was to figure out the next buildable piece of the game and then, once the user picked one (via `AskUserQuestion`, answer: "A: Seeker-select + countdown"), actually build it. There was no separate implementation prompt — after the user answered the option question and then approved the plan presented via plan mode, work proceeded directly under Auto Mode without further per-step prompts.

### What I did

Read `/PRD.md`, `/CONSTITUTION.md`, and the prior diary entry (`/docs/diary/2026-08-11-lobby-shell.md`) to understand what existed. Scanned `/src` and confirmed the lobby shell (name entry, create/join, host max-players, START) was the only thing built, with `/src/ui/screens/LobbyScreen.ts` rendering a dead-end "Round starting… (not implemented yet)" message once `Lobby.status` became `"started"`.

Proposed three options via `AskUserQuestion`: (A) seeker-select + countdown, (B) canvas/camera/movement prototype, (C) paint-the-sprite prototype. User picked A.

Entered plan mode, read the four files that mattered (`/src/domains/lobby/Lobby.ts`, `/src/domains/lobby/HostLobbySession.ts`, `/src/domains/lobby/GuestLobbySession.ts`, `/src/domains/lobby/LobbyMessage.ts`, `/src/app/App.ts`, `/src/ui/screens/LobbyScreen.ts`, `/src/style.css`) and wrote the plan to `/Users/mikkel/.claude/plans/mutable-tinkering-pelican.md`. The user approved it via `ExitPlanMode` without changes.

Implemented exactly what the plan described:
- `/src/domains/round/Round.ts` (new): `RoundSnapshot` type, `RoundPhase` type (`"seeker-reveal" | "countdown" | "active"`), `getRoundPhase(round, now)`, and duration constants `SPIN_DURATION_MS = 2500` / `COUNTDOWN_DURATION_MS = 3000`.
- `/src/domains/lobby/Lobby.ts`: added a `round: RoundSnapshot | null` field and a `round` field on `LobbySnapshot`. Rewrote `start()` to accept an injectable `now` (defaulting to `Date.now()`), randomly pick one current player as `seekerId`, compute `hiderIds` as everyone else, and derive `spinEndsAt`/`countdownEndsAt` from `now` plus the two duration constants.
- `/src/domains/lobby/HostLobbySession.ts`: `start()` now calls `this.lobby.start(Date.now())` explicitly.
- `/src/ui/screens/RoundScreen.ts` (new): `renderRoundScreen(root, { snapshot, selfPlayerId })` renders once, then runs a `setInterval` at 50ms that recomputes `getRoundPhase` against `Date.now()` and updates a single display element in place — cycling player names during `"seeker-reveal"`, showing the revealed seeker plus a countdown number during `"countdown"`, and showing a seeker/hider role banner during `"active"`. Returns a dispose function that clears the interval.
- `/src/ui/screens/LobbyScreen.ts`: deleted the now-dead `status === "started"` placeholder branch.
- `/src/app/App.ts`: added a `roundScreenDispose` field; the `onStateChange` callback in `showLobby()` now disposes any previous round screen, and branches to `renderRoundScreen` (storing its dispose) when `snapshot.status === "started" && snapshot.round`, otherwise falls through to the existing `renderLobbyScreen` call.
- `/src/style.css`: added `.round-display`, `.round-spin-name`, `.round-countdown-number`, `.role-banner`, `.role-seeker`, `.role-hider`.

Ran `npx tsc -b --noEmit` — clean. Then started `npx vite --port 5173` in the background and drove it with the Playwright MCP tools: tab 1 entered "Mikkel", created a lobby (invite ID `LE8W7`); tab 2 entered "Sara", joined via `LE8W7`; both tabs showed the synced player list. Clicked START on tab 1. By the time the snapshot was taken, tab 1 had already progressed to the countdown phase showing "Mikkel is the SEEKER!" with a "1" on screen, and tab 2 had already reached the active phase showing "You are a HIDER". Re-checked tab 1 moments later and it showed "Round started" / "You are the SEEKER" — matching tab 2's hider assignment on the same seeker identity. Closed both tabs and killed the dev server.

### Why

Keeping the host authoritative (host computes the seeker pick and both timestamps, guests only ever read the broadcast snapshot) mirrors the exact pattern already established for `maxPlayers`/`start` in the lobby-shell iteration, so no new asymmetry-handling code was needed anywhere — `HostLobbySession` already only exposes `start()`, and `GuestLobbySession` already only reads `state` messages.

Folding `round` into the existing `state` message rather than inventing a new message type kept `LobbyMessage.ts` untouched and avoided a second synchronization path to reason about — the wheel-spin/countdown/active transitions are all derived client-side from two absolute timestamps rather than driven by additional network messages, which is simpler and sufficient given the PRD doesn't require the host to be able to interrupt or resync a round in progress.

### What worked

The "compute two absolute timestamps once, derive phase locally via a pure function" design worked exactly as planned — `getRoundPhase` needed no changes during implementation, and the Playwright verification showed both tabs converging on the same seeker identity and progressing through phases independently but consistently, with no visible drift worth mentioning at `BroadcastChannel` latency.

Reusing the plan-mode file-reads from earlier in the session meant implementation had no surprises — every file named in the plan matched what was actually edited, with no additional files needed.

### What didn't work

Nothing broke. `tsc -b --noEmit` was clean on the first attempt, and the Playwright cross-tab check passed without needing a retry.

### What I learned

The two tabs progress through the spin/countdown/active phases fast enough (2.5s spin + 3s countdown = 5.5s total) that by the time a snapshot is captured after clicking START and switching tabs, the phases can already be visibly out of sync between what's shown in each Playwright snapshot call — not because the underlying timestamps disagree, but simply because wall-clock time passes between driving tab 1 and then switching to inspect tab 2. This is expected given the fixed, non-adjustable duration constants and isn't a bug; a future test that wants to catch the "seeker-reveal" cycling animation precisely would need to snapshot immediately after clicking START rather than after switching tabs.

### What was tricky

Deciding where the phase-derivation boundary should sit was the one real design question: computing `spinEndsAt`/`countdownEndsAt` once in `Lobby.start()` and letting each client's `RoundScreen` derive its own current phase via `getRoundPhase(round, Date.now())` keeps `Lobby` itself free of any timers or intervals — it stays a plain synchronous state object like the rest of the domain — while `RoundScreen` is the only place that owns a `setInterval`, and it's scoped to exactly the screen's lifetime via the returned dispose function.

### What warrants review

`/src/app/App.ts`'s `roundScreenDispose` handling is worth a second look — it only gets cleared/disposed inside the `onStateChange` callback, so if `showLobby()` were ever called a second time without `onStateChange` firing again first (not currently possible given how sessions are constructed, but worth flagging), a stale interval could theoretically outlive its screen.

The known clock-drift limitation flagged in the plan still applies: `spinEndsAt`/`countdownEndsAt` are interpreted locally per client with no clock-sync correction. This is a non-issue over `BroadcastChannel` (same machine, near-zero latency) but would need addressing once a real networked transport replaces it.

### Future work

The "active" phase currently just shows a static "You are the SEEKER"/"You are a HIDER" banner as a placeholder — the next natural slice (per the options not chosen this round) is the canvas/camera/movement prototype, which would give that active phase somewhere real to go, or the paint-the-sprite prototype for the hide phase specifically.
