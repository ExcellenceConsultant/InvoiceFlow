#!/usr/bin/env python3
"""
QuickBooks Invoice Upload Flask Application

A Flask application for bulk uploading invoices and bills to QuickBooks Online
using OAuth2 authentication.
"""

import os
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///quickbooks_invoices.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
from models import db
db.init_app(app)
CORS(app)

# Import after db initialization to avoid circular imports
from models import Invoice, Bill, QuickBooksToken
from quickbooks_oauth import QuickBooksOAuth
from quickbooks_api import QuickBooksAPI
from bulk_upload import BulkUploader

# Initialize QuickBooks components
qb_oauth = QuickBooksOAuth(app)
qb_api = QuickBooksAPI()
bulk_uploader = BulkUploader(qb_api)

@app.route('/')
def index():
    """Main dashboard page"""
    # Check if user is authenticated with QuickBooks
    is_authenticated = 'qb_company_id' in session
    
    # Get counts for dashboard
    invoice_count = Invoice.query.count()
    bill_count = Bill.query.count()
    
    return render_template('index.html', 
                         is_authenticated=is_authenticated,
                         invoice_count=invoice_count,
                         bill_count=bill_count)

@app.route('/auth/quickbooks')
def quickbooks_auth():
    """Initiate QuickBooks OAuth2 flow"""
    return qb_oauth.get_authorization_url()

@app.route('/auth/callback')
def auth_callback():
    """Handle QuickBooks OAuth2 callback"""
    code = request.args.get('code')
    company_id = request.args.get('realmId')  # QuickBooks sends company ID as realmId
    
    if not code:
        return jsonify({'error': 'Authorization code not received'}), 400
    
    try:
        tokens = qb_oauth.get_access_token(code, company_id)
        
        # Store tokens in session and database
        session['qb_access_token'] = tokens['access_token']
        session['qb_refresh_token'] = tokens['refresh_token']
        session['qb_company_id'] = tokens['company_id']
        
        # Save tokens to database
        qb_token = QuickBooksToken.query.first()
        if qb_token:
            qb_token.access_token = tokens['access_token']
            qb_token.refresh_token = tokens['refresh_token']
            qb_token.company_id = tokens['company_id']
        else:
            qb_token = QuickBooksToken(
                access_token=tokens['access_token'],
                refresh_token=tokens['refresh_token'],
                company_id=tokens['company_id']
            )
            db.session.add(qb_token)
        
        db.session.commit()
        logger.info(f"Successfully authenticated with QuickBooks company ID: {tokens['company_id']}")
        
        return redirect(url_for('index'))
    
    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}")
        return jsonify({'error': f'Authentication failed: {str(e)}'}), 500

@app.route('/api/upload-all', methods=['POST'])
def upload_all_to_quickbooks():
    """Bulk upload all invoices and bills to QuickBooks"""
    if 'qb_access_token' not in session:
        return jsonify({'error': 'Not authenticated with QuickBooks'}), 401
    
    try:
        # Get all pending invoices and bills
        invoices = Invoice.query.filter_by(quickbooks_id=None).all()
        bills = Bill.query.filter_by(quickbooks_id=None).all()
        
        if not invoices and not bills:
            return jsonify({
                'message': 'No pending invoices or bills to upload',
                'results': {'invoices': [], 'bills': []}
            })
        
        # Perform bulk upload
        results = bulk_uploader.upload_all(
            invoices=invoices,
            bills=bills,
            access_token=session['qb_access_token'],
            company_id=session['qb_company_id']
        )
        
        return jsonify({
            'message': 'Bulk upload completed',
            'results': results
        })
    
    except Exception as e:
        logger.error(f"Bulk upload error: {str(e)}")
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@app.route('/api/invoices', methods=['GET', 'POST'])
def manage_invoices():
    """Get all invoices or create a new invoice"""
    if request.method == 'GET':
        invoices = Invoice.query.all()
        return jsonify([invoice.to_dict() for invoice in invoices])
    
    elif request.method == 'POST':
        data = request.get_json()
        try:
            invoice = Invoice(
                customer_name=data['customer_name'],
                invoice_date=data['invoice_date'],
                due_date=data['due_date'],
                invoice_number=data['invoice_number'],
                line_description=data['line_description'],
                amount=float(data['amount']),
                tax_code=data.get('tax_code', '')
            )
            db.session.add(invoice)
            db.session.commit()
            
            return jsonify({
                'message': 'Invoice created successfully',
                'invoice': invoice.to_dict()
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Failed to create invoice: {str(e)}'}), 400

@app.route('/api/bills', methods=['GET', 'POST'])
def manage_bills():
    """Get all bills or create a new bill"""
    if request.method == 'GET':
        bills = Bill.query.all()
        return jsonify([bill.to_dict() for bill in bills])
    
    elif request.method == 'POST':
        data = request.get_json()
        try:
            bill = Bill(
                vendor_name=data['vendor_name'],
                bill_date=data['bill_date'],
                due_date=data['due_date'],
                bill_number=data['bill_number'],
                line_description=data['line_description'],
                amount=float(data['amount']),
                expense_account=data['expense_account']
            )
            db.session.add(bill)
            db.session.commit()
            
            return jsonify({
                'message': 'Bill created successfully',
                'bill': bill.to_dict()
            }), 201
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Failed to create bill: {str(e)}'}), 400

@app.route('/api/upload-status')
def upload_status():
    """Get upload status for all invoices and bills"""
    invoices = Invoice.query.all()
    bills = Bill.query.all()
    
    invoice_status = []
    for invoice in invoices:
        invoice_status.append({
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'customer_name': invoice.customer_name,
            'amount': invoice.amount,
            'uploaded': invoice.quickbooks_id is not None,
            'quickbooks_id': invoice.quickbooks_id,
            'upload_error': invoice.upload_error
        })
    
    bill_status = []
    for bill in bills:
        bill_status.append({
            'id': bill.id,
            'bill_number': bill.bill_number,
            'vendor_name': bill.vendor_name,
            'amount': bill.amount,
            'uploaded': bill.quickbooks_id is not None,
            'quickbooks_id': bill.quickbooks_id,
            'upload_error': bill.upload_error
        })
    
    return jsonify({
        'invoices': invoice_status,
        'bills': bill_status
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        logger.info("Database tables created")
    
    # Run the app
    app.run(host='0.0.0.0', port=5000, debug=True)