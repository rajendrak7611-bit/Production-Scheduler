import zipfile
import xml.etree.ElementTree as ET
import glob
import os
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
from models import Machine, Operator, Part, Operation, ProductionSchedule, Tooling, ProductionLog

def read_xlsx_rows(filepath):
    """
    Parses sheet1 of an xlsx file into a list of row value arrays using standard library zipfile/xml.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    target_path = os.path.join(base_dir, filepath) if not os.path.isabs(filepath) else filepath
    if not os.path.exists(target_path):
        target_path = filepath
    if not os.path.exists(target_path):
        print(f"File not found: {target_path}")
        return []
    try:
        with zipfile.ZipFile(target_path) as z:
            strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
                for elem in tree.iter():
                    if elem.tag.endswith('}t'):
                        strings.append(elem.text or '')
            
            target_sheet = 'xl/worksheets/sheet1.xml'
            if target_sheet not in z.namelist():
                # Pick first available worksheet
                sheets = [n for n in z.namelist() if n.startswith('xl/worksheets/sheet')]
                if not sheets:
                    return []
                target_sheet = sheets[0]
                
            tree = ET.fromstring(z.read(target_sheet))
            rows = []
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
            return rows
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return []

def safe_int(val, default=0):
    try:
        if not val:
            return default
        return int(float(val))
    except (ValueError, TypeError):
        return default

def safe_float(val, default=0.0):
    try:
        if not val:
            return default
        return float(val)
    except (ValueError, TypeError):
        return default

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        print("--- Seeding Machines ---")
        machine_rows = read_xlsx_rows("machine.xlsx")
        # Header: Dept, Machine Name
        existing_machines = {m.name: m for m in db.query(Machine).all()}
        for row in machine_rows[1:]:
            if len(row) >= 2:
                dept, name = row[0], row[1]
                if name and name not in existing_machines:
                    m = Machine(name=name, dept=dept, status="Active")
                    db.add(m)
                    existing_machines[name] = m
        db.commit()
        print(f"Total machines: {db.query(Machine).count()}")

        print("--- Seeding Operators ---")
        operator_rows = read_xlsx_rows("operator.xlsx")
        # Header: Dept, Name, Designation
        existing_op_names = {o.name for o in db.query(Operator).all()}
        for row in operator_rows[1:]:
            if len(row) >= 2:
                dept = row[0]
                name = row[1]
                desig = row[2] if len(row) > 2 else "Operator"
                if name and name not in existing_op_names:
                    op = Operator(name=name, dept=dept, designation=desig)
                    db.add(op)
                    existing_op_names.add(name)
        db.commit()
        print(f"Total operators: {db.query(Operator).count()}")

        print("--- Seeding Parts and Operations ---")
        part_files = ["part master 2.xlsx", "part master bc 1.xlsx", "part master spider.xlsx"]
        existing_parts = {p.part_no: p for p in db.query(Part).all()}

        for pfile in part_files:
            rows = read_xlsx_rows(pfile)
            if not rows:
                continue
            headers = [h.lower() for h in rows[0]]
            
            # Map column indices based on header names
            cust_idx = headers.index("customer") if "customer" in headers else (headers.index("custoer") if "custoer" in headers else -1)
            dept_idx = headers.index("dept") if "dept" in headers else -1
            fam_idx = headers.index("family") if "family" in headers else -1
            forge_idx = headers.index("forge pn") if "forge pn" in headers else -1
            part_idx = headers.index("part no") if "part no" in headers else -1
            opn_idx = headers.index("opn no") if "opn no" in headers else -1
            desc_idx = headers.index("description") if "description" in headers else -1
            mach_idx = headers.index("machine") if "machine" in headers else -1
            cyc_idx = headers.index("cycle time") if "cycle time" in headers else -1
            va_idx = headers.index("va") if "va" in headers else -1

            added_opn_keys = {(op.part_id, str(op.opn_no).strip(), op.description.strip().upper()) for op in db.query(Operation).all()}
            for row in rows[1:]:
                part_no = row[part_idx] if part_idx != -1 and part_idx < len(row) else ""
                if not part_no:
                    continue
                
                customer = row[cust_idx] if cust_idx != -1 and cust_idx < len(row) else ""
                dept = row[dept_idx] if dept_idx != -1 and dept_idx < len(row) else ""
                family = row[fam_idx] if fam_idx != -1 and fam_idx < len(row) else ""
                forge_pn = row[forge_idx] if forge_idx != -1 and forge_idx < len(row) else ""
                desc = row[desc_idx] if desc_idx != -1 and desc_idx < len(row) else ""
                mach = row[mach_idx] if mach_idx != -1 and mach_idx < len(row) else ""
                cyc = safe_float(row[cyc_idx]) if cyc_idx != -1 and cyc_idx < len(row) else 0.0
                if cyc == 0.0 and mach:
                    cyc = safe_float(mach)
                va = safe_float(row[va_idx]) if va_idx != -1 and va_idx < len(row) else 0.0
                opn_no = row[opn_idx] if opn_idx != -1 and opn_idx < len(row) else "10"

                part = existing_parts.get(part_no)
                if not part:
                    part = Part(
                        part_no=part_no,
                        customer=customer,
                        dept=dept,
                        family=family,
                        forge_pn=forge_pn,
                        description=desc,
                        cycle_time=cyc,
                        va=va
                    )
                    db.add(part)
                    db.flush()
                    existing_parts[part_no] = part
                
                # Add operation if not duplicate
                opn_key = (part.id, str(opn_no).strip(), desc.strip().upper())
                if opn_key not in added_opn_keys:
                    opn = Operation(
                        part_id=part.id,
                        opn_no=opn_no,
                        description=desc,
                        machine_name=mach,
                        cycle_time=cyc,
                        va=va
                    )
                    db.add(opn)
                    added_opn_keys.add(opn_key)

        db.commit()
        print(f"Total parts: {db.query(Part).count()}, operations: {db.query(Operation).count()}")

        print("--- Seeding Production Schedules ---")
        sch_rows = read_xlsx_rows("part master.xlsx")
        # Looking for data row start
        data_started = False
        for row in sch_rows:
            if not row:
                continue
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

                if part_no and part_no != "PART NO":
                    sch = ProductionSchedule(
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
        db.commit()
        print(f"Total schedules: {db.query(ProductionSchedule).count()}")

        print("--- Seeding Tooling ---")
        tap_rows = read_xlsx_rows("tap.xlsx")
        for row in tap_rows[1:]:
            if len(row) >= 1 and row[0]:
                spec = row[0]
                edges = safe_int(row[1]) if len(row) > 1 else 1
                t = Tooling(insert_spec=spec, no_of_edges=edges, current_usage=0, max_life=1000, status="Good")
                db.add(t)
        db.commit()
        print(f"Total tooling items: {db.query(Tooling).count()}")

        print("Data seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
