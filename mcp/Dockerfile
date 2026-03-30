FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./tsconfig.json
COPY src ./src

ENV NODE_ENV=production
ENV MCP_PORT=3333

EXPOSE 3333

CMD ["npm", "run", "start"]
