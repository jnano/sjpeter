import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.auth import get_current_admin
from app.models.parish import Parish
from app.models.admin import Admin

router = APIRouter(prefix="/parish", tags=["parish"])


class MassEntry(BaseModel):
    day: str
    time: str
    note: str = ""


class MassSchedule(BaseModel):
    entries: list[MassEntry] = []
    note: str = ""


class ParishUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    cafe_url: Optional[str] = None
    band_url: Optional[str] = None
    pastor_name: Optional[str] = None
    pastor_message: Optional[str] = None
    mass_schedule: Optional[MassSchedule] = None


class ParishOut(BaseModel):
    id: int
    name: str
    diocese: Optional[str]
    address: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    phone: Optional[str]
    fax: Optional[str]
    cafe_url: Optional[str]
    band_url: Optional[str]
    pastor_name: Optional[str]
    pastor_message: Optional[str]
    pastor_photo_url: Optional[str]
    mass_schedule: Optional[MassSchedule]

    class Config:
        from_attributes = True


def _get_parish(db: Session) -> Parish:
    parish = db.query(Parish).first()
    if not parish:
        raise HTTPException(status_code=500, detail="성당 정보가 초기화되지 않았습니다.")
    return parish


def _parish_to_out(parish: Parish) -> ParishOut:
    schedule = None
    if parish.mass_schedule:
        try:
            schedule = MassSchedule(**json.loads(parish.mass_schedule))
        except Exception:
            pass
    return ParishOut(
        id=parish.id,
        name=parish.name,
        diocese=parish.diocese,
        address=parish.address,
        lat=parish.lat,
        lng=parish.lng,
        phone=parish.phone,
        fax=parish.fax,
        cafe_url=parish.cafe_url,
        band_url=parish.band_url,
        pastor_name=parish.pastor_name,
        pastor_message=parish.pastor_message,
        pastor_photo_url=parish.pastor_photo_url,
        mass_schedule=schedule,
    )


@router.get("/", response_model=ParishOut)
def get_parish(db: Session = Depends(get_db)):
    return _parish_to_out(_get_parish(db))


@router.put("/", response_model=ParishOut)
def update_parish(
    body: ParishUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin),
):
    parish = _get_parish(db)
    data = body.model_dump(exclude_unset=True)

    if "mass_schedule" in data and data["mass_schedule"] is not None:
        parish.mass_schedule = json.dumps(data.pop("mass_schedule"), ensure_ascii=False)
    elif "mass_schedule" in data:
        data.pop("mass_schedule")

    for k, v in data.items():
        setattr(parish, k, v)

    db.commit()
    db.refresh(parish)
    return _parish_to_out(parish)
