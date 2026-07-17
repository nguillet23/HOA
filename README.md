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
   - Make sure the `requirements.txt` file is in the same folder as your other project files
   - Open a terminal in that folder and run:
   ```
   python -m pip install -r requirement.txt
   ```
   This will automatically install all the required libraries (flask, pandas, xlwings, openpyxl, and any others listed in the file).
4. Get the real `Test.xlsx` file from the config folder

   The `Test.xlsx` file should contain the list of associations and codes that can be easily updated.
   
   Currently, only `Ex_Test.xlsx` (__example file__) is included to protect real names and codes.
   - __`Ex_Test.xlsx` is an example file to hide associations and codes. IT DOES NOT WORK!!__
   
   To set up the real file, choose one of the following:
   - **Option A:** Manually add the associations and codes to `Test.xlsx` in the required format
   - **Option B:** Request the real `Test.xlsx` file from someone with access


---

## Running

1. Go to the folder called **Source Code** where all the files are located
2. Right click anywhere in the folder (You should see an option for 'Open in Terminal') [**Press that**]
3. Once in terminal, paste and run this command:
   ```
   python app.py
   ```
   It will take some time to run, but eventually a website for **http://localhost:5000/** will open
4. Input all files and passwords needed and then press run

## Closing

There are two options

**Option 1:** In the website, there is a big red button in the top right. Click that and follow all confirmations.

**Option 2:** Go back to terminal (the black window) and run:
```
Ctrl + C
```

From there the website/app should close.

⚠️ **IF NOT CLOSED CORRECTLY, IT WILL CONTINUE TO RUN ON YOUR COMPUTER UNTIL THE COMPUTER IS SHUT DOWN**

## Requirements

- Microsoft Excel must be installed on this PC (required for xlwings)
- Python must be installed (Python is the backend of the project)
- `requirements.txt` file must be included with your project files
