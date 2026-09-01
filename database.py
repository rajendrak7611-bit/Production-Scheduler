import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

# Support Render environment variable or persistent disk /data/production.db
db_url = os.getenv("DATABASE_URL")

if db_url:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if "postgresql" in db_url and "sslmode" not in db_url:
        if "?" in db_url:
            db_url += "&sslmode=require"
        else:
            db_url += "?sslmode=require"

if not db_url:
    if os.path.exists("/data"):
        db_url = "sqlite:////data/production.db"
    else:
        db_url = "sqlite:///./production.db"

connect_args = {"check_same_thread": False} if "sqlite" in db_url else {}

try:
    engine = create_engine(db_url, connect_args=connect_args)
    with engine.connect() as conn:
        pass
except Exception as e:
    print(f"Failed to connect to primary DATABASE_URL ({db_url}), falling back to SQLite: {e}")
    if os.path.exists("/data"):
        db_url = "sqlite:////data/production.db"
    else:
        db_url = "sqlite:///./production.db"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})

if "sqlite" in str(engine.url):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()
        except Exception:
            pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
