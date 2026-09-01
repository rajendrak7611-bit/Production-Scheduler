import json
import os
import glob
from sqlalchemy import text
from database import engine

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
                        col_defs.append(f"{col} TEXT" if is_postgres else f"{col} TEXT")
                
                if not is_postgres:
                    try:
                        conn.execute(text(f"DROP TABLE IF EXISTS {table_name};"))
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
                    except Exception as ie:
                        pass

                print(f"Restored table '{table_name}': {inserted} records.")
                total_inserted += inserted

            trans.commit()
            print(f"All {len(tables)} tables restored into database! (Total records: {total_inserted})")
        except Exception as e:
            trans.rollback()
            print(f"Backup restoration error: {e}")

if __name__ == "__main__":
    import_all_backup_tables()
