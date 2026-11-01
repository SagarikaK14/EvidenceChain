// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EvidenceChain
 * @notice Blockchain-based digital evidence management with HOD-governed role-based access control.
 * @dev Enforces Head of Department (HOD) authority over independent VIEW and DOWNLOAD permissions.
 */
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

    event HODUpdated(
        address indexed previousHOD,
        address indexed newHOD,
        uint256 timestamp
    );

    event DepartmentMemberRegistered(
        address indexed wallet,
        string name,
        string role,
        string departmentId,
        uint256 timestamp
    );

    event DepartmentMemberUpdated(
        address indexed wallet,
        string role,
        bool isActive,
        uint256 timestamp
    );

    event AdminPermissionAudit(
        address indexed admin,
        address indexed targetMember,
        string evidenceId,
        string permissionType,
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

    struct DepartmentMember {
        address walletAddress;
        string name;
        string role;
        string departmentId;
        bool isActive;
        uint256 registeredAt;
    }

    struct AdminAuditRecord {
        address admin;
        address targetMember;
        string evidenceId;
        string permissionType; // "VIEW" or "DOWNLOAD"
        string action;         // "GRANT" or "REVOKE"
        uint256 timestamp;
    }


    // ============================================================
    // STORAGE
    // ============================================================

    address public headOfDepartment;

    mapping(string => Evidence) public evidences;
    mapping(string => AccessRecord[]) public accessHistory;

    // View permission: evidence ID => user address => permission
    mapping(string => mapping(address => bool)) public viewAccess;

    // Download permission: evidence ID => user address => permission
    mapping(string => mapping(address => bool)) public downloadAccess;

    // Department personnel directory
    mapping(address => DepartmentMember) public departmentMembers;
    address[] public memberList;

    // Immutable on-chain administrative audit trail
    AdminAuditRecord[] public adminAuditHistory;


    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier onlyHOD() {
        require(
            msg.sender == headOfDepartment,
            "Unauthorized: Only Head of Department (HOD) can perform this action"
        );
        _;
    }

    modifier onlyAuthorizedPermissionAdmin(string memory _evidenceId) {
        require(
            bytes(evidences[_evidenceId].evidenceId).length > 0,
            "Evidence does not exist"
        );
        require(
            msg.sender == headOfDepartment,
            "Unauthorized: Only Head of Department (HOD) can manage evidence permissions"
        );
        _;
    }


    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor() {
        headOfDepartment = msg.sender;

        // Register deployer as Head of Department
        _registerMember(
            msg.sender,
            "Dr. Rajeshwar Sen",
            "Head of Department",
            "DEPT-FORENSICS-HQ"
        );

        // Pre-register default department members
        _registerMember(
            0x70997970C51812dc3A010C7d01b50e0d17dc79C8,
            "Rahul Sharma",
            "Forensic Investigator",
            "DEPT-CYBER-CRIME"
        );

        _registerMember(
            0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,
            "Ananya Patel",
            "Forensic Analyst",
            "DEPT-DIGITAL-REVIEW"
        );

        _registerMember(
            0x90F79bf6EB2c4f870365E785982E1f101E93b906,
            "Vikram Mehta",
            "External Examiner",
            "DEPT-JUDICIAL-COMMISSION"
        );

        _registerMember(
            0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65,
            "Sunita Rao",
            "Other Department Member",
            "DEPT-EVIDENCE-VAULT"
        );

        _registerMember(
            0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc,
            "Amit Verma",
            "Other Department Member",
            "DEPT-FIELD-OPS"
        );
    }

    function _registerMember(
        address _wallet,
        string memory _name,
        string memory _role,
        string memory _deptId
    ) internal {
        if (departmentMembers[_wallet].walletAddress == address(0)) {
            memberList.push(_wallet);
        }
        departmentMembers[_wallet] = DepartmentMember({
            walletAddress: _wallet,
            name: _name,
            role: _role,
            departmentId: _deptId,
            isActive: true,
            registeredAt: block.timestamp
        });
        emit DepartmentMemberRegistered(_wallet, _name, _role, _deptId, block.timestamp);
    }


    // ============================================================
    // HOD & DEPARTMENT MANAGEMENT
    // ============================================================

    function setHeadOfDepartment(address _newHOD) public onlyHOD {
        require(_newHOD != address(0), "Invalid HOD address");
        address previous = headOfDepartment;
        headOfDepartment = _newHOD;

        // Ensure new HOD is registered in department directory
        if (departmentMembers[_newHOD].walletAddress == address(0)) {
            _registerMember(_newHOD, "Head of Department", "Head of Department", "DEPT-FORENSICS-HQ");
        } else {
            departmentMembers[_newHOD].role = "Head of Department";
            departmentMembers[_newHOD].isActive = true;
        }

        emit HODUpdated(previous, _newHOD, block.timestamp);
    }

    function isHOD(address _account) public view returns (bool) {
        return _account == headOfDepartment;
    }

    function registerDepartmentMember(
        address _wallet,
        string memory _name,
        string memory _role,
        string memory _departmentId
    ) public onlyHOD {
        require(_wallet != address(0), "Invalid wallet address");
        _registerMember(_wallet, _name, _role, _departmentId);
    }

    function updateDepartmentMember(
        address _wallet,
        string memory _role,
        bool _isActive
    ) public onlyHOD {
        require(departmentMembers[_wallet].walletAddress != address(0), "Member not registered");
        departmentMembers[_wallet].role = _role;
        departmentMembers[_wallet].isActive = _isActive;
        emit DepartmentMemberUpdated(_wallet, _role, _isActive, block.timestamp);
    }

    function getDepartmentMembers() public view returns (DepartmentMember[] memory) {
        DepartmentMember[] memory members = new DepartmentMember[](memberList.length);
        for (uint256 i = 0; i < memberList.length; i++) {
            members[i] = departmentMembers[memberList[i]];
        }
        return members;
    }

    function getDepartmentMembersCount() public view returns (uint256) {
        return memberList.length;
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
        require(bytes(_evidenceId).length > 0, "Evidence ID required");
        require(bytes(_caseId).length > 0, "Case ID required");
        require(bytes(_evidenceHash).length > 0, "Evidence hash required");

        evidences[_evidenceId] = Evidence(
            _evidenceId,
            _caseId,
            _evidenceHash,
            msg.sender,
            block.timestamp
        );

        // Registering officer automatically receives VIEW and DOWNLOAD permission.
        viewAccess[_evidenceId][msg.sender] = true;
        downloadAccess[_evidenceId][msg.sender] = true;

        // Head of Department also retains supervisory VIEW and DOWNLOAD permissions.
        if (msg.sender != headOfDepartment) {
            viewAccess[_evidenceId][headOfDepartment] = true;
            downloadAccess[_evidenceId][headOfDepartment] = true;
        }

        emit EvidenceRegistered(
            _evidenceId,
            _caseId,
            _evidenceHash,
            msg.sender,
            block.timestamp
        );
    }


    // ============================================================
    // GET EVIDENCE & VERIFY EVIDENCE
    // ============================================================

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
    // HOD ACCESS MANAGEMENT (VIEW PERMISSIONS)
    // ============================================================

    function grantViewAccess(
        string memory _evidenceId,
        address _user
    )
        public
        onlyAuthorizedPermissionAdmin(_evidenceId)
    {
        require(_user != address(0), "Invalid user address");

        viewAccess[_evidenceId][_user] = true;

        adminAuditHistory.push(
            AdminAuditRecord(
                msg.sender,
                _user,
                _evidenceId,
                "VIEW",
                "GRANT",
                block.timestamp
            )
        );

        emit ViewAccessGranted(
            _evidenceId,
            _user,
            msg.sender,
            block.timestamp
        );

        emit AdminPermissionAudit(
            msg.sender,
            _user,
            _evidenceId,
            "VIEW",
            "GRANT",
            block.timestamp
        );
    }

    function revokeViewAccess(
        string memory _evidenceId,
        address _user
    )
        public
        onlyAuthorizedPermissionAdmin(_evidenceId)
    {
        require(_user != address(0), "Invalid user address");

        viewAccess[_evidenceId][_user] = false;

        adminAuditHistory.push(
            AdminAuditRecord(
                msg.sender,
                _user,
                _evidenceId,
                "VIEW",
                "REVOKE",
                block.timestamp
            )
        );

        emit ViewAccessRevoked(
            _evidenceId,
            _user,
            msg.sender,
            block.timestamp
        );

        emit AdminPermissionAudit(
            msg.sender,
            _user,
            _evidenceId,
            "VIEW",
            "REVOKE",
            block.timestamp
        );
    }


    // ============================================================
    // HOD ACCESS MANAGEMENT (DOWNLOAD PERMISSIONS)
    // ============================================================

    function grantDownloadAccess(
        string memory _evidenceId,
        address _user
    )
        public
        onlyAuthorizedPermissionAdmin(_evidenceId)
    {
        require(_user != address(0), "Invalid user address");

        downloadAccess[_evidenceId][_user] = true;

        adminAuditHistory.push(
            AdminAuditRecord(
                msg.sender,
                _user,
                _evidenceId,
                "DOWNLOAD",
                "GRANT",
                block.timestamp
            )
        );

        emit DownloadAccessGranted(
            _evidenceId,
            _user,
            msg.sender,
            block.timestamp
        );

        emit AdminPermissionAudit(
            msg.sender,
            _user,
            _evidenceId,
            "DOWNLOAD",
            "GRANT",
            block.timestamp
        );
    }

    function revokeDownloadAccess(
        string memory _evidenceId,
        address _user
    )
        public
        onlyAuthorizedPermissionAdmin(_evidenceId)
    {
        require(_user != address(0), "Invalid user address");

        downloadAccess[_evidenceId][_user] = false;

        adminAuditHistory.push(
            AdminAuditRecord(
                msg.sender,
                _user,
                _evidenceId,
                "DOWNLOAD",
                "REVOKE",
                block.timestamp
            )
        );

        emit DownloadAccessRevoked(
            _evidenceId,
            _user,
            msg.sender,
            block.timestamp
        );

        emit AdminPermissionAudit(
            msg.sender,
            _user,
            _evidenceId,
            "DOWNLOAD",
            "REVOKE",
            block.timestamp
        );
    }


    // ============================================================
    // PERMISSION CHECKERS
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
    // RECORD EVIDENCE ACCESS & HISTORY
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

        if (keccak256(bytes(_action)) == keccak256(bytes("VIEW"))) {
            require(viewAccess[_evidenceId][msg.sender], "View access denied");
        }

        if (keccak256(bytes(_action)) == keccak256(bytes("DOWNLOAD"))) {
            require(downloadAccess[_evidenceId][msg.sender], "Download access denied");
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
    // ADMINISTRATIVE AUDIT TRAIL
    // ============================================================

    function getAdminAuditHistory()
        public
        view
        returns (AdminAuditRecord[] memory)
    {
        return adminAuditHistory;
    }

    function getAdminAuditHistoryCount()
        public
        view
        returns (uint256)
    {
        return adminAuditHistory.length;
    }
}