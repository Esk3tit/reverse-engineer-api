# Use Node.js 20 Alpine image (supports Next 15)
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat curl bash git
WORKDIR /app

# Copy package files and all possible lockfiles
COPY package.json \
     package-lock.json* npm-shrinkwrap.json* \
     pnpm-lock.yaml yarn.lock \
     bun.lock bun.lockb ./

# Install dependencies using the detected package manager
RUN set -eux; \
  if [ -f bun.lock ] || [ -f bun.lockb ]; then \
    curl -fsSL https://bun.sh/install | bash -s -- --yes >/dev/null; \
    export BUN_INSTALL=/root/.bun; \
    export PATH="$BUN_INSTALL/bin:$PATH"; \
    bun install --ci; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm; \
    pnpm install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then \
    corepack enable yarn; \
    yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
    npm ci; \
  else \
    npm install; \
  fi

# Development image
FROM base AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "run", "dev"]

# Production builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]