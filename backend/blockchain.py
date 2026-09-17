from web3 import Web3


# ============================================================
# BLOCKCHAIN CONFIGURATION
# ============================================================

RPC_URL = "http://127.0.0.1:8545"

CONTRACT_ADDRESS = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e"

EXPECTED_CHAIN_ID = 31337


# ============================================================
# SMART CONTRACT ABI
# ============================================================

CONTRACT_ABI = [
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
                    },
                    {
                        "internalType": "address",
                        "name": "currentCustodian",
                        "type": "address"
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

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            },
            {
                "internalType": "address",
                "name": "_newCustodian",
                "type": "address"
            }
        ],
        "name": "transferCustody",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            }
        ],
        "name": "recordAccess",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },

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
    },

    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_evidenceId",
                "type": "string"
            }
        ],
        "name": "getCustodyHistory",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "from",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "to",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "timestamp",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct EvidenceChain.CustodyTransfer[]",
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

    if not Web3.is_address(CONTRACT_ADDRESS):

        raise ValueError(
            "Invalid EvidenceChain contract address."
        )

    checksum_address = Web3.to_checksum_address(
        CONTRACT_ADDRESS
    )

    contract_code = web3.eth.get_code(
        checksum_address
    )

    if contract_code == b"" or contract_code == b"0x":

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
        "timestamp": str(result[4]),
        "currentCustodian": result[5]
    }


# ============================================================
# VERIFY EVIDENCE
# ============================================================

def verify_evidence(
    evidence_id,
    current_hash
):

    web3, contract = connect_to_blockchain()

    result = contract.functions.verifyEvidence(
        str(evidence_id),
        str(current_hash)
    ).call()

    return result


# ============================================================
# TRANSFER EVIDENCE CUSTODY
# ============================================================

def transfer_custody(
    evidence_id,
    new_custodian
):

    web3, contract = connect_to_blockchain()

    # --------------------------------------------------------
    # VALIDATE NEW CUSTODIAN ADDRESS
    # --------------------------------------------------------

    if not Web3.is_address(new_custodian):

        raise ValueError(
            "Invalid blockchain custodian address."
        )

    checksum_custodian = Web3.to_checksum_address(
        new_custodian
    )

    # --------------------------------------------------------
    # GET AVAILABLE HARDHAT ACCOUNTS
    # --------------------------------------------------------

    accounts = web3.eth.accounts

    if len(accounts) == 0:

        raise ConnectionError(
            "No blockchain accounts available."
        )

    # --------------------------------------------------------
    # READ CURRENT CUSTODIAN FROM BLOCKCHAIN
    # --------------------------------------------------------

    evidence = contract.functions.getEvidence(
        str(evidence_id)
    ).call()

    current_custodian = Web3.to_checksum_address(
        evidence[5]
    )

    # --------------------------------------------------------
    # FIND THE CURRENT CUSTODIAN AMONG LOCAL ACCOUNTS
    # --------------------------------------------------------

    sender = None

    for account in accounts:

        if (
            Web3.to_checksum_address(account)
            == current_custodian
        ):

            sender = account

            break

    if sender is None:

        raise PermissionError(
            "The current custodian is not available "
            "among the local blockchain accounts."
        )

    # --------------------------------------------------------
    # PREVENT TRANSFER TO SAME ADDRESS
    # --------------------------------------------------------

    if (
        Web3.to_checksum_address(sender)
        == checksum_custodian
    ):

        raise ValueError(
            "New custodian must be different "
            "from the current custodian."
        )

    # --------------------------------------------------------
    # TRANSFER CUSTODY ON BLOCKCHAIN
    # --------------------------------------------------------

    transaction_hash = contract.functions.transferCustody(
        str(evidence_id),
        checksum_custodian
    ).transact({
        "from": sender
    })

    # --------------------------------------------------------
    # WAIT FOR BLOCKCHAIN CONFIRMATION
    # --------------------------------------------------------

    receipt = web3.eth.wait_for_transaction_receipt(
        transaction_hash
    )

    # --------------------------------------------------------
    # RETURN TRANSACTION INFORMATION
    # --------------------------------------------------------

    return {

        "transactionHash":
            transaction_hash.hex(),

        "blockNumber":
            receipt["blockNumber"],

        "from":
            Web3.to_checksum_address(sender),

        "to":
            checksum_custodian
    }

# ============================================================
# RECORD EVIDENCE ACCESS
# ============================================================

def record_access(evidence_id):

    web3, contract = connect_to_blockchain()

    accounts = web3.eth.accounts

    if len(accounts) == 0:

        raise ConnectionError(
            "No blockchain accounts available."
        )

    sender = accounts[0]

    transaction_hash = contract.functions.recordAccess(
        str(evidence_id)
    ).transact({
        "from": sender
    })

    receipt = web3.eth.wait_for_transaction_receipt(
        transaction_hash
    )

    return {
        "transactionHash": transaction_hash.hex(),
        "blockNumber": receipt["blockNumber"],
        "accessedBy": sender
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
            "timestamp": str(record[1])
        })

    return history


# ============================================================
# GET CUSTODY HISTORY
# ============================================================

def get_custody_history(evidence_id):

    web3, contract = connect_to_blockchain()

    result = contract.functions.getCustodyHistory(
        str(evidence_id)
    ).call()

    history = []

    for record in result:

        history.append({
            "from": record[0],
            "to": record[1],
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

        test_id = "EVD-DB550B68"

        print("Testing blockchain connection...")
        connect_to_blockchain()

        print()
        print("Testing evidence lookup...")

        evidence = get_evidence(test_id)

        print("Evidence:")
        print(evidence)

        print()
        print("Testing access history...")

        access_history = get_access_history(test_id)

        print("Access History:")
        print(access_history)

        print()
        print("Testing custody history...")

        custody_history = get_custody_history(test_id)

        print("Custody History:")
        print(custody_history)

        print()
        print("Blockchain integration test completed.")

    except Exception as error:

        print()
        print("ERROR:")
        print(error)
