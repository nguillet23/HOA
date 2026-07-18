"""Associations endpoints - handles loading association data."""

from flask import jsonify
from openpyxl import load_workbook
from .utils import CSV_FILE


def register_associations_routes(app):
    """Register all associations-related endpoints."""
    
    @app.route('/api/associations')
    def get_associations():
        associations = []
        
        try:
            workbook = load_workbook(CSV_FILE)  # .xlsx file
            worksheet = workbook.active
            
            # Get column headers from first row
            headers = [cell.value for cell in worksheet[1]]
            
            # Loop through data rows (starting from row 2)
            for row in worksheet.iter_rows(min_row=2, values_only=True):
                associations.append({
                    'value': row[2],      # First column (Association)
                    'label': row[2],      # First column
                    'num': row[0]         # Second column (Code)
                })
        except FileNotFoundError:
            return jsonify({'error': 'Excel file not found'}), 404
        except Exception as e:
            print(f"Error: {e}")
            return jsonify({'error': str(e)}), 400
        
        return jsonify(associations)