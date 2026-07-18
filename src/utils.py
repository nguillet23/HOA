import os
from flask import jsonify


# ── Constants & Configuration ─────────────────────────────────────────────────

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CSV_FILE = os.path.join(PROJECT_ROOT, 'config', 'Association Export.xlsx')

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


# ── Memory Management ─────────────────────────────────────────────────────────

def load_memory():
    """Load session memory (currently a stub)."""
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
    """Save session memory (currently a stub)."""
    return None


def migrate_memory(data):
    """Ensure all expected keys exist in memory."""
    data.setdefault("last_backup_folder", "")
    data.setdefault("last_association", "")
    data.setdefault("last_number", "")
    data.setdefault("last_month", "")
    data.setdefault("last_year", "")
    data.setdefault("last_budget_year", "")
    data.setdefault("last_file_paths", {})
    return data


# ── Validation ────────────────────────────────────────────────────────────────

def validate_request(payload):
    """Validate all required form fields."""
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