// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EvidenceChain {

    // ============================================================
    // EVENTS
    // ============================================================

    event EvidenceRegistered(
        string evidenceId,
        string caseId,
        string evidenceHash,
        address registeredBy,
        uint256 timestamp
    );

    event CustodyTransferred(
        string evidenceId,
        address from,
        address to,
        uint256 timestamp
    );

    event EvidenceAccessed(
        string evidenceId,
        address accessedBy,
        uint256 timestamp
    );


    // ============================================================
    // STRUCTS
    // ============================================================

    struct Evidence {
        string evidenceId;
        string caseId;
        string evidenceHash;
        address registeredBy;
        uint256 timestamp;
        address currentCustodian;
    }

    struct CustodyTransfer {
        address from;
        address to;
        uint256 timestamp;
    }

    struct AccessRecord {
        address accessedBy;
        uint256 timestamp;
    }


    // ============================================================
    // STORAGE
    // ============================================================

    mapping(string => Evidence) public evidences;

    mapping(string => CustodyTransfer[]) public custodyHistory;

    mapping(string => AccessRecord[]) public accessHistory;


    // ============================================================
    // REGISTER EVIDENCE
    // ============================================================

    function registerEvidence(
        string memory _evidenceId,
        string memory _caseId,
        string memory _evidenceHash
    ) public {

        require(
            bytes(evidences[_evidenceId].evidenceId).length == 0,
            "Evidence already exists"
        );

        require(
            bytes(_evidenceId).length > 0,
            "Evidence ID required"
        );

        require(
            bytes(_caseId).length > 0,
            "Case ID required"
        );

        require(
            bytes(_evidenceHash).length > 0,
            "Evidence hash required"
        );

        evidences[_evidenceId] = Evidence(
            _evidenceId,
            _caseId,
            _evidenceHash,
            msg.sender,
            block.timestamp,
            msg.sender
        );

        emit EvidenceRegistered(
            _evidenceId,
            _caseId,
            _evidenceHash,
            msg.sender,
            block.timestamp
        );
    }


    // ============================================================
    // GET EVIDENCE
    // ============================================================

    function getEvidence(string memory _evidenceId)
        public
        view
        returns (Evidence memory)
    {
        return evidences[_evidenceId];
    }


    // ============================================================
    // VERIFY EVIDENCE
    // ============================================================

    function verifyEvidence(
        string memory _evidenceId,
        string memory _currentHash
    )
        public
        view
        returns (bool)
    {
        require(
            bytes(evidences[_evidenceId].evidenceId).length > 0,
            "Evidence does not exist"
        );

        return keccak256(
            bytes(evidences[_evidenceId].evidenceHash)
        ) == keccak256(
            bytes(_currentHash)
        );
    }


    // ============================================================
    // TRANSFER CUSTODY
    // ============================================================

    function transferCustody(
        string memory _evidenceId,
        address _newCustodian
    )
        public
    {
        require(
            bytes(evidences[_evidenceId].evidenceId).length > 0,
            "Evidence does not exist"
        );

        require(
            msg.sender == evidences[_evidenceId].currentCustodian,
            "Only current custodian can transfer"
        );

        require(
            _newCustodian != address(0),
            "Invalid custodian address"
        );

        require(
            _newCustodian != msg.sender,
            "Already the current custodian"
        );

        custodyHistory[_evidenceId].push(
            CustodyTransfer(
                msg.sender,
                _newCustodian,
                block.timestamp
            )
        );

        emit CustodyTransferred(
            _evidenceId,
            msg.sender,
            _newCustodian,
            block.timestamp
        );

        evidences[_evidenceId].currentCustodian = _newCustodian;
    }


    // ============================================================
    // RECORD EVIDENCE ACCESS
    // ============================================================

    function recordAccess(
        string memory _evidenceId
    )
        public
    {
        require(
            bytes(evidences[_evidenceId].evidenceId).length > 0,
            "Evidence does not exist"
        );

        accessHistory[_evidenceId].push(
            AccessRecord(
                msg.sender,
                block.timestamp
            )
        );

        emit EvidenceAccessed(
            _evidenceId,
            msg.sender,
            block.timestamp
        );
    }


    // ============================================================
    // GET ACCESS HISTORY
    // ============================================================

    function getAccessHistory(
        string memory _evidenceId
    )
        public
        view
        returns (AccessRecord[] memory)
    {
        return accessHistory[_evidenceId];
    }


    // ============================================================
    // GET CUSTODY HISTORY
    // ============================================================

    function getCustodyHistory(
        string memory _evidenceId
    )
        public
        view
        returns (CustodyTransfer[] memory)
    {
        return custodyHistory[_evidenceId];
    }
}