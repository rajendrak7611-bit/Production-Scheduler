from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    hours = Column(Float, default=8.0)

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    details = Column(String, nullable=True)

class Setter(Base):
    __tablename__ = "setters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    department = Column(String, nullable=True)

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    details = Column(String, nullable=True)

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

IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
def get_now_ist():
    return datetime.datetime.now(IST)

class ProductionLog(Base):
    __tablename__ = "production_logs"

    id = Column(Integer, primary_key=True, index=True)
    dept = Column(String, nullable=True)
    date = Column(String, nullable=True)
    shift = Column(String, nullable=True)
    setter = Column(String, nullable=True)
    machine = Column(String, nullable=True)
    operator = Column(String, nullable=True)
    partno = Column(String, nullable=True)
    opn_no = Column(String, nullable=True)
    description = Column(String, nullable=True)
    runtime = Column(Float, default=0.0)
    cycle_time = Column(Float, default=0.0)
    target_qty = Column(Float, default=0.0)
    prod_qty = Column(Float, default=0.0)
    efficiency = Column(Float, default=0.0)
    idle_hours = Column(Float, default=0.0)
    idle_reason = Column(String, default="None")
    idle_hours_2 = Column(Float, default=0.0)
    idle_reason_2 = Column(String, default="None")
    idle_hours_3 = Column(Float, default=0.0)
    idle_reason_3 = Column(String, default="None")
    multiple_mc = Column(Integer, default=1)
    created_at = Column(DateTime, default=get_now_ist)

class RawMaterial(Base):
    __tablename__ = "raw_materials"

    id = Column(Integer, primary_key=True, index=True)
    forge_pn = Column(String, index=True, nullable=False)
    receipt = Column(Integer, default=0)
    despatch = Column(Integer, default=0)
    stock = Column(Integer, default=0)

class RawMaterialLog(Base):
    __tablename__ = "raw_material_logs"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)  # 'receipt' or 'despatch'
    date = Column(String, nullable=True)
    dc_type = Column(String, nullable=True)
    forge_pn = Column(String, index=True, nullable=False)
    dc_no = Column(String, nullable=True)
    finish_part_no = Column(String, nullable=True)
    part_prefix = Column(String, nullable=True)
    qty = Column(Integer, default=0)
    created_at = Column(DateTime, default=get_now_ist)

class Tooling(Base):
    __tablename__ = "tooling"

    id = Column(Integer, primary_key=True, index=True)
    insert_spec = Column(String, index=True, nullable=False)
    no_of_edges = Column(Integer, default=1)
    current_usage = Column(Integer, default=0)
    max_life = Column(Integer, default=1000)
    status = Column(String, default="Good") # Good, Warning, Replace

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'admin' or 'guest'

class InspectionParameter(Base):
    __tablename__ = "inspection_parameters"

    id = Column(Integer, primary_key=True, index=True)
    part_no = Column(String, index=True, nullable=False)
    opn_no = Column(String, index=True, nullable=False)
    sl_no = Column(Integer, nullable=False, default=1)
    description = Column(String, nullable=False)
    nominal_dimension = Column(Float, default=0.0)
    lo_tol = Column(Float, default=0.0)
    hi_tol = Column(Float, default=0.0)

class InspectionReport(Base):
    __tablename__ = "inspection_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_code = Column(String, index=True, nullable=True)  # Unique Traceability ID e.g. W04-20-0828-001
    prod_log_id = Column(Integer, nullable=True)
    part_no = Column(String, index=True, nullable=False)
    opn_no = Column(String, index=True, nullable=False)
    batch_qty = Column(Integer, default=30)
    machine_name = Column(String, nullable=True)
    operator_name = Column(String, nullable=True)
    inspection_date = Column(String, nullable=True)
    comp_sl_nos = Column(Text, nullable=True)  # Comma-separated component serial numbers, e.g. "10,11,12,13,14"
    readings_json = Column(Text, nullable=True) # JSON string mapping param_id -> { col_0: val, col_1: val ... }
