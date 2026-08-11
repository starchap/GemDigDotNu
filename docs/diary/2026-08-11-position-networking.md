# Diary: Position networking + cross-browser join investigation

Goal for this iteration (chosen via `/suggest-next-iteration` from three options —
position networking, paint-the-sprite, or catch/scoring/results) was to close
the gap flagged in the prior diary as load-bearing: every player's movement was
rendering locally only, so a seeker and hiders in the same round never actually
saw each other move. This session wired that up, then spent a second step
chasing down why a real cross-browser join attempt still failed after the
feature shipped.

## Step 1: Sync player positions across clients

**Author:** main

### Prompt Context

**Verbatim prompt:** `/suggest-next-iteration` (slash command, no free-text
argument), followed by the user picking "Position networking" when offered
three options via `AskUserQuestion`.

**Interpretation:** Read `PRD.md` + `CONSTITUTION.md`, scan the built
codebase, and propose 2-3 concrete next slices; then build whichever one the
user picks.

**Inferred intent:** Keep the loop's discipline — propose options grounded in
what's already built and what the PRD needs next, let the user choose, then
implement that one slice only, without scope creep into catch/scoring/paint.

### What I did

Read `/PRD.md`, `/CONSTITUTION.md`, and the three existing diary entries, then
scanned `/src` to see what was already built: lobby/host/join sessions, map
upload, seeker selection + countdown (`/src/domains/round/Round.ts`,
`/src/ui/screens/RoundScreen.ts`), and a canvas with camera + keyboard movement
(`/src/ui/game/GameCanvas.ts`, `/src/domains/movement/Movement.ts`) that only
ever rendered the local player. Proposed three options (position networking,
paint-the-sprite, catch+scoring+results) via `AskUserQuestion`; user picked
position networking.

Entered plan mode, read the remaining relevant files
(`HostLobbySession.ts`, `GuestLobbySession.ts`, `LobbyMessage.ts`, `App.ts`,
`Player.ts`, `NetworkTransport.ts`), and wrote a plan
(`/Users/mikkel/.claude/plans/smooth-wondering-matsumoto.md`) built around one
key observation: `BroadcastChannelTransport` already delivers every message
to every tab on a channel, not just host→guest — `join-request` already
relies on this. So position sync could reuse the existing channel/message
plumbing directly rather than inventing new infrastructure, and could bypass
the authoritative `Lobby`/`LobbySnapshot` state path entirely, since positions
are too high-frequency to route through full state broadcasts.

After the user approved the plan, implemented:

- `/src/domains/lobby/LobbyMessage.ts` — added a `{ type: "position"; playerId: string; position: Vector2 }` variant to the message union.
- `/src/domains/lobby/HostLobbySession.ts` and `/src/domains/lobby/GuestLobbySession.ts` — added symmetric `sendPosition(position)` / `onPositionUpdate(listener)` methods and a `positionListeners` array, wired into each class's existing `handleMessage` branch-per-type structure. `GuestLobbySession` didn't previously retain its `player` constructor argument as a field, so that needed adding to know its own id when sending. `HostLobbySession` reused the already-exposed `this.lobby.hostId` instead of adding a duplicate field.
- `/src/ui/screens/RoundScreen.ts` and `/src/app/App.ts` — threaded the `session` object (already in scope in `App.showLobby`) through to `mountGameCanvas`.
- `/src/ui/game/GameCanvas.ts` — added a `PositionChannel` interface (just the two methods `GameCanvas` needs, so either session type satisfies it structurally), a `Map<string, Vector2>` of remote positions kept current via `onPositionUpdate`, outgoing position sends throttled to ~20 Hz inside the existing `requestAnimationFrame` loop, and a `drawPlayerCircle` helper reused for both the local player and every other player with a known position — colored red if `player.id === seekerId`, else the existing hider blue.

Ran `npm run typecheck` (`tsc -b --noEmit`), which was clean on the first attempt.

### Why

The prior diary (`/docs/diary/2026-08-11-map-canvas-movement.md`) explicitly
named this as the next required step before catch-the-hider or proximity
scoring could exist at all — those both need players to actually see each
other's positions first.

### What worked

The plan's central design bet — piggyback on the existing broadcast-to-everyone
channel behavior instead of building new transport plumbing — held up exactly
as expected. No changes were needed to `Lobby.ts`, `Round.ts`, or
`LobbySnapshot`; position data never touches host-authoritative state, which
kept the diff small and `tsc -b --noEmit` clean on the first run.

### What didn't work

Nothing broke during implementation itself. The user interrupted mid-verification
("do not waste energy on with playwright") while I was in the middle of setting
up a two-tab Playwright drive of the feature, so that verification step was
skipped for this slice — the feature shipped on `tsc` cleanliness alone plus
manual code review, not an actual browser run.

### What I learned

`GuestLobbySession`'s constructor took a `player: Player` argument that was
used once (to send the initial `join-request`) and then discarded — it was
never stored as a field. That's a small asymmetry with `HostLobbySession`
(which can derive its own id from `this.lobby.hostId`) that only became
visible once a second feature needed to know "who am I" from inside the guest
session.

### What was tricky

Deciding whether remote players should be visible to hiders during the hide
phase was the one real design question, and the answer was to explicitly punt:
the PRD calls for hiders being blind to each other while hiding, but the round
model (`Round.ts`) only distinguishes `seeker-reveal` / `countdown` / `active`
— there's no hide-phase/seek-phase split yet to hang that visibility rule on.
Rather than inventing that split as a side effect of a position-networking
slice, I rendered every known player to everyone during `active` and called
out the hider-blindness rule as explicitly deferred, consistent with the
project's habit of layering one mechanic per iteration.

### What warrants review

`GameCanvas.ts`'s `onPositionUpdate` subscription is never unsubscribed on
dispose — this matches the existing convention in `HostLobbySession` /
`GuestLobbySession` (`stateListeners` is never pruned either), but it's worth
a second look if `GameCanvas` is ever mounted/unmounted more than once per
session lifetime.

The 20 Hz outgoing send throttle in `GameCanvas.ts`'s `loop` function is a
guessed number, not measured — reasonable for `BroadcastChannel` (same
machine, near-zero cost either way) but untested against any real network
transport.

### Future work

Catch-the-hider (click on a sprite) and proximity scoring are now unblocked —
both were explicitly waiting on this. Paint-the-sprite and the hide/seek
phase split (needed for hider-blindness) remain open, independent slices.

## Step 2: Debugging "cannot join a lobby" — cross-browser BroadcastChannel ceiling

**Author:** main

### Prompt Context

**Verbatim prompt:** "i cannot join a lobby", followed by "cannot join a
Lobby on localhost:5173 my host i hosting in chrome i try to join the lobby
from my firefox but we cannot join the button "join" does nothing and the
code is correct", followed by (after being offered a choice) "let's keep
testing in the same browser, but I wanna let my colleges join on the
localhost, make me a pakcage json script so they can join the lobby using my
ip on port 5173."

**Interpretation:** First message was a bare bug report with no repro detail.
Second message supplied the actual repro: two different browsers (Chrome host,
Firefox guest) on the same machine, same port, "Join" button visibly doing
nothing. Third message was a scope decision: don't fix cross-browser/cross-
machine play right now, just add a `dev:lan`-style script so colleagues on
the LAN can load the page.

**Inferred intent:** Get an actual playable multi-person session working
enough for colleagues to try the game, without necessarily committing to the
larger real-networking rework yet.

### What I did

On the first, detail-free report, I checked for environmental noise first:
found a stray second Vite dev server on port 5174 (started during my own
earlier verification attempt, then re-started again this session before I'd
checked for an existing one) alongside the original on 5173, and killed the
stray one with `kill 31954 31972`. Asked the user via `AskUserQuestion`
whether their two tabs were on the same port (they were) and what "cannot
join" actually looked like ("nothing happens" on clicking Join).

Reproduced the flow myself with Playwright against `http://localhost:5173`:
name entry → create lobby as "HostP" (invite ID `9YMMZ`) → new tab → name
entry → join lobby → enter `9YMMZ` → Join. This worked cleanly — "GuestP"
appeared in the host's player list, `2 / 8 players`, zero console errors.
Reported this back and asked the user to retry on a single dev server.

The user's follow-up supplied the real repro: Chrome (host) and Firefox
(guest) on the same machine. That's the actual root cause —
`/src/domains/networking/BroadcastChannelTransport.ts` wraps the `BroadcastChannel`
Web API, which only delivers messages between tabs/windows inside the *same*
browser engine and profile. Chrome and Firefox share no channel of any kind;
a `join-request` sent from Firefox never reaches Chrome's `HostLobbySession`,
so nothing happens — no error, because there's no failure path, just no
listener on the other end.

Explained this to the user with the relevant architectural framing
(`CONSTITUTION.md`'s "infra stays behind clean interfaces/fakes as long as
possible" principle — `NetworkTransport` is that interface,
`BroadcastChannelTransport` is the fake standing in for it), then asked via
`AskUserQuestion` whether to build real networking now or keep testing
same-browser and treat real networking as a future iteration. User chose to
keep testing same-browser for now, but asked for a `package.json` script to
expose the dev server on the LAN so colleagues could load the page from their
own machines.

Added `"dev:lan": "vite --host"` to `/package.json`'s `scripts`, alongside
the existing `dev` script. Before handing that over, flagged explicitly that
this only solves page delivery over the LAN — it does not fix multiplayer
joining, because `BroadcastChannel` doesn't cross machines at all (not even
same-browser, same-origin, same everything) — it's local to one browser
process, never network-transported. Colleagues loading the page from another
machine would hit the identical silent "Join does nothing" failure, for a
different underlying reason than the Chrome/Firefox case.

### Why

The user's stated goal ("let my colleagues join") can't actually be reached
by the LAN-exposure script alone given the current transport. Saying so before
they spent time distributing a URL that can't work seemed more useful than
silently doing exactly what was asked and letting them rediscover the ceiling
themselves.

### What worked

Reproducing with Playwright before asking more questions was the right call
once the user confirmed same-port same-machine — it ruled out my own
leftover dev-server mess as the cause definitively (clean two-tab join, zero
console errors) rather than leaving that as a guess, and narrowed the search
straight to "what's different about their setup" on the next round.

### What didn't work

My first hypothesis (stray second Vite instance on 5174 causing an origin
mismatch between tabs) was plausible given what I could see, but wrong for
this case — I fixed a real mess I'd made, but it wasn't the user's actual
bug. Worth noting for next time: killing background clutter and doing a clean
repro is good hygiene regardless, but shouldn't be presented as "found the
bug" until the user's own repro steps are actually reproduced.

### What I learned

`BroadcastChannel` cannot cross browser engines under any circumstance — this
isn't a configuration issue, permissions issue, or same-origin nuance, it's a
hard API boundary (per-user-agent, not per-origin in the network sense). It
also cannot cross machines, full stop, regardless of network exposure —
`--host` only affects whether the *page* (HTML/JS/CSS) can be fetched from
another device; it has zero bearing on whether `BroadcastChannel` messages can
reach that device, because that API was never designed to leave the browser
process it originated in.

### What was tricky

The user's first bug report ("cannot join a lobby") carried no repro detail,
and my environment had genuine, unrelated noise in it (the stray dev server)
that looked exactly like a plausible cause. Distinguishing "I found *a* bug"
from "I found *the* bug the user is hitting" required actually asking for the
specific repro steps and reproducing them, rather than stopping at the first
plausible-looking explanation.

### What warrants review

None of this step touched application code — it's a `package.json` script
addition (`dev:lan`) plus diagnosis. Nothing here needs a code review, but the
open architectural question (does this project need real networking to be
usable beyond same-browser demos) is now explicitly on the table for the user
to decide via a future `/suggest-next-iteration` or a direct ask.

### Future work

Real cross-browser/cross-machine play requires swapping in an actual
transport (most likely a small WebSocket relay server) behind the existing
`NetworkTransport` interface (`/src/domains/networking/NetworkTransport.ts`),
which both `HostLobbySession` and `GuestLobbySession` already depend on only
through that interface — the domain code shouldn't need to change, only the
`TransportFactory` wiring in `/src/app/App.ts`. This was offered to the user
this session and explicitly deferred, not forgotten.
