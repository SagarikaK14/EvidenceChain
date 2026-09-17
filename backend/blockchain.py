from web3 import Web3


# ============================================================
# BLOCKCHAIN CONFIGURATION
# ============================================================

RPC_URL = "http://127.0.0.1:8545"

CONTRACT_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"

EXPECTED_CHAIN_ID = 31337


# ============================================================
# SMART CONTRACT ABI
# ============================================================

CONTRACT_ABI = [

    # --------------------------------------------------------
    # REGISTER EVIDENCE
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_caseId",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_evidenceHash",
                "type": "string"
            }
        ],
        "name": "registerEvidence",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },

    # --------------------------------------------------------
    # GET EVIDENCE
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            }
        ],
        "name": "getEvidence",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "string",
                        "name": "evidenceId",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "caseId",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "evidenceHash",
                        "type": "string"
                    },
                    {
                        "internalType": "address",
                        "name": "registeredBy",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "timestamp",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct EvidenceChain.Evidence",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },

    # --------------------------------------------------------
    # VERIFY EVIDENCE
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_currentHash",
                "type": "string"
            }
        ],
        "name": "verifyEvidence",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },

    # --------------------------------------------------------
    # VIEW ACCESS
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "viewAccess",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "canView",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },

    # --------------------------------------------------------
    # DOWNLOAD ACCESS
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "downloadAccess",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "canDownload",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },

    # --------------------------------------------------------
    # GRANT VIEW ACCESS
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "grantViewAccess",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },

    # --------------------------------------------------------
    # REVOKE VIEW ACCESS
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "revokeViewAccess",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },

    # --------------------------------------------------------
    # GRANT DOWNLOAD ACCESS
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "grantDownloadAccess",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },

    # --------------------------------------------------------
    # REVOKE DOWNLOAD ACCESS
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "revokeDownloadAccess",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },

    # --------------------------------------------------------
    # RECORD ACCESS
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_action",
                "type": "string"
            }
        ],
        "name": "recordAccess",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },

    # --------------------------------------------------------
    # GET ACCESS HISTORY
    # --------------------------------------------------------

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            }
        ],
        "name": "getAccessHistory",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "accessedBy",
                        "type": "address"
                    },
                    {
                        "internalType": "string",
                        "name": "action",
                        "type": "string"
                    },
                    {
                        "internalType": "uint256",
                        "name": "timestamp",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct EvidenceChain.AccessRecord[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]


# ============================================================
# CONNECT TO HARDHAT
# ============================================================

def connect_to_blockchain():

    print("==========================================")
    print("Connecting to EvidenceChain blockchain...")
    print("RPC:", RPC_URL)
    print("Contract:", CONTRACT_ADDRESS)

    web3 = Web3(Web3.HTTPProvider(RPC_URL))

    if not web3.is_connected():
        raise ConnectionError(
            "Could not connect to Hardhat at "
            "http://127.0.0.1:8545"
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
        CONTRACT_ADDRESS
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
        abi=CONTRACT_ABI
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
# GET EVIDENCE
# ============================================================

def get_evidence(evidence_id):

    web3, contract = connect_to_blockchain()

    result = contract.functions.getEvidence(
        str(evidence_id)
    ).call()

    return {
        "evidenceId": result[0],
        "caseId": result[1],
        "evidenceHash": result[2],
        "registeredBy": result[3],
        "timestamp": str(result[4])
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

    return contract.functions.canView(
        str(evidence_id),
        user
    ).call()


# ============================================================
# CHECK DOWNLOAD ACCESS
# ============================================================

def can_download(
    evidence_id,
    user_address
):

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    return contract.functions.canDownload(
        str(evidence_id),
        user
    ).call()


# ============================================================
# GRANT VIEW ACCESS
# ============================================================

def grant_view_access(
    evidence_id,
    user_address
):

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    accounts = web3.eth.accounts

    if len(accounts) == 0:
        raise ConnectionError(
            "No blockchain accounts available."
        )

    sender = accounts[0]

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
        "action": "VIEW_GRANTED"
    }


# ============================================================
# REVOKE VIEW ACCESS
# ============================================================

def revoke_view_access(
    evidence_id,
    user_address
):

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    accounts = web3.eth.accounts

    if len(accounts) == 0:
        raise ConnectionError(
            "No blockchain accounts available."
        )

    sender = accounts[0]

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
        "action": "VIEW_REVOKED"
    }


# ============================================================
# GRANT DOWNLOAD ACCESS
# ============================================================

def grant_download_access(
    evidence_id,
    user_address
):

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    accounts = web3.eth.accounts

    if len(accounts) == 0:
        raise ConnectionError(
            "No blockchain accounts available."
        )

    sender = accounts[0]

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
        "action": "DOWNLOAD_GRANTED"
    }


# ============================================================
# REVOKE DOWNLOAD ACCESS
# ============================================================

def revoke_download_access(
    evidence_id,
    user_address
):

    web3, contract = connect_to_blockchain()

    user = validate_address(user_address)

    accounts = web3.eth.accounts

    if len(accounts) == 0:
        raise ConnectionError(
            "No blockchain accounts available."
        )

    sender = accounts[0]

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
        "action": "DOWNLOAD_REVOKED"
    }


# ============================================================
# RECORD EVIDENCE ACCESS
# ============================================================

def record_access(
    evidence_id,
    action
):

    web3, contract = connect_to_blockchain()

    accounts = web3.eth.accounts

    if len(accounts) == 0:
        raise ConnectionError(
            "No blockchain accounts available."
        )

    sender = accounts[0]

    action = str(action).upper()

    if action not in ["VIEW", "DOWNLOAD"]:
        raise ValueError(
            "Action must be VIEW or DOWNLOAD."
        )

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