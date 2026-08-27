from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
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

app = FastAPI(title="Production Management API")

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


# --- API Routes ---

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    
    total_machines = db.query(models.Machine).count()
    active_machines = db.query(models.Machine).filter(models.Machine.status == "Active").count()
    total_operators = db.query(models.Operator).count()
    total_parts = db.query(models.Part).count()
    total_schedules = db.query(models.ProductionSchedule).count()
    
    pending_qty = db.query(func.sum(models.ProductionSchedule.balance_to_produce)).scalar() or 0
    today_produced = db.query(func.sum(models.ProductionLog.qty_produced)).filter(models.ProductionLog.log_date.like(f"{today_str}%")).scalar() or 0
    today_scrap = db.query(func.sum(models.ProductionLog.scrap_qty)).filter(models.ProductionLog.log_date.like(f"{today_str}%")).scalar() or 0
    
    recent_logs = db.query(models.ProductionLog).order_by(models.ProductionLog.id.desc()).limit(10).all()
    
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
        ]
    }

# --- Machines ---
@app.get("/api/machines", response_model=List[MachineResponse])
def get_machines(db: Session = Depends(get_db)):
    return db.query(models.Machine).all()

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
@app.get("/api/operators", response_model=List[OperatorResponse])
def get_operators(db: Session = Depends(get_db)):
    return db.query(models.Operator).all()

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
            dept = row[dept_idx].strip() if dept_idx != -1 and dept_idx < len(row) and row[dept_idx] else "General"
            desig = row[desig_idx].strip() if desig_idx != -1 and desig_idx < len(row) and row[desig_idx] else "Operator"
            
            if name.upper() not in existing_op_names:
                op = models.Operator(name=name, dept=dept, designation=desig)
                db.add(op)
                existing_op_names.add(name.upper())
                imported_count += 1
                
    db.commit()
    return {"imported_count": imported_count, "message": f"Successfully imported {imported_count} new operators!"}

@app.delete("/api/operators/clear-all")
def clear_all_operators(db: Session = Depends(get_db)):
    db.query(models.Operator).delete()
    db.commit()
    return {"message": "All operators cleared successfully!"}

@app.delete("/api/operators/{operator_id}")
def delete_operator(operator_id: int, db: Session = Depends(get_db)):
    db_op = db.query(models.Operator).filter(models.Operator.id == operator_id).first()
    if not db_op:
        raise HTTPException(status_code=404, detail="Operator not found")
    db.delete(db_op)
    db.commit()
    return {"message": "Operator deleted"}

# --- Parts & Operations ---
@app.get("/api/parts", response_model=List[PartResponse])
def get_parts(db: Session = Depends(get_db)):
    return db.query(models.Part).all()

@app.post("/api/parts", response_model=PartResponse)
def create_part(part: PartCreate, db: Session = Depends(get_db)):
    db_part = models.Part(**part.model_dump())
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
    
    part_idx = -1
    opn_idx = -1
    desc_idx = -1
    cyc_idx = -1
    mach_idx = -1
    cust_idx = -1
    dept_idx = -1
    fam_idx = -1
    forge_idx = -1

    for i, h in enumerate(headers):
        if "part" in h or "item" in h: part_idx = i
        elif "opn" in h or "operation" in h: opn_idx = i
        elif "desc" in h or "description" in h: desc_idx = i
        elif "cycle" in h or "ct" in h: cyc_idx = i
        elif "machine" in h or "mach" in h: mach_idx = i
        elif "cust" in h or "customer" in h: cust_idx = i
        elif "dept" in h: dept_idx = i
        elif "family" in h or "fam" in h: fam_idx = i
        elif "forge" in h: forge_idx = i

    if part_idx == -1:
        part_idx = 0

    existing_parts = {p.part_no.strip().upper(): p for p in db.query(models.Part).all()}
    imported_parts_count = 0
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
    schedules = db.query(models.ProductionSchedule).all()
    parts = db.query(models.Part).all()
    part_map = {p.part_no.strip().upper(): p for p in parts if p.part_no}

    # Calculate actual produced quantity from production logs for each (part_no, opn_no)
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
    clean_part = part_no.strip().lower()

    def extract_clean_opn(raw_str):
        if not raw_str:
            return None, ""
        raw = str(raw_str).strip()
        cleaned = re.sub(r'\(\s*\d+\s*min\s*\)', '', raw, flags=re.IGNORECASE)
        m_opn = re.search(r'opn\s*(\d+(?:\.\d+)?)', cleaned, re.IGNORECASE)
        if m_opn:
            num = float(m_opn.group(1))
            return num, str(int(num)) if num.is_integer() else str(num)
        m_start = re.match(r'^\s*(\d+(?:\.\d+)?)', cleaned)
        if m_start:
            num = float(m_start.group(1))
            return num, str(int(num)) if num.is_integer() else str(num)
        m_any = re.search(r'(\d+(?:\.\d+)?)', cleaned)
        if m_any:
            num = float(m_any.group(1))
            return num, str(int(num)) if num.is_integer() else str(num)
        return None, raw

    curr_num, curr_opn_str = extract_clean_opn(opn_no)
    if curr_num is None:
        curr_num, curr_opn_str = 10.0, "10"

    logs = db.query(models.ProductionLog).filter(func.lower(models.ProductionLog.part_no) == clean_part).all()
    part = db.query(models.Part).filter(func.lower(models.Part.part_no) == clean_part).first()

    # Collect all known operation numbers for this part
    all_opn_nums = []
    if part and part.operations:
        for op in part.operations:
            num, _ = extract_clean_opn(op.opn_no)
            if num is not None and num not in all_opn_nums:
                all_opn_nums.append(num)

    for l in logs:
        num, _ = extract_clean_opn(l.opn_no)
        if num is not None and num not in all_opn_nums:
            all_opn_nums.append(num)

    all_opn_nums = sorted(all_opn_nums)

    # Sequence Determination:
    if curr_num <= 10.0:
        is_first_opn = True
        prev_opn_no = None
    elif curr_num == 20.0:
        has_opn_10 = any(n <= 10.0 for n in all_opn_nums)
        if has_opn_10:
            is_first_opn = False
            prev_opn_no = "10"
        else:
            is_first_opn = True
            prev_opn_no = None
    else:
        # curr_num >= 30.0 (Opn 30, Opn 40, Opn 50...): STRICTLY ALWAYS a subsequent operation!
        is_first_opn = False
        prev_candidates = [n for n in all_opn_nums if n < curr_num]
        if prev_candidates:
            p_num = max(prev_candidates)
            prev_opn_no = str(int(p_num)) if p_num.is_integer() else str(p_num)
        else:
            p_num = max(10.0, curr_num - 10.0)
            prev_opn_no = str(int(p_num)) if p_num.is_integer() else str(p_num)

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
    prev_num, _ = extract_clean_opn(prev_opn_no) if prev_opn_no else (None, "")
    prev_completed = extract_sl_nos(prev_opn_no, prev_num) if (not is_first_opn and prev_opn_no) else []

    return {
        "is_first_opn": is_first_opn,
        "prev_opn_no": prev_opn_no,
        "prev_completed_sl_nos": prev_completed,
        "completed_sl_nos": curr_completed
    }

@app.post("/api/production-logs", response_model=ProductionLogResponse)
def create_production_log(log: ProductionLogCreate, db: Session = Depends(get_db)):
    data = log.model_dump()
    
    # Auto capture exact date and time when entered
    now = datetime.datetime.now()
    if not data.get("log_date"):
        data["log_date"] = now.strftime("%Y-%m-%d %H:%M:%S")
    
    # Auto calculate shift based on current time if not provided
    if not data.get("shift"):
        h = now.hour
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
