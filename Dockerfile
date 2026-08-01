# ─── Stage 1: Build React client ───────────────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ─── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY config/ ./config/
COPY controllers/ ./controllers/
COPY middleware/ ./middleware/
COPY models/ ./models/
COPY routes/ ./routes/
COPY server.js ./
COPY scripts/ ./scripts/

# Copy built frontend from stage 1
COPY --from=client-builder /app/client/dist ./client/dist

# Local upload directory (used when STORAGE_MODE=local)
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "server.js"]
