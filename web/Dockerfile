FROM node:22-alpine

WORKDIR /app

# Copy only package files first (for layer caching)
COPY package.json pnpm-lock.yaml ./

# Install dependencies (include @swc/helpers for Next.js 16 Turbopack)
RUN corepack enable && corepack prepare pnpm@9 --activate && \
    pnpm install --frozen-lockfile && \
    pnpm add -D @swc/helpers

# Copy all source files
COPY . .

# Build Next.js (TurboPack)
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=http://localhost:4410
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm run build

# Production runner - use standalone output
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone build (next.config.ts has output: "standalone")
COPY --from=0 /app/.next/standalone ./
COPY --from=0 /app/.next/static ./.next/static
COPY --from=0 /app/public ./public

USER node
EXPOSE 3015
ENV PORT=3015
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3015/ >/dev/null || exit 1

CMD ["node", "server.js"]
