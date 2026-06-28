from __future__ import annotations
from dataclasses import dataclass

@dataclass
class User:
    user_id: str
    email: str
    name: str
    avatar_url: str
    created_at: str
    last_login: str
    is_admin: bool = False
    is_active: bool = True

    @staticmethod
    def from_row(row) -> "User":
        return User(
            user_id=row["user_id"], email=row["email"],
            name=row["name"], avatar_url=row["avatar_url"],
            created_at=str(row["created_at"]), last_login=str(row["last_login"]),
            is_admin=row["is_admin"], is_active=row["is_active"],
        )

    def to_public(self) -> dict:
        return {
            "user_id": self.user_id, "email": self.email,
            "name": self.name, "avatar_url": self.avatar_url,
            "created_at": self.created_at, "last_login": self.last_login,
            "is_admin": self.is_admin,
        }
