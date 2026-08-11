# Greenfield Development

This repo has no project yet. It's a bootstrap shell that builds a project from
scratch using a fixed 4-skill loop. No product, language, or stack is decided —
don't assume one.

## The loop

1. `/clarify-prd` — interview from raw vision to a concrete why/what, writes `PRD.md`.
2. `/clarify-constitution` — locks language, stack, and architecture standards, writes `CONSTITUTION.md`.
3. `/suggest-next-iteration` — reads `PRD.md` + `CONSTITUTION.md`, proposes the next buildable slice.
4. `/diary` — narrates the implementation of that slice as it happens (not a separate phase; runs alongside step 3's work).

After an iteration ships: run `/diary` to close it out, then clear context and
start a new session to run `/suggest-next-iteration` again. Don't chain
another iteration in the same session.

All four skills are `disable-model-invocation: true` — they only run when
explicitly invoked as slash commands, never auto-triggered. Don't second-guess
that; if the user hasn't typed the command, don't act as if they had.

## Ground rules while no PRD/CONSTITUTION exists

- If asked to write code before `PRD.md` exists, redirect to `/clarify-prd` first.
- Don't invent tech stack, language, or architecture choices — those belong in
  `CONSTITUTION.md` and are the user's call via `/clarify-constitution`.
- Prefer fakes over real infrastructure for as long as possible: in-memory
  state, hardcoded data, stub functions. Only reach for a real database, auth,
  or queues when a fake genuinely can't hold anymore.

## Files this loop produces (repo root, once created)

- `PRD.md` — problem, solution, user stories, in/out of scope.
- `CONSTITUTION.md` — language/runtime, architecture principles, fixed dependencies.
- `docs/diary/YYYY-MM-DD-<slug>.md` — one file per task/feature, append-only.
