## Problem Statement

There is no specific pain point this solves for a particular user group. This is being built because the creator wants a fun, novel party game to play online with friends — a fast-paced hide-and-seek game with a distinctive camouflage-painting twist.

## Solution

A fast-paced 2D online hide-and-seek game for groups. A host creates a lobby with an invite ID, sets a max player count (up to 16), and uploads an image that becomes the map for the round. Players join, pick a name, and one is randomly chosen as the seeker while the rest are hiders. Hiders camouflage themselves by freehand-painting their sprite to blend into the map, then hide by moving around it. The seeker hunts by moving around and clicking directly on hiders to catch them — caught hiders immediately join the hunt as seekers too. Hiders score points by risking proximity to a seeker while in that seeker's view. A round ends when time runs out or all hiders are caught, then everyone returns to the lobby where the host can start a new round with a new image.

## User Stories

1. As a host, I want to create a lobby and get an invite ID, so that I can invite others to join my game.
2. As a host, I want to set the max number of players (up to 16) for my lobby, so that I control the size of the match.
3. As a player, I want to enter my name before I actually enter a lobby, so that I'm identified as soon as I join.
4. As a player, I want to join a lobby via invite ID, so that I end up in the specific game my friends are in.
5. As a host, I want to upload an image to use as the map, so that the game has a unique playground each round.
6. As a host, I want to press START when I'm ready, so that the round only begins once everyone's set.
7. As a player, I want a quick wheel-spin animation to pick the random seeker after START is pressed, so that seeker selection feels like part of the game rather than an instant, invisible decision.
8. As a player, I want to see a countdown before the match starts, so that I know when the round begins.
9. As a hider, I want to freehand-paint my character using a color picker during the hide phase, so that I can camouflage myself against the map.
10. As a hider, I want a limited paint budget (~1.2x my surface area), so that camouflaging requires a tradeoff rather than unlimited coverage.
11. As a hider, I want to move my character around the map during the hide phase, so that I can pick a good hiding spot in addition to camouflaging.
12. As a hider, I want to keep moving during the seek phase, so that I can evade the seeker(s) actively rather than just sitting still.
13. As any player, I want a zoomed-in camera view rather than full-map visibility, so that finding and evading feel tense and skill-based.
14. As a hider, I want to be unable to see other hiders while hiding, so that camouflage and positioning stay a personal strategy.
15. As a seeker, I want to navigate with the keyboard and click directly on a hider's (slightly distorted) sprite to catch them, so that finding hiders is a deliberate, precise action.
16. As a caught hider, I want to immediately become a seeker myself, so that the hunt escalates as the round progresses.
17. As a hider, I want to earn more points the closer a seeker's cursor or character gets to me while I'm in that seeker's view, so that hiding close to danger is a rewarded risk.
18. As a hider, I want to taunt a seeker when they're not currently viewing me, so that I can bait them for fun without much risk. It should show as a colored glow on the edge of the seeker's viewport, on the side facing my direction.
19. As any player, I want the round to end early once all hiders are caught (rather than always running the full seek timer), so that a fully-resolved round doesn't drag on.
20. As a player, I want to see a ranked end-of-round results screen based on points earned (higher is better), so that I know how I did.
21. As a player, I want everyone to return to the lobby after a round, so that we can regroup before the host starts the next one.

## Implementation Decisions

- Players enter their name first, then join a lobby via invite ID.
- Lobby is joined via an invite ID; host sets max players, capped at 16.
- Host uploads the map image; the host also controls starting each round and can pick a new image for subsequent rounds.
- Host presses START when ready; this triggers seeker selection and then the countdown.
- Seeker is chosen at random via a brief wheel-spin animation right after START is pressed, before the countdown begins.
- Match timing is fixed: 30 seconds for the hide/paint phase, 2 minutes for the seek phase.
- Hiders control movement via keyboard and painting via mouse (freehand strokes + color picker, no preset patterns/colors).
- Paint budget per hider is capped at roughly 1.2x their sprite's surface area — camouflage is a limited resource, not unlimited.
- All players (hiders and seekers) can move at any phase of the match, including during the hide phase.
- All players see a zoomed-in camera frame centered on their own character, not the full map.
- Hiders cannot see other hiders while hiding.
- Seeker catches a hider by clicking directly on the hider's sprite, which has slight visual distortion applied.
- When a hider is caught, they immediately convert to a seeker and join the hunt (seekers can accumulate over the round).
- Only hiders earn points; seekers do not score.
- A hider earns points continuously based on proximity to a seeker's cursor/character, but only while inside that seeker's camera frame — closer proximity yields more points.
- Hiders can taunt a seeker at any time the seeker is not currently viewing them — a free action with no cost or cooldown. It renders as a colored glow on the edge of that seeker's viewport, on the side facing the taunting hider's direction.
- The round ends early if all hiders are caught before the seek timer expires, or otherwise ends when the 2-minute timer runs out.
- An end-of-round results screen ranks hiders by points earned, highest score is best.
- No score or history persists across rounds — each round is a standalone game. After the results screen, everyone returns to the lobby, and the host may start a new round with a new uploaded image.

## Out of Scope

- Persistent user accounts and cross-game/cross-lobby history or leaderboards.
- In-game text or voice chat between players.
- Mobile/touch support — desktop keyboard + mouse only.

## Further Notes

None at this time.
