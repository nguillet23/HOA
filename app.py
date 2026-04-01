import os
import sys
import shutil
import traceback
import tempfile
import threading
import webbrowser
import time
import tkinter as tk
from tkinter import filedialog

from flask import Flask, request, jsonify, render_template
import pandas as pd
import xlwings as xw

import json

MEMORY_FILE = os.path.join(os.path.dirname(__file__), "assoc_memory.json")


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
    }


def save_memory(data):
    with open(MEMORY_FILE, "w") as f:
        json.dump(data, f, indent=2)


def migrate_memory(data):
    data.setdefault("last_backup_folder", "")
    data.setdefault("last_association", "")
    data.setdefault("last_number", "")
    data.setdefault("last_month", "")
    data.setdefault("last_year", "")
    return data


# ── PyInstaller resource path helper ─────────────────────────────────────────
def resource_path(relative):
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)


app = Flask(__name__, template_folder=resource_path('templates'))

COLS_TO_DROP = [3, 4, 6, 7, 10, 12, 13, 15, 16, 18, 19, 22, 24, 25, 28, 29]


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
    assoc   = payload.get("association", "").strip()
    number  = payload.get("number", "").strip()
    month   = payload.get("month", "").strip()
    year    = payload.get("year", "").strip()

    if assoc:
        data["last_association"] = assoc
    if number:
        data["last_number"] = number
    if month:
        data["last_month"] = month
    if year:
        data["last_year"] = year

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


# ── Folder picker ─────────────────────────────────────────────────────────────

@app.route("/pick-folder", methods=["POST"])
def pick_folder():
    try:
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', True)
        folder = filedialog.askdirectory(title="Select Backup Folder")
        root.destroy()
        if folder:
            folder = os.path.normpath(folder)
            return jsonify({"ok": True, "path": folder})
        else:
            return jsonify({"ok": False, "path": ""})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


@app.route("/shutdown", methods=["POST"])
def shutdown():
    func = request.environ.get("werkzeug.server.shutdown")
    if func:
        func()
    else:
        t = threading.Timer(0.5, lambda: os.kill(os.getpid(), 9))
        t.daemon = True
        t.start()
    return jsonify({"ok": True})


# ── Helpers ───────────────────────────────────────────────────────────────────

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

VALID_MONTHS = {str(i).zfill(2) for i in range(1, 13)}


def _validate_request(form, files):
    errors = []

    assoc = form.get("association", "").strip()
    if not assoc:
        errors.append("Association Name is missing")
    elif len(assoc) > 100:
        errors.append("Association Name is too long (max 100 characters)")

    number = form.get("number", "").strip()
    if not number:
        errors.append("Association Number is missing")

    month = form.get("month", "").strip()
    if not month:
        errors.append("Month is missing")
    elif month not in VALID_MONTHS:
        errors.append(f"Month '{month}' is not valid — expected 01–12")

    year = form.get("year", "").strip()
    if not year:
        errors.append("Year is missing")
    elif not year.isdigit():
        errors.append("Year must contain digits only")
    elif len(year) != 4:
        errors.append(f"Year '{year}' must be exactly 4 digits")
    elif not (2000 <= int(year) <= 2100):
        errors.append(f"Year '{year}' is out of the expected range (2000–2100)")

    if not form.get("password", ""):
        errors.append("Workbook Password is missing")

    backup_folder = form.get("backup_folder", "").strip()
    if not backup_folder:
        errors.append("Backup Folder is missing — please select a folder")
    elif not os.path.isdir(backup_folder):
        errors.append(f"Backup Folder does not exist or is not accessible: {backup_folder}")

    for k in FILE_KEYS:
        if k not in files or files[k].filename == "":
            errors.append(f"{FILE_LABELS[k]} — no file selected")
        else:
            fname   = files[k].filename
            ext     = os.path.splitext(fname)[1].lower()
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
    logs   = []
    tmpdir = None

    def log(msg, level="info"):
        logs.append({"msg": msg, "level": level})

    def fail(msg):
        log(msg, "error")
        return jsonify({"ok": False, "logs": logs})

    try:
        # ── Backend validation ────────────────────────────────────────────
        validation_errors = _validate_request(request.form, request.files)
        if validation_errors:
            for err in validation_errors:
                log(err, "error")
            return jsonify({
                "ok": False,
                "logs": logs,
                "validation_errors": validation_errors,
            })

        # ── Pull form fields ──────────────────────────────────────────────
        association   = request.form["association"].strip()
        number        = request.form["number"].strip()
        month         = request.form["month"].strip()
        year          = request.form["year"].strip()
        date          = f"{year}_{month}"
        password      = request.form["password"]
        backup_folder = request.form["backup_folder"].strip()

        log(f"Association: {association} (#{number})  |  Period: {date}")

        # ── Save uploads to a temp directory ─────────────────────────────
        tmpdir = tempfile.mkdtemp(prefix="budget_proc_")
        log(f"Working directory: {tmpdir}")

        saved = {}
        for k in FILE_KEYS:
            f    = request.files[k]
            dest = os.path.join(tmpdir, f.filename)
            f.save(dest)
            saved[k] = dest
            log(f"Received {FILE_LABELS[k]}: {f.filename}")

        # ── Verify uploads are non-empty ──────────────────────────────────
        for k, path in saved.items():
            if not os.path.exists(path) or os.path.getsize(path) == 0:
                return fail(f"File upload failed or empty: {FILE_LABELS[k]} ({os.path.basename(path)})")

        # ── Load Balance Sheet ────────────────────────────────────────────
        log("Loading Balance Sheet…")
        try:
            BS = pd.read_excel(saved["balance"], sheet_name="BalanceSheet",
                               engine="xlrd", header=None)
        except Exception as e:
            return fail(f"Could not read Balance Sheet — {e}. "
                        f"Expected sheet 'BalanceSheet' in file: {os.path.basename(saved['balance'])}")

        # ── Load Operating Budget ─────────────────────────────────────────
        log("Loading Operating Budget Export…")
        try:
            OP = (pd.read_excel(saved["operating"], sheet_name="Sheet1",
                                engine="openpyxl", header=None)
                    .drop(columns=6))
        except Exception as e:
            return fail(f"Could not read Operating Budget Export — {e}. "
                        f"Expected sheet 'Sheet1' in file: {os.path.basename(saved['operating'])}")

        # ── Load Reserve Budget ───────────────────────────────────────────
        log("Loading Reserve Budget Export…")
        try:
            RSV = (pd.read_excel(saved["reserve"], sheet_name="Sheet1",
                                 engine="openpyxl", header=None)
                     .drop(columns=6))
        except Exception as e:
            return fail(f"Could not read Reserve Budget Export — {e}. "
                        f"Expected sheet 'Sheet1' in file: {os.path.basename(saved['reserve'])}")

        # ── Load & split Current Year ─────────────────────────────────────
        log("Loading Current Year Income Statement…")
        try:
            CY = pd.read_excel(saved["cy"], sheet_name="Income Statement",
                               engine="xlrd", header=None)
        except Exception as e:
            return fail(f"Could not read Current Year Income Statement — {e}. "
                        f"Expected sheet 'Income Statement' in file: {os.path.basename(saved['cy'])}")

        CY = CY.drop(CY.columns[COLS_TO_DROP], axis=1)
        cy_matches = CY[CY[0] == "Operating Net Total "].index
        if len(cy_matches) == 0:
            return fail("Current Year Income Statement: could not find the 'Operating Net Total' row. "
                        "Please check that the correct file was selected.")
        row_cy = cy_matches[0]
        OP_CY  = CY.iloc[0:row_cy + 1]
        RSV_CY = CY.iloc[row_cy:500]

        # ── Load & split Prior Year ───────────────────────────────────────
        log("Loading Prior Year Income Statement…")
        try:
            PY = pd.read_excel(saved["py"], sheet_name="Income Statement",
                               engine="xlrd", header=None)
        except Exception as e:
            return fail(f"Could not read Prior Year Income Statement — {e}. "
                        f"Expected sheet 'Income Statement' in file: {os.path.basename(saved['py'])}")

        PY = PY.drop(PY.columns[COLS_TO_DROP], axis=1)
        py_matches = PY[PY[0] == "Operating Net Total "].index
        if len(py_matches) == 0:
            return fail("Prior Year Income Statement: could not find the 'Operating Net Total' row. "
                        "Please check that the correct file was selected.")
        row_py = py_matches[0]
        OP_PY  = PY.iloc[0:row_py + 1]
        RSV_PY = PY.iloc[row_py:500]

        # ── Write into the macro workbook ─────────────────────────────────
        log("Opening macro workbook with xlwings…")
        try:
            excel_app = xw.App(visible=False)
            tgt_wb    = excel_app.books.open(saved["target"])
        except Exception as e:
            return fail(f"Could not open Budget Macro Workbook — {e}. "
                        f"Ensure the file is a valid .xlsm: {os.path.basename(saved['target'])}")

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
                        f"Sheet '{sheet_name}' not found in the Budget Macro Workbook. "
                        f"Make sure the correct template was selected."
                    )
                try:
                    ws.api.Unprotect(Password=password)
                except Exception:
                    raise ValueError(
                        f"Incorrect workbook password — could not unprotect sheet '{sheet_name}'. "
                        f"Please check the password and try again."
                    )
                ws.range(target_cell).value = data_vals
                ws.api.Protect(Password=password)
                tgt_wb.save()
        except Exception as e:
            tgt_wb.close()
            excel_app.quit()
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
        save_memory(mem)

        # ── Build destination folder ──────────────────────────────────────
        dest_folder = os.path.join(backup_folder, association)
        try:
            os.makedirs(dest_folder, exist_ok=True)
        except Exception as e:
            return fail(f"Could not create destination folder '{dest_folder}' — {e}. "
                        f"Check that the backup location is accessible.")

        log(f"Moving files to: {dest_folder}")

        # ── Output file names ─────────────────────────────────────────────
        macro_name       = f"{association}_{date}_Budget_Copy.xlsm"
        balance_out      = f"{number}_{association}_Balance_Sheet_{date}.xls"
        operating_out    = f"{number}_{association}_Budget_Export_OP.xlsx"
        reserve_out      = f"{number}_{association}_Budget_Export_RSV.xlsx"
        current_year_out = f"{number}_{association}_Income_Statement_CY.xls"
        past_year_out    = f"{number}_{association}_Income_Statement_PY.xls"

        # ── Move files into destination — shutil.move handles cross-device ─
        move_map = [
            (saved["target"],    macro_name),
            (saved["balance"],   balance_out),
            (saved["operating"], operating_out),
            (saved["reserve"],   reserve_out),
            (saved["cy"],        current_year_out),
            (saved["py"],        past_year_out),
        ]

        output_files = []
        for src_path, dst_name in move_map:
            original_name = os.path.basename(src_path)
            dst_path = os.path.join(dest_folder, dst_name)
            try:
                shutil.move(src_path, dst_path)
                log(f"Moved → {dst_name}", "success")
                output_files.append({"src": original_name, "dst": dst_name})
            except Exception as e:
                return fail(f"Failed to move '{dst_name}' — {e}")

        log("All files moved successfully.", "success")

        return jsonify({"ok": True, "logs": logs,
                        "output_files": output_files, "dest_folder": dest_folder})

    except Exception as e:
        log(f"Unexpected error: {str(e)}", "error")
        log(traceback.format_exc(), "error")
        return jsonify({"ok": False, "logs": logs})

    finally:
        # ── Always delete the temp directory, success or failure ──────────
        if tmpdir and os.path.exists(tmpdir):
            shutil.rmtree(tmpdir, ignore_errors=True)


def open_browser():
    time.sleep(1.2)
    webbrowser.open("http://localhost:5000")


if __name__ == "__main__":
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        threading.Thread(target=open_browser, daemon=True).start()
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)