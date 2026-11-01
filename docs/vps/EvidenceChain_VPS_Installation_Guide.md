# EVIDENCECHAIN — VPS INSTALLATION & PROVISIONING GUIDE

**Target OS:** Ubuntu 24.04 LTS (Clean Minimal Install)  
**Target Roles:** DevOps Engineer, System Administrator  
**Architecture:** x86_64 or ARM64 (2–4 vCPU, 4–8 GB RAM, 60–80 GB SSD)  
**Date:** October 29, 2026  

---

## Step 1: Initial Server Access & System Updates

Log in to the newly provisioned Ubuntu 24.04 server as `root`:

```bash
ssh root@YOUR_SERVER_IP
```

Update system package indices and upgrade existing packages:

```bash
apt-get update && apt-get dist-upgrade -y
apt-get install -y ufw curl git build-essential jq software-properties-common ca-certificates
```

---

## Step 2: Dedicated Service Account & Sudo Configuration

Create a dedicated system user `evidencechain` for running application daemons:

```bash
adduser --disabled-password --gecos "EvidenceChain Service" evidencechain
usermod -aG sudo evidencechain

# Copy authorized SSH keys from root to evidencechain user
mkdir -p /home/evidencechain/.ssh
cp /root/.ssh/authorized_keys /home/evidencechain/.ssh/authorized_keys
chown -R evidencechain:evidencechain /home/evidencechain/.ssh
chmod 700 /home/evidencechain/.ssh
chmod 600 /home/evidencechain/.ssh/authorized_keys
```

---

## Step 3: SSH Hardening

Create an SSH security drop-in configuration at `/etc/ssh/sshd_config.d/evidencechain.conf`:

```bash
cat << 'EOF' > /etc/ssh/sshd_config.d/evidencechain.conf
PermitRootLogin prohibit-password
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 4
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

systemctl restart ssh
```

---

## Step 4: UFW Firewall Hardening

Configure UFW to enforce a default-deny posture, permitting only SSH, HTTP, and HTTPS:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH Management'
ufw allow 80/tcp comment 'HTTP ACME Challenge'
ufw allow 443/tcp comment 'HTTPS Public Web'
ufw --force enable
ufw status verbose
```

*Note: Ports 5001 (Flask API) and 8545 (Anvil Blockchain) remain strictly blocked from external access.*

---

## Step 5: Runtime Dependencies Installation

### 5.1 Python 3 & Virtual Environment Tools
```bash
apt-get install -y python3 python3-venv python3-pip python3-dev
```

### 5.2 Node.js 22 LTS (NodeSource — Required for Vite)

> [!IMPORTANT]
> **Runtime Engine Compatibility**:
> Vite (installed in `frontend/package.json`) explicitly requires **Node.js `^20.19.0 || >=22.12.0`**.
> The default Ubuntu 24.04 LTS package repository provides Node.js v18.19.1, which **fails** Vite's engine check and breaks the frontend compilation.
> You must install Node.js 22 LTS using the official NodeSource repository:

```bash
# Add NodeSource Node.js 22 LTS repository
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Install Node.js 22 LTS and npm
apt-get install -y nodejs

# Verify Node.js version (Must output >= v22.12.0)
node --version
npm --version
```

### 5.3 Foundry / Anvil Installation (for `evidencechain` user)
Switch to the `evidencechain` user and install Foundry:

```bash
su - evidencechain -c "curl -L https://foundry.paradigm.xyz | bash"
su - evidencechain -c "~/.foundry/bin/foundryup"
su - evidencechain -c "~/.foundry/bin/anvil --version"
```

---

## Step 6: Directory Structure & Permissions Setup

Create the standardized application and storage directory hierarchy:

```bash
# 1. Application code root
mkdir -p /opt/evidencechain

# 2. Isolated demo data storage (Database, uploads, and blockchain state)
mkdir -p /var/lib/evidencechain/uploads

# 3. Static frontend root
mkdir -p /var/www/evidencechain
mkdir -p /var/www/certbot

# 4. Service logs
mkdir -p /var/log/evidencechain

# Set ownership
chown -R evidencechain:evidencechain /opt/evidencechain
chown -R evidencechain:evidencechain /var/lib/evidencechain
chown -R evidencechain:evidencechain /var/www/evidencechain
chown -R evidencechain:evidencechain /var/log/evidencechain

# Permissions
chmod 750 /var/lib/evidencechain
chmod 750 /var/lib/evidencechain/uploads
chmod 755 /var/www/evidencechain
```

---

## Step 7: Application Code & Virtual Environment Staging

Extract the sanitized deployment tarball into `/opt/evidencechain`:

```bash
# Transfer evidencechain-demo-v1.0.tar.gz from local workstation via scp:
# scp evidencechain-demo-v1.0.tar.gz evidencechain@YOUR_SERVER_IP:/opt/evidencechain/

cd /opt/evidencechain
tar -xzf evidencechain-demo-v1.0.tar.gz
chown -R evidencechain:evidencechain /opt/evidencechain

# Build Python Virtual Environment
su - evidencechain -c "
cd /opt/evidencechain/backend
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
"
```

---

## Step 8: Build Frontend Production Assets

Compile the React SPA for static serving:

```bash
su - evidencechain -c "
cd /opt/evidencechain/frontend
npm ci
npm run build
cp -r dist/* /var/www/evidencechain/
"
```

---

## Step 9: Configure Environment Secrets

Generate a cryptographically secure 64-character hex secret key and write `/opt/evidencechain/backend/.env`:

```bash
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

cat << EOF > /opt/evidencechain/backend/.env
FLASK_ENV=production
ENVIRONMENT=production
SECRET_KEY=${SECRET_KEY}
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=Lax
PERMANENT_SESSION_LIFETIME=28800

ALLOW_DEV_DEMO_SWITCH=false
ALLOW_DEV_DIAGNOSTICS=false
PUBLIC_DEMO_MODE=true

DATABASE_PATH=/var/lib/evidencechain/demo_evidence.db
UPLOAD_FOLDER=/var/lib/evidencechain/uploads
MAX_CONTENT_LENGTH=52428800

BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
EXPECTED_CHAIN_ID=31337
EOF

chown evidencechain:evidencechain /opt/evidencechain/backend/.env
chmod 600 /opt/evidencechain/backend/.env
```

---

## Step 10: Deploy Systemd Services

Install the Anvil and Gunicorn service units:

```bash
cp /opt/evidencechain/deploy/evidencechain-anvil.service /etc/systemd/system/
cp /opt/evidencechain/deploy/evidencechain-api.service /etc/systemd/system/

systemctl daemon-reload
systemctl enable evidencechain-anvil
systemctl enable evidencechain-api
systemctl start evidencechain-anvil
sleep 3
```

---

## Step 11: Initialize Demonstration Ledger & Synthetic Database

Execute the synthetic demo seeder (deploys fresh smart contract and seeds synthetic cases/officers/evidence):

```bash
su - evidencechain -c "
cd /opt/evidencechain
./backend/venv/bin/python scripts/seed_synthetic_demo.py
"
```

Start the API service:

```bash
systemctl start evidencechain-api
systemctl status evidencechain-api --no-pager
```

---

## Step 12: Nginx & HTTPS Configuration (Certbot)

Install Nginx and obtain a Let's Encrypt TLS certificate:

```bash
apt-get install -y nginx certbot python3-certbot-nginx

# Deploy Nginx configuration
cp /opt/evidencechain/deploy/nginx.conf /etc/nginx/sites-available/evidencechain
ln -s /etc/nginx/sites-available/evidencechain /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Obtain TLS Certificate (Replace demo.evidencechain.org with your registered domain)
certbot --nginx -d demo.evidencechain.org --non-interactive --agree-tos -m admin@evidencechain.org

nginx -t && systemctl restart nginx
```
