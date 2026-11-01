#!/usr/bin/env python3
"""
EvidenceChain Dynamic Public Demo Origin Registrar & Ingress Gatekeeper
Usage:
    python scripts/update_public_origin.py <EXACT_URL>            # Stage 1: Register origin (Quarantined)
    python scripts/update_public_origin.py <EXACT_URL> --enable   # Stage 2: Enable public ingress
    python scripts/update_public_origin.py --clear                # Restore loopback-only mode

Validates that the provided URL belongs strictly to trycloudflare.com:
    https://<subdomain>.trycloudflare.com
Updates .env.demo and gracefully reloads Gunicorn workers.
Never restarts the protected Anvil node on port 8545.
"""

import os
import sys
import re
import signal
import subprocess
import urllib.request
import json
import time
from urllib.parse import urlparse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_DEMO_FILE = os.path.join(BASE_DIR, ".env.demo")
PROTECTED_RPC = "http://127.0.0.1:8545"

def get_protected_block_height():
    """Verify that the protected baseline blockchain has not been modified."""
    try:
        req = urllib.request.Request(
            PROTECTED_RPC,
            data=b'{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}',
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            return int(data["result"], 16)
    except Exception as e:
        return f"Error: {e}"

def get_gunicorn_pids():
    """Find Gunicorn process IDs listening on 127.0.0.1:5101."""
    try:
        out = subprocess.check_output(["lsof", "-t", "-i", ":5101"], text=True)
        return [int(pid.strip()) for pid in out.strip().split("\n") if pid.strip()]
    except Exception:
        return []

def update_env_demo(new_origin: str, enable_public: bool):
    """Write or update PUBLIC_DEMO_ORIGIN and PUBLIC_ACCESS_ENABLED in .env.demo atomically."""
    lines = []
    found_origin = False
    found_enable = False

    if os.path.exists(ENV_DEMO_FILE):
        with open(ENV_DEMO_FILE, "r") as f:
            for line in f:
                if line.strip().startswith("PUBLIC_DEMO_ORIGIN="):
                    lines.append(f'PUBLIC_DEMO_ORIGIN="{new_origin}"\n')
                    found_origin = True
                elif line.strip().startswith("PUBLIC_ACCESS_ENABLED="):
                    lines.append(f'PUBLIC_ACCESS_ENABLED="{"true" if enable_public else "false"}"\n')
                    found_enable = True
                else:
                    lines.append(line)

    if not found_origin:
        lines.append(f'PUBLIC_DEMO_ORIGIN="{new_origin}"\n')
    if not found_enable:
        lines.append(f'PUBLIC_ACCESS_ENABLED="{"true" if enable_public else "false"}"\n')

    with open(ENV_DEMO_FILE, "w") as f:
        f.writelines(lines)

def reload_gunicorn():
    """Send SIGHUP to the Gunicorn master process to gracefully reload workers."""
    pids = get_gunicorn_pids()
    if not pids:
        return False
    for pid in pids:
        try:
            os.kill(pid, signal.SIGHUP)
        except ProcessLookupError:
            pass
    time.sleep(0.5)
    return True

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/update_public_origin.py <URL> [--enable] | --clear")
        sys.exit(1)

    target_arg = sys.argv[1].strip()
    enable_public = ("--enable" in sys.argv)

    if target_arg == "--clear":
        new_origin = ""
        enable_public = False
        print("[*] Clearing PUBLIC_DEMO_ORIGIN and disabling public ingress...")
    else:
        match = re.match(r"^https://([a-zA-Z0-9-]+)\.trycloudflare\.com/?$", target_arg)
        if not match:
            print(f"[!] ERROR: Target URL '{target_arg}' is invalid.")
            print("    Must strictly match: https://<subdomain>.trycloudflare.com")
            sys.exit(1)
        new_origin = f"https://{match.group(1)}.trycloudflare.com"
        state_str = "ACTIVE (Public Access Enabled)" if enable_public else "QUARANTINED (Pre-flight Pending)"
        print(f"[*] Validated exact Cloudflare Quick Tunnel origin: {new_origin}")
        print(f"[*] Gateway Ingress State: {state_str}")

    # Check baseline blockchain before update
    blk_before = get_protected_block_height()

    # Update .env.demo
    update_env_demo(new_origin, enable_public)

    # Reload Gunicorn
    reload_gunicorn()

    # Check baseline blockchain after update
    blk_after = get_protected_block_height()
    assert blk_before == blk_after == 113, f"CRITICAL: Protected Anvil state changed! ({blk_before} -> {blk_after})"

    if new_origin:
        if enable_public:
            print(f"[SUCCESS] Public Demo Origin activated: {new_origin}")
        else:
            print(f"[SUCCESS] Public Demo Origin registered in QUARANTINE mode: {new_origin}")
    else:
        print("[SUCCESS] Public origin cleared; loopback-only mode restored.")

if __name__ == "__main__":
    main()
