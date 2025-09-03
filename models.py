"""
Database models for QuickBooks Invoice Upload application

Defines models for invoices, bills, and QuickBooks authentication tokens.
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

# Create db instance
db = SQLAlchemy()

class Invoice(db.Model):
    """Model for Accounts Receivable (Customer Invoices)"""
    
    __tablename__ = 'invoices'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Invoice details
    customer_name = db.Column(db.String(200), nullable=False)
    invoice_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=True)
    invoice_number = db.Column(db.String(100), nullable=False, unique=True)
    line_description = db.Column(db.Text, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    tax_code = db.Column(db.String(50), nullable=True)
    
    # QuickBooks integration fields
    quickbooks_id = db.Column(db.String(100), nullable=True)
    upload_error = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert invoice to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'customer_name': self.customer_name,
            'invoice_date': self.invoice_date.isoformat() if self.invoice_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'invoice_number': self.invoice_number,
            'line_description': self.line_description,
            'amount': float(self.amount) if self.amount else 0,
            'tax_code': self.tax_code,
            'quickbooks_id': self.quickbooks_id,
            'upload_error': self.upload_error,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def to_quickbooks_json(self):
        """Convert invoice to QuickBooks API format"""
        return {
            "Line": [{
                "Amount": float(self.amount),
                "DetailType": "SalesItemLineDetail",
                "SalesItemLineDetail": {
                    "ItemRef": {
                        "value": "1",  # Default item - should be configurable
                        "name": "Services"
                    },
                    "TaxCodeRef": {
                        "value": self.tax_code if self.tax_code else "NON"
                    }
                },
                "Description": self.line_description
            }],
            "CustomerRef": {
                "name": self.customer_name
            },
            "DocNumber": self.invoice_number,
            "TxnDate": self.invoice_date.isoformat() if self.invoice_date else None,
            "DueDate": self.due_date.isoformat() if self.due_date else None
        }
    
    def __repr__(self):
        return f'<Invoice {self.invoice_number}: {self.customer_name} - ${self.amount}>'


class Bill(db.Model):
    """Model for Accounts Payable (Vendor Bills)"""
    
    __tablename__ = 'bills'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Bill details
    vendor_name = db.Column(db.String(200), nullable=False)
    bill_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=True)
    bill_number = db.Column(db.String(100), nullable=False, unique=True)
    line_description = db.Column(db.Text, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    expense_account = db.Column(db.String(200), nullable=False)
    
    # QuickBooks integration fields
    quickbooks_id = db.Column(db.String(100), nullable=True)
    upload_error = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert bill to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'vendor_name': self.vendor_name,
            'bill_date': self.bill_date.isoformat() if self.bill_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'bill_number': self.bill_number,
            'line_description': self.line_description,
            'amount': float(self.amount) if self.amount else 0,
            'expense_account': self.expense_account,
            'quickbooks_id': self.quickbooks_id,
            'upload_error': self.upload_error,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def to_quickbooks_json(self):
        """Convert bill to QuickBooks API format"""
        return {
            "Line": [{
                "Amount": float(self.amount),
                "DetailType": "AccountBasedExpenseLineDetail",
                "AccountBasedExpenseLineDetail": {
                    "AccountRef": {
                        "name": self.expense_account
                    }
                },
                "Description": self.line_description
            }],
            "VendorRef": {
                "name": self.vendor_name
            },
            "DocNumber": self.bill_number,
            "TxnDate": self.bill_date.isoformat() if self.bill_date else None,
            "DueDate": self.due_date.isoformat() if self.due_date else None
        }
    
    def __repr__(self):
        return f'<Bill {self.bill_number}: {self.vendor_name} - ${self.amount}>'


class QuickBooksToken(db.Model):
    """Model for storing QuickBooks OAuth tokens securely"""
    
    __tablename__ = 'quickbooks_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # OAuth tokens
    access_token = db.Column(db.Text, nullable=False)
    refresh_token = db.Column(db.Text, nullable=False)
    company_id = db.Column(db.String(100), nullable=False)
    
    # Token metadata
    token_expires_at = db.Column(db.DateTime, nullable=True)
    scope = db.Column(db.String(500), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def is_expired(self):
        """Check if the access token is expired"""
        if not self.token_expires_at:
            return False
        return datetime.utcnow() > self.token_expires_at
    
    def to_dict(self):
        """Convert token info to dictionary (excluding sensitive data)"""
        return {
            'id': self.id,
            'company_id': self.company_id,
            'has_access_token': bool(self.access_token),
            'has_refresh_token': bool(self.refresh_token),
            'token_expires_at': self.token_expires_at.isoformat() if self.token_expires_at else None,
            'scope': self.scope,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<QuickBooksToken company_id={self.company_id}>'