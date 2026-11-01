# ==============================================================================
# Stage 1: Build React Frontend
# ==============================================================================
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production Python Runtime with Foundry Anvil
# ==============================================================================
FROM python:3.11-slim-bookworm AS runner

# Install system dependencies & curl for Foundry installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Foundry (Anvil consensus node)
ENV FOUNDRY_DIR="/root/.foundry"
ENV PATH="/root/.foundry/bin:${PATH}"
RUN curl -L https://foundry.paradigm.xyz | bash && \
    /root/.foundry/bin/foundryup

WORKDIR /app

# Install Python backend dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/ ./backend

# Copy smart contract definitions & compiled artifacts
COPY contracts/ ./contracts

# Copy provisioning scripts
COPY scripts/ ./scripts

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Environment configuration
ENV PORT=10000 \
    FLASK_ENV=production \
    PUBLIC_DEMO_MODE=1 \
    FAIL_CLOSED=1 \
    PUBLIC_ACCESS_ENABLED=true \
    DATABASE_PATH=/app/data/evidencechain_demo.db \
    UPLOAD_FOLDER=/app/data/uploads \
    BLOCKCHAIN_RPC_URL=http://127.0.0.1:8555 \
    CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3 \
    FRONTEND_DIST=/app/frontend/dist \
    OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

EXPOSE 10000

ENTRYPOINT ["/app/entrypoint.sh"]
