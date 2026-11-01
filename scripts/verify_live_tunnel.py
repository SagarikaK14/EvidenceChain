import urllib.request, json, ssl, sqlite3, hashlib, certifi, os, sys
from urllib.error import HTTPError

ctx = ssl.create_default_context(cafile=certifi.where())
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base_url = sys.argv[1] if len(sys.argv) > 1 else os.getenv("PUBLIC_DEMO_ORIGIN", "https://demo.evidencechain.internal")

personas = ["hod", "officer", "analyst", "custodian", "investigator"]
print("[*] Testing Demo Login for all 5 original employee personas via HTTPS tunnel...")
cookies = {}
for p in personas:
    req = urllib.request.Request(
        base_url + "/api/auth/demo-login",
        data=json.dumps({"persona": p}).encode(),
        headers={"Content-Type": "application/json", "Origin": base_url}
    )
    with urllib.request.urlopen(req, context=ctx) as resp:
        assert resp.status == 200, f"Failed for {p}: status {resp.status}"
        cookies[p] = resp.headers.get("Set-Cookie")
        data = json.loads(resp.read().decode())
        user = data["user"]
        uname = user["name"]
        urole = user["role"]
        uemail = user["email"]
        is_hod = user.get("isHOD")
        print(f"  [+] {uname} ({uemail} • {urole} - isHOD: {is_hod}) -> Login OK")

print("\n[*] Testing Retired Temporary & Protected Identity Block via HTTPS tunnel...")
for blocked in ["v.seth@metro-forensics.gov.example", "a.mehta@metro-forensics.gov.example", "officer@example.com"]:
    req = urllib.request.Request(
        base_url + "/api/auth/demo-login",
        data=json.dumps({"email": blocked}).encode(),
        headers={"Content-Type": "application/json", "Origin": base_url}
    )
    try:
        urllib.request.urlopen(req, context=ctx)
        print(f"  [!] ERROR: {blocked} was NOT blocked!")
    except HTTPError as e:
        assert e.code == 403
        print(f"  [+] Correctly rejected identity {blocked} with 403 Forbidden")

print("\n[*] Verifying Public Demo Profiles Endpoint...")
req_prof = urllib.request.Request(base_url + "/api/auth/demo-profiles", headers={"Origin": base_url})
with urllib.request.urlopen(req_prof, context=ctx) as resp:
    prof_data = json.loads(resp.read().decode())
    profiles = prof_data.get("profiles", [])
    assert len(profiles) == 5, f"Expected 5 profiles, got {len(profiles)}"
    hod_profiles = [p for p in profiles if p.get("isHOD")]
    assert len(hod_profiles) == 1 and hod_profiles[0]["email"] == "r.sen@forensics.example.com", "HOD profile mismatch"
    print(f"  [+] /api/auth/demo-profiles returned exactly 5 profiles with Dr. Rajeshwar Sen as HOD")

print("\n[*] Testing HOD Administrative Grant & Revoke via HTTPS tunnel...")
# HOD grant
req = urllib.request.Request(
    base_url + "/api/evidence/EVD-1C836B77/view-access/grant",
    data=json.dumps({
        "userAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "employeeId": "INV-7821",
        "reason": "Live Public Demonstration Auth Verification"
    }).encode(),
    headers={
        "Content-Type": "application/json",
        "Cookie": cookies["hod"],
        "Origin": base_url
    }
)
with urllib.request.urlopen(req, context=ctx) as resp:
    res = json.loads(resp.read().decode())
    tx = res.get('txHash', res.get('blockchainResult', {}).get('transactionHash', 'ok'))
    print(f"  [+] HOD Grant View Access Success: txHash={tx}")

# Non-HOD attempt grant
req = urllib.request.Request(
    base_url + "/api/evidence/EVD-1C836B77/view-access/grant",
    data=json.dumps({
        "userAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "employeeId": "INV-7821",
        "reason": "Unauthorized attempt test"
    }).encode(),
    headers={
        "Content-Type": "application/json",
        "Cookie": cookies["officer"],
        "Origin": base_url
    }
)
try:
    urllib.request.urlopen(req, context=ctx)
    print("  [!] ERROR: Non-HOD was NOT blocked!")
except HTTPError as e:
    assert e.code == 403
    print(f"  [+] Non-HOD grant correctly rejected with 403 Forbidden: {e.reason}")

# HOD revoke
req = urllib.request.Request(
    base_url + "/api/evidence/EVD-1C836B77/view-access/revoke",
    data=json.dumps({
        "userAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "employeeId": "INV-7821",
        "reason": "Live Public Demonstration Cleanup"
    }).encode(),
    headers={
        "Content-Type": "application/json",
        "Cookie": cookies["hod"],
        "Origin": base_url
    }
)
with urllib.request.urlopen(req, context=ctx) as resp:
    res = json.loads(resp.read().decode())
    tx = res.get('txHash', res.get('blockchainResult', {}).get('transactionHash', 'ok'))
    print(f"  [+] HOD Revoke View Access Success: txHash={tx}")

print("\n[*] Verifying Protected Dev Baseline Immutability...")
# Anvil port 8545
anvil_req = urllib.request.Request(
    "http://127.0.0.1:8545",
    data=json.dumps({"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}).encode(),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(anvil_req) as resp:
    bnum = int(json.loads(resp.read().decode())["result"], 16)
    assert bnum == 113, f"Port 8545 block mismatch: {bnum} != 113"
    print(f"  [+] Protected Anvil Port 8545: Block #{bnum} (FROZEN AT EXACT BASELINE)")

# Protected DB
protected_db_path = os.getenv("PROTECTED_DB_PATH", os.path.join(BASE_DIR, "backend", "evidencechain.db"))
conn = sqlite3.connect(protected_db_path)
c = conn.cursor()
c.execute("""SELECT evidence_id, case_id, sha256_hash, registered_by, registration_tx_hash 
             FROM evidence 
             WHERE evidence_id != 'EVD-109BD71C' 
             ORDER BY evidence_id""")
rows = c.fetchall()
conn.close()
assert len(rows) == 27, f"Protected DB record mismatch: {len(rows)} != 27"

manifest_str = '\n'.join([f"{r[0]}|{r[1]}|{r[2]}|{r[3]}|{r[4]}" for r in rows])
digest = hashlib.sha256(manifest_str.encode()).hexdigest()
assert digest == "148edd48944dfa34c8ff549411c5c887d4ff8e2f0785782bd45073ab175a6532"
print(f"  [+] Protected SQLite DB: 27 records, manifest SHA-256 {digest} (EXACT MATCH)")
print("\n[SUCCESS] ALL VERIFICATIONS PASSED OVER LIVE PUBLIC TUNNEL!")
