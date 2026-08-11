# Diary: Paint-the-sprite camouflage + hide/seek phase split

Fifth iteration in the repo. Picks up right after position networking shipped:
every player could see every other player's movement continuously from the
moment countdown ended, with no camouflage, no hide/seek distinction, and no
concept of hider-blindness anywhere in the code. This iteration builds PRD
stories 9-10 (freehand paint camouflage with a limited budget) and, as the
minimal scaffolding needed to make painting meaningful, splits the
undifferentiated "active" round phase into a bounded 30-second "hide" phase
and an open-ended "seek" phase, with uniform blindness (nobody renders anybody
else) during "hide" per story 14.

## Step 1: Propose next slice, plan, implement, and verify cross-tab

**Author:** main

### Prompt Context

**Verbatim prompt:** `/suggest-next-iteration`

**Interpretation:** Run the `suggest-next-iteration` skill: confirm `PRD.md`
and `CONSTITUTION.md` exist, scan the codebase for what's already built, and
propose two or three logical next slices for the user to pick from.

**Inferred intent:** Continue the fixed 4-skill loop from the root
`CLAUDE.md` — the previous session had already run `/diary` to close out
position networking, so this session's job was to figure out the next
buildable piece and then build whichever one the user picked (via
`AskUserQuestion`, answer: "Paint-the-sprite camouflage"). There was no
separate implementation prompt — once the user approved the plan via
`ExitPlanMode`, work proceeded directly under Auto Mode, with one mid-flight
interruption ("we tested it it looks fine") that ended the verification step
early.

### What I did

Confirmed both `/PRD.md` and `/CONSTITUTION.md` existed, then read them in
full along with all four prior diary entries to reconstruct what was already
built: lobby creation/join, host map upload, seeker-select + countdown
(`/src/domains/round/Round.ts`, `/src/ui/screens/RoundScreen.ts`), and a
canvas with camera, keyboard movement, and cross-tab position sync
(`/src/ui/game/GameCanvas.ts`) that rendered every player as a plain colored
circle with no camouflage and no phase-based visibility rules — the "active"
phase just ran forever once countdown ended.

Proposed three options via `AskUserQuestion`: (A) catch mechanic + hide/seek
split, (B) paint-the-sprite camouflage, (C) proximity scoring + results
screen. User picked B.

Entered plan mode, read the remaining relevant files (`Lobby.ts`,
`LobbyMessage.ts`, `HostLobbySession.ts`, `GuestLobbySession.ts`,
`Player.ts`, `Movement.ts`, `App.ts`, `style.css`), then delegated to a
`Plan` sub-agent with the full architectural context and constraints (Round.ts
must stay timer-free/pure, Lobby stays host-authoritative for any new shared
timestamp, paint sync must bypass `LobbySnapshot` and reuse the exact
"position"-message peer-to-peer pattern, only hiders paint). The sub-agent's
plan settled several concrete decisions — paint canvas native resolution
equal to the sprite's own pixel space (28×28, matching `PLAYER_RADIUS*2`) to
avoid unit-conversion bugs between paint-canvas pixels and budget math;
budget checked per pointer-move segment rather than only at stroke-end;
`GameCanvas` deriving `RoundPhase` fresh every animation frame from a `round`
prop rather than being unmounted/remounted at the hide→seek boundary. Wrote
the final plan to `/Users/mikkel/.claude/plans/lively-discovering-star.md`,
and the user approved it via `ExitPlanMode` without changes.

Implemented exactly what the plan described:
- `/src/domains/round/Round.ts`: split `RoundPhase` from `"active"` into
  `"hide" | "seek"`, added `HIDE_DURATION_MS = 30000` and a `hideEndsAt`
  field on `RoundSnapshot`, updated `getRoundPhase` to check it.
- `/src/domains/lobby/Lobby.ts`: `start()` now computes
  `hideEndsAt = countdownEndsAt + HIDE_DURATION_MS` and includes it in the
  constructed `RoundSnapshot`, keeping the host authoritative for it exactly
  like the existing `spinEndsAt`/`countdownEndsAt`.
- `/src/domains/player/PlayerSprite.ts` (new): promoted `PLAYER_RADIUS`
  (previously a local const duplicated nowhere but embedded in
  `GameCanvas.ts`) and a derived `SPRITE_DIAMETER` into a shared module so the
  paint code and canvas code can't disagree about sprite size.
- `/src/domains/paint/PaintBudget.ts` (new): pure, DOM-free budget math —
  `computeSpriteSurfaceAreaPx2`, `computePaintBudgetPx2` (the 1.2x
  multiplier from story 10), `computeStrokeSegmentAreaPx2`, and a
  `PaintBudgetTracker` class (`spend`, `remaining`, `fractionRemaining`,
  `isExhausted`).
- `/src/domains/lobby/LobbyMessage.ts`: added a
  `{ type: "paint"; playerId: string; imageDataUrl: string }` variant,
  mirroring the existing `"position"` variant.
- `/src/domains/lobby/HostLobbySession.ts` and `GuestLobbySession.ts`: added
  symmetric `sendPaint(imageDataUrl)` / `onPaintUpdate(listener)` methods and
  a `paintListeners` array, wired into each class's existing
  branch-per-message-type `handleMessage` structure — no relay logic needed
  since `BroadcastChannelTransport` already fans messages out to every
  same-channel participant directly.
- `/src/ui/game/PaintPanel.ts` (new): `mountPaintPanel(root, { onPaintChange })`
  renders a 28×28-native-resolution canvas (CSS-scaled to ~196px display with
  `image-rendering: pixelated`), a native `<input type="color">`, and a
  budget bar. On every `pointermove` mid-stroke it computes the segment's
  area via `computeStrokeSegmentAreaPx2`, spends it from a
  `PaintBudgetTracker` owned for the panel's lifetime, and stops drawing
  (without blocking the drag itself) once the tracker reports exhausted.
  `onPaintChange` fires throttled (~150ms) during a stroke and once more
  unconditionally on pointer-up so the final state is never dropped.
- `/src/ui/game/GameCanvas.ts`: reshaped `GameCanvasProps` to take
  `round: RoundSnapshot` instead of separate `mapImageDataUrl`/`seekerId`
  fields, and a `session: PositionChannel & PaintChannel`. Every `draw()`
  call now derives `phase = getRoundPhase(props.round, Date.now())` itself;
  during `"hide"` it skips rendering every other player entirely (uniform
  blindness) and lazily mounts `PaintPanel` into a sibling DOM slot if the
  local role is `"hider"`; once phase leaves `"hide"` it disposes the panel
  and resumes rendering everyone. Player rendering now always layers a base
  role-color fill first, then the player's painted texture (transparent
  where unpainted) clipped to the circle on top, so an incomplete paint job
  still shows the giveaway color underneath. Remote painted textures arrive
  via `onPaintUpdate` and are cached into a `Map` even during `"hide"`, so
  there's no pop-in delay the instant `"seek"` begins.
- `/src/ui/screens/RoundScreen.ts`: updated the one `mountGameCanvas` call
  site to pass `round` directly instead of the two fields it used to derive
  from it — no other change needed, since the screen already mounts the
  canvas once on the first tick that isn't `"seeker-reveal"`/`"countdown"`,
  and that tick now naturally lands on `"hide"` instead of the old `"active"`.
- `/src/style.css`: added `.game-canvas-wrapper`, `.paint-panel`,
  `.paint-canvas`, `.paint-budget-bar`, `.paint-budget-fill`.

Ran `npm run typecheck` (`tsc -b --noEmit`) — clean on the first attempt.
Started `npx vite --port 5173` in the background and drove it with the
Playwright MCP tools: generated a small solid-color PNG with a standalone
Python script (no ImageMagick available) since the file-upload tool requires
paths inside the project's `.playwright-mcp/` directory, not the session's
own scratchpad — had to `cp` the generated file over before
`browser_file_upload` would accept it. Tab 1 ("Host") created a lobby
(invite ID `WMWTL`) and uploaded the map; tab 2 ("Guest") joined. Clicked
START on tab 1, waited 6 seconds for the 2.5s spin + 3s countdown to clear,
then screenshotted both tabs: tab 1 (now the seeker, per random selection)
showed only its own red circle with no guest visible; tab 2 (hider) showed
only its own blue circle, no seeker visible, and a paint panel underneath the
game canvas with a color swatch and a full blue budget bar. The user then
interrupted with "we tested it it looks fine" before the drag-to-paint and
hide→seek transition steps were exercised via Playwright, so I stopped there,
killed the dev server, and removed the generated screenshots and test PNG.

### Why

Reusing the existing `sendPosition`/`onPositionUpdate` peer-to-peer pattern
for paint data (rather than routing it through `Lobby`/`LobbySnapshot`) kept
the diff additive — no changes needed to how `HostLobbySession` broadcasts
authoritative state, and no new synchronization path to reason about beyond
the one `BroadcastChannelTransport` already provides for free.

Having `GameCanvas` derive `RoundPhase` itself every frame from a `round`
prop, rather than having `RoundScreen` decide when to (re)mount it, was the
plan's central bet: it means the hide→seek transition is just a local
variable flipping inside an already-running `requestAnimationFrame` loop —
nothing about the canvas, the map `Image`, or the keyboard listeners is torn
down and rebuilt at that boundary, which would have been a much larger and
more error-prone change.

Layering the painted texture over a base role-color fill (instead of an
either/or fallback) turned "camouflage costs a limited budget" into a
property that falls out of the rendering approach for free — an incomplete
paint job naturally still shows the giveaway color through the gaps, with no
extra code needed to enforce that.

### What worked

Promoting `PLAYER_RADIUS` into its own tiny module before writing any paint
math paid off immediately — the paint canvas's native resolution, the budget
formula, and the sprite-clipping rectangle in `GameCanvas.ts` all reference
the same constant, so there was never a moment where "sprite size" could
drift between the two systems.

The Plan sub-agent's recommendation to check the paint budget per
`pointermove` segment (not just at stroke-end) and simply stop drawing once
exhausted — rather than trying to clip a stroke's length mid-segment — turned
out to be exactly as simple to implement as advertised, with no edge case
that needed special-casing.

`tsc -b --noEmit` was clean on the first attempt despite the fairly invasive
`GameCanvasProps` reshape (dropping two flat fields in favor of the `round`
object), because every call site of `mountGameCanvas` was exactly one
function in `RoundScreen.ts`.

### What didn't work

The Playwright `browser_file_upload` tool rejected the test map PNG on the
first attempt with `Error: File access denied: ... is outside allowed roots.
Allowed roots: /Users/mikkel/Development/Greenfield Development/.playwright-mcp,
/Users/mikkel/Development/Greenfield Development` — it was written to the
session's scratchpad directory under `/private/tmp/...`, which isn't one of
the tool's allowed roots. Fixed by `cp`-ing the file into
`/Users/mikkel/Development/Greenfield Development/.playwright-mcp/map.png`
before retrying the upload, which then succeeded.

### What I learned

`browser_file_upload`'s allowed-roots restriction is scoped to the project
directory (and specifically its own `.playwright-mcp/` subfolder), not the
general-purpose scratchpad this session had been told to prefer for
temporary files — worth remembering next time a Playwright-driven flow needs
a fixture file, rather than rediscovering the error each time.

### What was tricky

Deciding what "blindness during hide" should mean for the seeker specifically
was the one real design question carried over from the plan: the PRD's story
14 only states that hiders can't see other hiders while hiding, and doesn't
directly address what the seeker sees during that same window. The plan's
answer — uniform blindness, nobody renders anybody else regardless of role —
was chosen because letting the seeker watch hiders position and paint
themselves before the seek phase even starts would trivially break the game
(free intel with zero risk), and building an asymmetric rule (seeker blind,
hiders blind to each other, but not to the seeker, or some other split) would
have been scope creep into the catch-mechanic slice that's explicitly
deferred. This shipped as implemented, with the caveat that if a future catch
mechanic wants the seeker to see hiders as soon as "seek" starts (matches the
current behavior on the phase boundary) or wants any staggered reveal, this
uniform rule is at the exact site to revisit.

### What warrants review

`GameCanvas.ts`'s `onPaintUpdate` subscription, like the pre-existing
`onPositionUpdate` one, is never unsubscribed on dispose — consistent with
the existing convention elsewhere in the session classes, but worth a second
look if `GameCanvas` is ever mounted/unmounted more than once per session
lifetime.

The drag-to-paint interaction itself (actually spending budget via simulated
pointer events, watching the budget bar deplete to 0%, and confirming ink
stops applying) and the hide→seek transition (confirming both tabs start
rendering each other again and that the painted texture — not a plain color
— shows up on the other player's sprite) were both left unverified by
Playwright once the user's own manual test confirmed things looked fine and
ended the session's verification step early. Worth a deliberate look if any
follow-up work touches `PaintPanel.ts` or the phase-gating logic in
`GameCanvas.ts`, since neither the budget-exhaustion path nor the
cross-client paint-sync path has an automated check behind it yet.

### Future work

Catch-the-hider (click on a sprite, converts them to a seeker) and proximity
scoring are the two PRD mechanics still most clearly unblocked by this
session's phase split — `RoundPhase` now has a real `"seek"` value for a
catch mechanic to key off of, and painted sprites now exist for a seeker to
actually need to *notice* a hider against the map, which is the whole point
of the camouflage this iteration added. The 2-minute seek-phase timer
mentioned in the PRD's implementation decisions is still unbounded/unused —
`"seek"` currently never ends on its own, which the catch-mechanic slice (or
a dedicated round-end slice) will need to address alongside the end-of-round
results screen.
