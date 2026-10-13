from __future__ import annotations

import os
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, Float, Integer, String, create_engine, select, delete, UniqueConstraint, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

database_url = URL.create(
    drivername="postgresql+psycopg",
    username=os.getenv("POSTGRES_USER", "atmos"),
    password=os.environ["POSTGRES_PASSWORD"],
    host="postgres",
    port=5432,
    database=os.getenv("POSTGRES_DB", "atmos"),
)

engine = create_engine(database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class SavedLocation(Base):
    __tablename__ = "saved_locations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100))
    admin1: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    timezone: Mapped[str] = mapped_column(String(80), default="auto")


class Preferences(Base):
    __tablename__ = "user_preferences"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    temperature_unit: Mapped[str] = mapped_column(String(20), default="celsius")
    theme: Mapped[str] = mapped_column(String(20), default="system")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100), default="")
    password_hash: Mapped[str | None] = mapped_column(String(256), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    home_city: Mapped[str] = mapped_column(String(120), default="")
    date_of_birth: Mapped[str] = mapped_column(String(10), default="")
    gender: Mapped[str] = mapped_column(String(40), default="")
    bike: Mapped[bool] = mapped_column(Boolean, default=False)
    car: Mapped[bool] = mapped_column(Boolean, default=False)
    transport_mode: Mapped[str] = mapped_column(String(40), default="private")


class UserSession(Base):
    __tablename__ = "user_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class RegisterInput(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=12, max_length=128)
    full_name: str = Field(default="", max_length=100)
    home_city: str = Field(default="", max_length=120)
    date_of_birth: str = Field(default="", max_length=10)
    gender: str = Field(default="", max_length=40)
    bike: bool = False
    car: bool = False
    transport_mode: Literal["private", "public", "mixed", "walking-cycling"] = "private"


class ProfileInput(BaseModel):
    full_name: str = Field(default="", max_length=100)
    home_city: str = Field(default="", max_length=120)
    date_of_birth: str = Field(default="", max_length=10)
    gender: str = Field(default="", max_length=40)
    bike: bool = False
    car: bool = False
    transport_mode: Literal["private", "public", "mixed", "walking-cycling"] = "private"


class LoginInput(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class LocationInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    country: str = Field(min_length=1, max_length=100)
    admin1: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timezone: str = "auto"


class LocationOutput(LocationInput):
    model_config = {"from_attributes": True}


class PreferencesInput(BaseModel):
    temperature_unit: Literal["celsius", "fahrenheit"] = "celsius"
    theme: Literal["system", "light", "dark"] = "system"


class PreferencesOutput(PreferencesInput):
    model_config = {"from_attributes": True}


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Suitable for local MVP only. Use Alembic migrations in production.
    Base.metadata.create_all(bind=engine)
    # Add profile columns to existing local MVP databases without dropping user data.
    profile_columns = {
        "home_city": "VARCHAR(120) NOT NULL DEFAULT ''",
        "date_of_birth": "VARCHAR(10) NOT NULL DEFAULT ''",
        "gender": "VARCHAR(40) NOT NULL DEFAULT ''",
        "bike": "BOOLEAN NOT NULL DEFAULT FALSE",
        "car": "BOOLEAN NOT NULL DEFAULT FALSE",
        "transport_mode": "VARCHAR(40) NOT NULL DEFAULT 'private'",
    }
    with engine.begin() as connection:
        for column, definition in profile_columns.items():
            connection.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column} {definition}"))
    # Email verification was removed for this MVP; activate legacy pending accounts.
    with SessionLocal() as session:
        session.query(User).filter(User.status == "pending_verification").update({User.status: "active"})
        session.commit()
    yield


app = FastAPI(title="Atmos User Service", version="0.1.0", lifespan=lifespan)
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "healthy", "service": "user-service"}


SESSION_COOKIE = "atmos_session"
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "7"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def _password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)
    return f"pbkdf2_sha256$600000${salt.hex()}${digest.hex()}"

def _password_matches(password: str, stored: str) -> bool:
    try:
        _, rounds, salt_hex, digest_hex = stored.split("$")
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(rounds)).hex()
        return hmac.compare_digest(candidate, digest_hex)
    except (ValueError, TypeError):
        return False

def _create_session(user: User, response: Response) -> None:
    raw = secrets.token_urlsafe(40)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    with SessionLocal() as session:
        session.add(UserSession(user_id=user.id, token_hash=_token_hash(raw), expires_at=expires))
        session.commit()
    response.set_cookie(SESSION_COOKIE, raw, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=SESSION_DAYS*86400, path="/")

def _current_user(request: Request) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token: raise HTTPException(status_code=401, detail="Sign in required")
    with SessionLocal() as session:
        saved = session.scalar(select(UserSession).where(UserSession.token_hash == _token_hash(token), UserSession.revoked == False))
        if saved is None or saved.expires_at <= datetime.now(timezone.utc): raise HTTPException(status_code=401, detail="Session expired")
        user = session.get(User, saved.user_id)
        if user is None or user.status != "active": raise HTTPException(status_code=403, detail="Account is not active")
        session.expunge(user)
        return user

@app.post("/api/v1/auth/register", status_code=201)
def register(body: RegisterInput, response: Response):
    email = body.email.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    with SessionLocal() as session:
        existing = session.scalar(select(User).where(User.email == email))
        if existing:
            raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in.")
        user = User(
            email=email,
            full_name=body.full_name.strip(),
            password_hash=_password_hash(body.password),
            status="active",
            home_city=body.home_city.strip(),
            date_of_birth=body.date_of_birth,
            gender=body.gender,
            bike=body.bike,
            car=body.car,
            transport_mode=body.transport_mode,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        session.expunge(user)
    _create_session(user, response)
    return _user_payload(user)


def _user_payload(user: User):
    return {
        "id": user.id, "email": user.email, "full_name": user.full_name,
        "home_city": user.home_city or "", "date_of_birth": user.date_of_birth or "",
        "gender": user.gender or "", "bike": bool(user.bike), "car": bool(user.car),
        "transport_mode": user.transport_mode or "private", "provider": "email",
    }


@app.post("/api/v1/auth/login")
def login(body: LoginInput, response: Response):
    email = body.email.strip().lower()
    with SessionLocal() as session:
        user = session.scalar(select(User).where(User.email == email))
        if user is None or not user.password_hash or not _password_matches(body.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Email or password is incorrect")
        if user.status != "active":
            raise HTTPException(status_code=403, detail="This account is disabled")
        session.expunge(user)
    _create_session(user, response)
    return _user_payload(user)


@app.get("/api/v1/auth/me")
def auth_me(request: Request):
    user = _current_user(request)
    return _user_payload(user)


@app.put("/api/v1/profile")
def update_profile(body: ProfileInput, request: Request):
    current = _current_user(request)
    with SessionLocal() as session:
        user = session.get(User, current.id)
        if user is None:
            raise HTTPException(status_code=401, detail="Sign in required")
        user.full_name = body.full_name.strip()
        user.home_city = body.home_city.strip()
        user.date_of_birth = body.date_of_birth
        user.gender = body.gender
        user.bike = body.bike
        user.car = body.car
        user.transport_mode = body.transport_mode
        session.commit()
        session.refresh(user)
        session.expunge(user)
    return _user_payload(user)

@app.post("/api/v1/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with SessionLocal() as session:
            saved = session.scalar(select(UserSession).where(UserSession.token_hash == _token_hash(token)))
            if saved: saved.revoked = True; session.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=COOKIE_SECURE, samesite="lax")
    return {"status": "signed_out"}

@app.get("/api/v1/locations", response_model=list[LocationOutput])
def list_locations():
    with SessionLocal() as session:
        return list(session.scalars(select(SavedLocation).order_by(SavedLocation.name)))


@app.post("/api/v1/locations", response_model=LocationOutput)
def add_location(body: LocationInput):
    with SessionLocal() as session:
        existing = session.scalar(
            select(SavedLocation).where(
                SavedLocation.latitude == body.latitude,
                SavedLocation.longitude == body.longitude,
            )
        )
        if existing:
            return existing
        item = SavedLocation(**body.model_dump())
        session.add(item)
        session.commit()
        session.refresh(item)
        return item


@app.delete("/api/v1/locations")
def remove_location(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
):
    with SessionLocal() as session:
        item = session.scalar(
            select(SavedLocation).where(
                SavedLocation.latitude == latitude,
                SavedLocation.longitude == longitude,
            )
        )
        if item is None:
            raise HTTPException(status_code=404, detail="Saved location not found")
        session.delete(item)
        session.commit()
        return {"deleted": True}


@app.get("/api/v1/preferences", response_model=PreferencesOutput)
def get_preferences():
    with SessionLocal() as session:
        item = session.scalar(select(Preferences).limit(1))
        if item is None:
            item = Preferences()
            session.add(item)
            session.commit()
            session.refresh(item)
        return item


@app.put("/api/v1/preferences", response_model=PreferencesOutput)
def update_preferences(body: PreferencesInput):
    with SessionLocal() as session:
        item = session.scalar(select(Preferences).limit(1))
        if item is None:
            item = Preferences()
            session.add(item)
        item.temperature_unit = body.temperature_unit
        item.theme = body.theme
        session.commit()
        session.refresh(item)
        return item
