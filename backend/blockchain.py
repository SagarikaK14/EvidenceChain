from web3 import Web3
from web3.exceptions import ContractLogicError
import json
import os
import re
import sys

# Ensure local environment configuration is loaded: prioritize .env.demo in demo deployments, fallback to .env
def _load_env():
    demo_env = os.getenv("DEMO_ENV_FILE")
    if not demo_env:
        cur = os.path.abspath(__file__)
        for _ in range(4):
            cur = os.path.dirname(cur)
            cand = os.path.join(cur, ".env.demo")
            if os.path.exists(cand):
                demo_env = cand
                break
    if demo_env and os.path.exists(demo_env):
        try:
            from dotenv import load_dotenv
            load_dotenv(demo_env, override=True)
        except ImportError:
            pass
    else:
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass

_load_env()


# ============================================================
# BLOCKCHAIN EXCEPTIONS & CLEAN ERROR EXTRACTOR
# ============================================================

class EvidenceNotFoundError(Exception):
    """Raised when target evidence is not registered on the active blockchain ledger."""
    pass


class LedgerExecutionError(Exception):
    """Raised when smart contract reverts or EVM execution fails."""
    pass


def extract_clean_error(err):
    """
    Extract a user-friendly error string, strictly stripping raw VM hex bytecode,
    internal RPC tuples, data dumps, and stack trace dumps.
    """
    if isinstance(err, (EvidenceNotFoundError, PermissionError)):
        return str(err)

    if isinstance(err, tuple) and len(err) > 0:
        err = err[0]

    msg = str(err)
    if "Evidence does not exist" in msg:
        return "Evidence record is not registered on the active blockchain ledger."

    match = re.search(r"reverted with reason string ['\"]([^'\"]+)['\"]", msg)
    if match:
        return f"Blockchain operation rejected: {match.group(1)}"

    if "execution reverted:" in msg:
        parts = msg.split("execution reverted:")
        clean = parts[1].split("'")[0].split('"')[0].strip()
        if clean:
            return f"Blockchain operation rejected: {clean}"

    if "VM Exception while processing transaction:" in msg:
        clean = msg.replace("VM Exception while processing transaction:", "").strip()
        clean = re.sub(r"0x[0-9a-fA-F]{8,}", "", clean)
        clean = clean.strip(" ()[],\"'")
        if clean:
            return f"Blockchain operation rejected: {clean}"

    # Strip any remaining hex dumps
    msg = re.sub(r"0x[0-9a-fA-F]{8,}", "", msg)
    msg = re.sub(r"['\"]?data['\"]?:\s*['\"][^'\"]*['\"]", "", msg)
    msg = msg.strip(" ()[],\"'")

    if not msg:
        return "Blockchain operation failed. The ledger network may be unavailable or rejected the transaction."

    return "Blockchain operation rejected: " + msg


# ============================================================
# BLOCKCHAIN CONFIGURATION & ISOLATION GUARDS
# ============================================================

def get_rpc_url():
    rpc = os.getenv("BLOCKCHAIN_RPC_URL", "").strip()
    is_demo = os.getenv("PUBLIC_DEMO_MODE", "").strip().lower() in ("1", "true", "yes")
    fail_closed = os.getenv("FAIL_CLOSED", "").strip().lower() in ("1", "true", "yes")

    if is_demo or fail_closed:
        if not rpc:
            raise RuntimeError(
                "FAIL-CLOSED SECURITY ENFORCEMENT: Missing BLOCKCHAIN_RPC_URL environment variable in demonstration mode. "
                "Refusing to fall back to default RPC URL."
            )
        if "8545" in rpc:
            raise RuntimeError(
                "FAIL-CLOSED SECURITY VIOLATION: Demonstration environment attempted to connect to port 8545 (protected Anvil node). "
                "Connection aborted to preserve original development state."
            )
    return rpc or "http://127.0.0.1:8545"

def get_contract_address():
    return os.getenv("CONTRACT_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3")

RPC_URL = get_rpc_url()
CONTRACT_ADDRESS = get_contract_address()
EXPECTED_CHAIN_ID = 31337

def verify_mutation_isolation():
    """
    Fail-closed runtime guard: prevents test suites or capture scripts from mutating
    the persistent Anvil instance on port 8545.
    """
    flask_env = (os.getenv("FLASK_ENV") or "").lower()
    is_testing = (
        flask_env in ("test", "testing")
        or bool(os.getenv("PYTEST_CURRENT_TEST"))
        or ("unittest" in sys.modules and any("test" in arg.lower() for arg in sys.argv))
    )
    if is_testing:
        rpc = get_rpc_url()
        if "8545" in rpc:
            raise RuntimeError(
                "FAIL-CLOSED SECURITY VIOLATION: Mutating blockchain operations during tests are strictly prohibited "
                "from executing against the persistent Anvil instance on port 8545. "
                "Set BLOCKCHAIN_RPC_URL to an isolated test node (e.g. http://127.0.0.1:8546)."
            )

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACT_PATH = os.path.join(
    os.path.dirname(BASE_DIR),
    "artifacts",
    "contracts",
    "EvidenceChain.sol",
    "EvidenceChain.json"
)

def get_contract_abi():
    if os.path.exists(ARTIFACT_PATH):
        try:
            with open(ARTIFACT_PATH, "r") as f:
                data = json.load(f)
                if "abi" in data:
                    return data["abi"]
        except Exception as e:
            print("Warning: failed to load ABI from artifact:", e)
    return CONTRACT_ABI


# ============================================================
# SMART CONTRACT ABI
# ============================================================

CONTRACT_ABI = [   {'inputs': [], 'stateMutability': 'nonpayable', 'type': 'constructor'},
    {   'anonymous': False,
        'inputs': [   {'indexed': True, 'internalType': 'address', 'name': 'admin', 'type': 'address'},
                      {'indexed': True, 'internalType': 'address', 'name': 'targetMember', 'type': 'address'},
                      {'indexed': False, 'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                      {'indexed': False, 'internalType': 'string', 'name': 'permissionType', 'type': 'string'},
                      {'indexed': False, 'internalType': 'string', 'name': 'action', 'type': 'string'},
                      {'indexed': False, 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'name': 'AdminPermissionAudit',
        'type': 'event'},
    {   'anonymous': False,
        'inputs': [   {'indexed': True, 'internalType': 'address', 'name': 'wallet', 'type': 'address'},
                      {'indexed': False, 'internalType': 'string', 'name': 'name', 'type': 'string'},
                      {'indexed': False, 'internalType': 'string', 'name': 'role', 'type': 'string'},
                      {'indexed': False, 'internalType': 'string', 'name': 'departmentId', 'type': 'string'},
                      {'indexed': False, 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'name': 'DepartmentMemberRegistered',
        'type': 'event'},
    {   'anonymous': False,
        'inputs': [   {'indexed': True, 'internalType': 'address', 'name': 'wallet', 'type': 'address'},
                      {'indexed': False, 'internalType': 'string', 'name': 'role', 'type': 'string'},
                      {'indexed': False, 'internalType': 'bool', 'name': 'isActive', 'type': 'bool'},
                      {'indexed': False, 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'name': 'DepartmentMemberUpdated',
        'type': 'event'},
    {   'anonymous': False,
        'inputs': [   {'indexed': False, 'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                      {'indexed': False, 'internalType': 'address', 'name': 'user', 'type': 'address'},
                      {'indexed': False, 'internalType': 'address', 'name': 'grantedBy', 'type': 'address'},
                      {'indexed': False, 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'name': 'DownloadAccessGranted',
        'type': 'event'},
    {   'anonymous': False,
        'inputs': [   {'indexed': False, 'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                      {'indexed': False, 'internalType': 'address', 'name': 'user', 'type': 'address'},
                      {'indexed': False, 'internalType': 'address', 'name': 'revokedBy', 'type': 'address'},
                      {'indexed': False, 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'name': 'DownloadAccessRevoked',
        'type': 'event'},
    {   'anonymous': False,
        'inputs': [   {'indexed': False, 'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                      {'indexed': False, 'internalType': 'address', 'name': 'accessedBy', 'type': 'address'},
                      {'indexed': False, 'internalType': 'string', 'name': 'action', 'type': 'string'},
                      {'indexed': False, 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'name': 'EvidenceAccessed',
        'type': 'event'},
    {   'anonymous': False,
        'inputs': [   {'indexed': False, 'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                      {'indexed': False, 'internalType': 'string', 'name': 'caseId', 'type': 'string'},
                      {'indexed': False, 'internalType': 'string', 'name': 'evidenceHash', 'type': 'string'},
                      {'indexed': False, 'internalType': 'address', 'name': 'registeredBy', 'type': 'address'},
                      {'indexed': False, 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'name': 'EvidenceRegistered',
        'type': 'event'},
    {   'anonymous': False,
        'inputs': [   {'indexed': True, 'internalType': 'address', 'name': 'previousHOD', 'type': 'address'},
                      {'indexed': True, 'internalType': 'address', 'name': 'newHOD', 'type': 'address'},
                      {'indexed': False, 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'name': 'HODUpdated',
        'type': 'event'},
    {   'anonymous': False,
        'inputs': [   {'indexed': False, 'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                      {'indexed': False, 'internalType': 'address', 'name': 'user', 'type': 'address'},
                      {'indexed': False, 'internalType': 'address', 'name': 'grantedBy', 'type': 'address'},
                      {'indexed': False, 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'name': 'ViewAccessGranted',
        'type': 'event'},
    {   'anonymous': False,
        'inputs': [   {'indexed': False, 'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                      {'indexed': False, 'internalType': 'address', 'name': 'user', 'type': 'address'},
                      {'indexed': False, 'internalType': 'address', 'name': 'revokedBy', 'type': 'address'},
                      {'indexed': False, 'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'name': 'ViewAccessRevoked',
        'type': 'event'},
    {   'inputs': [   {'internalType': 'string', 'name': '', 'type': 'string'},
                      {'internalType': 'uint256', 'name': '', 'type': 'uint256'}],
        'name': 'accessHistory',
        'outputs': [   {'internalType': 'address', 'name': 'accessedBy', 'type': 'address'},
                       {'internalType': 'string', 'name': 'action', 'type': 'string'},
                       {'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [{'internalType': 'uint256', 'name': '', 'type': 'uint256'}],
        'name': 'adminAuditHistory',
        'outputs': [   {'internalType': 'address', 'name': 'admin', 'type': 'address'},
                       {'internalType': 'address', 'name': 'targetMember', 'type': 'address'},
                       {'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                       {'internalType': 'string', 'name': 'permissionType', 'type': 'string'},
                       {'internalType': 'string', 'name': 'action', 'type': 'string'},
                       {'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '_evidenceId', 'type': 'string'},
                      {'internalType': 'address', 'name': '_user', 'type': 'address'}],
        'name': 'canDownload',
        'outputs': [{'internalType': 'bool', 'name': '', 'type': 'bool'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '_evidenceId', 'type': 'string'},
                      {'internalType': 'address', 'name': '_user', 'type': 'address'}],
        'name': 'canView',
        'outputs': [{'internalType': 'bool', 'name': '', 'type': 'bool'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [{'internalType': 'address', 'name': '', 'type': 'address'}],
        'name': 'departmentMembers',
        'outputs': [   {'internalType': 'address', 'name': 'walletAddress', 'type': 'address'},
                       {'internalType': 'string', 'name': 'name', 'type': 'string'},
                       {'internalType': 'string', 'name': 'role', 'type': 'string'},
                       {'internalType': 'string', 'name': 'departmentId', 'type': 'string'},
                       {'internalType': 'bool', 'name': 'isActive', 'type': 'bool'},
                       {'internalType': 'uint256', 'name': 'registeredAt', 'type': 'uint256'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '', 'type': 'string'},
                      {'internalType': 'address', 'name': '', 'type': 'address'}],
        'name': 'downloadAccess',
        'outputs': [{'internalType': 'bool', 'name': '', 'type': 'bool'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [{'internalType': 'string', 'name': '', 'type': 'string'}],
        'name': 'evidences',
        'outputs': [   {'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                       {'internalType': 'string', 'name': 'caseId', 'type': 'string'},
                       {'internalType': 'string', 'name': 'evidenceHash', 'type': 'string'},
                       {'internalType': 'address', 'name': 'registeredBy', 'type': 'address'},
                       {'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [{'internalType': 'string', 'name': '_evidenceId', 'type': 'string'}],
        'name': 'getAccessHistory',
        'outputs': [   {   'components': [   {'internalType': 'address', 'name': 'accessedBy', 'type': 'address'},
                                             {'internalType': 'string', 'name': 'action', 'type': 'string'},
                                             {'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
                           'internalType': 'struct EvidenceChain.AccessRecord[]',
                           'name': '',
                           'type': 'tuple[]'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [],
        'name': 'getAdminAuditHistory',
        'outputs': [   {   'components': [   {'internalType': 'address', 'name': 'admin', 'type': 'address'},
                                             {'internalType': 'address', 'name': 'targetMember', 'type': 'address'},
                                             {'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                                             {'internalType': 'string', 'name': 'permissionType', 'type': 'string'},
                                             {'internalType': 'string', 'name': 'action', 'type': 'string'},
                                             {'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
                           'internalType': 'struct EvidenceChain.AdminAuditRecord[]',
                           'name': '',
                           'type': 'tuple[]'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [],
        'name': 'getAdminAuditHistoryCount',
        'outputs': [{'internalType': 'uint256', 'name': '', 'type': 'uint256'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [],
        'name': 'getDepartmentMembers',
        'outputs': [   {   'components': [   {'internalType': 'address', 'name': 'walletAddress', 'type': 'address'},
                                             {'internalType': 'string', 'name': 'name', 'type': 'string'},
                                             {'internalType': 'string', 'name': 'role', 'type': 'string'},
                                             {'internalType': 'string', 'name': 'departmentId', 'type': 'string'},
                                             {'internalType': 'bool', 'name': 'isActive', 'type': 'bool'},
                                             {'internalType': 'uint256', 'name': 'registeredAt', 'type': 'uint256'}],
                           'internalType': 'struct EvidenceChain.DepartmentMember[]',
                           'name': '',
                           'type': 'tuple[]'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [],
        'name': 'getDepartmentMembersCount',
        'outputs': [{'internalType': 'uint256', 'name': '', 'type': 'uint256'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [{'internalType': 'string', 'name': '_evidenceId', 'type': 'string'}],
        'name': 'getEvidence',
        'outputs': [   {   'components': [   {'internalType': 'string', 'name': 'evidenceId', 'type': 'string'},
                                             {'internalType': 'string', 'name': 'caseId', 'type': 'string'},
                                             {'internalType': 'string', 'name': 'evidenceHash', 'type': 'string'},
                                             {'internalType': 'address', 'name': 'registeredBy', 'type': 'address'},
                                             {'internalType': 'uint256', 'name': 'timestamp', 'type': 'uint256'}],
                           'internalType': 'struct EvidenceChain.Evidence',
                           'name': '',
                           'type': 'tuple'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '_evidenceId', 'type': 'string'},
                      {'internalType': 'address', 'name': '_user', 'type': 'address'}],
        'name': 'grantDownloadAccess',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '_evidenceId', 'type': 'string'},
                      {'internalType': 'address', 'name': '_user', 'type': 'address'}],
        'name': 'grantViewAccess',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'},
    {   'inputs': [],
        'name': 'headOfDepartment',
        'outputs': [{'internalType': 'address', 'name': '', 'type': 'address'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [{'internalType': 'address', 'name': '_account', 'type': 'address'}],
        'name': 'isHOD',
        'outputs': [{'internalType': 'bool', 'name': '', 'type': 'bool'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [{'internalType': 'uint256', 'name': '', 'type': 'uint256'}],
        'name': 'memberList',
        'outputs': [{'internalType': 'address', 'name': '', 'type': 'address'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '_evidenceId', 'type': 'string'},
                      {'internalType': 'string', 'name': '_action', 'type': 'string'}],
        'name': 'recordAccess',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'address', 'name': '_wallet', 'type': 'address'},
                      {'internalType': 'string', 'name': '_name', 'type': 'string'},
                      {'internalType': 'string', 'name': '_role', 'type': 'string'},
                      {'internalType': 'string', 'name': '_departmentId', 'type': 'string'}],
        'name': 'registerDepartmentMember',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '_evidenceId', 'type': 'string'},
                      {'internalType': 'string', 'name': '_caseId', 'type': 'string'},
                      {'internalType': 'string', 'name': '_evidenceHash', 'type': 'string'}],
        'name': 'registerEvidence',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '_evidenceId', 'type': 'string'},
                      {'internalType': 'address', 'name': '_user', 'type': 'address'}],
        'name': 'revokeDownloadAccess',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '_evidenceId', 'type': 'string'},
                      {'internalType': 'address', 'name': '_user', 'type': 'address'}],
        'name': 'revokeViewAccess',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'},
    {   'inputs': [{'internalType': 'address', 'name': '_newHOD', 'type': 'address'}],
        'name': 'setHeadOfDepartment',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'address', 'name': '_wallet', 'type': 'address'},
                      {'internalType': 'string', 'name': '_role', 'type': 'string'},
                      {'internalType': 'bool', 'name': '_isActive', 'type': 'bool'}],
        'name': 'updateDepartmentMember',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '_evidenceId', 'type': 'string'},
                      {'internalType': 'string', 'name': '_currentHash', 'type': 'string'}],
        'name': 'verifyEvidence',
        'outputs': [{'internalType': 'bool', 'name': '', 'type': 'bool'}],
        'stateMutability': 'view',
        'type': 'function'},
    {   'inputs': [   {'internalType': 'string', 'name': '', 'type': 'string'},
                      {'internalType': 'address', 'name': '', 'type': 'address'}],
        'name': 'viewAccess',
        'outputs': [{'internalType': 'bool', 'name': '', 'type': 'bool'}],
        'stateMutability': 'view',
        'type': 'function'}]


# ============================================================
# CONNECT TO HARDHAT
# ============================================================

def connect_to_blockchain():

    active_rpc = get_rpc_url()
    active_contract = get_contract_address()

    print("==========================================")
    print("Connecting to EvidenceChain blockchain...")
    print("RPC:", active_rpc)
    print("Contract:", active_contract)

    web3 = Web3(Web3.HTTPProvider(active_rpc))

    if not web3.is_connected():
        raise ConnectionError(
            f"Could not connect to Consensus Node at {active_rpc}"
        )

    print("Hardhat RPC connection: OK")

    chain_id = web3.eth.chain_id

    print("Chain ID:", chain_id)

    if chain_id != EXPECTED_CHAIN_ID:
        raise ConnectionError(
            f"Wrong blockchain network. "
            f"Expected chain ID {EXPECTED_CHAIN_ID}, "
            f"received {chain_id}"
        )

    checksum_address = Web3.to_checksum_address(
        active_contract
    )

    contract_code = web3.eth.get_code(
        checksum_address
    )

    if contract_code in (b"", b"0x"):
        raise ConnectionError(
            "No smart contract found at "
            f"{checksum_address}"
        )

    print("Smart contract detected.")

    contract = web3.eth.contract(
        address=checksum_address,
        abi=get_contract_abi()
    )

    print("EvidenceChain contract connected.")
    print("==========================================")

    return web3, contract


# ============================================================
# REGISTER EVIDENCE
# ============================================================

def register_evidence(
    evidence_id,
    case_id,
    evidence_hash
):
    verify_mutation_isolation()

    web3, contract = connect_to_blockchain()

    accounts = web3.eth.accounts

    if len(accounts) == 0:
        raise ConnectionError(
            "No blockchain accounts available."
        )

    sender = accounts[0]

    transaction_hash = contract.functions.registerEvidence(
        str(evidence_id),
        str(case_id),
        str(evidence_hash)
    ).transact({
        "from": sender
    })

    receipt = web3.eth.wait_for_transaction_receipt(
        transaction_hash
    )

    return {
        "transactionHash": transaction_hash.hex(),
        "blockNumber": receipt["blockNumber"],
        "registeredBy": sender
    }


# ============================================================
# GET EVIDENCE & ON-CHAIN VERIFICATION
# ============================================================

def is_evidence_on_chain(evidence_id):
    """
    Check if an evidence record is anchored on the active blockchain ledger.
    """
    try:
        web3, contract = connect_to_blockchain()
        result = contract.functions.getEvidence(str(evidence_id)).call()
        return len(result[0]) > 0
    except Exception:
        return False


def get_evidence(evidence_id):
    """
    Retrieve on-chain evidence record or return None if unanchored.
    """
    try:
        web3, contract = connect_to_blockchain()

        result = contract.functions.getEvidence(
            str(evidence_id)
        ).call()

        if not result[0] or len(result[0]) == 0:
            return None

        return {
            "evidenceId": result[0],
            "caseId": result[1],
            "evidenceHash": result[2],
            "registeredBy": result[3],
            "timestamp": str(result[4])
        }
    except Exception as e:
        if "Evidence does not exist" in str(e):
            return None
        raise LedgerExecutionError(extract_clean_error(e))


def audit_evidence_ledger_status(evidence_id, db_hash=None, registration_tx_hash=None, blockchain_evidence_id=None, web3=None, contract=None):
    """
    Authoritative evaluation of an evidence record's ledger status.
    Reliably distinguishes:
    - VERIFIED_ACTIVE: Record verified on active connected Hardhat ledger
    - HISTORICAL_RECORD: Past registration in SQLite, but not on current ephemeral ledger session
    - PENDING_VERIFICATION: Registered in SQLite, awaiting initial ledger anchoring
    - VERIFICATION_UNAVAILABLE: Blockchain consensus node or smart contract offline
    """
    try:
        if web3 is None or contract is None:
            web3, contract = connect_to_blockchain()
        if not web3 or not web3.is_connected():
            return {
                "status": "VERIFICATION_UNAVAILABLE",
                "label": "Verification Unavailable",
                "isOnChain": False,
                "isHistorical": bool(registration_tx_hash or blockchain_evidence_id),
                "activeChainId": EXPECTED_CHAIN_ID,
                "contractAddress": CONTRACT_ADDRESS,
                "onChainHash": None,
                "hashMatches": None
            }

        checksum_addr = Web3.to_checksum_address(CONTRACT_ADDRESS)
        code = web3.eth.get_code(checksum_addr)
        if code in (b"", b"0x"):
            return {
                "status": "VERIFICATION_UNAVAILABLE",
                "label": "Verification Unavailable",
                "isOnChain": False,
                "isHistorical": bool(registration_tx_hash or blockchain_evidence_id),
                "activeChainId": EXPECTED_CHAIN_ID,
                "contractAddress": CONTRACT_ADDRESS,
                "onChainHash": None,
                "hashMatches": None
            }

        res = contract.functions.getEvidence(str(evidence_id)).call()
        on_chain_id = res[0]
        on_chain_hash = res[2]

        if on_chain_id and len(on_chain_id) > 0:
            hash_matches = (on_chain_hash.lower() == db_hash.lower()) if db_hash else True
            return {
                "status": "VERIFIED_ACTIVE",
                "label": "Verified on Active Ledger",
                "isOnChain": True,
                "isHistorical": False,
                "activeChainId": EXPECTED_CHAIN_ID,
                "contractAddress": CONTRACT_ADDRESS,
                "onChainHash": on_chain_hash,
                "hashMatches": hash_matches
            }
        else:
            is_hist = bool(registration_tx_hash or blockchain_evidence_id)
            return {
                "status": "HISTORICAL_RECORD" if is_hist else "NEVER_ANCHORED",
                "label": "Historical Ledger Record" if is_hist else "Never Anchored on Ledger",
                "isOnChain": False,
                "isHistorical": is_hist,
                "activeChainId": EXPECTED_CHAIN_ID,
                "contractAddress": CONTRACT_ADDRESS,
                "onChainHash": None,
                "hashMatches": None
            }
    except Exception as e:
        err_msg = str(e)
        if "Evidence does not exist" in err_msg or "execution reverted" in err_msg:
            is_hist = bool(registration_tx_hash or blockchain_evidence_id)
            return {
                "status": "HISTORICAL_RECORD" if is_hist else "NEVER_ANCHORED",
                "label": "Historical Ledger Record" if is_hist else "Never Anchored on Ledger",
                "isOnChain": False,
                "isHistorical": is_hist,
                "activeChainId": EXPECTED_CHAIN_ID,
                "contractAddress": CONTRACT_ADDRESS,
                "onChainHash": None,
                "hashMatches": None
            }
        return {
            "status": "VERIFICATION_UNAVAILABLE",
            "label": "Verification Unavailable",
            "isOnChain": False,
            "isHistorical": bool(registration_tx_hash or blockchain_evidence_id),
            "activeChainId": EXPECTED_CHAIN_ID,
            "contractAddress": CONTRACT_ADDRESS,
            "onChainHash": None,
            "hashMatches": None
        }


# ============================================================
# VERIFY EVIDENCE
# ============================================================

def verify_evidence(
    evidence_id,
    current_hash
):

    web3, contract = connect_to_blockchain()

    return contract.functions.verifyEvidence(
        str(evidence_id),
        str(current_hash)
    ).call()


# ============================================================
# HELPER - VALIDATE ADDRESS
# ============================================================

def validate_address(address):

    if not Web3.is_address(address):
        raise ValueError(
            "Invalid blockchain address."
        )

    return Web3.to_checksum_address(address)


# ============================================================
# CHECK VIEW ACCESS
# ============================================================

def can_view(
    evidence_id,
    user_address
):

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    # First verify evidence existence on the active contract
    try:
        ev = contract.functions.getEvidence(str(evidence_id)).call()
        if not ev[0] or len(ev[0]) == 0:
            raise EvidenceNotFoundError(
                f"Evidence record '{evidence_id}' is not registered on the active blockchain ledger."
            )
    except EvidenceNotFoundError:
        raise
    except Exception as e:
        if "Evidence does not exist" in str(e):
            raise EvidenceNotFoundError(
                f"Evidence record '{evidence_id}' is not registered on the active blockchain ledger."
            )
        raise LedgerExecutionError(extract_clean_error(e))

    try:
        return contract.functions.canView(
            str(evidence_id),
            user
        ).call()
    except ContractLogicError as cle:
        if "Evidence does not exist" in str(cle):
            raise EvidenceNotFoundError(
                f"Evidence record '{evidence_id}' is not registered on the active blockchain ledger."
            )
        raise LedgerExecutionError(extract_clean_error(cle))
    except Exception as e:
        raise LedgerExecutionError(extract_clean_error(e))


# ============================================================
# CHECK DOWNLOAD ACCESS
# ============================================================

def can_download(
    evidence_id,
    user_address
):

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    # First verify evidence existence on the active contract
    try:
        ev = contract.functions.getEvidence(str(evidence_id)).call()
        if not ev[0] or len(ev[0]) == 0:
            raise EvidenceNotFoundError(
                f"Evidence record '{evidence_id}' is not registered on the active blockchain ledger."
            )
    except EvidenceNotFoundError:
        raise
    except Exception as e:
        if "Evidence does not exist" in str(e):
            raise EvidenceNotFoundError(
                f"Evidence record '{evidence_id}' is not registered on the active blockchain ledger."
            )
        raise LedgerExecutionError(extract_clean_error(e))

    try:
        return contract.functions.canDownload(
            str(evidence_id),
            user
        ).call()
    except ContractLogicError as cle:
        if "Evidence does not exist" in str(cle):
            raise EvidenceNotFoundError(
                f"Evidence record '{evidence_id}' is not registered on the active blockchain ledger."
            )
        raise LedgerExecutionError(extract_clean_error(cle))
    except Exception as e:
        raise LedgerExecutionError(extract_clean_error(e))


# ============================================================
# GRANT VIEW ACCESS
# ============================================================

def grant_view_access(
    evidence_id,
    user_address,
    admin_address=None
):
    verify_mutation_isolation()

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    if not is_evidence_on_chain(evidence_id):
        raise EvidenceNotFoundError(
            f"Evidence record '{evidence_id}' is not registered on the active blockchain ledger."
        )

    if not admin_address:
        raise PermissionError(
            "Unauthorized: Admin blockchain address is required to execute permission grant."
        )

    hod_address = contract.functions.headOfDepartment().call()
    admin = validate_address(admin_address)
    if admin.lower() != hod_address.lower():
        raise PermissionError(
            "Unauthorized: Only Head of Department (HOD) can grant view permissions."
        )
    sender = admin

    try:
        transaction_hash = contract.functions.grantViewAccess(
            str(evidence_id),
            user
        ).transact({
            "from": sender
        })

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        return {
            "transactionHash": transaction_hash.hex(),
            "blockNumber": receipt["blockNumber"],
            "user": user,
            "admin": sender,
            "action": "VIEW_GRANTED"
        }
    except ContractLogicError as cle:
        raise LedgerExecutionError(extract_clean_error(cle))
    except Exception as e:
        raise LedgerExecutionError(extract_clean_error(e))


# ============================================================
# REVOKE VIEW ACCESS
# ============================================================

def revoke_view_access(
    evidence_id,
    user_address,
    admin_address=None
):
    verify_mutation_isolation()

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    if not is_evidence_on_chain(evidence_id):
        raise EvidenceNotFoundError(
            f"Evidence record '{evidence_id}' is not registered on the active blockchain ledger."
        )

    if not admin_address:
        raise PermissionError(
            "Unauthorized: Admin blockchain address is required to execute permission revocation."
        )

    hod_address = contract.functions.headOfDepartment().call()
    admin = validate_address(admin_address)
    if admin.lower() != hod_address.lower():
        raise PermissionError(
            "Unauthorized: Only Head of Department (HOD) can revoke view permissions."
        )
    sender = admin

    try:
        transaction_hash = contract.functions.revokeViewAccess(
            str(evidence_id),
            user
        ).transact({
            "from": sender
        })

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        return {
            "transactionHash": transaction_hash.hex(),
            "blockNumber": receipt["blockNumber"],
            "user": user,
            "admin": sender,
            "action": "VIEW_REVOKED"
        }
    except ContractLogicError as cle:
        raise LedgerExecutionError(extract_clean_error(cle))
    except Exception as e:
        raise LedgerExecutionError(extract_clean_error(e))


# ============================================================
# GRANT DOWNLOAD ACCESS
# ============================================================

def grant_download_access(
    evidence_id,
    user_address,
    admin_address=None
):
    verify_mutation_isolation()

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    if not is_evidence_on_chain(evidence_id):
        raise EvidenceNotFoundError(
            f"Evidence record '{evidence_id}' is not registered on the active blockchain ledger."
        )

    if not admin_address:
        raise PermissionError(
            "Unauthorized: Admin blockchain address is required to execute download permission grant."
        )

    hod_address = contract.functions.headOfDepartment().call()
    admin = validate_address(admin_address)
    if admin.lower() != hod_address.lower():
        raise PermissionError(
            "Unauthorized: Only Head of Department (HOD) can grant download permissions."
        )
    sender = admin

    try:
        transaction_hash = contract.functions.grantDownloadAccess(
            str(evidence_id),
            user
        ).transact({
            "from": sender
        })

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        return {
            "transactionHash": transaction_hash.hex(),
            "blockNumber": receipt["blockNumber"],
            "user": user,
            "admin": sender,
            "action": "DOWNLOAD_GRANTED"
        }
    except ContractLogicError as cle:
        raise LedgerExecutionError(extract_clean_error(cle))
    except Exception as e:
        raise LedgerExecutionError(extract_clean_error(e))


# ============================================================
# REVOKE DOWNLOAD ACCESS
# ============================================================

def revoke_download_access(
    evidence_id,
    user_address,
    admin_address=None
):
    verify_mutation_isolation()

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    if not is_evidence_on_chain(evidence_id):
        raise EvidenceNotFoundError(
            f"Evidence record '{evidence_id}' is not registered on the active blockchain ledger."
        )

    if not admin_address:
        raise PermissionError(
            "Unauthorized: Admin blockchain address is required to execute download permission revocation."
        )

    hod_address = contract.functions.headOfDepartment().call()
    admin = validate_address(admin_address)
    if admin.lower() != hod_address.lower():
        raise PermissionError(
            "Unauthorized: Only Head of Department (HOD) can revoke download permissions."
        )
    sender = admin

    try:
        transaction_hash = contract.functions.revokeDownloadAccess(
            str(evidence_id),
            user
        ).transact({
            "from": sender
        })

        receipt = web3.eth.wait_for_transaction_receipt(
            transaction_hash
        )

        return {
            "transactionHash": transaction_hash.hex(),
            "blockNumber": receipt["blockNumber"],
            "user": user,
            "admin": sender,
            "action": "DOWNLOAD_REVOKED"
        }
    except ContractLogicError as cle:
        raise LedgerExecutionError(extract_clean_error(cle))
    except Exception as e:
        raise LedgerExecutionError(extract_clean_error(e))


# ============================================================
# DEPARTMENT COMMAND & AUDIT HELPERS
# ============================================================

def get_head_of_department():
    web3, contract = connect_to_blockchain()
    return contract.functions.headOfDepartment().call()


def is_hod(user_address):
    if not user_address:
        return False
    try:
        user = validate_address(user_address)
        web3, contract = connect_to_blockchain()
        return contract.functions.isHOD(user).call()
    except Exception:
        return False


def get_department_members():
    web3, contract = connect_to_blockchain()
    members_raw = contract.functions.getDepartmentMembers().call()
    members = []
    for m in members_raw:
        members.append({
            "walletAddress": m[0],
            "name": m[1],
            "role": m[2],
            "departmentId": m[3],
            "isActive": bool(m[4]),
            "registeredAt": str(m[5])
        })
    return members


def get_admin_audit_history():
    web3, contract = connect_to_blockchain()
    history_raw = contract.functions.getAdminAuditHistory().call()
    history = []
    for r in history_raw:
        history.append({
            "admin": r[0],
            "targetMember": r[1],
            "evidenceId": r[2],
            "permissionType": r[3],
            "action": r[4],
            "timestamp": str(r[5])
        })
    return history


# ============================================================
# RECORD EVIDENCE ACCESS
# ============================================================

def record_access(
    evidence_id,
    action,
    user_address=None
):

    web3, contract = connect_to_blockchain()

    accounts = web3.eth.accounts

    if len(accounts) == 0:
        raise ConnectionError(
            "No blockchain accounts available."
        )

    action = str(action).upper()

    if action not in ["VIEW", "DOWNLOAD"]:
        raise ValueError(
            "Action must be VIEW or DOWNLOAD."
        )

    # For the local Hardhat demo, the node exposes test accounts
    # that can submit transactions directly.
    if user_address:
        user_address = validate_address(user_address)

        if user_address not in accounts:
            raise ValueError(
                "User wallet is not a configured local Hardhat account."
            )

        sender = user_address
    else:
        sender = accounts[0]

    transaction_hash = contract.functions.recordAccess(
        str(evidence_id),
        action
    ).transact({
        "from": sender
    })

    receipt = web3.eth.wait_for_transaction_receipt(
        transaction_hash
    )

    return {
        "transactionHash": transaction_hash.hex(),
        "blockNumber": receipt["blockNumber"],
        "accessedBy": sender,
        "action": action
    }


# ============================================================
# GET ACCESS HISTORY
# ============================================================

def get_access_history(evidence_id):

    web3, contract = connect_to_blockchain()

    result = contract.functions.getAccessHistory(
        str(evidence_id)
    ).call()

    history = []

    for record in result:

        history.append({
            "accessedBy": record[0],
            "action": record[1],
            "timestamp": str(record[2])
        })

    return history


# ============================================================
# BASIC BLOCKCHAIN TEST
# ============================================================

if __name__ == "__main__":

    print()
    print("EvidenceChain Backend Blockchain Test")
    print()

    try:

        print("Testing blockchain connection...")
        connect_to_blockchain()

        print()
        print("Blockchain integration test completed.")

    except Exception as error:

        print()
        print("ERROR:")
        print(error)