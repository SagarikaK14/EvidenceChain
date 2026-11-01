# EVIDENCECHAIN — VPS DEMO BACKUP & RESTORATION GUIDE

**Document ID:** EVC-VPS-BACKUP-2026-01  
**Target Environment:** Ubuntu 24.04 LTS Demonstration VPS  
**Storage Paths:** `/var/lib/evidencechain/`  
**Date:** October 29, 2026  

---

## 1. Backup Strategy for Demonstration State

The VPS environment maintains state across three distinct components:
1. **SQLite Database:** `/var/lib/evidencechain/demo_evidence.db`
2. **Blockchain State:** `/var/lib/evidencechain/.anvil_demo_state.json`
3. **Evidence Payloads:** `/var/lib/evidencechain/uploads/`

---

## 2. Automated Daily Backup Procedure

Create an automated daily backup script at `/opt/evidencechain/scripts/vps_backup.py`:

```python
#!/usr/bin/env python3
"""Execute non-blocking backup of VPS demonstration state."""
import sqlite3
import os
import shutil
import datetime

BACKUP_ROOT = "/var/backups/evidencechain"
os.makedirs(BACKUP_ROOT, exist_ok=True)
timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%SZ")

# 1. Hot SQLite Backup
src_db = "/var/lib/evidencechain/demo_evidence.db"
dst_db = os.path.join(BACKUP_ROOT, f"demo_evidence_{timestamp}.db")
if os.path.exists(src_db):
    s_conn = sqlite3.connect(src_db)
    d_conn = sqlite3.connect(dst_db)
    with d_conn:
        s_conn.backup(d_conn, pages=50)
    d_conn.close()
    s_conn.close()
    print(f"[+] SQLite backed up to {dst_db}")

# 2. Blockchain State Snapshot
src_anvil = "/var/lib/evidencechain/.anvil_demo_state.json"
dst_anvil = os.path.join(BACKUP_ROOT, f"anvil_demo_state_{timestamp}.json")
if os.path.exists(src_anvil):
    shutil.copy2(src_anvil, dst_anvil)
    print(f"[+] Anvil state copied to {dst_anvil}")

# 3. Payloads Tarball
src_uploads = "/var/lib/evidencechain/uploads"
dst_uploads = os.path.join(BACKUP_ROOT, f"uploads_{timestamp}.tar.gz")
if os.path.exists(src_uploads):
    shutil.make_archive(dst_uploads.replace(".tar.gz", ""), "gztar", src_uploads)
    print(f"[+] Uploads archived to {dst_uploads}")
```

Schedule in crontab (`sudo crontab -u evidencechain -e`):
```cron
0 3 * * * /opt/evidencechain/backend/venv/bin/python /opt/evidencechain/scripts/vps_backup.py >> /var/log/evidencechain/backup.log 2>&1
```

---

## 3. Disaster Restoration Drill

In the event of demonstration data corruption:

```bash
# 1. Stop active services
sudo systemctl stop evidencechain-api
sudo systemctl stop evidencechain-anvil

# 2. Restore latest SQLite backup
LATEST_DB=$(ls -t /var/backups/evidencechain/demo_evidence_*.db | head -n 1)
sudo cp "$LATEST_DB" /var/lib/evidencechain/demo_evidence.db
sudo chown evidencechain:evidencechain /var/lib/evidencechain/demo_evidence.db

# 3. Restore latest Anvil state
LATEST_ANVIL=$(ls -t /var/backups/evidencechain/anvil_demo_state_*.json | head -n 1)
sudo cp "$LATEST_ANVIL" /var/lib/evidencechain/.anvil_demo_state.json
sudo chown evidencechain:evidencechain /var/lib/evidencechain/.anvil_demo_state.json

# 4. Restart services in proper sequence
sudo systemctl start evidencechain-anvil
sleep 2
sudo systemctl start evidencechain-api
sudo systemctl restart nginx
```
