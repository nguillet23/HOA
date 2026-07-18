import os
import sys
from flask import Flask
from .routes import register_routes


def resource_path(relative):
    """Helper for PyInstaller resource paths."""
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__, template_folder=resource_path('templates'))
    
    # Register all routes
    register_routes(app)
    
    return app