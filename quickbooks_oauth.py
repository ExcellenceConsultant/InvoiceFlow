"""
QuickBooks OAuth2 Authentication Module

Handles OAuth2 flow for QuickBooks Online API integration.
"""

import os
import requests
from requests_oauthlib import OAuth2Session
from urllib.parse import urlencode
import logging

logger = logging.getLogger(__name__)

class QuickBooksOAuth:
    """QuickBooks OAuth2 authentication handler"""
    
    def __init__(self, app=None):
        self.app = app
        
        # QuickBooks OAuth2 endpoints
        self.discovery_url = "https://appcenter.intuit.com/connect/oauth2"
        self.authorization_base_url = "https://appcenter.intuit.com/connect/oauth2"
        self.token_url = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
        
        # OAuth2 configuration
        self.client_id = os.getenv('QUICKBOOKS_CLIENT_ID')
        self.client_secret = os.getenv('QUICKBOOKS_CLIENT_SECRET')
        self.redirect_uri = os.getenv('QUICKBOOKS_REDIRECT_URI', 'http://localhost:5000/auth/callback')
        self.scope = 'com.intuit.quickbooks.accounting'
        
        if not self.client_id or not self.client_secret:
            logger.warning("QuickBooks OAuth credentials not configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET environment variables.")
    
    def get_authorization_url(self):
        """Generate QuickBooks authorization URL"""
        try:
            # Create OAuth2 session
            oauth = OAuth2Session(
                self.client_id,
                scope=self.scope,
                redirect_uri=self.redirect_uri
            )
            
            # Generate authorization URL
            authorization_url, state = oauth.authorization_url(self.authorization_base_url)
            
            logger.info(f"Generated authorization URL: {authorization_url}")
            return authorization_url
            
        except Exception as e:
            logger.error(f"Failed to generate authorization URL: {str(e)}")
            raise Exception(f"OAuth URL generation failed: {str(e)}")
    
    def get_access_token(self, authorization_code, company_id=None):
        """Exchange authorization code for access token"""
        try:
            # Prepare token request
            token_data = {
                'grant_type': 'authorization_code',
                'code': authorization_code,
                'redirect_uri': self.redirect_uri
            }
            
            # Make token request
            response = requests.post(
                self.token_url,
                data=token_data,
                auth=(self.client_id, self.client_secret),
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            )
            
            response.raise_for_status()
            token_data = response.json()
            
            # Extract tokens
            access_token = token_data.get('access_token')
            refresh_token = token_data.get('refresh_token')
            expires_in = token_data.get('expires_in', 3600)
            
            if not access_token:
                raise Exception("Access token not received from QuickBooks")
            
            # Get company ID from realmId parameter (passed in callback)
            if not company_id:
                raise Exception("Company ID (realmId) not provided")
            
            logger.info(f"Successfully obtained access token for company: {company_id}")
            
            return {
                'access_token': access_token,
                'refresh_token': refresh_token,
                'company_id': company_id,
                'expires_in': expires_in,
                'token_type': token_data.get('token_type', 'Bearer')
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP error during token exchange: {str(e)}")
            raise Exception(f"Token exchange failed: {str(e)}")
        except Exception as e:
            logger.error(f"Token exchange error: {str(e)}")
            raise Exception(f"Token exchange failed: {str(e)}")
    
    def refresh_access_token(self, refresh_token):
        """Refresh expired access token"""
        try:
            token_data = {
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token
            }
            
            response = requests.post(
                self.token_url,
                data=token_data,
                auth=(self.client_id, self.client_secret),
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            )
            
            response.raise_for_status()
            token_data = response.json()
            
            access_token = token_data.get('access_token')
            new_refresh_token = token_data.get('refresh_token', refresh_token)
            expires_in = token_data.get('expires_in', 3600)
            
            if not access_token:
                raise Exception("New access token not received")
            
            logger.info("Successfully refreshed access token")
            
            return {
                'access_token': access_token,
                'refresh_token': new_refresh_token,
                'expires_in': expires_in,
                'token_type': token_data.get('token_type', 'Bearer')
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP error during token refresh: {str(e)}")
            raise Exception(f"Token refresh failed: {str(e)}")
        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")
            raise Exception(f"Token refresh failed: {str(e)}")
    
    def validate_token(self, access_token, company_id):
        """Validate if access token is still valid"""
        try:
            # Make a simple API call to check token validity
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/json'
            }
            
            # Test with company info endpoint
            response = requests.get(
                f'https://sandbox-quickbooks.api.intuit.com/v3/company/{company_id}/companyinfo/{company_id}',
                headers=headers,
                timeout=10
            )
            
            return response.status_code == 200
            
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return False