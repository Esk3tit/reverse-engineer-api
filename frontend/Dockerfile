# Use Node.js 20 Alpine image (supports Next 15)
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat curl bash git unzip
WORKDIR /app

# Copy manifest and any present lockfiles (bun/yarn/pnpm/npm)
COPY package.json ./
COPY *.lock* ./

# Install dependencies using the detected package manager
RUN set -eux; \
  if [ -f bun.lock ] || [ -f bun.lockb ]; then \
    curl -fsSL https://bun.sh/install | bash >/dev/null; \
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

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]

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

# Copy built app and runtime deps
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]