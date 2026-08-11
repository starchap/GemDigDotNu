# Diary: Lobby shell + join flow (first buildable iteration)

First code in the repo. `/suggest-next-iteration` proposed three slices off `PRD.md` and `CONSTITUTION.md` — lobby shell, canvas+camera prototype, or paint-the-sprite prototype — and the user picked the lobby shell (option A): name entry, create/join a lobby via invite ID, host sets max players, host presses START. Everything else in the game (map, painting, seeking, scoring) is out of scope for this slice.

## Step 1: Scaffold project, build lobby domain + fake networking, wire up UI, verify cross-tab

**Author:** main

### Prompt Context

**Verbatim prompt:** "let's begin with A"

**Interpretation:** The user was responding to a menu of three proposed next iterations (A: lobby shell + join flow, B: single-player movement + camera on canvas, C: paint-the-sprite prototype) and chose A.

**Inferred intent:** Start writing actual code for the first time in this greenfield repo, scoped tightly to the lobby/join domain — no map, movement, or painting yet. Per `CLAUDE.md`'s "fake everything as long as possible" rule and the constitution's mandate to keep infra behind clean interfaces, the expectation was that this iteration should visibly work (host and guest syncing in a lobby) without any real backend.

### What I did

Scaffolded a TypeScript + Vite browser project from nothing: `/package.json`, `/tsconfig.json`, `/index.html`, `/src/style.css`, `/src/main.ts`. No framework, per the constitution's "plain browser Canvas API — no game framework/library" (this iteration doesn't touch canvas yet, but the no-framework spirit extends to the DOM/UI layer too).

Built the domain layer under `/src/domains/`:
- `player/Player.ts` — a `Player` type plus `createPlayer(name)` using `crypto.randomUUID()`.
- `lobby/InviteId.ts` — `generateInviteId()`, a 5-character code from an alphabet with ambiguous characters (`0`/`O`/`1`/`I`) removed.
- `lobby/Lobby.ts` — the `Lobby` class: host, max players (capped at 16), player list, status (`waiting`/`started`), with `addPlayer`/`setMaxPlayers`/`start`/`toSnapshot`. Throws `LobbyFullError` when addPlayer exceeds capacity.
- `lobby/LobbyMessage.ts` — the message union (`join-request`, `set-max-players`, `start`, `state`) passed over the transport.
- `lobby/HostLobbySession.ts` and `lobby/GuestLobbySession.ts` — the session objects that wire a `Lobby` to a transport. The host session owns the authoritative `Lobby`, applies incoming messages, and broadcasts a fresh snapshot after every mutation. The guest session just sends a `join-request` on construction and forwards incoming `state` snapshots to listeners.
- `networking/NetworkTransport.ts` — a minimal `send`/`onMessage`/`close` interface.
- `networking/BroadcastChannelTransport.ts` — a real implementation over the browser's `BroadcastChannel` API, scoped by invite ID (`camo-lobby-<inviteId>`).
- `networking/InMemoryTransport.ts` — a same-process fake for future unit tests, backed by a module-level `Map` of channel name to a `Set` of endpoints, mirroring `BroadcastChannel`'s "don't deliver to self" semantics.

Built four DOM-only UI screens under `/src/ui/screens/`: `NameEntryScreen`, `HomeScreen`, `CreateLobbyScreen`, `JoinLobbyScreen`, `LobbyScreen`. Each is a plain function `(root, callbacks) => void` that clears and rebuilds `innerHTML` — no component framework, no virtual DOM. `/src/app/App.ts` is the orchestrator: it holds the current player and session, and each `show*` method re-renders the appropriate screen and wires callbacks back into itself.

Ran `npm install` (vite + typescript only) and `npx tsc -b --noEmit` — clean on the first pass after one small cleanup (see below).

Verified the whole thing live using the Playwright MCP tools against `npx vite --port 5173`: opened tab 1, entered name "Mikkel", created a lobby (got invite ID `G5UE3`), opened tab 2 in the same browser context, entered name "Sara", joined with `G5UE3`. Tab 2 immediately showed both players. Switched back to tab 1 without reloading — it also showed both players, proving the `BroadcastChannel` sync works live across real tabs, not just in theory. Clicked START on tab 1 (host); tab 2 flipped to "Round starting… (not implemented yet)" without any interaction on that tab. Closed both tabs and killed the dev server afterward.

### Why

The constitution's "infra stays behind clean interfaces/fakes as long as possible" principle drove the `NetworkTransport` abstraction: nothing in the lobby domain knows whether it's talking to `BroadcastChannel`, an in-memory bus, or (eventually) a WebSocket server. `BroadcastChannel` was chosen as the concrete transport for this iteration specifically because it's a genuine browser API — zero server, zero real infrastructure — yet still proves real multi-client sync visually, which is exactly what `/suggest-next-iteration`'s "get something visual running first, fake everything" guidance calls for. A single-tab simulation would have been less convincing proof that the lobby domain logic is actually shaped correctly for multiple independent clients.

The host-authoritative design (host owns the `Lobby`, guests only ever read snapshots) exists because the PRD's implementation decisions are explicit that only the host controls max players and START — building that asymmetry into the session classes rather than the UI keeps the UI dumb and the invariant enforced in one place.

### What worked

The `NetworkTransport` interface paid off immediately: `HostLobbySession` and `GuestLobbySession` were written and typechecked against the interface without ever touching `BroadcastChannel` directly, and swapping in `InMemoryTransport` for future automated tests should be a one-line change (pass a different `TransportFactory` into `App`).

The Playwright cross-tab test was the right call for verifying this iteration specifically, since the entire point of a lobby is that it's multi-client — a single-tab click-through wouldn't have proven anything about the networking layer actually working.

### What didn't work

Nothing broke during implementation. The only snag was self-caught during writing, not a runtime failure: `App.ts` initially imported and re-exported `LobbyFullError` out of habit (thinking a guest-facing "lobby full" error message might be wired up), but nothing actually consumed it, and `noUnusedLocals` in `/tsconfig.json` would have failed the build. Removed both the import and the stray `export { LobbyFullError }` before ever running `tsc`, so there's no error message to record — just a note that the unused-locals strictness setting did its job as a design-time check.

### What I learned

`BroadcastChannel` instances opened via Playwright's `browser_tabs` "new" action share the same browsing context group as the original tab (same origin, same profile), so cross-tab `BroadcastChannel` sync works in that test setup exactly as it would for a real user with two tabs open — this was worth confirming empirically rather than assuming, since MCP-driven tabs could plausibly have been isolated.

A guest joining a full lobby currently fails silently: `HostLobbySession.handleMessage` catches `LobbyFullError` and simply skips broadcasting, so the guest who tried to join never finds out. That's an intentional scope cut for this iteration (the PRD doesn't call out this edge case), but it's worth flagging rather than let it hide as an oversight.

### What was tricky

Deciding where the host/guest asymmetry should live was the one real design decision in this iteration. Putting `setMaxPlayers`/`start` only on `HostLobbySession` (not on `Lobby` itself, and not gated in the UI layer) means a guest's `App` instance structurally cannot call them — `App.showLobby()` only wires `onSetMaxPlayers`/`onStart` callbacks when `session instanceof HostLobbySession`. That felt like the right place to enforce the host-only invariant, since it's a networking/session-layer concern (who's allowed to author state-changing messages) rather than a UI concern (what buttons to show) or a pure-domain concern (`Lobby` itself has no concept of "whose message is this").

### What warrants review

`/src/app/App.ts` is the seam most worth a second look — it's the one place that knows about both session types and both transport directions, so any future bug in "guest sees stale state" or "host action leaks to guest" will likely trace back to `showLobby()`'s `session instanceof HostLobbySession` branch.

`/src/domains/lobby/HostLobbySession.ts`'s silent-drop behavior on `LobbyFullError` (noted above) is a real gap, not just a style nit — worth deciding deliberately in a future iteration rather than leaving it accidental.

The `InMemoryTransport` in `/src/domains/networking/InMemoryTransport.ts` was written but never exercised by any test yet — it's there to support future automated tests without a browser, but until something actually uses it, it's unverified beyond typechecking.

### Future work

Wiring an actual round after START — right now it just flips `Lobby.status` to `"started"` and both host and guest render a "Round starting… (not implemented yet)" placeholder. That's the natural next seam: either the canvas/camera prototype or the seeker-selection wheel-spin animation would give START somewhere real to go.

Surfacing the "lobby full" case to a rejected guest, if a future iteration decides that edge case matters enough to spend UI on.

Writing actual tests against `InMemoryTransport` now that it exists, rather than relying solely on the manual Playwright cross-tab check.
