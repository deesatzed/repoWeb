# DevShowcase

DevShowcase is a Next.js app that generates an employer-facing portfolio page from a developer’s repositories.

## Project layout

- `nextjs_space/` — the Next.js application (this is where `package.json` lives)

## Quick start

See `nextjs_space/docs/STARTUP.md`.

## LLM configuration (analysis)

The repository/project analysis uses OpenRouter (OpenAI-compatible chat completions).

- **Env vars** (see `nextjs_space/.env.example`)
  - **`OPENROUTER_API_KEY`**
  - **`OPENROUTER_MODEL`** (defaults to `deepseek/deepseek-chat`)

## System prompts used

The current system prompts are defined inline in the API routes:

- **Repository analyzer**: `nextjs_space/app/api/analyze/repository/route.ts`
- **Project analyzer**: `nextjs_space/app/api/analyze/project/route.ts`

The OpenRouter client wrapper is in `nextjs_space/lib/llm.ts`.

## Useful commands (run from `nextjs_space/`)

- `yarn install`
- `yarn test`
- `yarn build`
- `yarn dev`

## Public portfolio URL

- `/portfolio/[username]`
