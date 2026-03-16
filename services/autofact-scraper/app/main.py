from __future__ import annotations

import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException

from .autofact_client import (
    AutofactBlockedError,
    AutofactLookupError,
    AutofactNotFoundError,
    lookup_vehicle,
)
from .schemas import LookupRequest, VehicleLookupResponse

load_dotenv()

app = FastAPI(title="Autofact Scraper", version="1.0.0")


def verify_internal_token(
    x_internal_token: Annotated[str | None, Header()] = None,
) -> None:
    expected = os.getenv("AUTOFACT_SCRAPER_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=500, detail="AUTOFACT_SCRAPER_TOKEN no está configurado.")
    if x_internal_token != expected:
        raise HTTPException(status_code=401, detail="Token interno inválido.")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"ok": "true"}


@app.post("/lookup-patente", response_model=VehicleLookupResponse)
async def lookup_patente(
    body: LookupRequest,
    _: None = Depends(verify_internal_token),
) -> VehicleLookupResponse:
    try:
        return await lookup_vehicle(body.patente, body.email)
    except AutofactNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AutofactBlockedError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except AutofactLookupError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
