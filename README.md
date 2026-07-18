# Budget Processor — HomeOwners Advantage

## Setup (one-time, do this first)

1. Install Python from https://www.python.org/downloads/
   - During install, check **"Add Python to PATH"**
  
2. Verify Python installed correctly (optional but helpful)
   - Close any open terminal windows
   - Open a new terminal and run:
   ```
   python --version
   ```
   You should see a version number like `Python 3.11.0` or higher. If it doesn't work, Python wasn't added to PATH correctly and you'll need to reinstall it.

3. Download Libraries from terminal
   - Make sure the `requirements.txt` file is in the same folder as your project files
   - Open a terminal in that folder and run:
   ```
   python -m pip install -r requirements.txt
   ```
   This will automatically install all the required libraries (flask, pandas, xlwings, openpyxl, and any others listed in the file).

---

## Project Structure

```
project/
├── run.py                 (main entry point)
├── requirements.txt       (dependencies)
├── README.md
├── src/
│   ├── __init__.py
│   ├── routes.py         (all endpoints)
│   ├── utils.py          (constants & utilities)
│   ├── templates/
│   │   └── index.html
│   └── static/
│       ├── style.css
│       └── script.js
├── config/
│   └── Association Export.xlsx
```

---

## Running

1. Go to the folder where all the files are located (where `run.py` is)
2. Right click anywhere in the folder (You should see an option for 'Open in Terminal') [**Press that**]
3. Once in terminal, paste and run this command:
   ```
   python run.py
   ```
   It will take some time to run, but eventually a website for **http://localhost:5000/** will open automatically
4. Input all files and passwords needed and then press run

---

## Closing

There are two options:

**Option 1:** In the website, there is a big red button in the top right. Click that and follow all confirmations.

**Option 2:** Go back to terminal (the black window) and run:
```
Ctrl + C
```

From there the website/app should close.

⚠️ **IF NOT CLOSED CORRECTLY, IT WILL CONTINUE TO RUN ON YOUR COMPUTER UNTIL THE COMPUTER IS SHUT DOWN**

---

## Requirements

- Microsoft Excel must be installed on this PC (required for xlwings)
- Python 3.11 or higher must be installed (Python is the backend of the project)
- `requirements.txt` file must be included with your project files