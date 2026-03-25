from .movies import router as movies_router
from .halls import router as halls_router
from .schedules_db import router as schedules_db_router
from .auth import router as auth_router
from .users import router as users_router

__all__ = ["movies_router", "halls_router", "schedules_db_router", "auth_router", "users_router"]
