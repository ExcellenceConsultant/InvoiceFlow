"""
QuickBooks API Integration Module

Handles API calls to QuickBooks Online for creating invoices and bills.
"""

import os
import requests
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class QuickBooksAPI:
    """QuickBooks Online API integration"""
    
    def __init__(self):
        # QuickBooks API configuration
        self.base_url = os.getenv('QUICKBOOKS_BASE_URL', 'https://sandbox-quickbooks.api.intuit.com')
        self.api_version = 'v3'
        
        # Request timeout
        self.timeout = 30
    
    def _make_request(self, method, endpoint, access_token, company_id, data=None):
        """Make authenticated request to QuickBooks API"""
        try:
            url = f"{self.base_url}/{self.api_version}/company/{company_id}/{endpoint}"
            
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
            
            logger.info(f"Making {method} request to: {url}")
            
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=self.timeout)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=self.timeout)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, json=data, timeout=self.timeout)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            # Log response details
            logger.info(f"Response status: {response.status_code}")
            if response.status_code != 200:
                logger.error(f"Response content: {response.text}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.Timeout:
            logger.error(f"Request timeout for {endpoint}")
            raise Exception(f"Request timeout: {endpoint}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error for {endpoint}: {str(e)}")
            raise Exception(f"API request failed: {str(e)}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error for {endpoint}: {str(e)}")
            raise Exception(f"Invalid JSON response: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error for {endpoint}: {str(e)}")
            raise Exception(f"API error: {str(e)}")
    
    def create_invoice(self, invoice_data, access_token, company_id):
        """Create an invoice in QuickBooks"""
        try:
            logger.info(f"Creating invoice: {invoice_data.get('DocNumber', 'No doc number')}")
            
            # Ensure customer exists or create one
            customer_name = invoice_data.get('CustomerRef', {}).get('name')
            if customer_name:
                customer = self._get_or_create_customer(customer_name, access_token, company_id)
                invoice_data['CustomerRef'] = {'value': customer['Id']}
            
            response = self._make_request(
                'POST',
                'invoice',
                access_token,
                company_id,
                invoice_data
            )
            
            if 'QueryResponse' in response and 'Invoice' in response['QueryResponse']:
                created_invoice = response['QueryResponse']['Invoice'][0]
            elif 'Invoice' in response:
                created_invoice = response['Invoice']
            else:
                raise Exception("Unexpected response format from QuickBooks")
            
            logger.info(f"Successfully created invoice with ID: {created_invoice.get('Id')}")
            return created_invoice
            
        except Exception as e:
            logger.error(f"Failed to create invoice: {str(e)}")
            raise Exception(f"Invoice creation failed: {str(e)}")
    
    def create_bill(self, bill_data, access_token, company_id):
        """Create a bill in QuickBooks"""
        try:
            logger.info(f"Creating bill: {bill_data.get('DocNumber', 'No doc number')}")
            
            # Ensure vendor exists or create one
            vendor_name = bill_data.get('VendorRef', {}).get('name')
            if vendor_name:
                vendor = self._get_or_create_vendor(vendor_name, access_token, company_id)
                bill_data['VendorRef'] = {'value': vendor['Id']}
            
            # Ensure account exists for expense
            for line in bill_data.get('Line', []):
                if 'AccountBasedExpenseLineDetail' in line:
                    account_name = line['AccountBasedExpenseLineDetail']['AccountRef']['name']
                    account = self._get_or_create_account(account_name, access_token, company_id)
                    line['AccountBasedExpenseLineDetail']['AccountRef'] = {'value': account['Id']}
            
            response = self._make_request(
                'POST',
                'bill',
                access_token,
                company_id,
                bill_data
            )
            
            if 'QueryResponse' in response and 'Bill' in response['QueryResponse']:
                created_bill = response['QueryResponse']['Bill'][0]
            elif 'Bill' in response:
                created_bill = response['Bill']
            else:
                raise Exception("Unexpected response format from QuickBooks")
            
            logger.info(f"Successfully created bill with ID: {created_bill.get('Id')}")
            return created_bill
            
        except Exception as e:
            logger.error(f"Failed to create bill: {str(e)}")
            raise Exception(f"Bill creation failed: {str(e)}")
    
    def _get_or_create_customer(self, customer_name, access_token, company_id):
        """Get existing customer or create new one"""
        try:
            # Try to find existing customer
            response = self._make_request(
                'GET',
                f"query?query=SELECT * FROM Customer WHERE Name = '{customer_name}'",
                access_token,
                company_id
            )
            
            customers = response.get('QueryResponse', {}).get('Customer', [])
            if customers:
                return customers[0]
            
            # Create new customer
            customer_data = {
                'Name': customer_name,
                'CompanyName': customer_name
            }
            
            response = self._make_request(
                'POST',
                'customer',
                access_token,
                company_id,
                customer_data
            )
            
            return response['Customer']
            
        except Exception as e:
            logger.error(f"Failed to get/create customer {customer_name}: {str(e)}")
            raise Exception(f"Customer operation failed: {str(e)}")
    
    def _get_or_create_vendor(self, vendor_name, access_token, company_id):
        """Get existing vendor or create new one"""
        try:
            # Try to find existing vendor
            response = self._make_request(
                'GET',
                f"query?query=SELECT * FROM Vendor WHERE Name = '{vendor_name}'",
                access_token,
                company_id
            )
            
            vendors = response.get('QueryResponse', {}).get('Vendor', [])
            if vendors:
                return vendors[0]
            
            # Create new vendor
            vendor_data = {
                'Name': vendor_name,
                'CompanyName': vendor_name
            }
            
            response = self._make_request(
                'POST',
                'vendor',
                access_token,
                company_id,
                vendor_data
            )
            
            return response['Vendor']
            
        except Exception as e:
            logger.error(f"Failed to get/create vendor {vendor_name}: {str(e)}")
            raise Exception(f"Vendor operation failed: {str(e)}")
    
    def _get_or_create_account(self, account_name, access_token, company_id):
        """Get existing account or create new expense account"""
        try:
            # Try to find existing account
            response = self._make_request(
                'GET',
                f"query?query=SELECT * FROM Account WHERE Name = '{account_name}'",
                access_token,
                company_id
            )
            
            accounts = response.get('QueryResponse', {}).get('Account', [])
            if accounts:
                return accounts[0]
            
            # Create new expense account
            account_data = {
                'Name': account_name,
                'AccountType': 'Expense',
                'AccountSubType': 'OtherMiscellaneousServiceCost'
            }
            
            response = self._make_request(
                'POST',
                'account',
                access_token,
                company_id,
                account_data
            )
            
            return response['Account']
            
        except Exception as e:
            logger.error(f"Failed to get/create account {account_name}: {str(e)}")
            raise Exception(f"Account operation failed: {str(e)}")
    
    def get_company_info(self, access_token, company_id):
        """Get company information to validate connection"""
        try:
            response = self._make_request(
                'GET',
                f'companyinfo/{company_id}',
                access_token,
                company_id
            )
            
            return response.get('QueryResponse', {}).get('CompanyInfo', [{}])[0]
            
        except Exception as e:
            logger.error(f"Failed to get company info: {str(e)}")
            raise Exception(f"Company info retrieval failed: {str(e)}")