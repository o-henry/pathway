from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from lifemap_api.api.routes_checkins import router as checkins_router
from lifemap_api.api.routes_goals import router as goals_router
from lifemap_api.api.routes_maps import router as maps_router
from lifemap_api.api.routes_profiles import router as profiles_router
from lifemap_api.api.routes_revisions import router as revisions_router
from lifemap_api.api.routes_sources import router as sources_router
from lifemap_api.config import get_settings
from lifemap_api.infrastructure.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Life Map API",
        version="0.1.0",
        summary="Local-first API for the Life Map personal scenario mapper.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:4173",
            "http://localhost:4173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, object]:
        return {
            "status": "ok",
            "app_env": settings.app_env,
            "data_dir": str(settings.data_dir),
            "source_fetch_enabled": settings.source_fetch_enabled,
        }

    app.include_router(profiles_router)
    app.include_router(goals_router)
    app.include_router(maps_router)
    app.include_router(sources_router)
    app.include_router(checkins_router)
    app.include_router(revisions_router)

    return app


app = create_app()
