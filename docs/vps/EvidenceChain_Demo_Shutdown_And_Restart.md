# EVIDENCECHAIN — DEMONSTRATION LIFECYCLE & RUNBOOK
**Document Reference:** `EC-MANUAL-2026-DEMO-LIFECYCLE-01`  
**Classification:** OPERATIONAL RUNBOOK & COMMAND CHEATSHEET  
**Target Environment:** Local Demonstration Stack (`./EvidenceChain_Local_Demo`)  

---

## 1. COMPREHENSIVE COMMAND CHEATSHEET

### 1.1 Start the Entire Demo Stack (Local Mode)
To launch the isolated Anvil EVM node, the Flask backend, and the production reverse proxy:

```bash
cd ./EvidenceChain_Local_Demo

# 1. Start Demonstration Anvil EVM (Port 8555)
~/.foundry/bin/anvil --port 8555 --chain-id 31337 \
  --state demo_data/.anvil_demo_state.json \
  --preserve-historical-states > demo_data/anvil.log 2>&1 &

# 2. Start Demonstration Flask API (Port 5101)
(cd backend && venv/bin/python app.py > ../demo_data/backend.log 2>&1 &)

# 3. Start Production Same-Origin Reverse Proxy (Port 8080)
backend/venv/bin/python scripts/demo_reverse_proxy.py > demo_data/proxy.log 2>&1 &

echo "[+] Demonstration stack started at http://127.0.0.1:8080"
```

---

### 1.2 Stop the Demonstration Stack
To gracefully shut down all demo services without disturbing protected development nodes (ports 8545 & 8546):

```bash
# 1. Stop Reverse Proxy (:8080)
kill $(lsof -t -i :8080) 2>/dev/null || true

# 2. Stop Demonstration Flask API (:5101)
kill $(lsof -t -i :5101) 2>/dev/null || true

# 3. Stop Demonstration Anvil EVM (:8555)
kill $(lsof -t -i :8555) 2>/dev/null || true

# 4. Stop Cloudflare Tunnel
killall cloudflared 2>/dev/null || true

echo "[+] Demonstration stack stopped cleanly."
```

---

### 1.3 Restart the Demonstration Stack
```bash
# Stop first
kill $(lsof -t -i :8080 -i :5101 -i :8555) 2>/dev/null || true
sleep 1

# Start
cd ./EvidenceChain_Local_Demo
~/.foundry/bin/anvil --port 8555 --chain-id 31337 --state demo_data/.anvil_demo_state.json --preserve-historical-states > demo_data/anvil.log 2>&1 &
(cd backend && venv/bin/python app.py > ../demo_data/backend.log 2>&1 &)
backend/venv/bin/python scripts/demo_reverse_proxy.py > demo_data/proxy.log 2>&1 &

echo "[+] Demonstration stack restarted successfully."
```

---

### 1.4 Start the Public Cloudflare Tunnel
*(Execute ONLY after private smoke tests pass and explicit authorization is given)*

#### Option A: Open Public Demo Tunnel
```bash
cloudflared tunnel \
  --url http://127.0.0.1:8080
```

#### Option B: Faculty-Restricted Access Tunnel
```bash
cloudflared tunnel \
  --url http://127.0.0.1:8080 \
  --allowed-mail FACULTY_EMAIL
```

---

### 1.5 Stop the Public Cloudflare Tunnel
To immediately revoke public internet access while keeping the local demo running:

```bash
killall cloudflared 2>/dev/null || true
echo "[+] Public Cloudflare tunnel terminated. Access revoked."
```

---

### 1.6 Backup Synthetic Demonstration Data
To create an archive of all synthetic cases, registered items, and Anvil state:

```bash
cd ./EvidenceChain_Local_Demo
BACKUP_DIR="backups/demo_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 1. Consistent SQLite backup
sqlite3 demo_data/demo_evidence.db ".backup '$BACKUP_DIR/demo_evidence.db'"

# 2. Copy synthetic evidence uploads
cp -r demo_data/uploads "$BACKUP_DIR/uploads"

# 3. Dump current EVM block state via RPC
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"anvil_dumpState","params":[],"id":1}' \
  http://127.0.0.1:8555 | jq -r .result > "$BACKUP_DIR/anvil_state.hex"

echo "[+] Synthetic demo data backed up to $BACKUP_DIR"
```

---

### 1.7 Reset / Re-seed Demonstration Data to Clean State
If visitors submit test data during an evaluation and you wish to restore the clean 10-evidence baseline:

```bash
cd ./EvidenceChain_Local_Demo

# 1. Stop backend & anvil
kill $(lsof -t -i :5101 -i :8555) 2>/dev/null || true
sleep 1

# 2. Remove old demo database & anvil state
rm -f demo_data/demo_evidence.db demo_data/.anvil_demo_state.json

# 3. Start fresh Anvil on port 8555
~/.foundry/bin/anvil --port 8555 --chain-id 31337 \
  --state demo_data/.anvil_demo_state.json \
  --preserve-historical-states > demo_data/anvil.log 2>&1 &
sleep 2

# 4. Re-seed fresh contract and demo records
backend/venv/bin/python -c "
from scripts.seed_synthetic_demo import seed
seed('demo_data/demo_evidence.db', 'demo_data/uploads', 'http://127.0.0.1:8555')
"

# 5. Start Flask backend
(cd backend && venv/bin/python app.py > ../demo_data/backend.log 2>&1 &)

echo "[+] Clean synthetic baseline restored!"
```

---

## 2. TROUBLESHOOTING GUIDE

| Symptom | Cause | Solution |
|---|---|---|
| **Port 8080 already in use** | Stale proxy process | Run `kill $(lsof -t -i :8080)` and restart proxy. |
| **Port 5101 already in use** | Stale Flask process | Run `kill $(lsof -t -i :5101)` and restart backend. |
| **Port 8555 already in use** | Stale Anvil process | Run `kill $(lsof -t -i :8555)` and restart Anvil. |
| **503 Service Unavailable** | Reverse proxy cannot reach Flask | Verify Flask is listening: `curl http://127.0.0.1:5101/api/health`. |
| **429 Rate Limit Exceeded** | More than 10 logins / min | Wait 60 seconds or restart backend to clear in-memory rate buckets. |
| **Protected state altered?** | Verification panic | Run `backend/venv/bin/python scripts/run_smoke_tests.py` to confirm port 8545 is still at #113 and DB manifest matches `148edd48...`. |
