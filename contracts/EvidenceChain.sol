// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EvidenceChain {

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

    mapping(string => Evidence) public evidences;

    mapping(string => CustodyTransfer[]) public custodyHistory;

    function registerEvidence(
        string memory _evidenceId,
        string memory _caseId,
        string memory _evidenceHash
    ) public {
        require(
            bytes(evidences[_evidenceId].evidenceId).length == 0,
            "Evidence already exists"
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

    function getEvidence(string memory _evidenceId)
        public
        view
        returns (Evidence memory)
    {
        return evidences[_evidenceId];
    }

    function verifyEvidence(
        string memory _evidenceId,
        string memory _currentHash
    )
        public
        view
        returns (bool)
    {
        return keccak256(
            bytes(evidences[_evidenceId].evidenceHash)
        ) == keccak256(
            bytes(_currentHash)
        );
    }

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
}