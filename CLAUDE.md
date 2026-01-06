# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DevShowcase** (also known as **RepoNexus**) is a Next.js application that generates employer-facing portfolio pages from a developer's GitHub repositories. It uses AI to analyze repositories, curate projects, and create compelling portfolio presentations.

**Tech Stack**: Next.js 14, TypeScript, Prisma, SQLite, NextAuth, OpenRouter (OpenAI-compatible API), Octokit

**Working Directory**: All commands run from `nextjs_space/` subdirectory

## Development Commands

All commands must be run from the `nextjs_space/` directory.

### Essential Commands

```bash
# Install dependencies (Note: dual lockfile issue - see Known Issues)
npm install --legacy-peer-deps  # Current working method
# OR
yarn install                     # Original method

# Development server
npm run dev                      # Starts on http://localhost:3000

# Testing
npm test                         # Runs Node test runner (tests/*.test.ts)

# Build
npm run build                    # Production build
npm run start                    # Start production server

# Linting
npm run lint                     # Next.js ESLint

# Database
npx prisma generate              # Generate Prisma client
npx prisma db push               # Sync schema to database (no migrations)
npx prisma db seed               # Seed test data (optional)
npx prisma studio                # GUI database explorer
```

### Single Test Execution

Tests use Node's built-in test runner. To run a specific test file:

```bash
node --import tsx --test tests/specific-file.test.ts
```

## Architecture

### Application Flow

1. **Authentication**: User signs up/signs in (credentials or GitHub OAuth via NextAuth)
2. **GitHub Connection**: User provides GitHub token, stored encrypted (AES-256-CBC)
3. **Repository Sync**: Fetches user's repos from GitHub API, stores in SQLite
4. **Curation**: User or AI excludes low-value repos
5. **Project Grouping**: Manual or AI-assisted organization of repos into projects
6. **AI Analysis**: Deep analysis of individual repos and grouped projects
7. **Portfolio View**: Public-facing `/portfolio/[username]` page

### Directory Structure

```
nextjs_space/
├── app/
│   ├── api/                    # API routes (Next.js App Router)
│   │   ├── analyze/           # Repository & project AI analysis (SSE)
│   │   ├── curate/            # Auto-curation endpoints
│   │   ├── github/            # GitHub sync & connect
│   │   ├── portfolio/         # Portfolio settings & public routes
│   │   ├── projects/          # Project CRUD
│   │   └── repositories/      # Repository operations
│   ├── auth/                  # Sign in/sign up pages
│   ├── dashboard/             # Main user dashboard
│   └── portfolio/[username]/  # Public portfolio view
├── lib/
│   ├── github-api.ts          # Octokit wrapper with encryption
│   ├── llm.ts                 # OpenRouter client (server-only)
│   ├── auth-options.ts        # NextAuth configuration
│   ├── encryption.ts          # AES-256-CBC encryption utils
│   ├── analysis-schemas.ts    # Zod schemas for AI responses
│   └── db.ts                  # Prisma singleton client
├── prisma/
│   └── schema.prisma          # Database schema (SQLite)
└── tests/                     # Node test runner tests
```

### Data Model

**Core Models** (see `prisma/schema.prisma:37-238`):

- **User**: NextAuth user with credentials or OAuth
- **GitHubConnection**: 1:1 with User, stores encrypted token
- **Repository**: GitHub repos with metadata, links to Project
- **AIAnalysis**: 1:1 with Repository, stores AI-generated insights + citations
- **Project**: Groups multiple repositories, 1:1 with ProjectAnalysis
- **ProjectAnalysis**: Skills-focused analysis of grouped repos
- **PortfolioSettings**: User display preferences
- **CodeAsset/CodeAssetOccurrence**: Stigmergic code pattern analysis

**Key Relationships**:
- User → GitHubConnection → Repositories
- User → Projects → Repositories (many-to-many via projectId FK)
- Repository → AIAnalysis (with citations as JSON string)
- Project → ProjectAnalysis

### API Architecture

**Pattern**: Next.js App Router with `route.ts` files

**Authentication**: All protected routes check NextAuth session via `getServerSession(authOptions)`

**Error Handling**: Routes return JSON with `{ error: string }` and appropriate HTTP status codes

**Known Pattern - Stale Session Handling** (see `app/api/github/connect/route.ts:18-33`):
Routes verify user exists in DB after session check to prevent FK errors:

```typescript
const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
if (!dbUser) {
  return NextResponse.json(
    { error: 'User not found in database. Please sign in again.' },
    { status: 401 }
  );
}
```

### AI Integration

**Provider**: OpenRouter (OpenAI-compatible API)

**Configuration**:
- Env vars: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (defaults to `z-ai/glm-4.7`)
- Wrapper: `lib/llm.ts` (marked `server-only`)
- Two functions: `analyzeText()` and `analyzeJSON<T>()`

**Analysis Types**:

1. **Repository Analysis** (`app/api/analyze/repository/route.ts`)
   - System prompt: "You are a senior technical recruiter and engineering manager"
   - Fetches sample files from GitHub, analyzes code
   - Returns structured analysis with citations (file paths + line numbers + snippets)
   - Uses SSE for progress streaming
   - Schema: `RepositoryAnalysisSchema` in `lib/analysis-schemas.ts`

2. **Project Analysis** (`app/api/analyze/project/route.ts`)
   - System prompt: "You are a CTO-level engineering manager"
   - Analyzes grouped repositories for technical growth signals
   - Uses SSE for progress streaming
   - Schema: `ProjectAnalysisSchema` in `lib/analysis-schemas.ts`

3. **Auto-Curation** (`app/api/curate/auto/route.ts`)
   - AI suggests repos to exclude and grouping into projects
   - Supports `mode: preview|apply` (dry-run before mutation)
   - Requires explicit `intent: manual` to prevent accidental triggers

### GitHub Integration

**Service**: `lib/github-api.ts` - Octokit wrapper with encrypted token decryption

**Key Methods**:
- `getUserRepositories()`: Paginated fetch of all user repos
- `getRepositoryLanguages()`: Language breakdown
- `getRepositoryReadme()`: Base64-decoded README
- `getRepositoryFiles()`: Fetches sample files for analysis (max 10, up to 3000 chars each)
- `getRepositoryContents()`: Directory/file contents

**Critical Implementation Detail**:
- The `getRepositoryFiles()` method requires `owner` and `repo` as separate parameters
- Current analysis route extracts these from `repository.name.split('/')` which may fail
- Use `repository.fullName` field instead (format: "owner/repo")

### Authentication

**Provider**: NextAuth 4.24.11 with Prisma adapter

**Strategies**:
- **Credentials Provider**: Email/password (bcrypt hashed), always enabled
- **GitHub OAuth**: Optional, enabled only if `GITHUB_CLIENT_ID` is not placeholder

**Session Storage**: Database sessions via Prisma

**Configuration**: `lib/auth-options.ts:1-169`

## Environment Variables

Copy from `nextjs_space/.env.example` to `nextjs_space/.env` (never commit `.env`).

**Required**:
```bash
DATABASE_URL="file:./dev.db"                    # SQLite path
NEXTAUTH_SECRET="<random-string>"               # NextAuth session secret
ENCRYPTION_KEY="<64-char-hex>"                  # 32-byte hex for AES-256-CBC
OPENROUTER_API_KEY="<your-key>"                 # AI analysis provider
OPENROUTER_MODEL="z-ai/glm-4.7"                 # Model selection (optional)
```

**Optional** (OAuth):
```bash
GITHUB_CLIENT_ID="<client-id>"
GITHUB_CLIENT_SECRET="<client-secret>"
```

**Generation Commands**:
```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY (must be exactly 64 hex chars = 32 bytes)
openssl rand -hex 32
```

## Database

**Engine**: SQLite via Prisma

**Schema Management**: Uses `prisma db push` (schema sync) instead of migrations

**Location**:
- Local dev: `nextjs_space/dev.db` (gitignored)
- Production: `/data/sqlite.db` on Fly.io volume

**Workflow**:
1. Modify `prisma/schema.prisma`
2. Run `npx prisma generate` to update client
3. Run `npx prisma db push` to sync schema to DB
4. Schema changes require manual coordination with production

## Testing

**Framework**: Node.js built-in test runner

**Location**: `tests/*.test.ts`

**Run**: `npm test` from `nextjs_space/`

**Current Status**: 20 tests passing (as of 2026-01-05)

**Coverage**: No coverage reporting configured yet

## Deployment

**Platform**: Fly.io

**App Name**: `reponexus-portfolio`

**Production URL**: https://reponexus-portfolio.fly.dev/

**Deployment Commands**:
```bash
# Deploy
fly deploy

# View logs
fly logs

# SSH into container
fly ssh console

# Set secrets
fly secrets set NEXTAUTH_SECRET=xxx ENCRYPTION_KEY=xxx OPENROUTER_API_KEY=xxx

# Update database schema in production
fly ssh console
npx prisma db push
```

**Container**:
- Base image: `node:20-alpine`
- Build: Auto-detects yarn/npm based on lockfile presence
- Volume: SQLite persisted at `/data/sqlite.db`

**Configuration**: `nextjs_space/fly.toml` and `nextjs_space/Dockerfile`

## Known Issues & Gotchas

### 1. Dual Package Manager Lockfiles

**Issue**: Both `yarn.lock` and `package-lock.json` exist

**Current Workaround**: `npm install --legacy-peer-deps` due to ESLint 9 peer conflicts

**TODO**: Choose one package manager, remove other lockfile, align ESLint versions

### 2. Owner/Repo Parsing in Analysis

**Issue**: `app/api/analyze/repository/route.ts:72-76` extracts owner/repo via `repository.name.split('/')`

**Problem**: `repository.name` contains only repo short name (no `/`), causing GitHub API 404s

**Fix**: Use `repository.fullName` field or store owner separately

### 3. SSE Controller Invalid State

**Issue**: Repository analysis SSE route can error with `ERR_INVALID_STATE: Controller is already closed`

**Impact**: Breaks analysis streaming reliability

**Mitigation**: Guard controller writes, handle aborts properly

### 4. Workflow Gating

**Issue**: Auto-curation may appear to trigger without explicit user action

**Impact**: User trust erosion

**Mitigation**: Ensure `POST /api/curate/auto` requires `intent: manual` and `mode: preview` before `apply`

### 5. Citations Field Type

**Issue**: `AIAnalysis.citations` stored as JSON string but UI expects array

**Mitigation**: UI normalizes by parsing (see `app/dashboard/_components/repository-list.tsx:573-616`)

**Best Practice**: Always parse citations from DB before rendering

## Development Workflow

### Adding a New API Route

1. Create `app/api/[route]/route.ts`
2. Import `getServerSession` from `next-auth` and `authOptions` from `@/lib/auth-options`
3. Check authentication and user existence in DB
4. Use Prisma client from `@/lib/db`
5. Return `NextResponse.json()` with appropriate status codes
6. Add error handling with descriptive messages

### Adding AI Analysis

1. Define Zod schema in `lib/analysis-schemas.ts`
2. Use `analyzeJSON<YourType>()` from `lib/llm.ts` (server-only)
3. For streaming, use SSE with `TransformStream`
4. Store results in Prisma models
5. Validate LLM output with schema before saving

### Working with GitHub API

1. Decrypt token: `const service = new GitHubService(encryptedToken)`
2. Use methods from `lib/github-api.ts`
3. Handle errors gracefully (methods return null/empty on failure)
4. Always use `fullName` field for owner/repo extraction

### Modifying Database Schema

1. Edit `prisma/schema.prisma`
2. Run `npx prisma generate` (updates TypeScript types)
3. Run `npx prisma db push` (syncs to local DB)
4. Update seed script if needed (`scripts/seed.ts`)
5. For production: SSH to Fly.io and run `npx prisma db push` there

## Codebase Conventions

### TypeScript

- Strict mode enabled
- Use Zod for runtime validation (`lib/analysis-schemas.ts` pattern)
- Server-only code marked with `import 'server-only'`
- Import alias: `@/` maps to `nextjs_space/` root

### Prisma

- Use `prisma.user.findUnique()` etc. from `@/lib/db`
- Store JSON as string fields, parse on read (e.g., citations, topics)
- Always check user existence after session check to prevent FK errors

### API Routes

- Return `NextResponse.json()` with consistent error format
- Use 401 for auth failures, 404 for not found, 500 for server errors
- Log errors with `console.error()` before returning to client

### Security

- Tokens encrypted with AES-256-CBC before storage (`lib/encryption.ts`)
- Never log decrypted tokens or user passwords
- Use NextAuth session validation on all protected routes
- Validate all user inputs with Zod schemas

## Public Portfolio Routes

**Pattern**: `/portfolio/[username]` (see `app/portfolio/[username]/route.ts`)

**Data**: Fetches public-safe user data with redaction of sensitive fields

**DTO**: Uses `lib/public-dto.ts` for data transformation

**Access**: Unauthenticated public access

## Debugging Tips

### Database Issues

```bash
# Reset local database (destructive)
rm nextjs_space/dev.db
npx prisma db push

# Inspect database
npx prisma studio
```

### Authentication Issues

- Clear browser cookies/local storage
- Check `NEXTAUTH_SECRET` matches between sessions
- Verify user exists in DB after sign-in (stale session check)

### GitHub API Failures

- Check token validity (may expire)
- Verify `ENCRYPTION_KEY` hasn't changed (would break token decryption)
- Look for rate limit headers in GitHub responses

### LLM Analysis Failures

- Verify `OPENROUTER_API_KEY` is valid
- Check OpenRouter dashboard for usage/errors
- Look for malformed JSON in responses (schema validation errors)
- Test model with simpler prompts to isolate issues

## Testing Checklist

Before committing:

```bash
# Run tests
npm test

# Check linting
npm run lint

# Verify build
npm run build

# Local smoke test
npm run dev
# - Visit http://localhost:3000
# - Sign up/sign in
# - Connect GitHub
# - Sync repositories
# - Run auto-curation preview
# - Analyze a repository
```

## References

- **Main README**: `/README.md`
- **Startup Guide**: `nextjs_space/docs/STARTUP.md`
- **Deployment Guide**: `nextjs_space/docs/DEPLOYMENT_FLY.md`
- **Engineering Handoff**: `nextjs_space/Handoff_2026-01-05.md` (detailed technical context)
