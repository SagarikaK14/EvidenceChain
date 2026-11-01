# EVIDENCECHAIN — PHASE 6: DEPLOYMENT GUIDE

**Document ID:** EVC-P6-DG-2026-FINAL  
**Target Environment:** Linux / macOS Institutional Intranet or Dedicated VPC  
**Revision:** Production Release Candidate 1.0  
**Date:** October 28, 2026  

---

## 1. System Requirements & Prerequisites

Prior to deployment, verify that the host operating system meets the minimum hardware and software specifications:

### 1.1 Hardware Specifications
- **CPU:** 4 vCPUs (x86_64 or ARM64)
- **RAM:** Minimum 8 GB (16 GB recommended for high concurrent file verification)
- **Disk Storage:** 50 GB SSD for database, logs, and evidence file payloads
- **Network:** 100/1000 Mbps private network adapter with restricted inbound access

### 1.2 Software Dependencies
- **Operating System:** Ubuntu 22.04 LTS / Debian 12 / macOS Ventura 13.0+
- **Python:** Python 3.10 or 3.11 with `python3-venv` and `pip`
- **Node.js:** Node.js v18.x or v20.x LTS with `npm` v9+
- **Foundry / Anvil:** Foundry toolchain installed via `foundryup` (`anvil` executable available)
- **SQLite:** SQLite 3.35.0+ with WAL mode support
- **Web Server:** Nginx 1.20+ or Caddy 2.0+ (for production reverse proxy)

---

## 2. Environment Setup & Configuration

### 2.1 Repository Setup
Clone the repository and check out the verified release candidate branch:

```bash
git clone https://github.com/evidencechain/evidencechain.git /opt/evidencechain
cd /opt/evidencechain
git checkout checkpoint-phase6-release-candidate
```

### 2.2 Backend Environment Configuration
Create the isolated Python virtual environment and install production dependencies:

```bash
cd /opt/evidencechain/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Generate the production `.env` configuration file from the template:

```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env` and configure production secrets:

```ini
# Production Secret Configuration
FLASK_ENV=production
SECRET_KEY=9f83a4c172d8e401b59c23a78912debc54f67890123456789abcdef012345678
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=Lax

# Production Security Gateways
ALLOW_DEV_DEMO_SWITCH=false
ALLOW_DEV_DIAGNOSTICS=false

# EVM Node & Contract Coordinates
ANVIL_RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
UPLOAD_FOLDER=/opt/evidencechain/backend/uploads/evidence_files
```

### 2.3 Frontend Compilation
Build the production-ready React client:

```bash
cd /opt/evidencechain/frontend
npm ci
npm run build
```

The optimized static assets will be output to `/opt/evidencechain/frontend/dist/`.

---

## 3. Production Service Architecture & Ordering

EvidenceChain consists of three coordinated services that must be started in strict chronological sequence:

```
┌────────────────────────────────────────────────────────┐
│ 1. Persistent EVM Node (Anvil - Port 8545)             │
│    Loads .anvil_state.json and preserver history       │
└───────────────────────────┬────────────────────────────┘
                            │ (Must be listening)
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. EvidenceChain Flask API (Gunicorn WSGI - Port 5001) │
│    Connects to Port 8545 and backend/evidencechain.db  │
└───────────────────────────┬────────────────────────────┘
                            │ (Must be listening)
                            ▼
┌────────────────────────────────────────────────────────┐
│ 3. Reverse Proxy & Static Asset Server (Nginx - 443)   │
│    Serves frontend/dist and proxies /api to Port 5001  │
└────────────────────────────────────────────────────────┘
```

---

## 4. Systemd Service Definitions

To ensure continuous uptime and automatic restart upon server reboot, configure systemd unit files on Linux:

### 4.1 Service 1: Anvil Persistent Node (`/etc/systemd/system/evidencechain-anvil.service`)

```ini
[Unit]
Description=EvidenceChain Persistent Anvil Blockchain Node
After=network.target

[Service]
Type=simple
User=evidencechain
WorkingDirectory=/opt/evidencechain
ExecStart=/home/evidencechain/.foundry/bin/anvil --port 8545 --chain-id 31337 --state /opt/evidencechain/.anvil_state.json --preserve-historical-states
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

### 4.2 Service 2: Flask API Server (`/etc/systemd/system/evidencechain-api.service`)

```ini
[Unit]
Description=EvidenceChain Flask API Application Server (Gunicorn)
After=network.target evidencechain-anvil.service
Requires=evidencechain-anvil.service

[Service]
Type=simple
User=evidencechain
WorkingDirectory=/opt/evidencechain/backend
EnvironmentFile=/opt/evidencechain/backend/.env
ExecStart=/opt/evidencechain/backend/venv/bin/gunicorn --workers 4 --bind 127.0.0.1:5001 --timeout 120 --access-logfile /var/log/evidencechain/api_access.log --error-logfile /var/log/evidencechain/api_error.log app:app
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

---

## 5. Reverse Proxy Configuration (Nginx)

Configure Nginx (`/etc/nginx/sites-available/evidencechain.conf`) to serve the compiled frontend, enforce TLS, and proxy API traffic:

```nginx
server {
    listen 80;
    server_name evidencechain.local forensics.agency.gov;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name evidencechain.local forensics.agency.gov;

    ssl_certificate /etc/ssl/certs/evidencechain.crt;
    ssl_certificate_key /etc/ssl/private/evidencechain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Static Frontend SPA
    root /opt/evidencechain/frontend/dist;
    index index.html;

    client_max_body_size 100M;

    # React Router Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy to Gunicorn
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
    }

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

---

## 6. Service Management & Operations

### 6.1 Starting the Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable evidencechain-anvil
sudo systemctl enable evidencechain-api
sudo systemctl start evidencechain-anvil
sudo systemctl start evidencechain-api
sudo systemctl restart nginx
```

### 6.2 Graceful Shutdown Procedure

```bash
# Stop incoming traffic first
sudo systemctl stop nginx

# Stop API server (ensures in-flight transactions complete)
sudo systemctl stop evidencechain-api

# Stop Anvil node (flushes state to .anvil_state.json)
sudo systemctl stop evidencechain-anvil
```

---

## 7. Post-Deployment Verification Health Checks

Run these immediate validation checks to verify operational readiness:

### Check 1: Anvil EVM Loopback Check
```bash
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8545
```
*Expected Result:* `{"jsonrpc":"2.0","id":1,"result":"0x6b"}` (Block 107).

### Check 2: Backend System Health Endpoint
```bash
curl -s http://127.0.0.1:5001/api/health
```
*Expected Result:* `{"status":"healthy","database":"connected","blockchain":"connected","block_number":107}`.

### Check 3: SQLite Database Integrity
```bash
python3 -c "import sqlite3; conn = sqlite3.connect('/opt/evidencechain/backend/evidencechain.db'); print(conn.cursor().execute('PRAGMA integrity_check').fetchone()[0])"
```
*Expected Result:* `ok`.
