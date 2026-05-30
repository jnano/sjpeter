# faithandme frontend — Next.js 16 standalone (v1.5.456)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app

# v1.5.459 — NEXT_PUBLIC_* 는 빌드 시점에 client 번들에 베이크된다.
# 외부에서 접근할 backend URL 을 docker-compose 의 build.args 로 전달.
# 운영: https://api.example.com / 개발: http://localhost:8000
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js standalone 빌드 — node_modules 일부만 포함된 최소 번들 생성.
# next.config.ts 의 output: "standalone" 으로 .next/standalone/server.js 생성.
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# next/font 캐시 + 빌드 산출물
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# standalone 미설정 시 fallback (전체 .next 복사)
# COPY --from=builder /app/.next ./.next
# COPY --from=builder /app/node_modules ./node_modules
# COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000 > /dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
