# Production image for the Communication Assistant API.
# Build:  docker build -t communication-api .
# Run:    docker run -p 3000:3000 --env-file .env communication-api
# Any Docker host works (Render, Railway, Fly.io, a VPS) - put HTTPS in front of it and set the
# mobile app's EXPO_PUBLIC_API_URL to https://<your-domain>/api/v1.

# --- build stage -------------------------------------------------------------------------
# Debian (glibc) rather than Alpine so bcrypt's prebuilt native binary loads without compiling.
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# prisma.config.ts reads DIRECT_URL even for `generate`; codegen never connects, so a
# placeholder is enough at build time. The real URLs come from the runtime environment.
RUN DIRECT_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
  && npm run build \
  && npm prune --omit=dev

# --- runtime stage -----------------------------------------------------------------------
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

# package.json is needed at runtime for "type": "module" and the #prisma-client import map.
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/'+(process.env.API_PREFIX||'api/v1')+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
