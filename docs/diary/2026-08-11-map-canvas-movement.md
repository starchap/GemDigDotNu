# Diary: Map + canvas + camera + movement prototype

Third iteration in the repo, picking up where `2026-08-11-seeker-select-countdown.md` left off. The "active" phase of a round was a static "You are the SEEKER"/"You are a HIDER" placeholder banner. This iteration replaces it with real rendering: the host uploads a map image (PRD story 5, previously unimplemented), and once a round goes active, every player sees a Canvas view of that map with their own sprite, keyboard movement, and a zoomed-in camera that follows them (story 13) — deliberately scoped to **no networking of positions yet**, per the option description the user picked.

## Step 1: Propose next slice, plan, implement, and verify

**Author:** main

### Prompt Context

**Verbatim prompt:** `/suggest-next-iteration`

**Interpretation:** Run the `suggest-next-iteration` skill again in a new session: re-confirm `PRD.md`/`CONSTITUTION.md` and the current codebase state, then propose the next logical slice.

**Inferred intent:** Continue the fixed 4-skill loop. As with the previous iteration, there was no separate per-step prompt — the user answered an `AskUserQuestion` ("A: Map + canvas + camera + movement" over "B: Paint-the-sprite prototype"), and then plan mode was entered (a plan file already existed from the prior iteration at `/Users/mikkel/.claude/plans/mutable-tinkering-pelican.md`) and, per the harness's re-entry rule for a different task, was overwritten rather than amended. Implementation then proceeded automatically once plan mode exited — notably, plan mode exited on its own after a background research agent completed, without an explicit `ExitPlanMode` call producing a user-visible approval gate. That's a harness quirk worth flagging (see "What was tricky" below), not something the user asked for; I proceeded on the assumption that the option description the user had already picked, which spelled out this exact scope, constituted sufficient sign-off, matching how the prior iteration only needed one plan-approval gate before implementation ran through to completion.

### What I did

Used two background `Explore` agents (rather than reading files myself directly, per the plan-mode workflow's phase-1 rule) to (1) reconfirm `PRD.md`/`CONSTITUTION.md`/`docs/diary/` state and the `/src` tree, and (2) dump the full verbatim contents of every file relevant to this change (`CreateLobbyScreen.ts`, `HomeScreen.ts`, `JoinLobbyScreen.ts`, `Lobby.ts`, `HostLobbySession.ts`, `GuestLobbySession.ts`, `LobbyMessage.ts`, `NetworkTransport.ts`, `BroadcastChannelTransport.ts`, `Round.ts`, `RoundScreen.ts`, `App.ts`, `style.css`, `main.ts`). This confirmed the map-image gap (story 5 had no UI or domain support at all) and the exact current shape of `RoundScreen.ts`'s placeholder.

Wrote the plan to `/Users/mikkel/.claude/plans/mutable-tinkering-pelican.md`, then implemented it exactly:
- `/src/domains/round/Round.ts`: added `mapImageDataUrl: string` to `RoundSnapshot`.
- `/src/domains/lobby/Lobby.ts`: added `mapImageDataUrl: string | null = null`, `setMapImage(dataUrl)`, a new `MapImageRequiredError`, and `LobbySnapshot.mapImageDataUrl`. `start(now)` now throws `MapImageRequiredError` if no map is set, and copies `mapImageDataUrl` into the round snapshot at start time.
- `/src/domains/lobby/HostLobbySession.ts`: added `setMapImage(dataUrl)` mirroring `setMaxPlayers` — mutate then `broadcastState()`.
- `/src/domains/movement/Movement.ts` (new domain): `Vector2`, `MovementInput`, `MOVE_SPEED_PX_PER_SEC = 160`, a pure `stepPosition(position, input, deltaSeconds, bounds)` (diagonal-normalized, clamped to bounds), and a pure `computeCameraTopLeft(playerPosition, viewport, mapBounds)` (centers on the player, clamped so the viewport never shows past the map edges).
- `/src/ui/game/GameCanvas.ts` (new): `mountGameCanvas(root, { mapImageDataUrl, role })` — creates a 360×270 `<canvas>`, wires arrow-key/WASD listeners into a `MovementInput`, runs a `requestAnimationFrame` loop that steps position and draws the camera-clamped map slice (via the 9-argument `drawImage`), a colored circle sprite (red for seeker, blue for hider, reusing the existing role-banner palette), and an on-canvas role label. Returns a dispose function that cancels the rAF and removes the listeners.
- `/src/ui/screens/RoundScreen.ts`: on reaching the `"active"` phase, stops the 50ms interval and mounts `GameCanvas` exactly once (guarded by only reaching that branch after `window.clearInterval(intervalId)`), instead of rendering the static banner. Had to hoist `intervalId` to a `let` declared before `tick` — the original code declared it with `const` *after* the first `tick()` call, which happened to work only because the very first tick could never land in the `"active"` branch (the spin duration guarantees that), but referencing `intervalId` inside `tick` while it's still in the `const` temporal dead zone was fragile and worth fixing properly rather than relying on that timing coincidence.
- `/src/ui/screens/LobbyScreen.ts`: host view gained a `type="file" accept="image/*"` input that reads the file via `FileReader.readAsDataURL` and calls a new `onSetMapImage(dataUrl)` prop, a `<img class="map-preview">` once a map is set, and `startButton.disabled = !snapshot.mapImageDataUrl`.
- `/src/app/App.ts`: wired `onSetMapImage` to `hostSession.setMapImage(dataUrl)`.
- `/src/style.css`: added `.map-preview` and `.game-canvas` (`width:100%; height:auto` so the fixed-resolution canvas scales responsively in the existing card).

Ran `npx tsc -b --noEmit` — clean. Then verified live: generated a small 200×300 test PNG via `sips` in the scratchpad directory, copied it into `/Users/mikkel/Development/Greenfield Development/.playwright-mcp/` (Playwright's file-upload tool refused the original scratchpad path with "outside allowed roots" — its allow-list is scoped to the project directory and its own `.playwright-mcp` folder), then drove the full flow with Playwright MCP: name entry → create lobby → confirmed START was disabled with no map → uploaded the PNG via the file input (had to first click the file input to trigger a file-chooser modal state, since `browser_file_upload` errors if there's no pending modal) → confirmed a preview appeared and START became enabled → pressed START → waited through the wheel-spin/countdown → took a screenshot (accessibility snapshots return empty for canvas content, so screenshots were the right verification tool here) confirming the yellow map, a red "SEEKER" circle, and the on-canvas role label rendered correctly, camera clamped against the map's edges since the 360px viewport is wider than the 200px test map. Held `ArrowRight` for 500ms via `page.keyboard.down`/`waitForTimeout`/`up` (a single `press` only fires keydown+keyup instantly, not a hold) and re-screenshotted — the sprite moved right and stopped exactly at the map's right edge, confirming both movement and edge-clamping work. Deleted the screenshots and test image, killed the dev server afterward.

### Why

Keeping `mapImageDataUrl` host-authoritative on `Lobby`, broadcast via the existing `state` message, meant zero changes to `LobbyMessage.ts` or the transport layer — it reused the exact pattern `maxPlayers` already established, so no new synchronization path needed reasoning about.

Splitting movement into a pure `src/domains/movement/` module (no DOM, no Canvas) versus an impure `src/ui/game/GameCanvas.ts` (all the browser glue) follows the constitution's domain-driven principle directly and makes the position/camera math independently testable later, even though no unit tests were written this iteration — the separation itself was the important structural decision.

Scoping out position networking (explicitly called out in both the `AskUserQuestion` option description and the plan) kept this iteration achievable in one pass while still proving the actually-hard parts: image data flowing from a `<input type="file">` through `FileReader`, across `BroadcastChannel` as part of a snapshot, into an `Image` element, and then camera math correctly cropping and clamping against it.

### What worked

The camera-clamp math worked correctly on the very first try with real numbers: a 200×300 test map inside a 360×270 viewport clamped the camera to `(0,0)` on both axes (since the map is smaller than the viewport in both dimensions) and the screenshots visibly confirmed the sprite moving and stopping precisely at the map's right edge rather than sliding into the black backdrop.

Structuring `GameCanvas.ts` around a single `image.onload` callback that sets `mapBounds`/initial `position` and only then kicks off the `requestAnimationFrame` loop avoided any race where movement math would run against a zero-sized map before the image finished loading.

### What didn't work

`browser_file_upload` initially failed with `File access denied: ... is outside allowed roots. Allowed roots: /Users/mikkel/Development/Greenfield Development/.playwright-mcp, /Users/mikkel/Development/Greenfield Development` when pointed at a file in the session's scratchpad directory (`/private/tmp/claude-501/.../scratchpad/test-map.png`) — Playwright MCP's file tool has its own allow-list separate from the shell's filesystem access, scoped to the project directory. Fixed by `cp`-ing the test image into `.playwright-mcp/` first.

Also hit `Error: The tool "browser_file_upload" can only be used when there is related modal state present` on the first attempt — the tool only works after a file-chooser dialog has actually been triggered (by clicking the file input), not standalone. Fixed by clicking the file input button first (which Playwright reports as a "Modal state: [File chooser]"), then calling `browser_file_upload`.

`browser_run_code_unsafe` initially failed with `ReferenceError: setTimeout is not defined` when the snippet used a bare `setTimeout`-wrapped `Promise` — that API runs in the Playwright server process, not a browser page, so timers need `page.waitForTimeout(ms)` instead.

### What I learned

`tsc`'s temporal-dead-zone check doesn't catch a `const` declared after its first read if the read only happens conditionally and the condition can't be true on that first pass — the original `RoundScreen.ts` code (`intervalId` referenced inside `tick`, declared as `const` on the line after `tick()`'s first synchronous call) would have thrown a `ReferenceError` at runtime the very first time a round's spin phase happened to already be `"active"` by the time `RoundScreen` mounted (e.g. under significant broadcast delay). It never manifested in testing because `BroadcastChannel` delivery is near-instant and the 2.5s spin duration comfortably covers that gap, but it was a latent bug worth fixing rather than leaving to depend on that timing margin.

Accessibility snapshots (`browser_snapshot`) return an empty tree for a page whose entire visible content is a `<canvas>` — there's no ARIA content to describe. Screenshots are the correct (and only) verification tool for canvas-rendered UI going forward.

### What was tricky

The plan-mode exit was the one process oddity worth recording: after the second background research agent (`Explore`, dumping full file contents) completed and its `<task-notification>` was delivered, the system reminder that followed said plan mode had already been exited and edits were now allowed — without me having called `ExitPlanMode` and without an explicit user approval message in between. I chose to trust that harness-reported state rather than re-block on a manual approval gate, reasoning that the user's `AskUserQuestion` answer had already specified this iteration's scope precisely (map + canvas + camera + movement, no position networking) and that re-asking for approval of a plan whose contents matched that already-chosen scope would be redundant. This is a one-off worth flagging rather than a pattern to rely on — if a future iteration's plan diverges meaningfully from what the user explicitly chose, a manual approval step should still be sought.

Getting a real image file into the browser for the Playwright test required two separate fixes (the allow-list copy, then the file-chooser-modal sequencing) neither of which was obvious from the tool descriptions alone — both are now recorded above for next time.

### What warrants review

`/src/domains/lobby/Lobby.ts`'s `MapImageRequiredError` is thrown by `start()` but nothing in `HostLobbySession.start()` catches it — this is intentional (the UI already disables the START button until a map exists, so the guard is a defensive domain invariant, not a reachable UI path), but it's worth confirming that stance still holds once more ways to trigger `start()` exist.

`mapImageDataUrl` is now stored twice per round — once on `LobbySnapshot` (the "currently configured" map, mutable between rounds) and once on `RoundSnapshot` (the map that specific round is locked to). This was a deliberate choice (see "Design" in the plan file) to let the host stage a different image for the *next* round without affecting a round already in progress, but the duplication is worth a second look if it ever causes the two to visibly disagree.

`/src/ui/game/GameCanvas.ts` is the natural place to look first for any future bug in movement, camera, or rendering — it's the only file that touches `requestAnimationFrame`, raw keyboard events, and the 2D canvas context together.

### Future work

Networking player positions so a seeker can actually see hiders (and vice versa within view) is the load-bearing next step — nothing in this iteration syncs any player's position to any other client, so the "active" phase is currently single-player in substance even though the surrounding lobby/round machinery is fully multiplayer.

Replacing the plain colored-circle sprite with the actual paint-the-sprite mechanic (stories 9-10, the other option not chosen this round) would give hiders something to do with their sprite besides move it.

The seeker's catch mechanic (click directly on a hider's sprite, story 15) and the proximity-based scoring (story 17) both depend on position networking landing first.
