from pydantic import BaseModel, Field


class LookupRequest(BaseModel):
    patente: str = Field(..., min_length=6, max_length=8)
    email: str | None = None


class VehicleLookupResponse(BaseModel):
    patente: str
    marca: str
    modelo: str
    año: int
    motor: str | None = None
    combustible: str | None = None
    transmision: str | None = None
    fuente: str = "autofact"
    raw_text_preview: str | None = None
