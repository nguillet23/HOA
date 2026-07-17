import os
import sys
import shutil
import traceback
import threading
import webbrowser
import time
import tkinter as tk
from tkinter import filedialog

from flask import Flask, request, jsonify, render_template
import pandas as pd
import xlwings as xw
from openpyxl import load_workbook

import json


# Preferred memory file location: project_root/config/assoc_memory.json
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MEMORY_FILE = os.path.join(PROJECT_ROOT, 'config', 'assoc_memory.json')
CSV_FILE = os.path.join(PROJECT_ROOT, 'config', 'Test.xlsx')


def load_memory():
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r") as f:
            return json.load(f)
    return {
        "last_backup_folder": "",
        "last_association": "",
        "last_number": "",
        "last_month": "",
        "last_year": "",
        "last_budget_year": "",
        "last_file_paths": {},
    }


def save_memory(data):
    os.makedirs(os.path.dirname(MEMORY_FILE), exist_ok=True)
    with open(MEMORY_FILE, "w") as f:
        json.dump(data, f, indent=2)


def migrate_memory(data):
    data.setdefault("last_backup_folder", "")
    data.setdefault("last_association", "")
    data.setdefault("last_number", "")
    data.setdefault("last_month", "")
    data.setdefault("last_year", "")
    data.setdefault("last_budget_year", "")
    data.setdefault("last_file_paths", {})
    return data


# ── PyInstaller resource path helper ─────────────────────────────────────────
def resource_path(relative):
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)


app = Flask(__name__, template_folder=resource_path('templates'))

COLS_TO_DROP = [3, 4, 6, 7, 10, 12, 13, 15, 16, 18, 19, 22, 24, 25, 28, 29]

FILE_LABELS = {
    "balance":   "Balance Sheet",
    "operating": "Operating Budget Export",
    "reserve":   "Reserve Budget Export",
    "cy":        "Current Year Income Statement",
    "py":        "Prior Year Income Statement",
    "target":    "Budget Macro Workbook",
}

FILE_KEYS = list(FILE_LABELS.keys())

FILE_EXTENSIONS = {
    "target":    [".xlsm"],
    "balance":   [".xls", ".xlsx"],
    "operating": [".xls", ".xlsx"],
    "reserve":   [".xls", ".xlsx"],
    "cy":        [".xls", ".xlsx"],
    "py":        [".xls", ".xlsx"],
}

FILE_DIALOGS = {
    "target":    ("Budget Macro Workbook (.xlsm)",     [("Excel Macro Files", "*.xlsm")]),
    "balance":   ("Balance Sheet (.xls / .xlsx)",      [("Excel Files", "*.xls *.xlsx")]),
    "operating": ("Operating Budget Export (.xlsx)",   [("Excel Files", "*.xls *.xlsx")]),
    "reserve":   ("Reserve Budget Export (.xlsx)",     [("Excel Files", "*.xls *.xlsx")]),
    "cy":        ("Current Year Income Statement",     [("Excel Files", "*.xls *.xlsx")]),
    "py":        ("Prior Year Income Statement",       [("Excel Files", "*.xls *.xlsx")]),
}

VALID_MONTHS = {str(i).zfill(2) for i in range(1, 13)}


@app.route("/")
def index():
    return render_template("index.html")


# ── Memory endpoints ──────────────────────────────────────────────────────────

@app.route("/memory", methods=["GET"])
def get_memory():
    data = migrate_memory(load_memory())
    return jsonify(data)


@app.route("/memory", methods=["POST"])
def update_memory():
    data    = migrate_memory(load_memory())
    payload = request.json or {}
    for key in ("association", "number", "month", "year", "budget_year"):
        val = payload.get(key, "").strip()
        if val:
            if key == "budget_year":
                data["last_budget_year"] = val
            else:
                data[f"last_{key}"] = val
    save_memory(data)
    return jsonify({"ok": True})


@app.route("/memory/folder", methods=["POST"])
def update_folder_memory():
    data    = migrate_memory(load_memory())
    payload = request.json or {}
    folder  = payload.get("last_backup_folder", "").strip()
    if folder:
        data["last_backup_folder"] = folder
        save_memory(data)
    return jsonify({"ok": True})


@app.route("/memory/files", methods=["POST"])
def update_file_memory():
    """Persist the last-used file paths so the UI can suggest them next session."""
    data    = migrate_memory(load_memory())
    payload = request.json or {}
    paths   = payload.get("paths", {})
    if paths:
        data["last_file_paths"] = paths
        save_memory(data)
    return jsonify({"ok": True})


# ── Native file / folder pickers ──────────────────────────────────────────────

@app.route("/pick-folder", methods=["POST"])
def pick_folder():
    try:
        root = tk.Tk(); root.withdraw(); root.wm_attributes('-topmost', True)
        folder = filedialog.askdirectory(title="Select Backup Folder")
        root.destroy()
        if folder:
            return jsonify({"ok": True, "path": os.path.normpath(folder)})
        return jsonify({"ok": False, "path": ""})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


@app.route("/pick-file", methods=["POST"])
def pick_file():
    """Open a native file-picker for a specific file slot."""
    payload   = request.json or {}
    file_key  = payload.get("key", "")
    init_dir  = payload.get("init_dir", os.path.expanduser("~"))

    if file_key not in FILE_DIALOGS:
        return jsonify({"ok": False, "error": "Unknown file key"})

    title, filetypes = FILE_DIALOGS[file_key]
    try:
        root = tk.Tk(); root.withdraw(); root.wm_attributes('-topmost', True)
        path = filedialog.askopenfilename(
            title=f"Select {title}",
            filetypes=filetypes + [("All files", "*.*")],
            initialdir=init_dir,
        )
        root.destroy()
        if path:
            path = os.path.normpath(path)
            ext  = os.path.splitext(path)[1].lower()
            allowed = FILE_EXTENSIONS[file_key]
            if ext not in allowed:
                return jsonify({
                    "ok": False,
                    "error": f"Wrong file type '{ext}' — expected {' or '.join(allowed)}"
                })
            return jsonify({
                "ok":       True,
                "path":     path,
                "filename": os.path.basename(path),
                "dir":      os.path.dirname(path),
            })
        return jsonify({"ok": False, "path": ""})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


@app.route("/shutdown", methods=["POST"])
def shutdown():
    t = threading.Timer(0.5, lambda: os.kill(os.getpid(), 9))
    t.daemon = True; t.start()
    return jsonify({"ok": True})

# ── CSV Associations ────────────────────────────────────────────────────────────
@app.route('/api/associations')
def get_associations():
    associations = []
    
    try:
        workbook = load_workbook(CSV_FILE)  # .xlsx file
        worksheet = workbook.active
        
        # Get column headers from first row
        headers = [cell.value for cell in worksheet[1]]
        
        # Loop through data rows (starting from row 2)
        for row in worksheet.iter_rows(min_row=2, values_only=True):
            associations.append({
                'value': row[0],      # First column (Association)
                'label': row[0],      # First column
                'num': row[1]         # Second column (Code)
            })
    except FileNotFoundError:
        return jsonify({'error': 'Excel file not found'}), 404
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 400
    
    return jsonify(associations)

@app.route('/favicon.ico')
def favicon():
    return '', 204  # Return empty 204 (No Content)

# ── Validation ────────────────────────────────────────────────────────────────

def _validate_request(payload):
    errors = []

    assoc = payload.get("association", "").strip()
    if not assoc:
        errors.append("Association Name is missing")
    elif len(assoc) > 100:
        errors.append("Association Name is too long (max 100 characters)")

    number = payload.get("number", "").strip()
    if not number:
        errors.append("Association Number is missing")

    month = payload.get("month", "").strip()
    if not month:
        errors.append("Month is missing")
    elif month not in VALID_MONTHS:
        errors.append(f"Month '{month}' is not valid — expected 01–12")

    year = payload.get("year", "").strip()
    if not year:
        errors.append("Year is missing")
    elif not year.isdigit():
        errors.append("Year must contain digits only")
    elif len(year) != 4:
        errors.append(f"Year '{year}' must be exactly 4 digits")
    elif not (2000 <= int(year) <= 2100):
        errors.append(f"Year '{year}' is out of the expected range (2000–2100)")

    budget_year = payload.get("budget_year", "").strip()
    if not budget_year:
        errors.append("Budget Year is missing")
    elif not budget_year.isdigit():
        errors.append("Budget Year must contain digits only")
    elif len(budget_year) != 4:
        errors.append(f"Budget Year '{budget_year}' must be exactly 4 digits")
    elif not (2000 <= int(budget_year) <= 2100):
        errors.append(f"Budget Year '{budget_year}' is out of the expected range (2000–2100)")

    if not payload.get("password", ""):
        errors.append("Workbook Password is missing")

    backup_folder = payload.get("backup_folder", "").strip()
    if not backup_folder:
        errors.append("Backup Folder is missing — please select a folder")
    elif not os.path.isdir(backup_folder):
        errors.append(f"Backup Folder does not exist or is not accessible: {backup_folder}")

    for k in FILE_KEYS:
        path = payload.get(f"path_{k}", "").strip()
        if not path:
            errors.append(f"{FILE_LABELS[k]} — no file selected")
        elif not os.path.isfile(path):
            errors.append(f"{FILE_LABELS[k]} — file not found on disk: {os.path.basename(path)}")
        else:
            ext     = os.path.splitext(path)[1].lower()
            allowed = FILE_EXTENSIONS[k]
            if ext not in allowed:
                errors.append(
                    f"{FILE_LABELS[k]} — wrong file type '{ext}' "
                    f"(expected {' or '.join(allowed)})"
                )

    return errors


# ── Main process endpoint ──────────────────────────────────────────────────────

@app.route("/process", methods=["POST"])
def process():
    logs = []

    def log(msg, level="info"):
        logs.append({"msg": msg, "level": level})

    def fail(msg):
        log(msg, "error")
        return jsonify({"ok": False, "logs": logs})

    try:
        payload = request.json or {}

        # ── Backend validation ────────────────────────────────────────────
        validation_errors = _validate_request(payload)
        if validation_errors:
            for err in validation_errors:
                log(err, "error")
            return jsonify({"ok": False, "logs": logs, "validation_errors": validation_errors})

        # ── Pull fields ───────────────────────────────────────────────────
        association   = payload["association"].strip()
        number        = payload["number"].strip()
        month         = payload["month"].strip()
        year          = payload["year"].strip()
        budget_year   = payload["budget_year"].strip()
        date          = f"{year}_{month}"
        password      = payload["password"]
        backup_folder = payload["backup_folder"].strip()

        log(f"Association: {association} (#{number})  |  Period: {date}  |  Budget Year: {budget_year}")

        # Build a dict of the original on-disk paths
        paths = {k: payload[f"path_{k}"].strip() for k in FILE_KEYS}
        for k, p in paths.items():
            log(f"Using {FILE_LABELS[k]}: {os.path.basename(p)}")

        # ── Load Balance Sheet ────────────────────────────────────────────
        log("Loading Balance Sheet…")
        try:
            BS = pd.read_excel(paths["balance"], sheet_name="BalanceSheet",
                               engine="xlrd", header=None)
        except Exception as e:
            return fail(f"Could not read Balance Sheet — {e}.")

        # ── Load Operating Budget ─────────────────────────────────────────
        log("Loading Operating Budget Export…")
        try:
            OP = (pd.read_excel(paths["operating"], sheet_name="Sheet1",
                                engine="openpyxl", header=None)
                    .drop(columns=6))
        except Exception as e:
            return fail(f"Could not read Operating Budget Export — {e}.")

        # ── Load Reserve Budget ───────────────────────────────────────────
        log("Loading Reserve Budget Export…")
        try:
            RSV = (pd.read_excel(paths["reserve"], sheet_name="Sheet1",
                                 engine="openpyxl", header=None)
                     .drop(columns=6))
        except Exception as e:
            return fail(f"Could not read Reserve Budget Export — {e}.")

        # ── Load & split Current Year ─────────────────────────────────────
        log("Loading Current Year Income Statement…")
        try:
            CY = pd.read_excel(paths["cy"], sheet_name="Income Statement",
                               engine="xlrd", header=None)
        except Exception as e:
            return fail(f"Could not read Current Year Income Statement — {e}.")

        CY = CY.drop(CY.columns[COLS_TO_DROP], axis=1)
        cy_matches = CY[CY[0] == "Operating Net Total "].index
        if len(cy_matches) == 0:
            return fail("Current Year Income Statement: could not find 'Operating Net Total' row.")
        row_cy = cy_matches[0]
        OP_CY  = CY.iloc[0:row_cy + 1]
        RSV_CY = CY.iloc[row_cy:500]

        # ── Load & split Prior Year ───────────────────────────────────────
        log("Loading Prior Year Income Statement…")
        try:
            PY = pd.read_excel(paths["py"], sheet_name="Income Statement",
                               engine="xlrd", header=None)
        except Exception as e:
            return fail(f"Could not read Prior Year Income Statement — {e}.")

        PY = PY.drop(PY.columns[COLS_TO_DROP], axis=1)
        py_matches = PY[PY[0] == "Operating Net Total "].index
        if len(py_matches) == 0:
            return fail("Prior Year Income Statement: could not find 'Operating Net Total' row.")
        row_py = py_matches[0]
        OP_PY  = PY.iloc[0:row_py + 1]
        RSV_PY = PY.iloc[row_py:500]

        # ── Prepare target copy and write into the macro workbook ─────────
        target_copy_name = f"{budget_year}_{association}_Budget.xlsm"
        dest_folder = os.path.join(backup_folder, association)
        try:
            os.makedirs(dest_folder, exist_ok=True)
        except Exception as e:
            return fail(f"Could not create destination folder '{dest_folder}' — {e}.")

        target_copy_path = os.path.join(dest_folder, target_copy_name)
        log(f"Copying macro workbook to: {target_copy_name}")
        try:
            shutil.copy2(paths["target"], target_copy_path)
        except Exception as e:
            return fail(f"Could not copy Budget Macro Workbook — {e}.")

        log("Opening macro workbook with xlwings…")
        try:
            excel_app = xw.App(visible=False)
            tgt_wb    = excel_app.books.open(target_copy_path)
        except Exception as e:
            if os.path.exists(target_copy_path):
                os.remove(target_copy_path)
            return fail(f"Could not open Budget Macro Workbook — {e}.")

        sheet_operations = [
            ("CYBalSheet", "B1", BS.values),
            ("CYBudOP",    "B2", OP.iloc[0:501, 2:21].values),
            ("CYBudRSV",   "B2", RSV.iloc[0:501, 2:21].values),
            ("CYActOP",    "C1", OP_CY.iloc[0:501, 0:15].values),
            ("CYActRSV",   "C5", RSV_CY.iloc[0:501, 0:15].values),
            ("PYActOP",    "C1", OP_PY.iloc[0:501, 0:15].values),
            ("PYActRSV",   "C5", RSV_PY.iloc[0:501, 0:15].values),
            ("CYActRSV",   "C1", OP_CY.iloc[0:5, 0:15].values),
            ("PYActRSV",   "C1", OP_PY.iloc[0:5, 0:15].values),
        ]

        try:
            for sheet_name, target_cell, data_vals in sheet_operations:
                log(f"Writing sheet: {sheet_name} → {target_cell}")
                try:
                    ws = tgt_wb.sheets[sheet_name]
                except Exception:
                    raise ValueError(
                        f"Sheet '{sheet_name}' not found in the Budget Macro Workbook."
                    )
                try:
                    ws.api.Unprotect(Password=password)
                except Exception:
                    raise ValueError(
                        f"Incorrect workbook password — could not unprotect sheet '{sheet_name}'."
                    )
                ws.range(target_cell).value = data_vals
                ws.api.Protect(Password=password)
                tgt_wb.save()
        except Exception as e:
            tgt_wb.close()
            excel_app.quit()
            if os.path.exists(target_copy_path):
                os.remove(target_copy_path)
            return fail(str(e))

        tgt_wb.close()
        excel_app.quit()
        log("Workbook saved and closed.", "success")

        # ── Persist session to memory ─────────────────────────────────────
        mem = migrate_memory(load_memory())
        mem["last_association"] = association
        mem["last_number"]      = number
        mem["last_month"]       = month
        mem["last_year"]        = year
        mem["last_budget_year"] = budget_year
        mem["last_file_paths"]  = {k: str(paths[k]) for k in FILE_KEYS}
        save_memory(mem)

        log(f"Moving & renaming files to: {dest_folder}")

        output_files = [{
            "src": os.path.basename(paths["target"]),
            "dst": target_copy_name,
        }]

        move_map = [
            ("balance",   f"{number}_{association}_Balance_Sheet_{date}.xls"),
            ("operating", f"{number}_{association}_Budget_Export_OP.xlsx"),
            ("reserve",   f"{number}_{association}_Budget_Export_RSV.xlsx"),
            ("cy",        f"{number}_{association}_Income_Statement_CY.xls"),
            ("py",        f"{number}_{association}_Income_Statement_PY.xls"),
        ]

        for key, dst_name in move_map:
            src_path      = paths[key]
            original_name = os.path.basename(src_path)
            dst_path      = os.path.join(dest_folder, dst_name)
            try:
                shutil.move(src_path, dst_path)   # rename + move — no copy step
                log(f"Moved & renamed → {dst_name}", "success")
                output_files.append({"src": original_name, "dst": dst_name})
            except Exception as e:
                return fail(f"Failed to move '{original_name}' → '{dst_name}' — {e}")

        log("All files moved successfully.", "success")
        return jsonify({"ok": True, "logs": logs,
                        "output_files": output_files, "dest_folder": dest_folder})

    except Exception as e:
        log(f"Unexpected error: {str(e)}", "error")
        log(traceback.format_exc(), "error")
        return jsonify({"ok": False, "logs": logs})


def open_browser():
    webbrowser.open("http://localhost:5000")


if __name__ == "__main__":
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)