"""Memory endpoints - handles session/state persistence."""

from flask import request, jsonify
from .utils import load_memory, save_memory, migrate_memory


def register_memory_routes(app):
    """Register all memory-related endpoints."""
    
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