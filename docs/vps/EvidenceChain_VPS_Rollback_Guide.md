# EVIDENCECHAIN — VPS DEPLOYMENT ROLLBACK & DECOMMISSIONING GUIDE

**Document ID:** EVC-VPS-ROLLBACK-2026-01  
**Target Environment:** Ubuntu 24.04 LTS Demonstration VPS  
**Date:** October 29, 2026  

---

## 1. Fast Rollback (Reverting to Maintenance Mode)

If a critical vulnerability, configuration error, or unexpected behavior is detected on the public demo website, execute immediate fast containment:

```bash
# 1. Stop public ingress by disabling Nginx site
sudo rm -f /etc/nginx/sites-enabled/evidencechain
sudo systemctl reload nginx

# 2. Stop application and blockchain daemons
sudo systemctl stop evidencechain-api
sudo systemctl stop evidencechain-anvil

# 3. Present maintenance page on Port 80/443 (Optional)
cat << 'EOF' | sudo tee /var/www/html/index.html
<!DOCTYPE html>
<html>
<head><title>EvidenceChain Demo — Maintenance</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 60px; background: #0B1017; color: #FFF;">
  <h1>EvidenceChain Demonstration Portal</h1>
  <p style="color: #94A3B8;">The public demonstration system is temporarily offline for scheduled maintenance.</p>
</body>
</html>
EOF
```

---

## 2. Complete Zero-Footprint VPS Decommissioning

If the demonstration deployment concludes or must be completely wiped from the VPS:

### Step 1: Stop and Disable System Services
```bash
sudo systemctl stop evidencechain-api
sudo systemctl stop evidencechain-anvil
sudo systemctl disable evidencechain-api
sudo systemctl disable evidencechain-anvil

sudo rm -f /etc/systemd/system/evidencechain-api.service
sudo rm -f /etc/systemd/system/evidencechain-anvil.service
sudo systemctl daemon-reload
```

### Step 2: Remove Web Server Configurations
```bash
sudo rm -f /etc/nginx/sites-available/evidencechain
sudo rm -f /etc/nginx/sites-enabled/evidencechain
sudo systemctl restart nginx
```

### Step 3: Remove Application & Data Directories
```bash
sudo rm -rf /opt/evidencechain
sudo rm -rf /var/lib/evidencechain
sudo rm -rf /var/www/evidencechain
sudo rm -rf /var/log/evidencechain
sudo rm -rf /var/backups/evidencechain
```

### Step 4: Remove Dedicated Service Account (Optional)
```bash
sudo userdel -r evidencechain 2>/dev/null || true
```

*Verification:* The server is returned to its pristine baseline state with zero persistent evidence artifacts.
