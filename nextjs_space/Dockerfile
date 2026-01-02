# Base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

# Set output mode to standalone for Docker
ENV NEXT_OUTPUT_MODE standalone

# Generate Prisma Client
RUN npx prisma generate

# Build the app
# Note: If your build requires database access (e.g. for static pages), 
# you may need to provide a dummy DATABASE_URL or build arguments.
RUN yarn build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Create data directory for SQLite
RUN mkdir -p /data
RUN chown nextjs:nodejs /data

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./standalone
RUN SERVER_JS_PATH=$(find ./standalone -maxdepth 4 -name server.js -print -quit) && \
  if [ -z "$SERVER_JS_PATH" ]; then \
    echo "ERROR: Next standalone output missing server.js" && \
    find ./standalone -maxdepth 4 -name server.js -print && \
    exit 1; \
  fi && \
  SERVER_DIR=$(dirname "$SERVER_JS_PATH") && \
  cp -R "$SERVER_DIR"/. ./
RUN rm -rf ./standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
