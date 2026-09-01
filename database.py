import os
from sqlalchemy import create_engine, event, text
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

def is_data_writable():
    return os.path.exists("/data") and os.access("/data", os.W_OK)

if not db_url:
    if is_data_writable():
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
    if is_data_writable():
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
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
    except Exception as e:
        print(f"Primary SessionLocal error: {e}, using SQLite fallback session.")
        fallback_path = "/data/production.db" if is_data_writable() else "./production.db"
        fallback_engine = create_engine(f"sqlite:///{fallback_path}", connect_args={"check_same_thread": False})
        FallbackSession = sessionmaker(autocommit=False, autoflush=False, bind=fallback_engine)
        db = FallbackSession()
    try:
        yield db
    finally:
        try:
            db.close()
        except Exception:
            pass
