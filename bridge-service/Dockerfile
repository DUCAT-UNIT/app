FROM node:20-alpine AS build

WORKDIR /app

COPY bridge-service/package.json bridge-service/package-lock.json ./bridge-service/
WORKDIR /app/bridge-service
RUN npm ci

WORKDIR /app
COPY bridge-service ./bridge-service
COPY shared ./shared

WORKDIR /app/bridge-service
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS runtime

WORKDIR /app/bridge-service
ENV NODE_ENV=production
ENV PORT=8788

COPY --from=build /app/bridge-service/package.json ./package.json
COPY --from=build /app/bridge-service/node_modules ./node_modules
COPY --from=build /app/bridge-service/dist ./dist
COPY --from=build /app/bridge-service/public ./public
COPY --from=build /app/bridge-service/ecosystem.config.cjs ./ecosystem.config.cjs

EXPOSE 8788

CMD ["node", "dist/bridge-service/src/server.js"]
