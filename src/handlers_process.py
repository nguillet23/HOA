"""Process endpoint - handles the main budget processing workflow."""

import os
import shutil
import traceback

from flask import request, jsonify
import pandas as pd
import xlwings as xw

from .utils import (
    CSV_FILE, FILE_LABELS, FILE_KEYS, COLS_TO_DROP,
    load_memory, save_memory, migrate_memory, validate_request
)


def register_process_routes(app):
    """Register the main process endpoint."""
    
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
            validation_errors = validate_request(payload)
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