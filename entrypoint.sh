#!/usr/bin/env bash
set -e

PORT="${PORT:-10000}"
if [ -z "$DEMO_USER_PASSWORD" ]; then
    echo "[!] Notice: DEMO_USER_PASSWORD environment variable not set. Generating unique ephemeral session password..."
    export DEMO_USER_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
fi
echo "=========================================================="
echo " Starting EvidenceChain Public Cloud Production Container"
echo " HTTP Port: $PORT | Chain ID: 31337 | Anvil Port: 8555"
echo "=========================================================="

mkdir -p /app/data/uploads

# Ensure anvil binary is in PATH
export PATH="$HOME/.foundry/bin:/root/.foundry/bin:$PATH"

# Start Foundry Anvil daemon on port 8555
echo "[*] Launching Foundry Anvil consensus node on port 8555..."
anvil --port 8555 --chain-id 31337 --host 127.0.0.1 &
ANVIL_PID=$!

# Function to cleanly stop background processes
cleanup() {
    echo "[*] Shutting down EvidenceChain container services..."
    kill -TERM "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# Run automated bootstrap
echo "[*] Executing cloud provisioning and contract deployment..."
python3 scripts/cloud_bootstrap.py

# Launch Gunicorn WSGI web server
echo "[*] Starting Gunicorn WSGI server on 0.0.0.0:$PORT..."
exec gunicorn --chdir backend --bind "0.0.0.0:$PORT" --workers 2 --threads 4 --timeout 120 "app:app"
