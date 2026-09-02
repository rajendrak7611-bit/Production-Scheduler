import json
import os
import glob
from sqlalchemy import text
from database import engine
import models

def safe_float(val, default=0.0):
    try:
        return float(val) if val is not None and str(val).strip() not in ["", "-"] else default
    except (ValueError, TypeError):
        return default

def import_all_backup_tables():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    search_paths = [
        os.path.join(base_dir, "full_backup.json"),
        "C:/Users/win10/Downloads/GRS_Factory_Database_Full_Backup_2026-09-01.json",
        os.path.join(base_dir, "GRS_Factory_Database_Full_Backup_*.json")
    ]
    
    backup_path = None
    for p in search_paths:
        files = glob.glob(p)
        if files:
            files.sort(reverse=True)
            backup_path = files[0]
            break

    if not backup_path or not os.path.exists(backup_path):
        print("No JSON backup file found!")
        return

    print(f"Loading backup file: {backup_path}")
    with open(backup_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    tables = data.get("tables", {})
    if not tables:
        return

    is_postgres = "postgresql" in str(engine.url)

    try:
        models.Base.metadata.create_all(bind=engine)
    except Exception:
        pass

    with engine.connect() as conn:
        trans = conn.begin()
        total_inserted = 0
        try:
            for table_name, rows in tables.items():
                if not rows:
                    continue
                
                first_row = rows[0]
                cols = list(first_row.keys())
                col_defs = []
                for col in cols:
                    if col.lower() == "id":
                        col_defs.append(f"{col} SERIAL PRIMARY KEY" if is_postgres else f"{col} INTEGER PRIMARY KEY")
                    else:
                        col_defs.append(f"{col} TEXT")
                
                try:
                    conn.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE;" if is_postgres else f"DROP TABLE IF EXISTS {table_name};"))
                except Exception:
                    pass
                
                try:
                    conn.execute(text(f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(col_defs)});"))
                except Exception:
                    pass
                
                try:
                    conn.execute(text(f"DELETE FROM {table_name};"))
                except Exception:
                    pass

                placeholders = ", ".join([f":{c}" for c in cols])
                col_str = ", ".join(cols)
                insert_sql = text(f"INSERT INTO {table_name} ({col_str}) VALUES ({placeholders});")

                inserted = 0
                for row in rows:
                    try:
                        conn.execute(insert_sql, row)
                        inserted += 1
                    except Exception:
                        pass

                print(f"Restored table '{table_name}': {inserted} records.")
                total_inserted += inserted

            trans.commit()
            print(f"All {len(tables)} backup tables restored into database!")

            # Sync model tables (machines, operators, parts, production_schedules)
            with engine.connect() as conn2:
                t2 = conn2.begin()
                try:
                    # Departments
                    departments_data = tables.get("departments", [])
                    if departments_data:
                        try:
                            conn2.execute(text("DELETE FROM departments;"))
                        except Exception:
                            pass
                        for d in departments_data:
                            did = int(safe_float(d.get("id"), 0))
                            dname = d.get("name") or d.get("dept") or d.get("department")
                            if dname:
                                try:
                                    if did:
                                        conn2.execute(text("INSERT INTO departments (id, name) VALUES (:id, :name);"), {"id": did, "name": dname})
                                    else:
                                        conn2.execute(text("INSERT INTO departments (name) VALUES (:name);"), {"name": dname})
                                except Exception:
                                    try:
                                        conn2.execute(text("INSERT INTO departments (name) VALUES (:name);"), {"name": dname})
                                    except Exception:
                                        pass

                    # Machines
                    machines_data = tables.get("machines", [])
                    if machines_data:
                        try:
                            conn2.execute(text("DELETE FROM machines;"))
                        except Exception:
                            pass
                        for m in machines_data:
                            mid = int(safe_float(m.get("id"), 0))
                            name = m.get("name") or m.get("machine_name") or m.get("machine")
                            dept = m.get("department") or m.get("dept") or ""
                            status = m.get("status") or "Active"
                            if name:
                                try:
                                    if mid:
                                        conn2.execute(text("INSERT INTO machines (id, name, dept, status) VALUES (:id, :name, :dept, :status);"), {"id": mid, "name": name, "dept": dept, "status": status})
                                    else:
                                        conn2.execute(text("INSERT INTO machines (name, dept, status) VALUES (:name, :dept, :status);"), {"name": name, "dept": dept, "status": status})
                                except Exception:
                                    try:
                                        conn2.execute(text("INSERT INTO machines (name, dept, status) VALUES (:name, :dept, :status);"), {"name": name, "dept": dept, "status": status})
                                    except Exception:
                                        pass

                    # Operators
                    operators_data = tables.get("operators", [])
                    if operators_data:
                        try:
                            conn2.execute(text("DELETE FROM operators;"))
                        except Exception:
                            pass
                        for o in operators_data:
                            oid = int(safe_float(o.get("id"), 0))
                            name = o.get("name") or o.get("operator_name") or o.get("operator")
                            dept = o.get("department") or o.get("dept") or ""
                            desig = o.get("designation") or o.get("role") or "Operator"
                            if name:
                                try:
                                    if oid:
                                        conn2.execute(text("INSERT INTO operators (id, name, dept, designation) VALUES (:id, :name, :dept, :desig);"), {"id": oid, "name": name, "dept": dept, "desig": desig})
                                    else:
                                        conn2.execute(text("INSERT INTO operators (name, dept, designation) VALUES (:name, :dept, :desig);"), {"name": name, "dept": dept, "desig": desig})
                                except Exception:
                                    try:
                                        conn2.execute(text("INSERT INTO operators (name, dept, designation) VALUES (:name, :dept, :desig);"), {"name": name, "dept": dept, "desig": desig})
                                    except Exception:
                                        pass

                    # Parts
                    part_masters = tables.get("part_masters", [])
                    if part_masters:
                        try:
                            conn2.execute(text("DELETE FROM parts;"))
                        except Exception:
                            pass
                        for p in part_masters:
                            pid = int(safe_float(p.get("id"), 0))
                            part_no = p.get("partno") or p.get("part_no") or p.get("part_number")
                            cust = p.get("customer") or p.get("customer_name") or ""
                            dept = p.get("department") or p.get("dept") or ""
                            fam = p.get("family") or ""
                            forge = p.get("forge_pn") or p.get("forge_part_no") or ""
                            desc = p.get("description") or ""
                            cyc = safe_float(p.get("cycle_time"), 0.0)
                            va = safe_float(p.get("va"), 0.0)
                            if part_no:
                                try:
                                    if pid:
                                        conn2.execute(text("INSERT INTO parts (id, part_no, customer, dept, family, forge_pn, description, cycle_time, va) VALUES (:id, :part_no, :cust, :dept, :fam, :forge, :desc, :cyc, :va);"), {"id": pid, "part_no": part_no, "cust": cust, "dept": dept, "fam": fam, "forge": forge, "desc": desc, "cyc": cyc, "va": va})
                                    else:
                                        conn2.execute(text("INSERT INTO parts (part_no, customer, dept, family, forge_pn, description, cycle_time, va) VALUES (:part_no, :cust, :dept, :fam, :forge, :desc, :cyc, :va);"), {"part_no": part_no, "cust": cust, "dept": dept, "fam": fam, "forge": forge, "desc": desc, "cyc": cyc, "va": va})
                                except Exception:
                                    pass

                    # Operations
                    part_operations_data = tables.get("part_operations", [])
                    if part_operations_data:
                        try:
                            conn2.execute(text("DELETE FROM operations;"))
                        except Exception:
                            pass
                        for op in part_operations_data:
                            pid = int(safe_float(op.get("part_id"), 0))
                            opn = str(op.get("opn_no") or "")
                            desc = op.get("description") or ""
                            mc = op.get("machine") or op.get("machine_name") or ""
                            cyc = safe_float(op.get("cycle_time"), 0.0)
                            if pid and opn:
                                try:
                                    conn2.execute(text("INSERT INTO operations (part_id, opn_no, description, machine_name, cycle_time) VALUES (:part_id, :opn_no, :description, :machine_name, :cycle_time);"), {
                                        "part_id": pid,
                                        "opn_no": opn,
                                        "description": desc,
                                        "machine_name": mc,
                                        "cycle_time": cyc
                                    })
                                except Exception:
                                    pass

                    # Schedules
                    schedules_data = tables.get("schedules", [])
                    if schedules_data:
                        try:
                            conn2.execute(text("DELETE FROM production_schedules;"))
                        except Exception:
                            pass
                        for s in schedules_data:
                            sl_no = str(s.get("sl_no") or "")
                            item = str(s.get("item") or "")
                            grs_no = str(s.get("grs_no") or "")
                            part_no = s.get("part_no") or s.get("partno") or ""
                            total_sch_qty = int(safe_float(s.get("total_sch_qty") or s.get("sch_qty") or s.get("quantity"), 0))
                            rate = safe_float(s.get("rate_per_pc") or s.get("rate"), 0.0)
                            amount = safe_float(s.get("amount"), 0.0)
                            qty_disp = int(safe_float(s.get("qty_disp") or s.get("dispatched"), 0))
                            val_rs = safe_float(s.get("value_rs") or s.get("value"), 0.0)
                            bal = int(safe_float(s.get("balance_to_produce") or s.get("balance"), (total_sch_qty - qty_disp)))
                            remarks = str(s.get("remarks") or "")
                            if part_no:
                                try:
                                    conn2.execute(text("INSERT INTO production_schedules (sl_no, item, grs_no, part_no, total_sch_qty, rate_per_pc, amount, qty_disp, value_rs, balance_to_produce, remarks) VALUES (:sl_no, :item, :grs_no, :part_no, :total_sch_qty, :rate, :amount, :qty_disp, :val_rs, :bal, :remarks);"), {"sl_no": sl_no, "item": item, "grs_no": grs_no, "part_no": part_no, "total_sch_qty": total_sch_qty, "rate": rate, "amount": amount, "qty_disp": qty_disp, "val_rs": val_rs, "bal": bal, "remarks": remarks})
                                except Exception:
                                    pass

                    t2.commit()
                    print("Synced model tables successfully!")
                except Exception as ex2:
                    t2.rollback()
                    print(f"Model tables sync notice: {ex2}")
        except Exception as e:
            trans.rollback()
            print(f"Backup restoration error: {e}")

if __name__ == "__main__":
    import_all_backup_tables()
