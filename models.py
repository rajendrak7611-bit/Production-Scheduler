from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Machine(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    dept = Column(String, index=True)
    status = Column(String, default="Active")  # Active, Maintenance, Idle

class Operator(Base):
    __tablename__ = "operators"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    dept = Column(String, index=True)
    designation = Column(String)

class Part(Base):
    __tablename__ = "parts"

    id = Column(Integer, primary_key=True, index=True)
    part_no = Column(String, unique=True, index=True, nullable=False)
    customer = Column(String, index=True, nullable=True)
    dept = Column(String, index=True, nullable=True)
    family = Column(String, index=True, nullable=True)
    forge_pn = Column(String, nullable=True)
    description = Column(String, nullable=True)
    cycle_time = Column(Float, default=0.0)
    va = Column(Float, default=0.0)

    operations = relationship("Operation", back_populates="part", cascade="all, delete-orphan")

class Operation(Base):
    __tablename__ = "operations"

    id = Column(Integer, primary_key=True, index=True)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)
    opn_no = Column(String, nullable=False)
    description = Column(String, nullable=True)
    machine_name = Column(String, nullable=True)
    cycle_time = Column(Float, default=0.0)
    va = Column(Float, default=0.0)

    part = relationship("Part", back_populates="operations")

class ProductionSchedule(Base):
    __tablename__ = "production_schedules"

    id = Column(Integer, primary_key=True, index=True)
    sl_no = Column(String, nullable=True)
    item = Column(String, nullable=True)
    grs_no = Column(String, nullable=True)
    part_no = Column(String, index=True, nullable=False)
    total_sch_qty = Column(Integer, default=0)
    rate_per_pc = Column(Float, default=0.0)
    amount = Column(Float, default=0.0)
    qty_disp = Column(Integer, default=0)
    value_rs = Column(Float, default=0.0)
    balance_to_produce = Column(Integer, default=0)
    remarks = Column(String, nullable=True)

class ProductionLog(Base):
    __tablename__ = "production_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_date = Column(String, nullable=False)  # YYYY-MM-DD
    shift = Column(String, default="Shift A")   # Shift A, Shift B, Shift C
    machine_name = Column(String, index=True, nullable=False)
    operator_name = Column(String, index=True, nullable=False)
    part_no = Column(String, index=True, nullable=False)
    opn_no = Column(String, nullable=True)
    qty_produced = Column(Integer, default=0)
    scrap_qty = Column(Integer, default=0)
    completed_sl_nos = Column(Text, nullable=True)  # Stores comma-separated Sl Nos like "1,2,3,4,5"
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Tooling(Base):
    __tablename__ = "tooling"

    id = Column(Integer, primary_key=True, index=True)
    insert_spec = Column(String, index=True, nullable=False)
    no_of_edges = Column(Integer, default=1)
    current_usage = Column(Integer, default=0)
    max_life = Column(Integer, default=1000)
    status = Column(String, default="Good") # Good, Warning, Replace
