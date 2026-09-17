from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import hashlib
import uuid

from blockchain import (
    get_evidence,
    register_evidence,
    verify_evidence,
    transfer_custody,
    record_access,
    get_access_history,
    get_custody_history
)

from database.db import (
    get_db,
    save_evidence,
    update_custodian
)


# ============================================================
# APP CONFIGURATION
# ============================================================

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.path.join(
    BASE_DIR,
    "uploads"
)

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def calculate_sha256(file_path):
    """
    Calculate SHA-256 hash of a file.
    """

    sha256 = hashlib.sha256()

    with open(file_path, "rb") as file:

        while True:

            chunk = file.read(8192)

            if not chunk:
                break

            sha256.update(chunk)

    return sha256.hexdigest()


def generate_evidence_id():
    """
    Generate a unique EvidenceChain evidence ID.
    """

    return (
        "EVD-"
        + uuid.uuid4().hex[:8].upper()
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route(
    "/api/health",
    methods=["GET"]
)
def health():

    return jsonify({

        "status": "ok",

        "service": (
            "EvidenceChain Backend"
        )
    })


# ============================================================
# GET EVIDENCE
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>",
    methods=["GET"]
)
def get_evidence_route(evidence_id):

    try:

        # ----------------------------------------------------
        # GET BLOCKCHAIN DATA
        # ----------------------------------------------------

        blockchain_data = get_evidence(
            evidence_id
        )

        if not blockchain_data:

            return jsonify({

                "status": "error",

                "message": (
                    "Evidence not found "
                    "on blockchain."
                )
            }), 404

        # ----------------------------------------------------
        # GET DATABASE DATA
        # ----------------------------------------------------

        connection = get_db()

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                evidence_id,
                case_id,
                title,
                description,
                file_path,
                sha256_hash,
                registered_by,
                blockchain_evidence_id,
                registration_tx_hash,
                current_custodian
            FROM evidence
            WHERE evidence_id = ?
            """,
            (evidence_id,)
        )

        row = cursor.fetchone()

        connection.close()

        database_data = None

        if row:

            database_data = {

                "evidenceId": row[0],

                "caseId": row[1],

                "title": row[2],

                "description": row[3],

                "filePath": row[4],

                "sha256Hash": row[5],

                "registeredBy": row[6],

                "blockchainEvidenceId": row[7],

                "registrationTxHash": row[8],

                "currentCustodian": row[9]
            }

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return jsonify({

            "status": "success",

            "evidence": blockchain_data,

            "database": database_data
        })

    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


# ============================================================
# REGISTER EVIDENCE
# ============================================================

@app.route(
    "/api/evidence/register",
    methods=["POST"]
)
def register_evidence_route():

    try:

        # ----------------------------------------------------
        # CHECK FILE
        # ----------------------------------------------------

        if "file" not in request.files:

            return jsonify({

                "status": "error",

                "message": (
                    "No evidence file provided."
                )
            }), 400

        uploaded_file = request.files[
            "file"
        ]

        if uploaded_file.filename == "":

            return jsonify({

                "status": "error",

                "message": (
                    "No evidence file selected."
                )
            }), 400

        # ----------------------------------------------------
        # GET FORM DATA
        # ----------------------------------------------------

        case_id = request.form.get(
            "caseId",
            ""
        ).strip()

        description = request.form.get(
            "description",
            ""
        ).strip()

        if not case_id:

            return jsonify({

                "status": "error",

                "message": (
                    "Case ID is required."
                )
            }), 400

        # ----------------------------------------------------
        # GENERATE EVIDENCE ID
        # ----------------------------------------------------

        evidence_id = generate_evidence_id()

        # ----------------------------------------------------
        # SAVE FILE
        # ----------------------------------------------------

        original_filename = (
            uploaded_file.filename
        )

        safe_filename = (
            evidence_id
            + "_"
            + original_filename
        )

        file_path = os.path.join(
            app.config["UPLOAD_FOLDER"],
            safe_filename
        )

        uploaded_file.save(
            file_path
        )

        # ----------------------------------------------------
        # CALCULATE SHA-256
        # ----------------------------------------------------

        evidence_hash = calculate_sha256(
            file_path
        )

        # ----------------------------------------------------
        # REGISTER ON BLOCKCHAIN
        # ----------------------------------------------------

        blockchain_result = register_evidence(

            evidence_id,

            case_id,

            evidence_hash
        )

        # ----------------------------------------------------
        # SAVE METADATA IN SQLITE
        # ----------------------------------------------------

        save_evidence(

            evidence_id=evidence_id,

            case_id=case_id,

            title=original_filename,

            description=description,

            file_path=file_path,

            sha256_hash=evidence_hash,

            registered_by=(
                blockchain_result.get(
                    "registeredBy"
                )
            ),

            blockchain_evidence_id=(
                evidence_id
            ),

            registration_tx_hash=(
                blockchain_result[
                    "transactionHash"
                ]
            ),

            current_custodian=(
                blockchain_result.get(
                    "currentCustodian"
                )
            )
        )

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return jsonify({

            "status": "success",

            "message": (
                "Evidence registered "
                "successfully."
            ),

            "evidenceId": evidence_id,

            "caseId": case_id,

            "description": description,

            "fileName": original_filename,

            "evidenceHash": evidence_hash,

            "transactionHash": (
                blockchain_result[
                    "transactionHash"
                ]
            ),

            "blockNumber": (
                blockchain_result[
                    "blockNumber"
                ]
            ),

            "registeredBy": (
                blockchain_result.get(
                    "registeredBy"
                )
            ),

            "currentCustodian": (
                blockchain_result.get(
                    "currentCustodian"
                )
            )

        }), 201

    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


# ============================================================
# VERIFY EVIDENCE
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/verify",
    methods=["POST"]
)
def verify_evidence_route(evidence_id):

    try:

        data = request.get_json()

        if not data:

            return jsonify({

                "status": "error",

                "message": (
                    "Request body is required."
                )
            }), 400

        current_hash = data.get(
            "currentHash",
            ""
        ).strip().lower()

        if not current_hash:

            return jsonify({

                "status": "error",

                "message": (
                    "Current hash is required."
                )
            }), 400

        # ----------------------------------------------------
        # GET STORED EVIDENCE
        # ----------------------------------------------------

        blockchain_data = get_evidence(
            evidence_id
        )

        if not blockchain_data:

            return jsonify({

                "status": "error",

                "message": (
                    "Evidence not found."
                )
            }), 404

        stored_hash = (
            blockchain_data[
                "evidenceHash"
            ]
        )

        # ----------------------------------------------------
        # VERIFY HASH
        # ----------------------------------------------------

        is_authentic = verify_evidence(

            evidence_id,

            current_hash
        )

        result = (

            "AUTHENTIC"

            if is_authentic

            else "TAMPERED"
        )

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return jsonify({

            "status": "success",

            "evidenceId": evidence_id,

            "result": result,

            "isAuthentic": (
                is_authentic
            ),

            "storedHash": stored_hash,

            "currentHash": current_hash

        })

    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


# ============================================================
# TRANSFER CUSTODY
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/transfer",
    methods=["POST"]
)
def transfer_custody_route(evidence_id):

    try:

        data = request.get_json()

        if not data:

            return jsonify({

                "status": "error",

                "message": (
                    "Request body is required."
                )
            }), 400

        new_custodian = data.get(
            "newCustodian",
            ""
        ).strip()

        if not new_custodian:

            return jsonify({

                "status": "error",

                "message": (
                    "New custodian address "
                    "is required."
                )
            }), 400

        # ----------------------------------------------------
        # TRANSFER ON BLOCKCHAIN
        # ----------------------------------------------------

        blockchain_result = transfer_custody(

            evidence_id,

            new_custodian
        )

        # ----------------------------------------------------
        # UPDATE SQLITE
        # ----------------------------------------------------

        update_custodian(

            evidence_id,

            blockchain_result[
                "to"
            ]
        )

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return jsonify({

            "status": "success",

            "message": (
                "Custody transferred "
                "successfully."
            ),

            "evidenceId": evidence_id,

            "newCustodian": (
                blockchain_result[
                    "to"
                ]
            ),

            "transactionHash": (
                blockchain_result[
                    "transactionHash"
                ]
            ),

            "blockNumber": (
                blockchain_result[
                    "blockNumber"
                ]
            ),

            "from": (
                blockchain_result[
                    "from"
                ]
            ),

            "to": (
                blockchain_result[
                    "to"
                ]
            )
        })

    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


# ============================================================
# RECORD EVIDENCE ACCESS
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/access",
    methods=["POST"]
)
def record_access_route(evidence_id):

    try:

        blockchain_result = record_access(
            evidence_id
        )

        return jsonify({

            "status": "success",

            "message": (
                "Evidence access recorded "
                "successfully."
            ),

            "evidenceId": evidence_id,

            "accessedBy": (
                blockchain_result[
                    "accessedBy"
                ]
            ),

            "transactionHash": (
                blockchain_result[
                    "transactionHash"
                ]
            ),

            "blockNumber": (
                blockchain_result[
                    "blockNumber"
                ]
            )
        })

    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


# ============================================================
# ACCESS HISTORY
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/access-history",
    methods=["GET"]
)
def access_history_route(evidence_id):

    try:

        history = get_access_history(
            evidence_id
        )

        return jsonify({

            "status": "success",

            "evidenceId": evidence_id,

            "count": len(history),

            "accessHistory": history

        })

    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


# ============================================================
# CUSTODY HISTORY
# ============================================================

@app.route(
    "/api/evidence/<evidence_id>/custody-history",
    methods=["GET"]
)
def custody_history_route(evidence_id):

    try:

        history = get_custody_history(
            evidence_id
        )

        return jsonify({

            "status": "success",

            "evidenceId": evidence_id,

            "count": len(history),

            "custodyHistory": history

        })

    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


# ============================================================
# ROOT
# ============================================================

@app.route(
    "/",
    methods=["GET"]
)
def index():

    return jsonify({

        "service": (
            "EvidenceChain Backend"
        ),

        "status": "running"
    })


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    app.run(

        host="127.0.0.1",

        port=5001,

        debug=True
    )
