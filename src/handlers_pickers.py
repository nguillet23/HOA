"""File/folder picker endpoints - handles native file dialogs."""

import os
import tkinter as tk
from tkinter import filedialog

from flask import request, jsonify
from .utils import FILE_DIALOGS, FILE_EXTENSIONS


def register_picker_routes(app):
    """Register all file/folder picker endpoints."""
    
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