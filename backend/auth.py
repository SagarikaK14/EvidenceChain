from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from database.db import get_db_connection


# ============================================================
# AUTH BLUEPRINT
# ============================================================

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)


# ============================================================
# REGISTER USER
# ============================================================

@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json()

    if not data:

        return jsonify({
            "status": "error",
            "message": "Request body is required."
        }), 400


    # --------------------------------------------------------
    # Read fields
    # --------------------------------------------------------

    name = str(
        data.get("name", "")
    ).strip()

    email = str(
        data.get("email", "")
    ).strip().lower()

    password = str(
        data.get("password", "")
    )

    role = str(
        data.get("role", "officer")
    ).strip()

    wallet_address = data.get(
        "wallet_address"
    )


    # --------------------------------------------------------
    # Validate
    # --------------------------------------------------------

    if not name:

        return jsonify({
            "status": "error",
            "message": "Name is required."
        }), 400


    if not email:

        return jsonify({
            "status": "error",
            "message": "Email is required."
        }), 400


    if not password:

        return jsonify({
            "status": "error",
            "message": "Password is required."
        }), 400


    if len(password) < 6:

        return jsonify({
            "status": "error",
            "message": "Password must contain at least 6 characters."
        }), 400


    connection = get_db_connection()

    cursor = connection.cursor()


    try:

        # ----------------------------------------------------
        # Check existing user
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE email = ?
            """,
            (email,)
        )

        existing_user = cursor.fetchone()


        if existing_user:

            return jsonify({
                "status": "error",
                "message": "User with this email already exists."
            }), 409


        # ----------------------------------------------------
        # Hash password
        # ----------------------------------------------------

        password_hash = generate_password_hash(
            password
        )


        # ----------------------------------------------------
        # Insert user
        # ----------------------------------------------------

        cursor.execute(
            """
            INSERT INTO users (

                name,
                email,
                password_hash,
                role,
                wallet_address

            )

            VALUES (?, ?, ?, ?, ?)
            """,
            (
                name,
                email,
                password_hash,
                role,
                wallet_address
            )
        )


        connection.commit()

        user_id = cursor.lastrowid


        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        return jsonify({

            "status": "success",

            "message": "User registered successfully.",

            "user": {

                "id": user_id,

                "name": name,

                "email": email,

                "role": role,

                "wallet_address": wallet_address
            }

        }), 201


    except Exception as error:

        connection.rollback()

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


    finally:

        connection.close()


# ============================================================
# LOGIN USER
# ============================================================

@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    if not data:

        return jsonify({
            "status": "error",
            "message": "Request body is required."
        }), 400


    # --------------------------------------------------------
    # Read credentials
    # --------------------------------------------------------

    email = str(
        data.get("email", "")
    ).strip().lower()

    password = str(
        data.get("password", "")
    )


    # --------------------------------------------------------
    # Validate
    # --------------------------------------------------------

    if not email:

        return jsonify({
            "status": "error",
            "message": "Email is required."
        }), 400


    if not password:

        return jsonify({
            "status": "error",
            "message": "Password is required."
        }), 400


    connection = get_db_connection()

    cursor = connection.cursor()


    try:

        # ----------------------------------------------------
        # Find user
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                name,
                email,
                password_hash,
                role,
                wallet_address

            FROM users

            WHERE email = ?
            """,
            (email,)
        )


        user = cursor.fetchone()


        # ----------------------------------------------------
        # User not found
        # ----------------------------------------------------

        if user is None:

            return jsonify({

                "status": "error",

                "message": "Invalid email or password."

            }), 401


        # ----------------------------------------------------
        # Check password
        # ----------------------------------------------------

        password_correct = check_password_hash(

            user["password_hash"],

            password
        )


        if not password_correct:

            return jsonify({

                "status": "error",

                "message": "Invalid email or password."

            }), 401


        # ----------------------------------------------------
        # Successful login
        # ----------------------------------------------------

        return jsonify({

            "status": "success",

            "message": "Login successful.",

            "user": {

                "id": user["id"],

                "name": user["name"],

                "email": user["email"],

                "role": user["role"],

                "wallet_address": user["wallet_address"]
            }

        }), 200


    except Exception as error:

        return jsonify({

            "status": "error",

            "message": str(error)

        }), 500


    finally:

        connection.close()
