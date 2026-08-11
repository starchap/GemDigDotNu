## Language & Runtime

TypeScript, running in-browser (client) and on Node.js (relay server).

## Architecture Principles

- Small domain-driven structure: separate domains such as `seeker`, `hider`, `lobby`, `networking`, etc.
- Common design patterns (builder, factory, strategy, flyweight, etc.) applied where they genuinely fit — not forced.
- Proper naming throughout so code is self-explanatory; comment classes/functions when the why isn't obvious from naming alone, avoid noise-comments.
- Rendering via plain browser Canvas API — no game framework/library.
- Infra (networking transport, persistence, etc.) stays behind clean interfaces/fakes as long as possible, per the greenfield default. The relay server is the one exception now made real: it's a dumb per-room message forwarder with no game logic, so `networking` remains the only domain aware of transport — lobby/round state stays in-memory and fake.

## Fixed Dependencies

- TypeScript
- Browser Canvas API
- Node.js (relay server runtime)
- `ws` (WebSocket server library)

Nothing else locked yet.
