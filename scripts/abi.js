module.exports = [
    

        {

            "anonymous": false,

            "inputs": [

                {

                    "indexed": false,

                    "internalType": "string",

                    "name": "evidenceId",

                    "type": "string"

                },

                {

                    "indexed": false,

                    "internalType": "address",

                    "name": "from",

                    "type": "address"

                },

                {

                    "indexed": false,

                    "internalType": "address",

                    "name": "to",

                    "type": "address"

                },

                {

                    "indexed": false,

                    "internalType": "uint256",

                    "name": "timestamp",

                    "type": "uint256"

                }

            ],

            "name": "CustodyTransferred",

            "type": "event"

        },

        {

            "anonymous": false,

            "inputs": [

                {

                    "indexed": false,

                    "internalType": "string",

                    "name": "evidenceId",

                    "type": "string"

                },

                {

                    "indexed": false,

                    "internalType": "string",

                    "name": "caseId",

                    "type": "string"

                },

                {

                    "indexed": false,

                    "internalType": "string",

                    "name": "evidenceHash",

                    "type": "string"

                },

                {

                    "indexed": false,

                    "internalType": "address",

                    "name": "registeredBy",

                    "type": "address"

                },

                {

                    "indexed": false,

                    "internalType": "uint256",

                    "name": "timestamp",

                    "type": "uint256"

                }

            ],

            "name": "EvidenceRegistered",

            "type": "event"

        },

        {

            "inputs": [

                {

                    "internalType": "string",

                    "name": "",

                    "type": "string"

                },

                {

                    "internalType": "uint256",

                    "name": "",

                    "type": "uint256"

                }

            ],

            "name": "custodyHistory",

            "outputs": [

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

            "stateMutability": "view",

            "type": "function"

        },

        {

            "inputs": [

                {

                    "internalType": "string",

                    "name": "",

                    "type": "string"

                }

            ],

            "name": "evidences",

            "outputs": [

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

        }

    
];