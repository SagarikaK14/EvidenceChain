#!/usr/bin/env python3
"""
EvidenceChain - Isolated Demonstration Persistence & Cold-Restart Verification
Performs a complete isolated demonstration restart without reseeding.
Confirms:
1. Previously registered synthetic evidence remains in SQLite.
2. Its on-chain registration remains present and verifiable on Anvil.
3. The smart contract address remains consistent and callable.
4. Cryptographic SHA-256 verification still succeeds after restart.
5. New registration succeeds and increments blockchain state.
6. Original development environment (Port 8545 & baseline SQLite) remains 100% untouched.
"""

import os
import sys
import time
import json
import sqlite3
import hashlib
import subprocess
import urllib.request
from urllib.error import HTTPError

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO_DB = os.path.join(BASE_DIR, "demo_data", "demo_evidence.db")
ANVIL_STATE = os.path.join(BASE_DIR, "demo_data", ".anvil_demo_state.json")
PROTECTED_DB = os.getenv("PROTECTED_DB_PATH", os.path.join(BASE_DIR, "backend", "evidencechain.db"))
PROTECTED_RPC = "http://127.0.0.1:8545"
DEMO_RPC = "http://127.0.0.1:8555"
PROXY_URL = "http://127.0.0.1:8080"
EXPECTED_BASELINE_MANIFEST = "148edd48944dfa34c8ff549411c5c887d4ff8e2f0785782bd45073ab175a6532"

def rpc_call(url, method, params=[]):
    payload = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode())["result"]

def get_pids(port):
    try:
        out = subprocess.check_output(["lsof", "-t", "-i", f":{port}"], text=True)
        return [int(p.strip()) for p in out.strip().split("\n") if p.strip()]
    except Exception:
        return []

def kill_pids(pids, sig=subprocess.signal.SIGTERM):
    for p in pids:
        try:
            os.kill(p, sig)
        except ProcessLookupError:
            pass

def check_baseline_integrity():
    # 1. Check port 8545
    blk = int(rpc_call(PROTECTED_RPC, "eth_blockNumber"), 16)
    if blk != 113:
        raise RuntimeError(f"CRITICAL: Protected Anvil on port 8545 is at block #{blk}, expected #113!")
    
    # 2. Check baseline SQLite
    conn = sqlite3.connect(PROTECTED_DB)
    cur = conn.cursor()
    cur.execute('''SELECT evidence_id, case_id, sha256_hash, registered_by, registration_tx_hash 
                   FROM evidence 
                   WHERE evidence_id != "EVD-109BD71C" 
                   ORDER BY evidence_id''')
    rows = cur.fetchall()
    conn.close()
    manifest_str = '\n'.join([f"{r[0]}|{r[1]}|{r[2]}|{r[3]}|{r[4]}" for r in rows])
    calc_hash = hashlib.sha256(manifest_str.encode()).hexdigest()
    if len(rows) != 27 or calc_hash != EXPECTED_BASELINE_MANIFEST:
        raise RuntimeError(f"CRITICAL: Protected SQLite manifest mismatch! Count: {len(rows)}, Hash: {calc_hash}")
    return blk, calc_hash

def start_anvil():
    cmd = [
        os.path.expanduser("~/.foundry/bin/anvil"),
        "--port", "8555",
        "--chain-id", "31337",
        "--state", ANVIL_STATE,
        "--state-interval", "10",
        "--preserve-historical-states"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(20):
        if len(get_pids(8555)) > 0:
            return True
        time.sleep(0.2)
    return False

def start_backend():
    env = dict(os.environ, OBJC_DISABLE_INITIALIZE_FORK_SAFETY="YES")
    cmd = [
        os.path.join(BASE_DIR, "backend", "venv", "bin", "gunicorn"),
        "--bind", "127.0.0.1:5101",
        "--workers", "2",
        "--timeout", "120",
        "app:app"
    ]
    proc = subprocess.Popen(cmd, cwd=os.path.join(BASE_DIR, "backend"), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(20):
        if len(get_pids(5101)) > 0:
            return True
        time.sleep(0.2)
    return False

def start_proxy():
    cmd = [
        os.path.join(BASE_DIR, "backend", "venv", "bin", "python"),
        os.path.join(BASE_DIR, "scripts", "demo_reverse_proxy.py")
    ]
    proc = subprocess.Popen(cmd, cwd=BASE_DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(20):
        if len(get_pids(8080)) > 0:
            return True
        time.sleep(0.2)
    return False

def ensure_services():
    if not get_pids(8555):
        print("[*] Starting demo Anvil on port 8555...")
        start_anvil()
    if not get_pids(5101):
        print("[*] Starting demo Gunicorn on port 5101...")
        start_backend()
    if not get_pids(8080):
        print("[*] Starting demo Reverse Proxy on port 8080...")
        start_proxy()
    time.sleep(1)

def main():
    print("=" * 70)
    print("EVIDENCECHAIN ISOLATED DEMO COLD RESTART & PERSISTENCE VERIFICATION")
    print("=" * 70)

    # Step 0: Ensure services running before starting test
    ensure_services()

    # Pre-restart baseline verification
    p_blk, p_manifest = check_baseline_integrity()
    print(f"[+] Protected Baseline Verified: Anvil Block #{p_blk}, SQLite Manifest {p_manifest[:16]}...")

    # Step 1: Inspect existing demo records in SQLite
    conn = sqlite3.connect(DEMO_DB)
    cur = conn.cursor()
    cur.execute("SELECT evidence_id, case_id, sha256_hash, registration_tx_hash FROM evidence ORDER BY id DESC")
    existing_records = cur.fetchall()
    conn.close()
    print(f"[+] Existing synthetic evidence count in SQLite: {len(existing_records)}")
    if not existing_records:
        raise RuntimeError("No existing records found in demo database!")
    target_record = existing_records[0]
    target_id = target_record[0]
    target_hash = target_record[2]
    print(f"[+] Selected Target Record for Persistence Test: {target_id} (Hash: {target_hash[:16]}...)")

    # Step 2: Verify target record on current Anvil before restart
    demo_blk_before = int(rpc_call(DEMO_RPC, "eth_blockNumber"), 16)
    print(f"[+] Current Demo Anvil (Port 8555) Block Height before restart: #{demo_blk_before}")

    # Login and verify target evidence
    login_req = urllib.request.Request(
        f"{PROXY_URL}/api/auth/demo-login",
        data=json.dumps({"persona": "a.mehta"}).encode(),
        headers={"Content-Type": "application/json", "Origin": PROXY_URL}
    )
    with urllib.request.urlopen(login_req) as resp:
        cookie_header = resp.headers.get("Set-Cookie")

    verify_req = urllib.request.Request(
        f"{PROXY_URL}/api/evidence/{target_id}/verify",
        data=json.dumps({"currentHash": target_hash}).encode(),
        headers={"Content-Type": "application/json", "Cookie": cookie_header, "Origin": PROXY_URL}
    )
    with urllib.request.urlopen(verify_req) as resp:
        verify_data = json.loads(resp.read().decode())
        print(f"[+] Pre-restart verification result for {target_id}: {verify_data.get('result')}")
        assert verify_data.get("result") == "AUTHENTIC", "Pre-restart verification failed!"

    # Step 3: Gracefully terminate isolated demonstration services
    print("\n[*] Initiating graceful cold shutdown of demonstration services...")
    pids_8555 = get_pids(8555)
    pids_5101 = get_pids(5101)
    pids_8080 = get_pids(8080)

    # Send SIGINT to Anvil so it dumps state to .anvil_demo_state.json
    kill_pids(pids_8555, subprocess.signal.SIGINT)
    kill_pids(pids_5101, subprocess.signal.SIGTERM)
    kill_pids(pids_8080, subprocess.signal.SIGTERM)
    time.sleep(3)

    # Confirm all demo ports are closed
    assert len(get_pids(8555)) == 0, "Port 8555 still open!"
    assert len(get_pids(5101)) == 0, "Port 5101 still open!"
    assert len(get_pids(8080)) == 0, "Port 8080 still open!"
    print("[+] All demonstration ports (8555, 5101, 8080) successfully closed.")

    # Confirm .anvil_demo_state.json exists and is valid
    assert os.path.exists(ANVIL_STATE), f"State file {ANVIL_STATE} missing!"
    state_size = os.path.getsize(ANVIL_STATE)
    print(f"[+] Verified persisted Anvil state snapshot exists ({state_size} bytes).")

    # Verify protected baseline is STILL untouched during shutdown
    check_baseline_integrity()

    # Step 4: Restart demonstration services WITHOUT RESEEDING
    print("\n[*] Restarting demonstration stack from disk state snapshot (NO RESEEDING)...")
    
    # 4a. Start Anvil on port 8555 loading from state file
    assert start_anvil(), "Failed to start Anvil on port 8555!"
    print("[+] Anvil restarted on port 8555 from snapshot.")

    # 4b. Start Gunicorn on port 5101
    assert start_backend(), "Failed to start Gunicorn on port 5101!"
    print("[+] Gunicorn restarted on port 5101.")

    # 4c. Start Reverse Proxy on port 8080
    assert start_proxy(), "Failed to start Reverse Proxy on port 8080!"
    print("[+] Reverse proxy restarted on port 8080.")

    time.sleep(1)

    # Step 5: Post-Restart Verification
    print("\n[*] Running post-restart verification suite...")

    # 5a. Verify Block height was preserved
    demo_blk_after = int(rpc_call(DEMO_RPC, "eth_blockNumber"), 16)
    print(f"[+] Post-restart Demo Anvil Block Height: #{demo_blk_after} (Expected: #{demo_blk_before})")
    assert demo_blk_after == demo_blk_before, f"Block height mismatch after restart! ({demo_blk_after} vs {demo_blk_before})"

    # 5b. Verify smart contract code exists
    code = rpc_call(DEMO_RPC, "eth_getCode", ["0x5FbDB2315678afecb367f032d93F642f64180aa3", "latest"])
    assert len(code) > 10, "Smart contract code missing on restarted Anvil!"
    print("[+] Smart contract bytecode intact at 0x5FbDB2315678afecb367f032d93F642f64180aa3.")

    # 5c. Login again
    login_req2 = urllib.request.Request(
        f"{PROXY_URL}/api/auth/demo-login",
        data=json.dumps({"persona": "a.mehta"}).encode(),
        headers={"Content-Type": "application/json", "Origin": PROXY_URL}
    )
    with urllib.request.urlopen(login_req2) as resp:
        cookie2 = resp.headers.get("Set-Cookie")
        login_res = json.loads(resp.read().decode())
        print(f"[+] Re-authenticated after cold restart: {login_res['user']['name']} ({login_res['user']['role']})")

    # 5d. Query evidence repository: verify all previously recorded synthetic evidence remains in SQLite
    repo_req = urllib.request.Request(f"{PROXY_URL}/api/evidence", headers={"Cookie": cookie2})
    with urllib.request.urlopen(repo_req) as resp:
        data = json.loads(resp.read().decode())
        items = data.get("evidence", []) if isinstance(data, dict) else data
        print(f"[+] Evidence records returned by API: {len(items)}")
        assert len(items) >= len(existing_records), "Evidence records lost after restart!"

    # 5e. Perform cryptographic verification on the pre-restart target record
    verify_req2 = urllib.request.Request(
        f"{PROXY_URL}/api/evidence/{target_id}/verify",
        data=json.dumps({"currentHash": target_hash}).encode(),
        headers={"Content-Type": "application/json", "Cookie": cookie2, "Origin": PROXY_URL}
    )
    with urllib.request.urlopen(verify_req2) as resp:
        verify_data2 = json.loads(resp.read().decode())
        result_status = verify_data2.get("result")
        print(f"[+] Post-restart cryptographic verification for {target_id}: {result_status}")
        assert result_status == "AUTHENTIC", f"Post-restart verification returned {result_status}, expected AUTHENTIC!"

    # 5f. Register a NEW synthetic evidence item to prove the chain continues mining
    boundary = "----WebKitFormBoundaryPersistenceTest"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="title"\r\n\r\nCold Restart Verification Evidence\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="description"\r\n\r\nVerified after full service cold restart\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="caseId"\r\n\r\nCASE-2026-M101\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="cold_restart_log.txt"\r\n'
        f"Content-Type: text/plain\r\n\r\n"
        f"PERSISTENCE_COLD_RESTART_EVIDENCE_PAYLOAD_{time.time()}\r\n"
        f"--{boundary}--\r\n"
    ).encode()

    reg_req = urllib.request.Request(
        f"{PROXY_URL}/api/evidence/register",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Cookie": cookie2,
            "Origin": PROXY_URL
        }
    )
    with urllib.request.urlopen(reg_req) as resp:
        new_evd = json.loads(resp.read().decode())
        new_id = new_evd.get("evidenceId") or new_evd.get("evidence", {}).get("evidenceId")
        new_tx = new_evd.get("txHash") or new_evd.get("registration_tx_hash")
        print(f"[+] Successfully registered new record after restart: {new_id} (Tx: {str(new_tx)[:16]}...)")

    demo_blk_final = int(rpc_call(DEMO_RPC, "eth_blockNumber"), 16)
    print(f"[+] New Demo Anvil Block Height: #{demo_blk_final} (Successfully mined new block!)")
    assert demo_blk_final == demo_blk_after + 1, "Failed to mine new block after restart!"

    # Step 6: Final check on protected baseline
    check_baseline_integrity()
    print("[+] Protected Baseline Untouched: Port 8545 strictly at Block #113, SQLite manifest intact.")

    print("\n" + "=" * 70)
    print("PERSISTENCE & COLD RESTART VERIFICATION SCORECARD: 100% PASS")
    print("All contracts, records, hashes, and chain states verified across restart.")
    print("=" * 70)

if __name__ == "__main__":
    main()
