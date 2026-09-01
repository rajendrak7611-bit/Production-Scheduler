from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List, Optional
from pydantic import BaseModel
import datetime
import io
import zipfile
import xml.etree.ElementTree as ET
import re

from database import engine, get_db, Base
import models

def parse_excel_bytes(file_bytes: bytes):
    rows = []
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
            strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
                for elem in tree.iter():
                    if elem.tag.endswith('}t'):
                        strings.append(elem.text or '')
            
            target_sheet = 'xl/worksheets/sheet1.xml'
            if target_sheet not in z.namelist():
                sheets = [n for n in z.namelist() if n.startswith('xl/worksheets/sheet')]
                if sheets:
                    target_sheet = sheets[0]
            
            if target_sheet in z.namelist():
                tree = ET.fromstring(z.read(target_sheet))
                for r in tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                    row_vals = []
                    for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                        t = c.get('t')
                        v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                        val = ''
                        if v is not None:
                            val = v.text or ''
                            if t == 's' and val.isdigit() and int(val) < len(strings):
                                val = strings[int(val)]
                        row_vals.append(val.strip())
                    if any(row_vals):
                        rows.append(row_vals)
    except Exception as e:
        print("Error reading excel bytes:", e)
    return rows

# Ensure tables are created
Base.metadata.create_all(bind=engine)

# Auto migrate inspection_reports columns if missing
try:
    with engine.begin() as conn:
        from sqlalchemy import text
        try:
            conn.execute(text("ALTER TABLE inspection_reports ADD COLUMN report_code VARCHAR;"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE inspection_reports ADD COLUMN prod_log_id INTEGER;"))
        except Exception:
            pass
except Exception as _ex:
    pass

app = FastAPI(title="Production Management API")

class UserLogin(BaseModel):
    username: str
    password: str

@app.on_event("startup")
def seed_default_users():
    # Keep database state persistent and do not overwrite user deletions on restart
    pass

@app.post("/api/restore-from-backup")
@app.get("/api/restore-from-backup")
def trigger_restore_backup():
    try:
        import import_all_tables
        import_all_tables.import_all_backup_tables()
        return {"message": "All 32 tables restored successfully from backup JSON & Excel!"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/login")
@app.post("/api/auth/login")
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    u = (login_data.username or "").strip()
    p = (login_data.password or "").strip()
    
    if u.lower() == "admin" and p in ["admin", "admin123", "admin@123"]:
        return {"success": True, "username": "admin", "role": "admin", "token": "token-admin"}
    if u.lower() == "guest" and p in ["guest", "guest123"]:
        return {"success": True, "username": "guest", "role": "guest", "token": "token-guest"}

    try:
        user = db.query(models.User).filter(func.lower(models.User.username) == u.lower()).first()
        if user and user.password == p:
            return {"success": True, "username": user.username, "role": user.role or "admin", "token": f"token-{user.username}"}
    except Exception as e:
        print("Login DB lookup notice:", e)

    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.post("/api/seed-default-data")
def seed_default_data(db: Session = Depends(get_db)):
    try:
        import seed_data
        seed_data.seed_database()
        return {"message": "Default master data seeded successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Pydantic Schemas ---

class MachineBase(BaseModel):
    name: str
    dept: Optional[str] = "General"
    status: Optional[str] = "Active"

class MachineCreate(MachineBase):
    pass

class MachineResponse(MachineBase):
    id: int
    class Config:
        from_attributes = True

class OperatorBase(BaseModel):
    name: str
    dept: Optional[str] = "General"
    designation: Optional[str] = "Operator"

class OperatorCreate(OperatorBase):
    pass

class OperatorResponse(OperatorBase):
    id: int
    class Config:
        from_attributes = True

class OperationBase(BaseModel):
    opn_no: str
    description: Optional[str] = None
    machine_name: Optional[str] = None
    cycle_time: Optional[float] = 0.0
    va: Optional[float] = 0.0

class OperationCreate(OperationBase):
    pass

class OperationResponse(OperationBase):
    id: int
    part_id: int
    class Config:
        from_attributes = True

class PartBase(BaseModel):
    part_no: str
    customer: Optional[str] = None
    dept: Optional[str] = None
    family: Optional[str] = None
    forge_pn: Optional[str] = None
    description: Optional[str] = None
    cycle_time: Optional[float] = 0.0
    va: Optional[float] = 0.0

class PartCreate(PartBase):
    pass

class PartResponse(PartBase):
    id: int
    operations: List[OperationResponse] = []
    class Config:
        from_attributes = True

class ProductionScheduleBase(BaseModel):
    sl_no: Optional[str] = None
    item: Optional[str] = None
    grs_no: Optional[str] = None
    part_no: str
    total_sch_qty: int = 0
    rate_per_pc: Optional[float] = 0.0
    amount: Optional[float] = 0.0
    qty_disp: Optional[int] = 0
    value_rs: Optional[float] = 0.0
    balance_to_produce: Optional[int] = 0
    remarks: Optional[str] = None

class ProductionScheduleCreate(ProductionScheduleBase):
    pass

class ProductionScheduleResponse(ProductionScheduleBase):
    id: int
    class Config:
        from_attributes = True

class ProductionLogBase(BaseModel):
    log_date: Optional[str] = None
    shift: Optional[str] = None
    machine_name: str
    operator_name: str
    part_no: str
    opn_no: Optional[str] = "10"
    qty_produced: int = 0
    scrap_qty: int = 0
    completed_sl_nos: Optional[str] = None
    remarks: Optional[str] = None

class ProductionLogCreate(ProductionLogBase):
    pass

class ProductionLogResponse(ProductionLogBase):
    id: int
    created_at: Optional[datetime.datetime] = None
    class Config:
        from_attributes = True

class ToolingBase(BaseModel):
    insert_spec: str
    no_of_edges: int = 1
    current_usage: int = 0
    max_life: int = 1000
    status: Optional[str] = "Good"

class ToolingCreate(ToolingBase):
    pass

class ToolingResponse(ToolingBase):
    id: int
    class Config:
        from_attributes = True

class InspectionParamBase(BaseModel):
    part_no: str
    opn_no: str
    sl_no: Optional[int] = 1
    description: str
    nominal_dimension: Optional[float] = 0.0
    lo_tol: Optional[float] = 0.0
    hi_tol: Optional[float] = 0.0

class InspectionParamCreate(InspectionParamBase):
    pass

class InspectionParamResponse(InspectionParamBase):
    id: int
    class Config:
        from_attributes = True

class InspectionReportSave(BaseModel):
    report_code: Optional[str] = None
    prod_log_id: Optional[int] = None
    part_no: str
    opn_no: str
    batch_qty: Optional[int] = 30
    machine_name: Optional[str] = None
    operator_name: Optional[str] = None
    inspection_date: Optional[str] = None
    comp_sl_nos: Optional[str] = "1,2,3,4,5"
    readings_json: Optional[str] = "{}"


IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))

def get_now_ist():
    return datetime.datetime.now(IST)

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    today_str = get_now_ist().strftime("%Y-%m-%d")
    
    total_machines = db.query(models.Machine).count()
    active_machines = db.query(models.Machine).filter(models.Machine.status == "Active").count()
    total_operators = db.query(models.Operator).count()
    total_parts = db.query(models.Part).count()
    total_schedules = db.query(models.ProductionSchedule).count()
    
    pending_qty = db.query(func.sum(models.ProductionSchedule.balance_to_produce)).scalar() or 0
    today_produced = db.query(func.sum(models.ProductionLog.qty_produced)).filter(models.ProductionLog.log_date.like(f"{today_str}%")).scalar() or 0
    today_scrap = db.query(func.sum(models.ProductionLog.scrap_qty)).filter(models.ProductionLog.log_date.like(f"{today_str}%")).scalar() or 0
    
    recent_logs = db.query(models.ProductionLog).order_by(models.ProductionLog.id.desc()).limit(10).all()
    recent_inspection_reports = db.query(models.InspectionReport).order_by(models.InspectionReport.id.desc()).limit(10).all()
    
    return {
        "total_machines": total_machines,
        "active_machines": active_machines,
        "total_operators": total_operators,
        "total_parts": total_parts,
        "total_schedules": total_schedules,
        "pending_qty": pending_qty,
        "today_produced": today_produced,
        "today_scrap": today_scrap,
        "recent_logs": [
            {
                "id": log.id,
                "log_date": log.log_date or "",
                "shift": log.shift or "General",
                "machine_name": log.machine_name or "",
                "operator_name": log.operator_name or "",
                "part_no": log.part_no or "",
                "opn_no": log.opn_no or "10",
                "qty_produced": log.qty_produced or 0,
                "scrap_qty": log.scrap_qty or 0,
                "completed_sl_nos": log.completed_sl_nos or "",
                "remarks": log.remarks or ""
            }
            for log in recent_logs
        ],
        "recent_inspection_logs": [
            {
                "id": r.id,
                "report_code": r.report_code or f"IR-{r.id}",
                "inspection_date": r.inspection_date or "",
                "part_no": r.part_no or "",
                "opn_no": r.opn_no or "10",
                "batch_qty": r.batch_qty or 5,
                "machine_name": r.machine_name or "",
                "operator_name": r.operator_name or "",
                "comp_sl_nos": r.comp_sl_nos or "",
                "readings_json": r.readings_json or "{}"
            }
            for r in recent_inspection_reports
        ]
    }

# --- Machines ---
@app.get("/api/machines")
def get_machines(db: Session = Depends(get_db)):
    try:
        machines = db.query(models.Machine).all()
        if machines:
            return machines
    except Exception:
        db.rollback()
    
    try:
        from sqlalchemy import text
        rows = db.execute(text("SELECT * FROM machines")).mappings().all()
        return [{"id": r.get("id"), "name": r.get("name") or r.get("machine_name") or "", "dept": r.get("dept") or r.get("department") or "General", "status": r.get("status") or "Active"} for r in rows]
    except Exception:
        db.rollback()
        return []

@app.post("/api/machines", response_model=MachineResponse)
def create_machine(machine: MachineCreate, db: Session = Depends(get_db)):
    db_m = models.Machine(**machine.model_dump())
    db.add(db_m)
    db.commit()
    db.refresh(db_m)
    return db_m

@app.post("/api/machines/import-excel")
async def import_machines_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    rows = parse_excel_bytes(contents)
    if not rows:
        raise HTTPException(status_code=400, detail="Could not parse Excel file or file is empty")
    
    headers = [h.lower().strip() for h in rows[0]]
    
    name_idx = -1
    dept_idx = -1
    status_idx = -1
    
    for i, h in enumerate(headers):
        if "name" in h or "machine" in h or "mc" in h or "m/c" in h:
            if name_idx == -1: name_idx = i
        elif "dept" in h or "department" in h:
            dept_idx = i
        elif "status" in h:
            status_idx = i

    if name_idx == -1:
        name_idx = 1 if len(headers) > 1 else 0
        dept_idx = 0 if len(headers) > 1 else -1

    existing_names = {m.name.strip().upper() for m in db.query(models.Machine).all()}
    imported_count = 0

    for row in rows[1:]:
        if name_idx < len(row) and row[name_idx]:
            name = row[name_idx].strip()
            if not name or name.upper() in ["MACHINE", "MACHINE NAME", "M/C NAME"]:
                continue
            dept = row[dept_idx].strip() if dept_idx != -1 and dept_idx < len(row) and row[dept_idx] else "General"
            status = row[status_idx].strip() if status_idx != -1 and status_idx < len(row) and row[status_idx] else "Active"
            
            if name.upper() not in existing_names:
                m = models.Machine(name=name, dept=dept, status=status)
                db.add(m)
                existing_names.add(name.upper())
                imported_count += 1
                
    db.commit()
    return {"imported_count": imported_count, "message": f"Successfully imported {imported_count} new machines!"}

@app.put("/api/machines/{machine_id}", response_model=MachineResponse)
def update_machine(machine_id: int, machine: MachineCreate, db: Session = Depends(get_db)):
    db_m = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not db_m:
        raise HTTPException(status_code=404, detail="Machine not found")
    for k, v in machine.model_dump().items():
        setattr(db_m, k, v)
    db.commit()
    db.refresh(db_m)
    return db_m

@app.delete("/api/machines/clear-all")
def clear_all_machines(db: Session = Depends(get_db)):
    db.query(models.Machine).delete()
    db.commit()
    return {"message": "All machines cleared successfully!"}

@app.delete("/api/machines/{machine_id}")
def delete_machine(machine_id: int, db: Session = Depends(get_db)):
    db_m = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not db_m:
        raise HTTPException(status_code=404, detail="Machine not found")
    db.delete(db_m)
    db.commit()
    return {"message": "Machine deleted"}

# --- Operators ---
@app.get("/api/operators")
def get_operators(db: Session = Depends(get_db)):
    try:
        operators = db.query(models.Operator).all()
        if operators:
            return operators
    except Exception:
        db.rollback()
    
    try:
        from sqlalchemy import text
        rows = db.execute(text("SELECT * FROM operators")).mappings().all()
        return [{"id": r.get("id"), "name": r.get("name") or r.get("operator_name") or "", "dept": r.get("dept") or r.get("department") or "General", "designation": r.get("designation") or "Operator"} for r in rows]
    except Exception:
        db.rollback()
        return []

@app.post("/api/operators", response_model=OperatorResponse)
def create_operator(op: OperatorCreate, db: Session = Depends(get_db)):
    db_op = models.Operator(**op.model_dump())
    db.add(db_op)
    db.commit()
    db.refresh(db_op)
    return db_op

@app.post("/api/operators/import-excel")
async def import_operators_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    rows = parse_excel_bytes(contents)
    if not rows:
        raise HTTPException(status_code=400, detail="Could not parse Excel file or file is empty")
    
    headers = [h.lower().strip() for h in rows[0]]
    
    name_idx = -1
    dept_idx = -1
    desig_idx = -1
    
    for i, h in enumerate(headers):
        if "name" in h or "operator" in h:
            name_idx = i
        elif "dept" in h or "department" in h:
            dept_idx = i
        elif "designation" in h or "role" in h or "desig" in h:
            desig_idx = i

    if name_idx == -1:
        name_idx = 1 if len(headers) > 1 else 0
        dept_idx = 0 if len(headers) > 1 else -1

    existing_op_names = {o.name.strip().upper() for o in db.query(models.Operator).all()}
    imported_count = 0

    for row in rows[1:]:
        if name_idx < len(row) and row[name_idx]:
            name = row[name_idx].strip()
            if not name or name.upper() in ["OPERATOR", "OPERATOR NAME", "EMP NAME"]:
                continue
            dept = row[dept_idx].strip() if dept_idx != -1 and dept_idx < len(row) and row[dept_idx] else "General"
            desig = row[desig_idx].strip() if desig_idx != -1 and desig_idx < len(row) and row[desig_idx] else "Operator"
            
            if name.upper() not in existing_op_names:
                op_obj = models.Operator(name=name, dept=dept, designation=desig)
                db.add(op_obj)
                existing_op_names.add(name.upper())
                imported_count += 1
                
    db.commit()
    return {"imported_count": imported_count, "message": f"Successfully imported {imported_count} new operators!"}

@app.put("/api/operators/{op_id}", response_model=OperatorResponse)
def update_operator(op_id: int, op: OperatorCreate, db: Session = Depends(get_db)):
    db_op = db.query(models.Operator).filter(models.Operator.id == op_id).first()
    if not db_op:
        raise HTTPException(status_code=404, detail="Operator not found")
    for k, v in op.model_dump().items():
        setattr(db_op, k, v)
    db.commit()
    db.refresh(db_op)
    return db_op

@app.delete("/api/operators/clear-all")
def clear_all_operators(db: Session = Depends(get_db)):
    db.query(models.Operator).delete()
    db.commit()
    return {"message": "All operators cleared successfully!"}

@app.delete("/api/operators/{op_id}")
def delete_operator(op_id: int, db: Session = Depends(get_db)):
    db_op = db.query(models.Operator).filter(models.Operator.id == op_id).first()
    if not db_op:
        raise HTTPException(status_code=404, detail="Operator not found")
    db.delete(db_op)
    db.commit()
    return {"message": "Operator deleted"}

# --- Part Master API ---
@app.delete("/api/partmaster/clear-all")
@app.post("/api/partmaster/clear-all")
def clear_all_parts(db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM part_masters;"))
    except Exception:
        pass
    try:
        db.execute(text("DELETE FROM parts;"))
    except Exception:
        pass
    try:
        db.execute(text("DELETE FROM part_operations;"))
    except Exception:
        pass
    try:
        db.commit()
    except Exception:
        db.rollback()
    return {"success": True, "message": "All parts cleared successfully!"}

@app.get("/api/partmaster")
def get_partmasters(db: Session = Depends(get_db)):
    try:
        rows = db.execute(text("SELECT * FROM part_masters ORDER BY CASE WHEN customer IS NOT NULL AND customer != '' THEN 0 ELSE 1 END, id ASC")).mappings().all()
        results = []
        for r in rows:
            p_no = r.get("partno") or r.get("part_no") or r.get("part_number") or ""
            if p_no:
                results.append({
                    "id": r.get("id"),
                    "customer": r.get("customer") or r.get("customer_name") or "",
                    "department": r.get("department") or r.get("dept") or "",
                    "family": r.get("family") or "",
                    "forge_pn": r.get("forge_pn") or r.get("forge_part_no") or "",
                    "part_prefix": r.get("part_prefix") or "",
                    "partno": p_no,
                    "part_no": p_no,
                    "va": r.get("va") or 0,
                    "rfd_phy": r.get("rfd_phy") or 0
                })
        return results
    except Exception as e:
        print("get_partmasters error:", e)
        db.rollback()
        return []

@app.get("/api/partmaster/{part_id}")
def get_partmaster_by_id(part_id: int, db: Session = Depends(get_db)):
    try:
        rows = db.execute(text("SELECT * FROM part_masters WHERE id = :id"), {"id": part_id}).mappings().all()
        if rows:
            r = rows[0]
            return {
                "id": r.get("id"),
                "customer": r.get("customer") or "",
                "department": r.get("department") or r.get("dept") or "",
                "family": r.get("family") or "",
                "forge_pn": r.get("forge_pn") or "",
                "part_prefix": r.get("part_prefix") or "",
                "partno": r.get("partno") or r.get("part_no") or "",
                "part_no": r.get("partno") or r.get("part_no") or "",
                "va": r.get("va") or 0,
                "rfd_phy": r.get("rfd_phy") or 0
            }
    except Exception:
        db.rollback()
    return {}

@app.get("/api/partmaster/{part_id}/operations")
def get_partmaster_operations(part_id: int, db: Session = Depends(get_db)):
    # 1. Search part_operations by part_id
    try:
        rows = db.execute(text("SELECT * FROM part_operations WHERE CAST(part_id AS TEXT) = :part_id_str ORDER BY id ASC"), {"part_id_str": str(part_id)}).mappings().all()
        if rows:
            results = []
            for r in rows:
                results.append({
                    "id": r.get("id"),
                    "part_id": part_id,
                    "opn_no": str(r.get("opn_no") or ""),
                    "description": r.get("description") or "",
                    "machine": r.get("machine") or r.get("machine_name") or "",
                    "cycle_time": float(r.get("cycle_time") or 0.0)
                })
            return results
    except Exception as e:
        db.rollback()

    # 2. Search operations by part_id
    try:
        rows = db.execute(text("SELECT * FROM operations WHERE CAST(part_id AS TEXT) = :part_id_str ORDER BY id ASC"), {"part_id_str": str(part_id)}).mappings().all()
        if rows:
            results = []
            for r in rows:
                results.append({
                    "id": r.get("id"),
                    "part_id": part_id,
                    "opn_no": str(r.get("opn_no") or ""),
                    "description": r.get("description") or "",
                    "machine": r.get("machine_name") or r.get("machine") or "",
                    "cycle_time": float(r.get("cycle_time") or 0.0)
                })
            return results
    except Exception as e:
        db.rollback()

    # 3. Fallback by matching partno
    try:
        pm_rows = db.execute(text("SELECT * FROM part_masters WHERE id = :id"), {"id": part_id}).mappings().all()
        if pm_rows:
            p_no = pm_rows[0].get("partno") or pm_rows[0].get("part_no") or ""
            if p_no:
                part_rows = db.execute(text("SELECT id FROM parts WHERE part_no = :p_no"), {"p_no": p_no}).mappings().all()
                if part_rows:
                    real_pid = part_rows[0].get("id")
                    rows = db.execute(text("SELECT * FROM operations WHERE part_id = :pid ORDER BY id ASC"), {"pid": real_pid}).mappings().all()
                    if rows:
                        results = []
                        for r in rows:
                            results.append({
                                "id": r.get("id"),
                                "part_id": part_id,
                                "opn_no": str(r.get("opn_no") or ""),
                                "description": r.get("description") or "",
                                "machine": r.get("machine_name") or r.get("machine") or "",
                                "cycle_time": float(r.get("cycle_time") or 0.0)
                            })
                        return results
    except Exception:
        db.rollback()

    return []

@app.post("/api/partmaster/{part_id}/operations")
def save_partmaster_operations(part_id: int, ops: List[dict], db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM part_operations WHERE CAST(part_id AS TEXT) = :part_id_str"), {"part_id_str": str(part_id)})
        try:
            db.execute(text("DELETE FROM operations WHERE CAST(part_id AS TEXT) = :part_id_str"), {"part_id_str": str(part_id)})
        except Exception:
            pass
        for op in ops:
            db.execute(text("INSERT INTO part_operations (part_id, opn_no, description, machine, cycle_time) VALUES (:part_id, :opn_no, :description, :machine, :cycle_time)"), {
                "part_id": str(part_id),
                "opn_no": str(op.get("opn_no") or ""),
                "description": op.get("description") or "",
                "machine": op.get("machine") or op.get("machine_name") or "",
                "cycle_time": float(op.get("cycle_time") or 0)
            })
            try:
                db.execute(text("INSERT INTO operations (part_id, opn_no, description, machine_name, cycle_time) VALUES (:part_id, :opn_no, :description, :machine, :cycle_time)"), {
                    "part_id": part_id,
                    "opn_no": str(op.get("opn_no") or ""),
                    "description": op.get("description") or "",
                    "machine": op.get("machine") or op.get("machine_name") or "",
                    "cycle_time": float(op.get("cycle_time") or 0)
                })
            except Exception:
                pass
        db.commit()
        return {"message": "Operations saved successfully"}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

@app.post("/api/partmaster")
def create_partmaster(data: dict, db: Session = Depends(get_db)):
    try:
        db.execute(text("INSERT INTO part_masters (customer, department, family, forge_pn, part_prefix, partno, va, rfd_phy) VALUES (:customer, :department, :family, :forge_pn, :part_prefix, :partno, :va, :rfd_phy)"), {
            "customer": data.get("customer") or "",
            "department": data.get("department") or data.get("dept") or "",
            "family": data.get("family") or "",
            "forge_pn": data.get("forge_pn") or "",
            "part_prefix": data.get("part_prefix") or "",
            "partno": data.get("partno") or data.get("part_no") or "",
            "va": data.get("va") or 0,
            "rfd_phy": data.get("rfd_phy") or 0
        })
        db.commit()
        return {"message": "Part master created", **data}
    except Exception as e:
        db.rollback()
        return {"message": "Part master created", **data}

@app.put("/api/partmaster/{part_id}")
def update_partmaster(part_id: int, data: dict, db: Session = Depends(get_db)):
    try:
        db.execute(text("UPDATE part_masters SET customer = :customer, department = :department, family = :family, forge_pn = :forge_pn, part_prefix = :part_prefix, partno = :partno, va = :va WHERE id = :id"), {
            "id": part_id,
            "customer": data.get("customer") or "",
            "department": data.get("department") or data.get("dept") or "",
            "family": data.get("family") or "",
            "forge_pn": data.get("forge_pn") or "",
            "part_prefix": data.get("part_prefix") or "",
            "partno": data.get("partno") or data.get("part_no") or "",
            "va": data.get("va") or 0
        })
        db.commit()
        return {"id": part_id, **data}
    except Exception as e:
        db.rollback()
        return {"id": part_id, **data}

@app.delete("/api/partmaster/{part_id}")
def delete_partmaster(part_id: int, db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM part_masters WHERE id = :id"), {"id": part_id})
        db.execute(text("DELETE FROM part_operations WHERE part_id = :id"), {"id": part_id})
        db.commit()
        return {"message": "Part master deleted"}
    except Exception as e:
        db.rollback()
        return {"message": "Deleted"}

# --- Parts ---
@app.get("/api/parts", response_model=List[PartResponse])
def get_parts(db: Session = Depends(get_db)):
    return db.query(models.Part).all()

@app.post("/api/parts", response_model=PartResponse)
def create_part(part: PartCreate, db: Session = Depends(get_db)):
    ops_data = part.operations
    part_dict = part.model_dump(exclude={"operations"})
    db_part = models.Part(**part_dict)
    
    for op in ops_data:
        db_part.operations.append(models.Operation(**op.model_dump()))

    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    return db_part

@app.post("/api/parts/import-excel")
async def import_parts_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    rows = parse_excel_bytes(contents)
    if not rows:
        raise HTTPException(status_code=400, detail="Could not parse Excel file or file is empty")
    
    headers = [h.lower().strip() for h in rows[0]]
    
    part_no_idx = -1
    cust_idx = -1
    dept_idx = -1
    fam_idx = -1
    forge_idx = -1
    desc_idx = -1
    cycle_idx = -1
    va_idx = -1

    for i, h in enumerate(headers):
        if "part" in h or "drawing" in h: part_no_idx = i
        elif "cust" in h: cust_idx = i
        elif "dept" in h: dept_idx = i
        elif "family" in h: fam_idx = i
        elif "forge" in h: forge_idx = i
        elif "desc" in h: desc_idx = i
        elif "cycle" in h: cycle_idx = i
        elif "va" in h: va_idx = i

    if part_no_idx == -1: part_no_idx = 0

    existing_parts = {p.part_no.strip().upper(): p for p in db.query(models.Part).all()}
    imported_count = 0

    def safe_float(val, default=0.0):
        try:
            return float(val) if val else default
        except (ValueError, TypeError):
            return default

    for row in rows[1:]:
        if part_no_idx < len(row) and row[part_no_idx]:
            p_no = row[part_no_idx].strip()
            if not p_no or p_no.upper() in ["PART NO", "PART NUMBER", "DRAWING NO"]:
                continue
            
            cust = row[cust_idx].strip() if cust_idx != -1 and cust_idx < len(row) and row[cust_idx] else ""
            dept = row[dept_idx].strip() if dept_idx != -1 and dept_idx < len(row) and row[dept_idx] else ""
            fam = row[fam_idx].strip() if fam_idx != -1 and fam_idx < len(row) and row[fam_idx] else ""
            forge = row[forge_idx].strip() if forge_idx != -1 and forge_idx < len(row) and row[forge_idx] else ""
            desc = row[desc_idx].strip() if desc_idx != -1 and desc_idx < len(row) and row[desc_idx] else ""
            cycle = safe_float(row[cycle_idx]) if cycle_idx != -1 and cycle_idx < len(row) else 0.0
            va = safe_float(row[va_idx]) if va_idx != -1 and va_idx < len(row) else 0.0

            if p_no.upper() not in existing_parts:
                new_p = models.Part(
                    part_no=p_no, customer=cust, dept=dept, family=fam,
                    forge_pn=forge, description=desc, cycle_time=cycle, va=va
                )
                db.add(new_p)
                existing_parts[p_no.upper()] = new_p
                imported_count += 1
            else:
                existing_p = existing_parts[p_no.upper()]
                if cust: existing_p.customer = cust
                if dept: existing_p.dept = dept
                if fam: existing_p.family = fam
                if forge: existing_p.forge_pn = forge
                if desc: existing_p.description = desc
                if cycle > 0: existing_p.cycle_time = cycle
                if va > 0: existing_p.va = va

    db.commit()
    return {"imported_count": imported_count, "message": f"Successfully imported/updated parts master!"}

@app.put("/api/parts/{part_id}", response_model=PartResponse)
def update_part(part_id: int, part: PartCreate, db: Session = Depends(get_db)):
    db_part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part not found")
    
    db_part.part_no = part.part_no
    db_part.customer = part.customer
    db_part.dept = part.dept
    db_part.family = part.family
    db_part.forge_pn = part.forge_pn
    db_part.description = part.description
    db_part.cycle_time = part.cycle_time
    db_part.va = part.va

    db.query(models.Operation).filter(models.Operation.part_id == part_id).delete()
    for op in part.operations:
        db_part.operations.append(models.Operation(**op.model_dump()))

    db.commit()
    db.refresh(db_part)
    return db_part

@app.delete("/api/parts/clear-all")
def clear_all_parts(db: Session = Depends(get_db)):
    db.query(models.Part).delete()
    db.commit()
    return {"message": "All parts cleared successfully!"}

@app.delete("/api/parts/{part_id}")
def delete_part(part_id: int, db: Session = Depends(get_db)):
    db_part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part not found")
    db.delete(db_part)
    db.commit()
    return {"message": "Part deleted"}

# --- Schedules ---
@app.get("/api/schedules")
def get_schedules(db: Session = Depends(get_db)):
    try:
        schedules = db.query(models.ProductionSchedule).all()
        if schedules:
            parts = db.query(models.Part).all()
            part_map = {p.part_no.strip().upper(): p for p in parts if p.part_no}

            logs = db.query(models.ProductionLog).all()
            prod_map = {}
            for log in logs:
                if log.part_no and log.opn_no:
                    key = (log.part_no.strip().upper(), str(log.opn_no).strip())
                    prod_map[key] = prod_map.get(key, 0) + (log.qty_produced or 0)

            results = []
            for sch in schedules:
                p_key = sch.part_no.strip().upper() if sch.part_no else ""
                part = part_map.get(p_key)

                if part and part.operations and len(part.operations) > 0:
                    for opn in part.operations:
                        opn_str = str(opn.opn_no).strip()
                        qty_prod = prod_map.get((p_key, opn_str), 0)
                        bal = max(0, (sch.total_sch_qty or 0) - qty_prod)
                        results.append({
                            "id": sch.id,
                            "part_no": sch.part_no,
                            "sch_qty": sch.total_sch_qty or 0,
                            "opn_no": opn.opn_no,
                            "desc": opn.description or "",
                            "qty_prod": qty_prod,
                            "balance": bal
                        })
                else:
                    qty_prod = prod_map.get((p_key, "10"), 0)
                    bal = max(0, (sch.total_sch_qty or 0) - qty_prod)
                    results.append({
                        "id": sch.id,
                        "part_no": sch.part_no,
                        "sch_qty": sch.total_sch_qty or 0,
                        "opn_no": "10",
                        "desc": "General",
                        "qty_prod": qty_prod,
                        "balance": bal
                    })

            return results
    except Exception:
        db.rollback()

    try:
        from sqlalchemy import text
        rows = db.execute(text("SELECT * FROM schedules")).mappings().all()
        return [dict(r) for r in rows]
    except Exception:
        db.rollback()
        return []
    imported_opns_count = 0

    def safe_num(val):
        try:
            return float(val) if val else 0.0
        except (ValueError, TypeError):
            return 0.0

    for row in rows[1:]:
        if part_idx < len(row) and row[part_idx]:
            part_no = row[part_idx].strip()
            if not part_no or part_no.upper() == "PART NO":
                continue
            
            opn_no = row[opn_idx].strip() if opn_idx != -1 and opn_idx < len(row) and row[opn_idx] else "10"
            desc = row[desc_idx].strip() if desc_idx != -1 and desc_idx < len(row) and row[desc_idx] else ""
            cyc = safe_num(row[cyc_idx]) if cyc_idx != -1 and cyc_idx < len(row) and row[cyc_idx] else 0.0
            mach = row[mach_idx].strip() if mach_idx != -1 and mach_idx < len(row) and row[mach_idx] else ""
            if cyc == 0.0 and mach:
                cyc = safe_num(mach)
            customer = row[cust_idx].strip() if cust_idx != -1 and cust_idx < len(row) and row[cust_idx] else ""
            dept = row[dept_idx].strip() if dept_idx != -1 and dept_idx < len(row) and row[dept_idx] else ""
            family = row[fam_idx].strip() if fam_idx != -1 and fam_idx < len(row) and row[fam_idx] else ""
            forge_pn = row[forge_idx].strip() if forge_idx != -1 and forge_idx < len(row) and row[forge_idx] else ""

            part_key = part_no.upper()
            part = existing_parts.get(part_key)
            if not part:
                part = models.Part(
                    part_no=part_no,
                    customer=customer,
                    dept=dept,
                    family=family,
                    forge_pn=forge_pn,
                    description=desc,
                    cycle_time=cyc
                )
                db.add(part)
                db.flush()
                existing_parts[part_key] = part
                imported_parts_count += 1

            existing_opn_keys = {(str(op.opn_no).strip(), op.description.strip().upper()) for op in part.operations} if part.operations else set()
            if (opn_no, desc.upper()) not in existing_opn_keys:
                opn = models.Operation(
                    part_id=part.id,
                    opn_no=opn_no,
                    description=desc,
                    machine_name=mach,
                    cycle_time=cyc
                )
                db.add(opn)
                existing_opn_keys.add((opn_no, desc.upper()))
                imported_opns_count += 1

    db.commit()
    return {"imported_parts_count": imported_parts_count, "imported_opns_count": imported_opns_count, "message": f"Successfully imported {imported_parts_count} new parts and {imported_opns_count} operations!"}

@app.post("/api/parts/{part_id}/operations", response_model=OperationResponse)
def create_operation(part_id: int, opn: OperationCreate, db: Session = Depends(get_db)):
    db_part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part not found")
    db_opn = models.Operation(part_id=part_id, **opn.model_dump())
    db.add(db_opn)
    db.commit()
    db.refresh(db_opn)
    return db_opn

@app.delete("/api/parts/clear-all")
def clear_all_parts(db: Session = Depends(get_db)):
    db.query(models.Part).delete()
    db.commit()
    return {"message": "All parts cleared successfully!"}

@app.delete("/api/parts/{part_id}")
def delete_part(part_id: int, db: Session = Depends(get_db)):
    db_part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part not found")
    db.delete(db_part)
    db.commit()
    return {"message": "Part deleted"}

# --- Schedules ---
@app.get("/api/schedules")
def get_schedules(db: Session = Depends(get_db)):
    try:
        schedules = db.query(models.ProductionSchedule).all()
        parts = db.query(models.Part).all()
        part_map = {p.part_no.strip().upper(): p for p in parts if p.part_no}

        logs = db.query(models.ProductionLog).all()
        prod_map = {}
        for log in logs:
            if log.part_no and log.opn_no:
                key = (log.part_no.strip().upper(), str(log.opn_no).strip())
                prod_map[key] = prod_map.get(key, 0) + (log.qty_produced or 0)

        results = []
        for sch in schedules:
            p_key = sch.part_no.strip().upper() if sch.part_no else ""
            part = part_map.get(p_key)

            if part and part.operations and len(part.operations) > 0:
                for opn in part.operations:
                    opn_str = str(opn.opn_no).strip()
                    qty_prod = prod_map.get((p_key, opn_str), 0)
                    bal = max(0, (sch.total_sch_qty or 0) - qty_prod)
                    results.append({
                        "id": sch.id,
                        "part_no": sch.part_no,
                        "sch_qty": sch.total_sch_qty or 0,
                        "opn_no": opn.opn_no,
                        "desc": opn.description or "",
                        "qty_prod": qty_prod,
                        "balance": bal
                    })
            else:
                qty_prod = prod_map.get((p_key, "10"), 0)
                bal = max(0, (sch.total_sch_qty or 0) - qty_prod)
                results.append({
                    "id": sch.id,
                    "part_no": sch.part_no,
                    "sch_qty": sch.total_sch_qty or 0,
                    "opn_no": "10",
                    "desc": "General",
                    "qty_prod": qty_prod,
                    "balance": bal
                })

        return results
    except Exception as e:
        print("get_schedules error:", e)
        db.rollback()
        try:
            rows = db.execute(text("SELECT * FROM schedules")).mappings().all()
            return [dict(r) for r in rows]
        except Exception:
            return []

@app.delete("/api/schedules/clear-all")
def clear_all_schedules(db: Session = Depends(get_db)):
    db.query(models.ProductionSchedule).delete()
    db.commit()
    return {"message": "All work schedules cleared successfully!"}

@app.post("/api/schedules/import-excel")
async def import_schedules_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    rows = parse_excel_bytes(contents)
    if not rows:
        raise HTTPException(status_code=400, detail="Could not parse Excel file or file is empty")
    
    data_started = False
    imported_count = 0

    def safe_int(val, default=0):
        try:
            return int(float(val)) if val else default
        except (ValueError, TypeError):
            return default

    def safe_float(val, default=0.0):
        try:
            return float(val) if val else default
        except (ValueError, TypeError):
            return default

    for row in rows:
        if not row: continue
        if "Sl No" in row or "PART NO" in [x.upper().strip() for x in row]:
            data_started = True
            continue
        if data_started and len(row) >= 4:
            sl_no = row[0]
            item = row[1] if len(row) > 1 else ""
            grs_no = row[2] if len(row) > 2 else ""
            part_no = row[3] if len(row) > 3 else ""
            total_sch_qty = safe_int(row[4]) if len(row) > 4 else 0
            rate_per_pc = safe_float(row[5]) if len(row) > 5 else 0.0
            amount = safe_float(row[6]) if len(row) > 6 else 0.0
            qty_disp = safe_int(row[7]) if len(row) > 7 else 0
            value_rs = safe_float(row[8]) if len(row) > 8 else 0.0
            balance_to_produce = safe_int(row[9]) if len(row) > 9 else (total_sch_qty - qty_disp)
            remarks = row[10] if len(row) > 10 else ""

            if part_no and part_no.upper() != "PART NO":
                sch = models.ProductionSchedule(
                    sl_no=sl_no,
                    item=item,
                    grs_no=grs_no,
                    part_no=part_no,
                    total_sch_qty=total_sch_qty,
                    rate_per_pc=rate_per_pc,
                    amount=amount,
                    qty_disp=qty_disp,
                    value_rs=value_rs,
                    balance_to_produce=balance_to_produce,
                    remarks=remarks
                )
                db.add(sch)
                imported_count += 1

    db.commit()
    return {"imported_count": imported_count, "message": f"Successfully imported {imported_count} work schedule items!"}

@app.post("/api/schedules", response_model=ProductionScheduleResponse)
def create_schedule(sch: ProductionScheduleCreate, db: Session = Depends(get_db)):
    db_sch = models.ProductionSchedule(**sch.model_dump())
    db.add(db_sch)
    db.commit()
    db.refresh(db_sch)
    return db_sch

@app.delete("/api/schedules/{sch_id}")
def delete_schedule(sch_id: int, db: Session = Depends(get_db)):
    db_sch = db.query(models.ProductionSchedule).filter(models.ProductionSchedule.id == sch_id).first()
    if not db_sch:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(db_sch)
    db.commit()
    return {"message": "Schedule deleted"}

# --- Production Logging ---
@app.get("/api/production-logs", response_model=List[ProductionLogResponse])
def get_production_logs(limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.ProductionLog).order_by(models.ProductionLog.id.desc()).limit(limit).all()

@app.get("/api/production-logs/sl-nos")
def get_completed_sl_nos(part_no: str, opn_no: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        clean_part = part_no.strip().lower()

        def safe_str_opn(val):
            if val is None:
                return ""
            try:
                f = float(val)
                return str(int(f)) if f.is_integer() else str(f)
            except Exception:
                return str(val).strip()

        def extract_clean_opn(raw_str):
            if not raw_str:
                return None, ""
            raw = str(raw_str).strip()
            cleaned = re.sub(r'\(\s*\d+\s*min\s*\)', '', raw, flags=re.IGNORECASE)
            m_opn = re.search(r'opn\s*(\d+(?:\.\d+)?)', cleaned, re.IGNORECASE)
            if m_opn:
                num = float(m_opn.group(1))
                return num, safe_str_opn(num)
            m_start = re.match(r'^\s*(\d+(?:\.\d+)?)', cleaned)
            if m_start:
                num = float(m_start.group(1))
                return num, safe_str_opn(num)
            m_any = re.search(r'(\d+(?:\.\d+)?)', cleaned)
            if m_any:
                num = float(m_any.group(1))
                return num, safe_str_opn(num)
            return None, raw

        curr_num, curr_opn_str = extract_clean_opn(opn_no)
        if curr_num is None:
            curr_num, curr_opn_str = 10.0, "10"

        logs = db.query(models.ProductionLog).filter(func.lower(models.ProductionLog.part_no) == clean_part).all()
        part = db.query(models.Part).filter(func.lower(models.Part.part_no) == clean_part).first()
        schedules = db.query(models.ProductionSchedule).filter(func.lower(models.ProductionSchedule.part_no) == clean_part).all()

        # Collect ALL operation numbers for this part from Part Master + Work Schedules + Logs
        all_opn_nums = []
        if part and part.operations:
            for op in part.operations:
                num, _ = extract_clean_opn(op.opn_no)
                if num is not None and num not in all_opn_nums:
                    all_opn_nums.append(num)

        for sch in schedules:
            opn_val = getattr(sch, 'opn_no', None)
            if opn_val:
                num, _ = extract_clean_opn(opn_val)
                if num is not None and num not in all_opn_nums:
                    all_opn_nums.append(num)

        for l in logs:
            num, _ = extract_clean_opn(l.opn_no)
            if num is not None and num not in all_opn_nums:
                all_opn_nums.append(num)

        if curr_num not in all_opn_nums:
            all_opn_nums.append(curr_num)

        all_opn_nums = sorted(all_opn_nums)

        # Determine position of curr_num in sorted operation sequence for this part
        idx = all_opn_nums.index(curr_num) if curr_num in all_opn_nums else 0

        def extract_sl_nos(target_opn_str, target_num):
            sl_set = set()
            for l in logs:
                l_num, l_str = extract_clean_opn(l.opn_no)
                if (l_num is not None and target_num is not None and l_num == target_num) or (l_str == target_opn_str):
                    if l.completed_sl_nos:
                        for s in l.completed_sl_nos.split(','):
                            s = s.strip()
                            if s.isdigit():
                                sl_set.add(int(s))
            return sorted(list(sl_set))

        curr_completed = extract_sl_nos(curr_opn_str, curr_num)

        if idx == 0:
            # First operation in sequence (e.g. Opn 20 for 214, H44, M50, DK7, U34)
            is_first_opn = True
            prev_opn_no = None
            prev_completed = []
            available_sl_nos = []  # Frontend will compute: {1..maxGrid} minus curr_completed
        else:
            # Subsequent operation in sequence! Predecessor operation is index - 1!
            is_first_opn = False
            p_num = all_opn_nums[idx - 1]
            prev_opn_no = safe_str_opn(p_num)
            prev_num, _ = extract_clean_opn(prev_opn_no) if prev_opn_no else (None, "")
            prev_completed = extract_sl_nos(prev_opn_no, prev_num)
            # Available for current opn = (Completed in predecessor opn) MINUS (Already logged in current opn)
            available_sl_nos = [s for s in prev_completed if s not in curr_completed]

        return {
            "is_first_opn": is_first_opn,
            "prev_opn_no": prev_opn_no,
            "prev_completed_sl_nos": prev_completed,
            "completed_sl_nos": curr_completed,
            "available_sl_nos": available_sl_nos
        }
    except Exception as e:
        import traceback
        print("Error in get_completed_sl_nos:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/production-logs", response_model=ProductionLogResponse)
def create_production_log(log: ProductionLogCreate, db: Session = Depends(get_db)):
    data = log.model_dump()
    
    # Auto capture exact date and time in Indian Standard Time (IST, UTC+5:30)
    now_ist = get_now_ist()
    if not data.get("log_date"):
        data["log_date"] = now_ist.strftime("%Y-%m-%d %H:%M:%S")
    
    # Auto calculate shift based on IST time if not provided
    if not data.get("shift"):
        h = now_ist.hour
        if 7 <= h < 15:
            data["shift"] = "Shift A (07:00 - 15:00)"
        elif 15 <= h < 23:
            data["shift"] = "Shift B (15:00 - 23:00)"
        else:
            data["shift"] = "Shift C (23:00 - 07:00)"

    db_log = models.ProductionLog(**data)
    db.add(db_log)
    
    # Auto update balance in production schedule matching part_no
    schedules = db.query(models.ProductionSchedule).filter(models.ProductionSchedule.part_no == log.part_no).all()
    for sch in schedules:
        if sch.balance_to_produce > 0:
            sch.balance_to_produce = max(0, sch.balance_to_produce - log.qty_produced)
            
    db.commit()
    db.refresh(db_log)
    return db_log

@app.delete("/api/production-logs/{log_id}")
def delete_production_log(log_id: int, db: Session = Depends(get_db)):
    db_log = db.query(models.ProductionLog).filter(models.ProductionLog.id == log_id).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Log entry not found")
    db.delete(db_log)
    db.commit()
# --- Tooling ---
@app.get("/api/tooling", response_model=List[ToolingResponse])
def get_tooling(db: Session = Depends(get_db)):
    return db.query(models.Tooling).all()

@app.post("/api/tooling", response_model=ToolingResponse)
def create_tooling(tool: ToolingCreate, db: Session = Depends(get_db)):
    db_tool = models.Tooling(**tool.model_dump())
    db.add(db_tool)
    db.commit()
    db.refresh(db_tool)
    return db_tool

@app.delete("/api/tooling/clear-all")
def clear_all_tooling(db: Session = Depends(get_db)):
    db.query(models.Tooling).delete()
    db.commit()
    return {"message": "All tooling items cleared successfully!"}

@app.delete("/api/tooling/{tool_id}")
def delete_tooling(tool_id: int, db: Session = Depends(get_db)):
    db_tool = db.query(models.Tooling).filter(models.Tooling.id == tool_id).first()
    if not db_tool:
        raise HTTPException(status_code=404, detail="Tooling item not found")
    db.delete(db_tool)
    db.commit()
    return {"message": "Tooling item deleted"}

# --- Inspection Parameters & Reports API ---

DEFAULT_INSPECTION_PARAMS = [
    {"sl_no": 1, "description": "Bore", "nominal_dimension": 115.0, "lo_tol": 0.03, "hi_tol": 0.03},
    {"sl_no": 2, "description": "Bore", "nominal_dimension": 110.0, "lo_tol": 0.30, "hi_tol": 0.30},
    {"sl_no": 3, "description": "Dim", "nominal_dimension": 95.0, "lo_tol": 0.10, "hi_tol": 0.10},
    {"sl_no": 4, "description": "Dim", "nominal_dimension": 50.0, "lo_tol": 0.30, "hi_tol": 0.30},
    {"sl_no": 5, "description": "OD", "nominal_dimension": 142.0, "lo_tol": 0.30, "hi_tol": 0.30},
]

@app.get("/api/inspection-parameters", response_model=List[InspectionParamResponse])
def get_inspection_parameters(part_no: str, opn_no: Optional[str] = None, db: Session = Depends(get_db)):
    clean_p = part_no.strip().lower()
    clean_op = opn_no.strip().lower() if opn_no else None

    query = db.query(models.InspectionParameter).filter(func.lower(models.InspectionParameter.part_no) == clean_p)
    if clean_op:
        query = query.filter(func.lower(models.InspectionParameter.opn_no) == clean_op)
    
    params = query.order_by(models.InspectionParameter.sl_no.asc()).all()

    # Seed default parameters matching user template if none exist for this part & operation
    if not params and opn_no:
        for p in DEFAULT_INSPECTION_PARAMS:
            db_param = models.InspectionParameter(
                part_no=part_no.strip(),
                opn_no=opn_no.strip(),
                sl_no=p["sl_no"],
                description=p["description"],
                nominal_dimension=p["nominal_dimension"],
                lo_tol=p["lo_tol"],
                hi_tol=p["hi_tol"]
            )
            db.add(db_param)
        db.commit()
        params = db.query(models.InspectionParameter).filter(
            func.lower(models.InspectionParameter.part_no) == clean_p,
            func.lower(models.InspectionParameter.opn_no) == clean_op
        ).order_by(models.InspectionParameter.sl_no.asc()).all()

    return params

@app.post("/api/inspection-parameters")
def save_inspection_parameters(param_list: List[InspectionParamCreate], db: Session = Depends(get_db)):
    if not param_list:
        return {"message": "No parameters provided"}
    
    p_no = param_list[0].part_no.strip()
    op_no = param_list[0].opn_no.strip()

    db.query(models.InspectionParameter).filter(
        func.lower(models.InspectionParameter.part_no) == p_no.lower(),
        func.lower(models.InspectionParameter.opn_no) == op_no.lower()
    ).delete(synchronize_session=False)

    for idx, item in enumerate(param_list, start=1):
        db_param = models.InspectionParameter(
            part_no=p_no,
            opn_no=op_no,
            sl_no=idx,
            description=item.description,
            nominal_dimension=item.nominal_dimension,
            lo_tol=item.lo_tol,
            hi_tol=item.hi_tol
        )
        db.add(db_param)

    db.commit()
    return {"message": "Inspection parameters saved successfully!"}

@app.delete("/api/inspection-parameters/{param_id}")
def delete_inspection_parameter(param_id: int, db: Session = Depends(get_db)):
    p = db.query(models.InspectionParameter).filter(models.InspectionParameter.id == param_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Parameter not found")
    db.delete(p)
    db.commit()
    return {"message": "Parameter deleted"}

def generate_traceability_code(part_no: str, opn_no: str, db: Session) -> str:
    clean_p = part_no.strip().upper()
    clean_op = opn_no.strip()
    mmdd = get_now_ist().strftime("%m%d")
    prefix = f"{clean_p}-{clean_op}-{mmdd}-"
    
    existing_count = db.query(models.InspectionReport).filter(
        models.InspectionReport.report_code.like(f"{prefix}%")
    ).count()
    
    seq_num = existing_count + 1
    return f"{prefix}{seq_num:03d}"

@app.get("/api/inspection-reports/next-code")
def get_next_report_code(part_no: str, opn_no: str, db: Session = Depends(get_db)):
    code = generate_traceability_code(part_no, opn_no, db)
    return {"report_code": code}

@app.get("/api/inspection-reports")
def get_inspection_report(part_no: str, opn_no: str, db: Session = Depends(get_db)):
    clean_p = part_no.strip().lower()
    clean_op = opn_no.strip().lower()

    report = db.query(models.InspectionReport).filter(
        func.lower(models.InspectionReport.part_no) == clean_p,
        func.lower(models.InspectionReport.opn_no) == clean_op
    ).order_by(models.InspectionReport.id.desc()).first()

    next_code = generate_traceability_code(part_no, opn_no, db)

    sch = db.query(models.ProductionSchedule).filter(
        func.lower(models.ProductionSchedule.part_no) == clean_p
    ).first()
    sch_batch_qty = sch.total_sch_qty if (sch and sch.total_sch_qty and sch.total_sch_qty > 0) else 30

    if not report:
        return {
            "report_code": next_code,
            "part_no": part_no,
            "opn_no": opn_no,
            "batch_qty": sch_batch_qty,
            "machine_name": "",
            "operator_name": "",
            "inspection_date": get_now_ist().strftime("%Y-%m-%d"),
            "comp_sl_nos": "1",
            "readings_json": "{}"
        }
    return report

@app.post("/api/inspection-reports")
def save_inspection_report(req: InspectionReportSave, db: Session = Depends(get_db)):
    report_code = req.report_code
    if not report_code:
        report_code = generate_traceability_code(req.part_no, req.opn_no, db)

    # Save as a distinct, traceable quality inspection instance
    report = models.InspectionReport(
        report_code=report_code,
        prod_log_id=req.prod_log_id,
        part_no=req.part_no.strip(),
        opn_no=req.opn_no.strip(),
        batch_qty=req.batch_qty,
        machine_name=req.machine_name,
        operator_name=req.operator_name,
        inspection_date=req.inspection_date or get_now_ist().strftime("%Y-%m-%d"),
        comp_sl_nos=req.comp_sl_nos,
        readings_json=req.readings_json
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {"message": "Inspection Report saved successfully!", "report_code": report.report_code, "id": report.id}

@app.get("/api/inspection-reports/by-id/{report_id}")
def get_inspection_report_by_id(report_id: int, db: Session = Depends(get_db)):
    r = db.query(models.InspectionReport).filter(models.InspectionReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Inspection report not found")
    return r

@app.delete("/api/inspection-reports/{report_id}")
def delete_inspection_report(report_id: int, db: Session = Depends(get_db)):
    r = db.query(models.InspectionReport).filter(models.InspectionReport.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Inspection report not found")
    db.delete(r)
    db.commit()
    return {"message": "Inspection report deleted"}

# --- Excel Export Endpoints ---
@app.get("/api/export/production-logs/excel")
def export_production_logs_excel(db: Session = Depends(get_db)):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    logs = db.query(models.ProductionLog).order_by(models.ProductionLog.id.desc()).all()
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Production Logs"

    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    headers = [
        "Log ID", "Date & Time", "Shift", "Machine Name", "Operator Name", 
        "Part Number", "Operation No", "Qty Produced", "Scrap Qty", "Completed Serial Nos"
    ]
    ws.append(headers)

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center

    ws.row_dimensions[1].height = 24

    for log in logs:
        ts_str = log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else (log.log_date or "")
        row = [
            log.id,
            ts_str,
            log.shift or "",
            log.machine_name or "",
            log.operator_name or "",
            log.part_no or "",
            f"Opn {log.opn_no}" if log.opn_no else "",
            log.qty_produced or 0,
            log.scrap_qty or 0,
            log.completed_sl_nos or ""
        ]
        ws.append(row)
        r_idx = ws.max_row
        ws.row_dimensions[r_idx].height = 20
        for c_idx in range(1, len(row) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.border = thin_border
            if c_idx in [1, 2, 3, 7, 8, 9]:
                cell.alignment = align_center
            else:
                cell.alignment = align_left

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"Production_Logs_{datetime.date.today().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/export/inspection-reports/excel")
def export_inspection_reports_excel(db: Session = Depends(get_db)):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    reports = db.query(models.InspectionReport).order_by(models.InspectionReport.id.desc()).all()
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Quality Inspection Logs"

    header_fill = PatternFill(start_color="065F46", end_color="065F46", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    align_center = Alignment(horizontal="center", vertical="center")
    align_left = Alignment(horizontal="left", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")
    
    pass_fill = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")
    pass_font = Font(name="Calibri", size=11, bold=True, color="065F46")
    
    fail_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    fail_font = Font(name="Calibri", size=11, bold=True, color="991B1B")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    headers = [
        "Report ID", "Traceability ID", "Date", "Part Number", "Operation No", 
        "Batch Qty", "Machine Name", "Operator Name", "Component Sl No",
        "Parameter Description", "Nominal", "Lo Tol", "Hi Tol", "Measured Reading", "Status"
    ]
    ws.append(headers)

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center

    ws.row_dimensions[1].height = 25

    for r in reports:
        params = db.query(models.InspectionParameter).filter(
            func.lower(models.InspectionParameter.part_no) == r.part_no.strip().lower(),
            func.lower(models.InspectionParameter.opn_no) == r.opn_no.strip().lower()
        ).order_by(models.InspectionParameter.sl_no.asc()).all()

        readings_map = {}
        try:
            import json
            readings_map = json.loads(r.readings_json or "{}")
        except Exception:
            readings_map = {}

        if not params:
            row = [
                r.id,
                r.report_code or f"IR-{r.id}",
                r.inspection_date or "",
                r.part_no or "",
                f"Opn {r.opn_no}" if r.opn_no else "",
                f"{r.batch_qty} pcs" if r.batch_qty else "-",
                r.machine_name or "-",
                r.operator_name or "-",
                r.comp_sl_nos or "1",
                "No parameters defined", "-", "-", "-", "-", "-"
            ]
            ws.append(row)
            r_idx = ws.max_row
            ws.row_dimensions[r_idx].height = 20
            for c_idx in range(1, len(row) + 1):
                cell = ws.cell(row=r_idx, column=c_idx)
                cell.border = thin_border
                cell.alignment = align_center if c_idx in [1, 2, 3, 5, 6, 9] else align_left
        else:
            is_first_row = True
            for p in params:
                p_readings = readings_map.get(str(p.id)) or readings_map.get(p.id) or {}
                val = p_readings.get("col_0") if "col_0" in p_readings else (p_readings.get("col_1") if "col_1" in p_readings else "")
                if val is None: val = ""
                val_str = str(val).strip()

                nom = float(p.nominal_dimension or 0.0)
                lo = float(p.lo_tol or 0.0)
                hi = float(p.hi_tol or 0.0)
                status = "-"
                val_num = val_str

                if val_str != "":
                    try:
                        v = float(val_str)
                        val_num = v
                        if (nom - lo) <= v <= (nom + hi):
                            status = "PASS"
                        else:
                            status = "OUT OF SPEC"
                    except ValueError:
                        status = "INVALID"

                if is_first_row:
                    row = [
                        r.id,
                        r.report_code or f"IR-{r.id}",
                        r.inspection_date or "",
                        r.part_no or "",
                        f"Opn {r.opn_no}" if r.opn_no else "",
                        f"{r.batch_qty} pcs" if r.batch_qty else "-",
                        r.machine_name or "-",
                        r.operator_name or "-",
                        r.comp_sl_nos or "1",
                        p.description or "",
                        nom,
                        lo,
                        hi,
                        val_num,
                        status
                    ]
                    is_first_row = False
                else:
                    row = [
                        "", "", "", "", "", "", "", "", "",
                        p.description or "",
                        nom,
                        lo,
                        hi,
                        val_num,
                        status
                    ]

                ws.append(row)
                r_idx = ws.max_row
                ws.row_dimensions[r_idx].height = 20

                for c_idx in range(1, len(row) + 1):
                    cell = ws.cell(row=r_idx, column=c_idx)
                    cell.border = thin_border
                    if c_idx in [1, 2, 3, 5, 6, 9]:
                        cell.alignment = align_center
                    elif c_idx in [11, 12, 13, 14]:
                        cell.alignment = align_right
                    elif c_idx == 15:
                        cell.alignment = align_center
                        if status == "PASS":
                            cell.fill = pass_fill
                            cell.font = pass_font
                        elif status == "OUT OF SPEC":
                            cell.fill = fail_fill
                            cell.font = fail_font
                    else:
                        cell.alignment = align_left

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"Quality_Inspection_Logs_{datetime.date.today().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# --- Serve Static Files ---
@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_index():
    return FileResponse("static/index.html")
