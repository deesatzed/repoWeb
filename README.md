# RepoNexus Portfolio

RepoNexus Portfolio is a Next.js app that generates an employer-facing portfolio page from a developer's GitHub repositories. It features AI-powered analysis, bulk repository operations, and intelligent curation.

## Features

- **AI-Powered Analysis**: Automatic repository and project analysis using OpenRouter/LLM models
- **Bulk Actions**: Deep re-analyze multiple repositories at once, apply AI-generated titles in bulk
- **Smart Curation**: Hide excluded repositories, highlight featured repos with enriched content
- **Public Portfolio**: Rich, expandable repository cards with detailed engineering insights
- **GitHub Integration**: Sync repositories, fetch READMEs, and analyze code structure

## Project layout

- `nextjs_space/` — the Next.js application (this is where `package.json` lives)

## Quick start

See `nextjs_space/docs/STARTUP.md`.

## LLM configuration (analysis)

The repository/project analysis uses OpenRouter (OpenAI-compatible chat completions).

- **Env vars** (see `nextjs_space/.env.example`)
  - **`OPENROUTER_API_KEY`**
  - **`OPENROUTER_MODEL`** (defaults to `openai/gpt-4o-mini`)

## System prompts used

The current system prompts are defined inline in the API routes:

- **Repository analyzer**: `nextjs_space/app/api/analyze/repository/route.ts`
- **Project analyzer**: `nextjs_space/app/api/analyze/project/route.ts`

The OpenRouter client wrapper is in `nextjs_space/lib/llm.ts`.

## Useful commands (run from `nextjs_space/`)

- `yarn install` — Install dependencies
- `yarn dev` — Start dev server at `http://localhost:3000`
- `yarn test` — Run test suite (20+ tests)
- `yarn lint` — Run ESLint checks
- `yarn build` — Create production build
- `yarn prisma db push` — Create/update SQLite schema

## Deployment

Production is deployed on Fly.io at https://reponexus-portfolio.fly.dev

See `nextjs_space/docs/DEPLOYMENT_FLY.md` for deployment instructions.

## Public portfolio URL

- `/portfolio/[username]` — Public portfolio page with expandable repository cards

## Dashboard Features

- **Repository List**: View all synced repositories with AI analysis status
- **Bulk Actions**:
  - **Deep Re-analyze Selected**: Trigger deep AI analysis on selected repositories
  - **Apply AI Titles**: Set `displayName` from `aiAnalysis.displayTitle` for selected repos
- **Curate Portfolio**: Toggle `isExcluded` to hide/show repos, toggle `isFeatured` to highlight
- **Highlighted Repo's**: Special section showing featured repositories with enriched content
- **Re-analyze**: Manual re-analysis always runs in deep dive mode for richer insights
