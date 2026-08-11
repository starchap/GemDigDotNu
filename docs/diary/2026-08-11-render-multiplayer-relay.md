# Diary: Real cross-device multiplayer via a Render.com-deployable WebSocket relay

Prior iterations flagged (in `docs/diary/2026-08-11-lobby-shell.md` and
`docs/diary/2026-08-11-position-networking.md`) that `BroadcastChannelTransport`
only works across tabs of the same browser on one machine, and that a small
WebSocket relay server behind the existing `NetworkTransport` interface was
the load-bearing next step. This session replaces the transport with a real
relay and makes the whole thing deployable as a single Render.com Web Service.

## Step 1: Plan and lock stack decisions

**Author:** main

### Prompt Context

**Verbatim prompt:** "for the next iterations we would like to make this ready for render.com so that we can play it multiple players to join and game."

**Interpretation:** The user wants the game to actually support players joining from different machines/networks, deployed on Render.com — not just same-browser-tab testing.

**Inferred intent:** Move from a local fake transport to real cross-device networking, packaged so it can be deployed and shared with friends to actually playtest.

### What I did
Explored the existing `networking` and `lobby` domains (via an Explore agent) to confirm `NetworkTransport` was already a clean seam (`send`/`onMessage`/`close`) with `BroadcastChannelTransport` as the only wired-up implementation and `InMemoryTransport` unused. Asked the user three questions via `AskUserQuestion`: server tech (`ws` vs `socket.io`), Render topology (one service vs two), and whether to fold the resulting CONSTITUTION.md stack change into this same plan. User chose Node.js + `ws`, a single Web Service, and to update the constitution inline. Wrote the plan to `/Users/mikkel/.claude/plans/for-the-next-iterations-wiggly-cerf.md` and got it approved.

### Why
The constitution explicitly leaves server runtime unlocked, and adding one is a stack decision that belongs to the user, not something to assume — hence asking before writing any code.

### What worked
The existing `NetworkTransport` interface needed zero changes and neither did `HostLobbySession`/`GuestLobbySession`/`Lobby` — the abstraction held up exactly as intended when it was introduced.

### What didn't work
N/A for this step — planning went straight through without rework.

### What I learned
The `createLobbyTransport` factory in `/src/app/App.ts` was already the single call site to swap, which is exactly the kind of seam the constitution's "infra behind fakes" principle is meant to produce.

### What was tricky
Deciding how much of this belongs in CONSTITUTION.md vs. deferred to `/clarify-constitution` — resolved by asking the user directly rather than assuming either way.

### What warrants review
Read `/Users/mikkel/Development/Greenfield Development/CONSTITUTION.md` to confirm the added Node.js/`ws` lines match what you'd have chosen via `/clarify-constitution`.

### Future work
None beyond what's captured in Step 2.

## Step 2: Implement relay server, WebSocketTransport, and Render deploy config

**Author:** main

### What I did
- Updated `/CONSTITUTION.md`: Language & Runtime now covers Node.js for the relay; Fixed Dependencies gained `ws` and Node.js; Architecture Principles gained a note that the relay is a dumb per-room forwarder with no game logic, so `networking` stays the only transport-aware domain.
- Added `/server/relay.ts`: a Node `http` server that serves the built `dist/` SPA for normal requests (with an index.html fallback for client-side routes) and upgrades to a `ws.WebSocketServer` on the same port. Clients must send a `{type: "join", room}` handshake as their first message; the server tracks `Map<roomId, Set<WebSocket>>` and relays every subsequent message to the other sockets in that room, skipping the sender — mirroring `InMemoryTransport`'s "don't deliver to self" behavior. Room entries get cleaned up on socket `close`/`error` to avoid leaking empty `Set`s.
- Added `/server/tsconfig.json` (Node lib, `NodeNext` module/resolution, separate `outDir: ../dist-server`) so server code doesn't pull in DOM types and vice versa.
- Added `/src/domains/networking/WebSocketTransport.ts` implementing `NetworkTransport<Message>` over a browser `WebSocket`: sends the join handshake on `onopen`, buffers any `send()` calls made before the socket opens, and maps `onMessage`/`close` directly onto the underlying socket — same single-handler shape as `BroadcastChannelTransport`.
- Rewired `/src/app/App.ts`: `createLobbyTransport` now builds a `WebSocketTransport` pointed at a same-origin `ws(s)://` URL derived from `window.location`, overridable via `VITE_RELAY_URL` for local dev against a different port. Removed the `BroadcastChannelTransport` import from `App.ts` (the class itself and `InMemoryTransport` stay in the codebase, just no longer wired up as the default).
- Added `/src/vite-env.d.ts` for `ImportMetaEnv`/`ImportMeta` typing (`VITE_RELAY_URL`), since one didn't exist yet.
- Updated `/package.json`: added `ws` as a runtime dependency, `@types/node` + `@types/ws` as dev dependencies, and `build:server` / `start` scripts. `typecheck` now runs both the client (`tsc -b`) and server (`tsc -p server/tsconfig.json`) project checks.
- Added `/render.yaml`: single `web` service (`plan: free`, Node runtime) with `buildCommand: npm install && npm run build && npm run build:server` and `startCommand: npm start`.
- Added `dist-server` to `/.gitignore` alongside the existing `dist`.

### Why
This directly implements the plan: real transport, one deployable process/port (required for Render's free-tier single-port model), constitution updated to match the now-locked stack.

### What worked
`npm run typecheck`, `npm run build`, and `npm run build:server` all passed cleanly on the first full pass after one type fix (below). Manually spun up the built relay on port 3099 and drove it with two raw `ws` clients in a throwaway Node script: both joined room `ABCDE` via the handshake, and a message sent from client A arrived at client B — confirming the relay actually forwards across independent socket connections, not just within one process's fake bus.

### What didn't work
First `npm run typecheck` failed with:
```
server/relay.ts(80,15): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
  Type 'null' is not assignable to type 'string'.
```
Cause: `joinedRoomId = handshake.room` assigns from an `any` (untyped `JSON.parse` result) into a `string | null`-declared `let`; TS keeps the declared union type after such an assignment rather than narrowing to `string`, so the very next line's use of `joinedRoomId` as a `string` argument failed. Fixed by introducing an explicitly-typed `const room: string = handshake.room` and using `room` for both the assignment and the `roomFor(room)` call.

### What I learned
`import.meta.dirname` (used in `relay.ts` to locate `../dist` relative to the compiled server file) requires a reasonably modern Node — pinned `NODE_VERSION: 22.9.0` in `render.yaml` to be safe on Render's build image. Also confirmed `tsc -b`'s composite-project incremental build doesn't interfere with a separate non-composite `server/tsconfig.json` checked via plain `-p`, so the two type-check universes (DOM vs Node) can stay fully isolated without a monorepo tool.

### What was tricky
Getting the static-file fallback right without pulling in Express: a bare `node:http` server plus manual `extname`-based content-type lookup and a try/catch-into-index.html fallback (for client-side routing, though this SPA doesn't currently have any routes) was enough, but it's worth double-checking the `Content-Type` map in `/server/relay.ts` if new asset types get added to the built output later (e.g. fonts, webp) since unmapped extensions currently fall back to `application/octet-stream`.

### What warrants review
- `/server/relay.ts` — the whole relay logic is new and unreviewed by a human; especially the handshake parsing (`JSON.parse` on the first message with no try/catch — a malformed first message will throw and crash that connection's message handler, worth confirming that's acceptable versus wrapping in try/catch and closing gracefully).
- `/src/app/App.ts` — confirm the `relayUrl()` same-origin derivation is what's wanted for local `vite dev` (client on 5173, relay would need to run separately and be pointed at via `VITE_RELAY_URL=ws://localhost:3000` — this isn't documented anywhere yet, see Future work).
- `render.yaml` — free-tier Render web services spin down on idle and cold-start on the next request; worth confirming that's acceptable for a party game where a host might create a lobby and wait for friends to click a link a few minutes later.

### Future work
- Document the local two-process dev workflow (run `vite` for the client and `node --experimental-strip-types server/relay.ts` or similar for the relay, with `VITE_RELAY_URL` pointing at it) — right now local dev either runs the full build+start pipeline or falls back to the now-orphaned `BroadcastChannelTransport`/`InMemoryTransport` for same-machine testing.
- Actual deploy to Render and a real two-machine playtest (needs the user's Render account) is called out in the plan's verification section but wasn't done in this session.
- Consider wrapping the relay's handshake `JSON.parse` in a try/catch so a malformed first message closes the socket cleanly instead of throwing inside the `message` event handler.
