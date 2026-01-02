# DevShowcase — Local Startup

This project runs from `nextjs_space/`.

## Prereqs

- Node.js (the repo currently works with Node 20.x)
- Yarn classic (`yarn -v` shows `1.x`)
- SQLite (included via Prisma, no separate install needed)

## Environment

Copy and fill environment variables:

- Use `.env.example` as the source of truth.
- Do **not** commit `.env`.

Required:

- `DATABASE_URL="file:./dev.db"`
- `NEXTAUTH_SECRET`
- `ENCRYPTION_KEY` (must be 32-byte hex)
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (defaults to `deepseek/deepseek-chat`)

OAuth (needed for real sign-in + GitHub sync):

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## Database Setup

We use SQLite for simplicity. The database file will be created wherever `DATABASE_URL` points.

Create and seed the DB:

- `yarn prisma db push`
- `yarn prisma db seed` (optional, for test data)

## Run the app

From `nextjs_space/`:

- `yarn dev`

Then open:

- http://localhost:3000

## Test + build

From `nextjs_space/`:

- `yarn test`
- `yarn build`

## Manual smoke checks

- Home loads: `/`
- Auth pages render: `/auth/signin`, `/auth/signup`
- Dashboard renders (requires auth): `/dashboard`
- Public portfolio route: `/portfolio/[username]`

## LLM model + prompts

We call OpenRouter using an OpenAI-compatible client wrapper in `lib/llm.ts`.

- **Model selection** is controlled by `OPENROUTER_MODEL`.
- **API key** is `OPENROUTER_API_KEY`.

The system prompts are currently defined inline in the analysis routes:

- **Repository analysis** (`app/api/analyze/repository/route.ts`)
  - System prompt: `You are a senior technical recruiter and engineering manager.`
- **Project analysis** (`app/api/analyze/project/route.ts`)
  - System prompt: `You are a CTO-level engineering manager assessing a candidate's portfolio project for technical growth and architectural maturity.`

