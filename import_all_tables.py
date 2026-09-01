import json
import sqlite3
import os
import glob

def import_all_backup_tables():
    # Find latest backup JSON file
    search_paths = [
        "C:/Users/win10/Downloads/GRS_Factory_Database_Full_Backup_*.json",
        "./GRS_Factory_Database_Full_Backup_*.json"
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
    conn = sqlite3.connect("production.db")
    cursor = conn.cursor()

    total_inserted = 0
    for table_name, rows in tables.items():
        if not rows:
            continue
        
        first_row = rows[0]
        cols = list(first_row.keys())
        col_defs = []
        for col in cols:
            if col.lower() == "id":
                col_defs.append(f"{col} INTEGER PRIMARY KEY")
            else:
                col_defs.append(f"{col} TEXT")
                
        cursor.execute(f"DROP TABLE IF EXISTS {table_name};")
        create_sql = f"CREATE TABLE {table_name} ({', '.join(col_defs)});"
        cursor.execute(create_sql)

        placeholders = ", ".join(["?"] * len(cols))
        insert_sql = f"INSERT INTO {table_name} ({', '.join(cols)}) VALUES ({placeholders});"

        row_data = []
        for r in rows:
            row_data.append(tuple(r.get(c) for c in cols))

        cursor.executemany(insert_sql, row_data)
        print(f"Restored table '{table_name}': {len(row_data)} records.")
        total_inserted += len(row_data)

    conn.commit()
    conn.close()
    print(f"All {len(tables)} tables fully restored into production.db! (Total records: {total_inserted})")

if __name__ == "__main__":
    import_all_backup_tables()
