import logging

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import auth, games, groups
from app.core.config import get_settings
from app.domain.errors import DomainError
from app.domain.teams import TeamDrawError

logging.basicConfig(level=logging.INFO)

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

v1 = APIRouter(prefix="/v1")
v1.include_router(auth.router)
v1.include_router(groups.router)
v1.include_router(games.router)
app.include_router(v1)


@app.exception_handler(DomainError)
async def domain_error_handler(_: Request, error: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"error": {"code": error.code, "message": error.message}},
    )


@app.exception_handler(TeamDrawError)
async def team_draw_error_handler(_: Request, error: TeamDrawError) -> JSONResponse:
    # Rule 16: the message names the unrated players, so it is safe to show.
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "team_draw_failed", "message": str(error)}},
    )


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
