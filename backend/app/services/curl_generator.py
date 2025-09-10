"""
Service to generate curl commands from HTTP requests
"""
import json
import structlog
from typing import Dict, Any, List
from urllib.parse import quote

from app.exceptions import CurlGenerationError

logger = structlog.get_logger()


class CurlGenerator:
    """Service to generate curl commands from parsed HTTP requests"""
    
    def __init__(self):
        self.sensitive_headers = {
            'cookie', 'authorization', 'x-api-key', 'x-auth-token', 
            'x-access-token', 'bearer', 'api-key'
        }
    
    async def generate_curl(self, request: Dict[str, Any]) -> str:
        """
        Generate a curl command from a parsed request
        
        Args:
            request: Parsed request data
            
        Returns:
            Formatted curl command string
        """
        try:
            logger.info("Generating curl command", url=request.get('url'))
            
            curl_parts = ['curl']
            
            # Add method
            method = request.get('method', 'GET')
            if method != 'GET':
                curl_parts.append(f'-X {method}')
            
            # Add headers
            headers = request.get('headers', {})
            for name, value in headers.items():
                # Clean and format header
                clean_name = name.strip()
                clean_value = value.strip()
                
                if clean_name and clean_value:
                    # Mask sensitive headers for security
                    if self._is_sensitive_header(clean_name):
                        clean_value = self._mask_sensitive_value(clean_value)
                    
                    # Escape quotes in header values
                    escaped_value = clean_value.replace('"', '\\"')
                    curl_parts.append(f'-H "{clean_name}: {escaped_value}"')
            
            # Add body data if present
            body = request.get('body')
            if body and method in ['POST', 'PUT', 'PATCH']:
                # Try to format as JSON if it looks like JSON
                if self._is_json_body(body):
                    try:
                        # Pretty format JSON
                        formatted_json = json.dumps(json.loads(body), indent=2)
                        escaped_body = formatted_json.replace("'", "'\"'\"'")
                        curl_parts.append(f"--data '{escaped_body}'")
                    except json.JSONDecodeError:
                        # Fallback to raw body
                        escaped_body = body.replace("'", "'\"'\"'")
                        curl_parts.append(f"--data '{escaped_body}'")
                else:
                    # Handle form data or other content types
                    escaped_body = body.replace("'", "'\"'\"'")
                    curl_parts.append(f"--data '{escaped_body}'")
            
            # Add URL (always last)
            url = request.get('url', '')
            if not url:
                raise CurlGenerationError("Request URL is missing")
            
            # Escape URL if needed
            curl_parts.append(f"'{url}'")
            
            # Join all parts with line continuation for readability
            curl_command = ' \\\n  '.join(curl_parts)
            
            logger.info("Successfully generated curl command")
            return curl_command
            
        except Exception as e:
            logger.error(f"Failed to generate curl command: {str(e)}")
            raise CurlGenerationError(f"Could not generate curl command: {str(e)}")
    
    def _is_sensitive_header(self, header_name: str) -> bool:
        """Check if a header contains sensitive information"""
        header_lower = header_name.lower()
        return any(sensitive in header_lower for sensitive in self.sensitive_headers)
    
    def _mask_sensitive_value(self, value: str) -> str:
        """Mask sensitive header values for security"""
        if len(value) <= 8:
            return "***MASKED***"
        
        # Show first 4 and last 4 characters, mask the middle
        return f"{value[:4]}...{value[-4:]}"
    
    def _is_json_body(self, body: str) -> bool:
        """Check if body content appears to be JSON"""
        if not body:
            return False
        
        body = body.strip()
        return (body.startswith('{') and body.endswith('}')) or \
               (body.startswith('[') and body.endswith(']'))
    
    def generate_curl_with_comments(self, request: Dict[str, Any]) -> str:
        """
        Generate a curl command with helpful comments
        
        Args:
            request: Parsed request data
            
        Returns:
            Commented curl command string
        """
        try:
            base_curl = self.generate_curl(request)
            
            comments = []
            comments.append("# Generated curl command")
            comments.append(f"# Method: {request.get('method', 'GET')}")
            comments.append(f"# URL: {request.get('url', '')}")
            
            # Add response info if available
            if request.get('response_status'):
                comments.append(f"# Expected response status: {request.get('response_status')}")
            
            if request.get('response_content_type'):
                comments.append(f"# Response content type: {request.get('response_content_type')}")
            
            # Add security warning if sensitive headers detected
            headers = request.get('headers', {})
            has_sensitive = any(self._is_sensitive_header(name) for name in headers.keys())
            if has_sensitive:
                comments.append("#")
                comments.append("# WARNING: This request contains authentication headers.")
                comments.append("# The sensitive values have been masked for security.")
                comments.append("# You'll need to replace the masked values with actual credentials.")
            
            # Add parameter explanation
            query_params = request.get('query_params', {})
            if query_params:
                comments.append("#")
                comments.append("# Query parameters in this request:")
                for param, value in query_params.items():
                    comments.append(f"#   {param}: {value}")
            
            comments.append("#")
            
            return '\n'.join(comments) + '\n' + base_curl
            
        except Exception as e:
            # Fallback to basic curl if comment generation fails
            logger.warning(f"Failed to generate commented curl: {str(e)}")
            return self.generate_curl(request)