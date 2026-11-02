# «Сбрось карты» — single process: static dist/ + WebSocket
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
COPY server ./server
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package.json package-lock.json ./
# tsx needed at runtime (server + shared rules are TypeScript)
RUN npm ci --omit=dev && npm install --no-save tsx@4.21.0
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json /app/tsconfig.app.json /app/tsconfig.node.json ./
EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
