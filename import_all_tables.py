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

                    # Shifts
                    shifts_data = tables.get("shifts", [])
                    if shifts_data:
                        try:
                            conn2.execute(text("DELETE FROM shifts;"))
                        except Exception:
                            pass
                        for s in shifts_data:
                            sid = int(safe_float(s.get("id"), 0))
                            sname = s.get("name")
                            shours = float(safe_float(s.get("hours"), 8.0))
                            if sname:
                                try:
                                    if sid:
                                        conn2.execute(text("INSERT INTO shifts (id, name, hours) VALUES (:id, :name, :hours);"), {"id": sid, "name": sname, "hours": shours})
                                    else:
                                        conn2.execute(text("INSERT INTO shifts (name, hours) VALUES (:name, :hours);"), {"name": sname, "hours": shours})
                                except Exception:
                                    try:
                                        conn2.execute(text("INSERT INTO shifts (name, hours) VALUES (:name, :hours);"), {"name": sname, "hours": shours})
                                    except Exception:
                                        pass

                    # Vendors
                    vendors_data = tables.get("vendors", [])
                    if vendors_data:
                        try:
                            conn2.execute(text("DELETE FROM vendors;"))
                        except Exception:
                            pass
                        for v in vendors_data:
                            vid = int(safe_float(v.get("id"), 0))
                            vname = v.get("name")
                            vdetails = v.get("details") or ""
                            if vname:
                                try:
                                    if vid:
                                        conn2.execute(text("INSERT INTO vendors (id, name, details) VALUES (:id, :name, :details);"), {"id": vid, "name": vname, "details": vdetails})
                                    else:
                                        conn2.execute(text("INSERT INTO vendors (name, details) VALUES (:name, :details);"), {"name": vname, "details": vdetails})
                                except Exception:
                                    try:
                                        conn2.execute(text("INSERT INTO vendors (name, details) VALUES (:name, :details);"), {"name": vname, "details": vdetails})
                                    except Exception:
                                        pass

                    # Setters
                    setters_data = tables.get("setters", [])
                    if setters_data:
                        try:
                            conn2.execute(text("DELETE FROM setters;"))
                        except Exception:
                            pass
                        for st in setters_data:
                            stid = int(safe_float(st.get("id"), 0))
                            stname = st.get("name")
                            stdept = st.get("department") or st.get("dept") or ""
                            if stname:
                                try:
                                    if stid:
                                        conn2.execute(text("INSERT INTO setters (id, name, department) VALUES (:id, :name, :dept);"), {"id": stid, "name": stname, "dept": stdept})
                                    else:
                                        conn2.execute(text("INSERT INTO setters (name, department) VALUES (:name, :dept);"), {"name": stname, "dept": stdept})
                                except Exception:
                                    try:
                                        conn2.execute(text("INSERT INTO setters (name, department) VALUES (:name, :dept);"), {"name": stname, "dept": stdept})
                                    except Exception:
                                        pass

                    # Suppliers
                    suppliers_data = tables.get("suppliers", [])
                    if suppliers_data:
                        try:
                            conn2.execute(text("DELETE FROM suppliers;"))
                        except Exception:
                            pass
                        for sup in suppliers_data:
                            supid = int(safe_float(sup.get("id"), 0))
                            supname = sup.get("name")
                            supdetails = sup.get("details") or ""
                            if supname:
                                try:
                                    if supid:
                                        conn2.execute(text("INSERT INTO suppliers (id, name, details) VALUES (:id, :name, :details);"), {"id": supid, "name": supname, "details": supdetails})
                                    else:
                                        conn2.execute(text("INSERT INTO suppliers (name, details) VALUES (:name, :details);"), {"name": supname, "details": supdetails})
                                except Exception:
                                    try:
                                        conn2.execute(text("INSERT INTO suppliers (name, details) VALUES (:name, :details);"), {"name": supname, "details": supdetails})
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

                    # Raw Materials
                    rm_data = tables.get("raw_materials", [])
                    if rm_data:
                        try:
                            conn2.execute(text("DELETE FROM raw_materials;"))
                        except Exception:
                            pass
                        for r in rm_data:
                            rid = int(safe_float(r.get("id"), 0))
                            fpn = r.get("forge_pn") or ""
                            rcpt = int(safe_float(r.get("receipt"), 0))
                            dspt = int(safe_float(r.get("despatch"), 0))
                            stk = int(safe_float(r.get("stock"), rcpt - dspt))
                            if fpn:
                                try:
                                    if rid:
                                        conn2.execute(text("INSERT INTO raw_materials (id, forge_pn, receipt, despatch, stock) VALUES (:id, :forge_pn, :receipt, :despatch, :stock);"), {"id": rid, "forge_pn": fpn, "receipt": rcpt, "despatch": dspt, "stock": stk})
                                    else:
                                        conn2.execute(text("INSERT INTO raw_materials (forge_pn, receipt, despatch, stock) VALUES (:forge_pn, :receipt, :despatch, :stock);"), {"forge_pn": fpn, "receipt": rcpt, "despatch": dspt, "stock": stk})
                                except Exception:
                                    pass

                    # Raw Material Logs
                    rm_logs_data = tables.get("raw_material_logs", [])
                    if rm_logs_data:
                        try:
                            conn2.execute(text("DELETE FROM raw_material_logs;"))
                        except Exception:
                            pass
                        for rl in rm_logs_data:
                            rlid = int(safe_float(rl.get("id"), 0))
                            rtype = rl.get("type") or "receipt"
                            rdate = rl.get("date") or ""
                            dctype = rl.get("dc_type") or ""
                            fpn = rl.get("forge_pn") or ""
                            dcno = rl.get("dc_no") or ""
                            fpno = rl.get("finish_part_no") or ""
                            pprefix = rl.get("part_prefix") or ""
                            rqty = int(safe_float(rl.get("qty"), 0))
                            if fpn:
                                try:
                                    if rlid:
                                        conn2.execute(text("INSERT INTO raw_material_logs (id, type, date, dc_type, forge_pn, dc_no, finish_part_no, part_prefix, qty) VALUES (:id, :type, :date, :dc_type, :forge_pn, :dc_no, :finish_part_no, :part_prefix, :qty);"), {"id": rlid, "type": rtype, "date": rdate, "dc_type": dctype, "forge_pn": fpn, "dc_no": dcno, "finish_part_no": fpno, "part_prefix": pprefix, "qty": rqty})
                                    else:
                                        conn2.execute(text("INSERT INTO raw_material_logs (type, date, dc_type, forge_pn, dc_no, finish_part_no, part_prefix, qty) VALUES (:type, :date, :dc_type, :forge_pn, :dc_no, :finish_part_no, :part_prefix, :qty);"), {"type": rtype, "date": rdate, "dc_type": dctype, "forge_pn": fpn, "dc_no": dcno, "finish_part_no": fpno, "part_prefix": pprefix, "qty": rqty})
                                except Exception:
                                    pass

                    # Users
                    users_data = tables.get("users", [])
                    if users_data:
                        try:
                            conn2.execute(text("DELETE FROM users;"))
                        except Exception:
                            pass
                        for u in users_data:
                            uid = int(safe_float(u.get("id"), 0))
                            uname = (u.get("username") or "").strip()
                            pwhash = u.get("password_hash") or ""
                            pw = u.get("password") or ""
                            role = u.get("role") or "operator"
                            screens = u.get("accessible_screens") or "[]"
                            if uname:
                                try:
                                    if uid:
                                        conn2.execute(text("""
                                            INSERT INTO users (id, username, password, password_hash, role, accessible_screens)
                                            VALUES (:id, :username, :password, :password_hash, :role, :accessible_screens);
                                        """), {"id": uid, "username": uname, "password": pw, "password_hash": pwhash, "role": role, "accessible_screens": screens})
                                    else:
                                        conn2.execute(text("""
                                            INSERT INTO users (username, password, password_hash, role, accessible_screens)
                                            VALUES (:username, :password, :password_hash, :role, :accessible_screens);
                                        """), {"username": uname, "password": pw, "password_hash": pwhash, "role": role, "accessible_screens": screens})
                                except Exception:
                                    try:
                                        conn2.execute(text("""
                                            INSERT INTO users (username, role, accessible_screens)
                                            VALUES (:username, :role, :accessible_screens);
                                        """), {"username": uname, "role": role, "accessible_screens": screens})
                                    except Exception:
                                        pass

                    # Attendances
                    att_data = tables.get("attendances", [])
                    if att_data:
                        try:
                            conn2.execute(text("DELETE FROM attendances;"))
                        except Exception:
                            pass
                        for a in att_data:
                            aid = int(safe_float(a.get("id"), 0))
                            ename = (a.get("employee_name") or a.get("name") or "").strip()
                            dept = (a.get("dept") or a.get("department") or "").strip()
                            desig = (a.get("designation") or "Operator").strip()
                            my = (a.get("month_year") or "").strip()
                            day = int(safe_float(a.get("day"), 1))
                            hrs = str(a.get("hours") or "0")
                            if ename and my:
                                try:
                                    if aid:
                                        conn2.execute(text("""
                                            INSERT INTO attendances (id, employee_name, dept, designation, month_year, day, hours)
                                            VALUES (:id, :employee_name, :dept, :designation, :month_year, :day, :hours);
                                        """), {"id": aid, "employee_name": ename, "dept": dept, "designation": desig, "month_year": my, "day": day, "hours": hrs})
                                    else:
                                        conn2.execute(text("""
                                            INSERT INTO attendances (employee_name, dept, designation, month_year, day, hours)
                                            VALUES (:employee_name, :dept, :designation, :month_year, :day, :hours);
                                        """), {"employee_name": ename, "dept": dept, "designation": desig, "month_year": my, "day": day, "hours": hrs})
                                except Exception:
                                    pass

                    # Production Logs
                    prod_logs_data = tables.get("production_logs", [])
                    if prod_logs_data:
                        try:
                            conn2.execute(text("DELETE FROM production_logs;"))
                        except Exception:
                            pass
                        for pl in prod_logs_data:
                            plid = int(safe_float(pl.get("id"), 0))
                            pldept = pl.get("dept") or "General"
                            pldate = pl.get("date") or ""
                            plshift = pl.get("shift") or "First"
                            plsetter = pl.get("setter") or ""
                            plmach = pl.get("machine") or ""
                            plop = pl.get("operator") or ""
                            plpart = pl.get("partno") or ""
                            plopn = str(pl.get("opn_no") or "")
                            pldesc = pl.get("description") or ""
                            plrun = safe_float(pl.get("runtime"), 0)
                            plcyc = safe_float(pl.get("cycle_time"), 0)
                            pltgt = safe_float(pl.get("target_qty"), 0)
                            plprod = safe_float(pl.get("prod_qty"), 0)
                            pleff = safe_float(pl.get("efficiency"), 0)
                            plidle1 = safe_float(pl.get("idle_hours"), 0)
                            plreason1 = pl.get("idle_reason") or "None"
                            plidle2 = safe_float(pl.get("idle_hours_2"), 0)
                            plreason2 = pl.get("idle_reason_2") or "None"
                            plidle3 = safe_float(pl.get("idle_hours_3"), 0)
                            plreason3 = pl.get("idle_reason_3") or "None"
                            plmult = str(pl.get("multiple_mc") or 1)

                            if plpart or plmach or plop:
                                try:
                                    if plid:
                                        conn2.execute(text("""
                                            INSERT INTO production_logs (
                                                id, dept, date, shift, setter, machine, operator, partno, opn_no,
                                                description, runtime, cycle_time, target_qty, prod_qty, efficiency,
                                                idle_hours, idle_reason, idle_hours_2, idle_reason_2, idle_hours_3, idle_reason_3, multiple_mc
                                            ) VALUES (
                                                :id, :dept, :date, :shift, :setter, :machine, :operator, :partno, :opn_no,
                                                :description, :runtime, :cycle_time, :target_qty, :prod_qty, :efficiency,
                                                :idle_hours, :idle_reason, :idle_hours_2, :idle_reason_2, :idle_hours_3, :idle_reason_3, :multiple_mc
                                            );
                                        """), {
                                            "id": plid, "dept": pldept, "date": pldate, "shift": plshift, "setter": plsetter,
                                            "machine": plmach, "operator": plop, "partno": plpart, "opn_no": plopn,
                                            "description": pldesc, "runtime": plrun, "cycle_time": plcyc, "target_qty": pltgt,
                                            "prod_qty": plprod, "efficiency": pleff, "idle_hours": plidle1, "idle_reason": plreason1,
                                            "idle_hours_2": plidle2, "idle_reason_2": plreason2, "idle_hours_3": plidle3, "idle_reason_3": plreason3,
                                            "multiple_mc": plmult
                                        })
                                    else:
                                        conn2.execute(text("""
                                            INSERT INTO production_logs (
                                                dept, date, shift, setter, machine, operator, partno, opn_no,
                                                description, runtime, cycle_time, target_qty, prod_qty, efficiency,
                                                idle_hours, idle_reason, idle_hours_2, idle_reason_2, idle_hours_3, idle_reason_3, multiple_mc
                                            ) VALUES (
                                                :dept, :date, :shift, :setter, :machine, :operator, :partno, :opn_no,
                                                :description, :runtime, :cycle_time, :target_qty, :prod_qty, :efficiency,
                                                :idle_hours, :idle_reason, :idle_hours_2, :idle_reason_2, :idle_hours_3, :idle_reason_3, :multiple_mc
                                            );
                                        """), {
                                            "dept": pldept, "date": pldate, "shift": plshift, "setter": plsetter,
                                            "machine": plmach, "operator": plop, "partno": plpart, "opn_no": plopn,
                                            "description": pldesc, "runtime": plrun, "cycle_time": plcyc, "target_qty": pltgt,
                                            "prod_qty": plprod, "efficiency": pleff, "idle_hours": plidle1, "idle_reason": plreason1,
                                            "idle_hours_2": plidle2, "idle_reason_2": plreason2, "idle_hours_3": plidle3, "idle_reason_3": plreason3,
                                            "multiple_mc": plmult
                                        })
                                except Exception:
                                    pass

                    # HT Logs
                    ht_data = tables.get("ht_logs", [])
                    if ht_data:
                        try:
                            conn2.execute(text("DELETE FROM ht_logs;"))
                        except Exception:
                            pass
                        for h in ht_data:
                            hid = int(safe_float(h.get("id"), 0))
                            hdate = h.get("date") or ""
                            hdc = h.get("dc_no") or ""
                            hvend = h.get("vendor") or ""
                            hpn = h.get("partno") or h.get("part_no") or ""
                            hqty = int(safe_float(h.get("qty"), 0))
                            if hpn:
                                try:
                                    if hid:
                                        conn2.execute(text("INSERT INTO ht_logs (id, date, dc_no, vendor, partno, qty) VALUES (:id, :date, :dc_no, :vendor, :partno, :qty);"), {"id": hid, "date": hdate, "dc_no": hdc, "vendor": hvend, "partno": hpn, "qty": hqty})
                                    else:
                                        conn2.execute(text("INSERT INTO ht_logs (date, dc_no, vendor, partno, qty) VALUES (:date, :dc_no, :vendor, :partno, :qty);"), {"date": hdate, "dc_no": hdc, "vendor": hvend, "partno": hpn, "qty": hqty})
                                except Exception:
                                    pass

                    # HT Receipt Logs
                    htr_data = tables.get("ht_receipt_logs", [])
                    if htr_data:
                        try:
                            conn2.execute(text("DELETE FROM ht_receipt_logs;"))
                        except Exception:
                            pass
                        for hr in htr_data:
                            hrid = int(safe_float(hr.get("id"), 0))
                            hrdate = hr.get("date") or ""
                            hrdc = hr.get("dc_no") or ""
                            hrvend = hr.get("vendor") or ""
                            hrpn = hr.get("partno") or hr.get("part_no") or ""
                            hrqty = int(safe_float(hr.get("qty"), 0))
                            if hrpn:
                                try:
                                    if hrid:
                                        conn2.execute(text("INSERT INTO ht_receipt_logs (id, date, dc_no, vendor, partno, qty) VALUES (:id, :date, :dc_no, :vendor, :partno, :qty);"), {"id": hrid, "date": hrdate, "dc_no": hrdc, "vendor": hrvend, "partno": hrpn, "qty": hrqty})
                                    else:
                                        conn2.execute(text("INSERT INTO ht_receipt_logs (date, dc_no, vendor, partno, qty) VALUES (:date, :dc_no, :vendor, :partno, :qty);"), {"date": hrdate, "dc_no": hrdc, "vendor": hrvend, "partno": hrpn, "qty": hrqty})
                                except Exception:
                                    pass

                    # PC Logs
                    pc_data = tables.get("pc_logs", [])
                    if pc_data:
                        try:
                            conn2.execute(text("DELETE FROM pc_logs;"))
                        except Exception:
                            pass
                        for p in pc_data:
                            pid = int(safe_float(p.get("id"), 0))
                            pdate = p.get("date") or ""
                            pdc = p.get("dc_no") or ""
                            pvend = p.get("vendor") or ""
                            ppn = p.get("partno") or p.get("part_no") or ""
                            pqty = int(safe_float(p.get("qty"), 0))
                            if ppn:
                                try:
                                    if pid:
                                        conn2.execute(text("INSERT INTO pc_logs (id, date, dc_no, vendor, partno, qty) VALUES (:id, :date, :dc_no, :vendor, :partno, :qty);"), {"id": pid, "date": pdate, "dc_no": pdc, "vendor": pvend, "partno": ppn, "qty": pqty})
                                    else:
                                        conn2.execute(text("INSERT INTO pc_logs (date, dc_no, vendor, partno, qty) VALUES (:date, :dc_no, :vendor, :partno, :qty);"), {"date": pdate, "dc_no": pdc, "vendor": pvend, "partno": ppn, "qty": pqty})
                                except Exception:
                                    pass

                    # PC Receipt Logs
                    pcr_data = tables.get("pc_receipt_logs", [])
                    if pcr_data:
                        try:
                            conn2.execute(text("DELETE FROM pc_receipt_logs;"))
                        except Exception:
                            pass
                        for pr in pcr_data:
                            prid = int(safe_float(pr.get("id"), 0))
                            prdate = pr.get("date") or ""
                            prdc = pr.get("dc_no") or ""
                            prvend = pr.get("vendor") or ""
                            prpn = pr.get("partno") or pr.get("part_no") or ""
                            prqty = int(safe_float(pr.get("qty"), 0))
                            if prpn:
                                try:
                                    if prid:
                                        conn2.execute(text("INSERT INTO pc_receipt_logs (id, date, dc_no, vendor, partno, qty) VALUES (:id, :date, :dc_no, :vendor, :partno, :qty);"), {"id": prid, "date": prdate, "dc_no": prdc, "vendor": prvend, "partno": prpn, "qty": prqty})
                                    else:
                                        conn2.execute(text("INSERT INTO pc_receipt_logs (date, dc_no, vendor, partno, qty) VALUES (:date, :dc_no, :vendor, :partno, :qty);"), {"date": prdate, "dc_no": prdc, "vendor": prvend, "partno": prpn, "qty": prqty})
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
