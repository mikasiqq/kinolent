from .movies import router as movies_router
from .halls import router as halls_router
from .schedules_db import router as schedules_db_router

__all__ = ["movies_router", "halls_router", "schedules_db_router"]
