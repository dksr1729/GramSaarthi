from datetime import datetime
from typing import Optional
from database import db_client
from config import settings
from auth import hash_password, verify_password, create_access_token
from models import UserRegister, UserLogin, UserResponse, TokenResponse, PersonaEnum
import logging

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self):
        self.users_table = settings.DYNAMODB_USERS_TABLE

    async def register_user(self, user_data: UserRegister) -> TokenResponse:
        """Register a new user"""
        try:
            # Check if user already exists
            existing_user = db_client.get_item(
                self.users_table,
                {"gmail": user_data.gmail}
            )

            if existing_user:
                raise ValueError("User with this email already exists")

            # Validate location data based on persona
            if user_data.persona == PersonaEnum.DISTRICT_ADMIN:
                if not user_data.district:
                    raise ValueError("District Admin must select a district")
                user_data.mandal = None
                user_data.village = None
            else:
                if not user_data.mandal or not user_data.village:
                    raise ValueError("Panchayat Officer and Rural User must select mandal and village")

            # Hash password
            password_hash = hash_password(user_data.password)

            # Create user item
            user_item = {
                "gmail": user_data.gmail,
                "password_hash": password_hash,
                "name": user_data.name,
                "persona": user_data.persona.value,
                "state": user_data.state,
                "district": user_data.district or "",
                "mandal": user_data.mandal or "",
                "village": user_data.village or "",
                "created_at": datetime.utcnow().isoformat()
            }

            # Save to DynamoDB
            success = db_client.put_item(self.users_table, user_item)

            if not success:
                raise Exception("Failed to save user to database")

            # Create access token
            token_data = {
                "gmail": user_data.gmail,
                "persona": user_data.persona.value,
                "district": user_data.district or "",
                "mandal": user_data.mandal or "",
                "village": user_data.village or ""
            }
            access_token = create_access_token(token_data)

            # Create user response
            user_response = UserResponse(
                gmail=user_data.gmail,
                name=user_data.name,
                persona=user_data.persona.value,
                state=user_data.state,
                district=user_data.district,
                mandal=user_data.mandal,
                village=user_data.village,
                created_at=user_item["created_at"]
            )

            logger.info(f"User registered successfully: {user_data.gmail}")

            return TokenResponse(
                access_token=access_token,
                user=user_response
            )

        except ValueError as e:
            logger.error(f"Validation error during registration: {e}")
            raise
        except Exception as e:
            logger.error(f"Error during user registration: {e}")
            raise Exception("Failed to register user")

    async def login_user(self, login_data: UserLogin) -> TokenResponse:
        """Login user"""
        try:
            # Get user from database
            user = db_client.get_item(
                self.users_table,
                {"gmail": login_data.gmail}
            )

            if not user:
                raise ValueError("Invalid email or password")

            # Verify password
            if not verify_password(login_data.password, user["password_hash"]):
                logger.warning(f"Failed login attempt for: {login_data.gmail}")
                raise ValueError("Invalid email or password")

            # Create access token
            token_data = {
                "gmail": user["gmail"],
                "persona": user["persona"],
                "district": user.get("district", ""),
                "mandal": user.get("mandal", ""),
                "village": user.get("village", "")
            }
            access_token = create_access_token(token_data)

            # Create user response
            user_response = UserResponse(
                gmail=user["gmail"],
                name=user["name"],
                persona=user["persona"],
                state=user["state"],
                district=user.get("district"),
                mandal=user.get("mandal"),
                village=user.get("village"),
                created_at=user["created_at"]
            )

            logger.info(f"User logged in successfully: {login_data.gmail}")

            return TokenResponse(
                access_token=access_token,
                user=user_response
            )

        except ValueError as e:
            logger.error(f"Login error: {e}")
            raise
        except Exception as e:
            logger.error(f"Error during user login: {e}")
            raise Exception("Failed to login user")

    async def get_user_info(self, gmail: str) -> Optional[UserResponse]:
        """Get user information"""
        try:
            user = db_client.get_item(
                self.users_table,
                {"gmail": gmail}
            )

            if not user:
                return None

            return UserResponse(
                gmail=user["gmail"],
                name=user["name"],
                persona=user["persona"],
                state=user["state"],
                district=user.get("district"),
                mandal=user.get("mandal"),
                village=user.get("village"),
                created_at=user["created_at"]
            )

        except Exception as e:
            logger.error(f"Error getting user info: {e}")
            return None


# Global auth service instance
auth_service = AuthService()
