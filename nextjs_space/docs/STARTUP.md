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

## CLI-First Admin (JSON Workflow)

For a single-user setup, you can skip the dashboard UI and generate the employer portfolio from JSON (auto-curation included):

1) Set a GitHub token (repo scope):
   - `GITHUB_TOKEN=ghp_...`
2) Run the full flow (sync + auto-curate + analyze + build):
   - `yarn portfolio:all --limit 10 --mode mock`
   - (Optional) add `--username <githubUsername>` if your token has multiple accounts.
3) (Optional) Edit `data/portfolio/<username>/curation.json` to refine include/exclude or grouping.
4) Rebuild after edits:
   - `yarn portfolio:build --username <githubUsername>`

The employer page reads `data/portfolio/<username>/portfolio.json`.

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

## Dashboard Features

After signing in, the dashboard provides:

- **Repository List**: View all synced repositories with AI analysis status
- **Bulk Actions** (select multiple repos to enable):
  - **Deep Re-analyze Selected**: Trigger deep AI analysis on selected repositories
  - **Apply AI Titles**: Set `displayName` from `aiAnalysis.displayTitle` for selected repos
- **Curate Portfolio**: Toggle `isExcluded` to hide/show repos, toggle `isFeatured` to highlight
- **Highlighted Repo's**: Special section showing featured repositories with enriched content
- **Re-analyze**: Manual re-analysis always runs in deep dive mode for richer insights

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
