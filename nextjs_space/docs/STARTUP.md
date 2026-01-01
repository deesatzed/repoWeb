# DevShowcase — Local Startup

This project runs from `nextjs_space/`.

## Prereqs

- Node.js (the repo currently works with Node 20.x)
- Yarn classic (`yarn -v` shows `1.x`)
- Local Postgres running on `localhost:5432`

## Environment

Copy and fill environment variables:

- Use `.env.example` as the source of truth.
- Do **not** commit `.env`.

Required:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `ENCRYPTION_KEY` (must be 32-byte hex)
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (e.g. `mistralai/devstral-2512`)

OAuth (needed for real sign-in + GitHub sync):

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

## Local Postgres (recommended for dev)

We validated local Postgres using a Unix-socket connection (avoids TCP password rules).

Use this `DATABASE_URL` for local dev:

- `postgresql://o2satz@localhost/devshowcase?host=/tmp&schema=public`

Create the DB (if needed):

- `createdb devshowcase`

## Prisma schema sync

This repo currently has **no** `prisma/migrations/` folder.

For local dev, sync the DB schema from `prisma/schema.prisma`:

- `DATABASE_URL='postgresql://o2satz@localhost/devshowcase?host=/tmp&schema=public' yarn prisma db push`

## Run the app

From `nextjs_space/`:

- `DATABASE_URL='postgresql://o2satz@localhost/devshowcase?host=/tmp&schema=public' yarn dev`

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

## Troubleshooting

- Prisma `P1010` using `localhost:5432` typically means TCP auth requires a password. Use the Unix-socket URL shown above (`host=/tmp`).
