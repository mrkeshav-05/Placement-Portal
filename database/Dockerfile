# Migration runner and database toolbox.
#
# Compose starts this as `migrate` after the database is healthy and before the
# backend, so every stack boots against an up-to-date schema. The same image
# backs the `tools` service, which runs the seed, import, and maintenance
# scripts on demand, so none of them need Node installed on the host.
#
# Build context is the repository root because this is an npm workspace.

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY database/package.json ./database/
RUN npm ci --workspace @tnp/database --include-workspace-root
COPY database ./database
RUN npm run db:generate
CMD ["sh", "-c", "npm run db:deploy && npm run db:seed"]
