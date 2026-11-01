# EVIDENCECHAIN — PHASE 6: BACKUP & DISASTER RECOVERY GUIDE

**Document ID:** EVC-P6-BRG-2026-FINAL  
**Target Audience:** DevOps Engineers, Database Administrators, Forensic Custodians  
**Classification:** Operational Continuity Standard Operating Procedure  
**Date:** October 28, 2026  

---

## 1. Overview & Disaster Recovery Strategy

Digital evidence repositories require continuous operational availability and zero data loss. EvidenceChain employs a multi-component backup strategy covering three distinct storage layers:

1. **Relational Register:** SQLite database (`backend/evidencechain.db`) storing metadata, users, cases, and audit events.
2. **Blockchain State:** Anvil persistent JSON state file (`.anvil_state.json`) recording blocks, EVM transactions, smart contract storage slots, and event logs.
3. **Payload Storage:** Raw digital forensic files (`backend/uploads/evidence_files/`).

---

## 2. Backup Procedures

### 2.1 Online Hot SQLite Backup (`sqlite3.backup` API)
Never use standard file copy (`cp`) on a running SQLite database in WAL mode, as uncommitted WAL transactions or half-written pages can corrupt the backup. Instead, utilize SQLite's online backup API:

```python
#!/usr/bin/env python3
"""Execute non-blocking online hot backup of EvidenceChain SQLite database."""
import sqlite3
import datetime
import os

DB_SRC = "/opt/evidencechain/backend/evidencechain.db"
BACKUP_DIR = "/var/backups/evidencechain"
os.makedirs(BACKUP_DIR, exist_ok=True)

timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%SZ")
backup_file = os.path.join(BACKUP_DIR, f"evidencechain_backup_{timestamp}.db")

print(f"Initiating online hot backup to {backup_file}...")
src_conn = sqlite3.connect(DB_SRC)
dst_conn = sqlite3.connect(backup_file)

with dst_conn:
    src_conn.backup(dst_conn, pages=100)

dst_conn.close()
src_conn.close()

# Verify integrity of generated backup
verify_conn = sqlite3.connect(backup_file)
status = verify_conn.cursor().execute("PRAGMA integrity_check").fetchone()[0]
verify_conn.close()

if status == "ok":
    print("SUCCESS: Online backup completed and verified (integrity_check=ok).")
else:
    raise RuntimeError(f"Backup verification failed: {status}")
```

### 2.2 Blockchain State Snapshotting
Foundry Anvil automatically writes its state to `.anvil_state.json` when stopped or when periodically snapshotting. To create a consistent point-in-time snapshot:

```bash
# Flush and archive current Anvil state
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
cp /opt/evidencechain/.anvil_state.json /var/backups/evidencechain/anvil_state_${TIMESTAMP}.json
sha256sum /var/backups/evidencechain/anvil_state_${TIMESTAMP}.json > /var/backups/evidencechain/anvil_state_${TIMESTAMP}.json.sha256
```

### 2.3 Evidence File Payload Synchronization
Synchronize evidence payload files using `rsync` with checksum validation:

```bash
rsync -avz --checksum \
  /opt/evidencechain/backend/uploads/evidence_files/ \
  /var/backups/evidencechain/payloads/
```

---

## 3. Automated Backup Cron Configuration

Configure an automated hourly backup schedule via `/etc/cron.d/evidencechain-backup`:

```cron
# Hourly online database backup and payload sync
0 * * * * evidencechain /opt/evidencechain/scripts/backup_evidence_data.py >> /var/log/evidencechain/backup.log 2>&1

# Daily archival and checksum generation at 02:00 UTC
0 2 * * * evidencechain tar -czf /var/backups/evidencechain/daily_archive_$(date +\%Y\%m\%d).tar.gz /var/backups/evidencechain/*.db /var/backups/evidencechain/*.json
```

---

## 4. Disaster Recovery & Restoration Drill

To restore EvidenceChain from backups following hardware failure or disaster, execute the following verified procedure in an isolated recovery sandbox:

### Step 1: Prepare Recovery Directory
```bash
RESTORE_ROOT="/tmp/evidencechain_restore_drill"
rm -rf "$RESTORE_ROOT"
mkdir -p "$RESTORE_ROOT/backend/uploads/evidence_files"
```

### Step 2: Restore Relational Register & Verify Manifest
```bash
LATEST_DB=$(ls -t /var/backups/evidencechain/evidencechain_backup_*.db | head -n 1)
cp "$LATEST_DB" "$RESTORE_ROOT/backend/evidencechain.db"

# Execute manifest integrity verification
python3 -c "
import sqlite3, hashlib
conn = sqlite3.connect('$RESTORE_ROOT/backend/evidencechain.db')
cur = conn.cursor()
cur.execute('SELECT evidence_id, case_id, sha256_hash, registered_by, registration_tx_hash FROM evidence ORDER BY evidence_id')
rows = cur.fetchall()
manifest_str = '\n'.join([f'{r[0]}|{r[1]}|{r[2]}|{r[3]}|{r[4]}' for r in rows])
db_hash = hashlib.sha256(manifest_str.encode()).hexdigest()
print(f'Restored Evidence Count: {len(rows)}')
print(f'Restored Manifest Hash: {db_hash}')
assert len(rows) == 27
assert db_hash == '148edd48944dfa34c8ff549411c5c887d4ff8e2f0785782bd45073ab175a6532'
print('RECOVERY VERIFICATION PASSED: All 27 records bit-for-bit intact.')
"
```

### Step 3: Restore Blockchain State & Start Node in Sandbox
```bash
LATEST_STATE=$(ls -t /var/backups/evidencechain/anvil_state_*.json | head -n 1)
cp "$LATEST_STATE" "$RESTORE_ROOT/.anvil_state.json"

# Test start Anvil on test port 8546
~/.foundry/bin/anvil --port 8546 --chain-id 31337 --state "$RESTORE_ROOT/.anvil_state.json" &
ANVIL_PID=$!
sleep 2

# Verify block height
BLOCK_HEX=$(curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8546 | jq -r .result)
echo "Restored Sandbox Block Height: $BLOCK_HEX"

# Clean up sandbox node
kill $ANVIL_PID
```

---

## 5. Recovery SLA & Metrics

- **Recovery Point Objective (RPO):** Maximum 1 hour (controlled by hourly snapshot cron).
- **Recovery Time Objective (RTO):** Less than 15 minutes to fully restore database, blockchain state, and resume API services.
- **Data Loss Tolerance:** 0% on anchored evidence records and cryptographic manifests.
