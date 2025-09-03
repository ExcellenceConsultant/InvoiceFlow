"""
Bulk Upload Module for QuickBooks Integration

Handles bulk uploading of invoices and bills to QuickBooks Online
with detailed success/failure logging.
"""

import logging
from datetime import datetime
from models import db

logger = logging.getLogger(__name__)

class BulkUploader:
    """Handles bulk uploading of invoices and bills to QuickBooks"""
    
    def __init__(self, quickbooks_api):
        self.qb_api = quickbooks_api
    
    def upload_all(self, invoices, bills, access_token, company_id):
        """
        Upload all invoices and bills to QuickBooks in bulk
        
        Args:
            invoices: List of Invoice model instances
            bills: List of Bill model instances
            access_token: QuickBooks access token
            company_id: QuickBooks company ID
            
        Returns:
            Dictionary with detailed results for each upload
        """
        results = {
            'invoices': {
                'total': len(invoices),
                'successful': 0,
                'failed': 0,
                'details': []
            },
            'bills': {
                'total': len(bills),
                'successful': 0,
                'failed': 0,
                'details': []
            },
            'summary': {
                'total_processed': len(invoices) + len(bills),
                'total_successful': 0,
                'total_failed': 0,
                'upload_timestamp': datetime.utcnow().isoformat()
            }
        }
        
        # Upload invoices
        if invoices:
            logger.info(f"Starting bulk upload of {len(invoices)} invoices")
            results['invoices'] = self._upload_invoices(invoices, access_token, company_id)
        
        # Upload bills
        if bills:
            logger.info(f"Starting bulk upload of {len(bills)} bills")
            results['bills'] = self._upload_bills(bills, access_token, company_id)
        
        # Calculate summary
        results['summary']['total_successful'] = (
            results['invoices']['successful'] + results['bills']['successful']
        )
        results['summary']['total_failed'] = (
            results['invoices']['failed'] + results['bills']['failed']
        )
        
        logger.info(
            f"Bulk upload completed: {results['summary']['total_successful']} successful, "
            f"{results['summary']['total_failed']} failed out of {results['summary']['total_processed']} total"
        )
        
        return results
    
    def _upload_invoices(self, invoices, access_token, company_id):
        """Upload invoices to QuickBooks"""
        result = {
            'total': len(invoices),
            'successful': 0,
            'failed': 0,
            'details': []
        }
        
        for invoice in invoices:
            try:
                # Convert invoice to QuickBooks format
                qb_invoice_data = invoice.to_quickbooks_json()
                
                # Upload to QuickBooks
                qb_response = self.qb_api.create_invoice(
                    qb_invoice_data,
                    access_token,
                    company_id
                )
                
                # Update local invoice record
                invoice.quickbooks_id = qb_response.get('Id')
                invoice.uploaded_at = datetime.utcnow()
                invoice.upload_error = None
                
                # Record success
                result['successful'] += 1
                result['details'].append({
                    'id': invoice.id,
                    'invoice_number': invoice.invoice_number,
                    'customer_name': invoice.customer_name,
                    'amount': float(invoice.amount),
                    'status': 'success',
                    'quickbooks_id': invoice.quickbooks_id,
                    'message': 'Successfully uploaded to QuickBooks'
                })
                
                logger.info(f"Successfully uploaded invoice {invoice.invoice_number}")
                
            except Exception as e:
                error_message = str(e)
                logger.error(f"Failed to upload invoice {invoice.invoice_number}: {error_message}")
                
                # Update local invoice record with error
                invoice.upload_error = error_message
                
                # Record failure
                result['failed'] += 1
                result['details'].append({
                    'id': invoice.id,
                    'invoice_number': invoice.invoice_number,
                    'customer_name': invoice.customer_name,
                    'amount': float(invoice.amount),
                    'status': 'failed',
                    'quickbooks_id': None,
                    'message': error_message,
                    'error': error_message
                })
            
            # Commit changes to database after each invoice
            try:
                db.session.commit()
            except Exception as e:
                logger.error(f"Database commit error for invoice {invoice.invoice_number}: {str(e)}")
                db.session.rollback()
        
        return result
    
    def _upload_bills(self, bills, access_token, company_id):
        """Upload bills to QuickBooks"""
        result = {
            'total': len(bills),
            'successful': 0,
            'failed': 0,
            'details': []
        }
        
        for bill in bills:
            try:
                # Convert bill to QuickBooks format
                qb_bill_data = bill.to_quickbooks_json()
                
                # Upload to QuickBooks
                qb_response = self.qb_api.create_bill(
                    qb_bill_data,
                    access_token,
                    company_id
                )
                
                # Update local bill record
                bill.quickbooks_id = qb_response.get('Id')
                bill.uploaded_at = datetime.utcnow()
                bill.upload_error = None
                
                # Record success
                result['successful'] += 1
                result['details'].append({
                    'id': bill.id,
                    'bill_number': bill.bill_number,
                    'vendor_name': bill.vendor_name,
                    'amount': float(bill.amount),
                    'status': 'success',
                    'quickbooks_id': bill.quickbooks_id,
                    'message': 'Successfully uploaded to QuickBooks'
                })
                
                logger.info(f"Successfully uploaded bill {bill.bill_number}")
                
            except Exception as e:
                error_message = str(e)
                logger.error(f"Failed to upload bill {bill.bill_number}: {error_message}")
                
                # Update local bill record with error
                bill.upload_error = error_message
                
                # Record failure
                result['failed'] += 1
                result['details'].append({
                    'id': bill.id,
                    'bill_number': bill.bill_number,
                    'vendor_name': bill.vendor_name,
                    'amount': float(bill.amount),
                    'status': 'failed',
                    'quickbooks_id': None,
                    'message': error_message,
                    'error': error_message
                })
            
            # Commit changes to database after each bill
            try:
                db.session.commit()
            except Exception as e:
                logger.error(f"Database commit error for bill {bill.bill_number}: {str(e)}")
                db.session.rollback()
        
        return result
    
    def upload_single_invoice(self, invoice, access_token, company_id):
        """Upload a single invoice to QuickBooks"""
        try:
            qb_invoice_data = invoice.to_quickbooks_json()
            qb_response = self.qb_api.create_invoice(qb_invoice_data, access_token, company_id)
            
            # Update invoice record
            invoice.quickbooks_id = qb_response.get('Id')
            invoice.uploaded_at = datetime.utcnow()
            invoice.upload_error = None
            db.session.commit()
            
            return {
                'status': 'success',
                'quickbooks_id': invoice.quickbooks_id,
                'message': 'Successfully uploaded to QuickBooks'
            }
            
        except Exception as e:
            error_message = str(e)
            invoice.upload_error = error_message
            db.session.commit()
            
            return {
                'status': 'failed',
                'error': error_message,
                'message': f'Upload failed: {error_message}'
            }
    
    def upload_single_bill(self, bill, access_token, company_id):
        """Upload a single bill to QuickBooks"""
        try:
            qb_bill_data = bill.to_quickbooks_json()
            qb_response = self.qb_api.create_bill(qb_bill_data, access_token, company_id)
            
            # Update bill record
            bill.quickbooks_id = qb_response.get('Id')
            bill.uploaded_at = datetime.utcnow()
            bill.upload_error = None
            db.session.commit()
            
            return {
                'status': 'success',
                'quickbooks_id': bill.quickbooks_id,
                'message': 'Successfully uploaded to QuickBooks'
            }
            
        except Exception as e:
            error_message = str(e)
            bill.upload_error = error_message
            db.session.commit()
            
            return {
                'status': 'failed',
                'error': error_message,
                'message': f'Upload failed: {error_message}'
            }
    
    def get_upload_statistics(self):
        """Get statistics about uploaded vs pending items"""
        from models import Invoice, Bill
        
        # Count invoices
        total_invoices = Invoice.query.count()
        uploaded_invoices = Invoice.query.filter(Invoice.quickbooks_id.isnot(None)).count()
        failed_invoices = Invoice.query.filter(Invoice.upload_error.isnot(None)).count()
        
        # Count bills
        total_bills = Bill.query.count()
        uploaded_bills = Bill.query.filter(Bill.quickbooks_id.isnot(None)).count()
        failed_bills = Bill.query.filter(Bill.upload_error.isnot(None)).count()
        
        return {
            'invoices': {
                'total': total_invoices,
                'uploaded': uploaded_invoices,
                'pending': total_invoices - uploaded_invoices,
                'failed': failed_invoices
            },
            'bills': {
                'total': total_bills,
                'uploaded': uploaded_bills,
                'pending': total_bills - uploaded_bills,
                'failed': failed_bills
            },
            'overall': {
                'total': total_invoices + total_bills,
                'uploaded': uploaded_invoices + uploaded_bills,
                'pending': (total_invoices - uploaded_invoices) + (total_bills - uploaded_bills),
                'failed': failed_invoices + failed_bills
            }
        }