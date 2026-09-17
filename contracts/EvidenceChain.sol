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

    event ViewAccessGranted(
        string evidenceId,
        address user,
        address grantedBy,
        uint256 timestamp
    );

    event ViewAccessRevoked(
        string evidenceId,
        address user,
        address revokedBy,
        uint256 timestamp
    );

    event DownloadAccessGranted(
        string evidenceId,
        address user,
        address grantedBy,
        uint256 timestamp
    );

    event DownloadAccessRevoked(
        string evidenceId,
        address user,
        address revokedBy,
        uint256 timestamp
    );

    event EvidenceAccessed(
        string evidenceId,
        address accessedBy,
        string action,
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
    }

    struct AccessRecord {
        address accessedBy;
        string action;
        uint256 timestamp;
    }


    // ============================================================
    // STORAGE
    // ============================================================

    mapping(string => Evidence) public evidences;

    mapping(string => AccessRecord[]) public accessHistory;

    // View permission:
    // evidence ID => user address => permission
    mapping(string => mapping(address => bool)) public viewAccess;

    // Download permission:
    // evidence ID => user address => permission
    mapping(string => mapping(address => bool)) public downloadAccess;


    // ============================================================
    // MODIFIER
    // ============================================================

    modifier onlyEvidenceOwner(string memory _evidenceId) {
        require(
            bytes(evidences[_evidenceId].evidenceId).length > 0,
            "Evidence does not exist"
        );

        require(
            msg.sender == evidences[_evidenceId].registeredBy,
            "Only evidence owner can manage permissions"
        );

        _;
    }


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
            block.timestamp
        );

        // The person who registers the evidence automatically
        // receives both view and download permission.
        viewAccess[_evidenceId][msg.sender] = true;
        downloadAccess[_evidenceId][msg.sender] = true;

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
    // GRANT VIEW ACCESS
    // ============================================================

    function grantViewAccess(
        string memory _evidenceId,
        address _user
    )
        public
        onlyEvidenceOwner(_evidenceId)
    {
        require(
            _user != address(0),
            "Invalid user address"
        );

        viewAccess[_evidenceId][_user] = true;

        emit ViewAccessGranted(
            _evidenceId,
            _user,
            msg.sender,
            block.timestamp
        );
    }


    // ============================================================
    // REVOKE VIEW ACCESS
    // ============================================================

    function revokeViewAccess(
        string memory _evidenceId,
        address _user
    )
        public
        onlyEvidenceOwner(_evidenceId)
    {
        require(
            _user != address(0),
            "Invalid user address"
        );

        viewAccess[_evidenceId][_user] = false;

        emit ViewAccessRevoked(
            _evidenceId,
            _user,
            msg.sender,
            block.timestamp
        );
    }


    // ============================================================
    // GRANT DOWNLOAD ACCESS
    // ============================================================

    function grantDownloadAccess(
        string memory _evidenceId,
        address _user
    )
        public
        onlyEvidenceOwner(_evidenceId)
    {
        require(
            _user != address(0),
            "Invalid user address"
        );

        downloadAccess[_evidenceId][_user] = true;

        emit DownloadAccessGranted(
            _evidenceId,
            _user,
            msg.sender,
            block.timestamp
        );
    }


    // ============================================================
    // REVOKE DOWNLOAD ACCESS
    // ============================================================

    function revokeDownloadAccess(
        string memory _evidenceId,
        address _user
    )
        public
        onlyEvidenceOwner(_evidenceId)
    {
        require(
            _user != address(0),
            "Invalid user address"
        );

        downloadAccess[_evidenceId][_user] = false;

        emit DownloadAccessRevoked(
            _evidenceId,
            _user,
            msg.sender,
            block.timestamp
        );
    }


    // ============================================================
    // CHECK VIEW ACCESS
    // ============================================================

    function canView(
        string memory _evidenceId,
        address _user
    )
        public
        view
        returns (bool)
    {
        require(
            bytes(evidences[_evidenceId].evidenceId).length > 0,
            "Evidence does not exist"
        );

        return viewAccess[_evidenceId][_user];
    }


    // ============================================================
    // CHECK DOWNLOAD ACCESS
    // ============================================================

    function canDownload(
        string memory _evidenceId,
        address _user
    )
        public
        view
        returns (bool)
    {
        require(
            bytes(evidences[_evidenceId].evidenceId).length > 0,
            "Evidence does not exist"
        );

        return downloadAccess[_evidenceId][_user];
    }


    // ============================================================
    // RECORD EVIDENCE ACCESS
    // ============================================================

    function recordAccess(
        string memory _evidenceId,
        string memory _action
    )
        public
    {
        require(
            bytes(evidences[_evidenceId].evidenceId).length > 0,
            "Evidence does not exist"
        );

        require(
            keccak256(bytes(_action)) == keccak256(bytes("VIEW")) ||
            keccak256(bytes(_action)) == keccak256(bytes("DOWNLOAD")),
            "Invalid access action"
        );

        if (
            keccak256(bytes(_action)) ==
            keccak256(bytes("VIEW"))
        ) {
            require(
                viewAccess[_evidenceId][msg.sender],
                "View access denied"
            );
        }

        if (
            keccak256(bytes(_action)) ==
            keccak256(bytes("DOWNLOAD"))
        ) {
            require(
                downloadAccess[_evidenceId][msg.sender],
                "Download access denied"
            );
        }

        accessHistory[_evidenceId].push(
            AccessRecord(
                msg.sender,
                _action,
                block.timestamp
            )
        );

        emit EvidenceAccessed(
            _evidenceId,
            msg.sender,
            _action,
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
}