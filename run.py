"""
Usage
-----
Run the Flask app from the project root with either:

    python run.py

This starts the server at http://127.0.0.1:5000 and opens a browser window.
"""

import os
import threading
import webbrowser
from src import create_app


def open_browser():
    webbrowser.open("http://localhost:5000")


if __name__ == "__main__":
    app = create_app()
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)