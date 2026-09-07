# frontend/Dockerfile
FROM node:20-slim AS builder

WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

# Serve with a lightweight static server
FROM node:20-slim
RUN npm install -g serve
WORKDIR /app
COPY --from=builder /app/dist .

EXPOSE 3000
CMD ["serve", "-s", ".", "-l", "3000"]
