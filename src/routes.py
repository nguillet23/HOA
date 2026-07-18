"""Flask routes - registers all endpoint handlers."""

import os
import threading
from flask import render_template, jsonify

from .handlers_memory import register_memory_routes
from .handlers_pickers import register_picker_routes
from .handlers_associations import register_associations_routes
from .handlers_process import register_process_routes


def register_routes(app):
    """Register all routes with the Flask app."""
    
    # Index page
    @app.route("/")
    def index():
        return render_template("index.html")


    # Favicon (no content)
    @app.route('/favicon.ico')
    def favicon():
        return '', 204


    # Shutdown endpoint
    @app.route("/shutdown", methods=["POST"])
    def shutdown():
        t = threading.Timer(0.5, lambda: os.kill(os.getpid(), 9))
        t.daemon = True
        t.start()
        return jsonify({"ok": True})


    # Register all handler routes
    register_memory_routes(app)
    register_picker_routes(app)
    register_associations_routes(app)
    register_process_routes(app)