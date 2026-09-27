FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tsconfig.base.json ./
RUN pnpm install --frozen-lockfile
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN pnpm db:generate
ENV VITE_DATA_MODE=api
ENV VITE_API_BASE_URL=/api/v1
RUN pnpm --filter @mf/web build
ENV NODE_ENV=production
EXPOSE 4000
CMD ["pnpm", "--filter", "@mf/api", "start"]
