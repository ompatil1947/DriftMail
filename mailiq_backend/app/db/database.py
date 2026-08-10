"""
SQLAlchemy engine + session factory.
DB file lives at data/driftmail.db relative to the backend root.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

_DB_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
os.makedirs(_DB_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{os.path.join(_DB_DIR, 'driftmail.db')}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # needed for SQLite + FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
