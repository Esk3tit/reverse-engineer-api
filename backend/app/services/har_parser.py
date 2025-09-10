"""
HAR file parsing service
"""
import json
import structlog
from typing import List, Dict, Any, Optional
from urllib.parse import parse_qs, urlparse

from app.config import get_settings
from app.models import HARRequest
from app.exceptions import HARParsingError

logger = structlog.get_logger()


class HARParser:
    """Service to parse HAR files and extract relevant API requests"""
    
    def __init__(self):
        self.settings = get_settings()
    
    async def parse_har_file(self, har_content: bytes) -> List[Dict[str, Any]]:
        """
        Parse HAR file and extract API requests
        
        Args:
            har_content: Raw HAR file content
            
        Returns:
            List of parsed and filtered requests
        """
        try:
            # Parse JSON
            har_data = json.loads(har_content.decode('utf-8'))
            
            # Validate HAR structure
            if not self._validate_har_structure(har_data):
                raise HARParsingError("Invalid HAR file structure")
            
            # Extract entries
            entries = har_data.get('log', {}).get('entries', [])
            logger.info(f"Found {len(entries)} total requests in HAR file")
            
            # Filter and parse requests
            parsed_requests = []
            for i, entry in enumerate(entries):
                try:
                    parsed_request = self._parse_entry(entry, i)
                    if parsed_request and self._should_include_request(parsed_request):
                        parsed_requests.append(parsed_request)
                except Exception as e:
                    logger.warning(f"Failed to parse entry {i}", error=str(e))
                    continue
            
            logger.info(f"Parsed {len(parsed_requests)} API requests after filtering")
            
            # Limit the number of requests for token efficiency
            if len(parsed_requests) > self.settings.MAX_REQUESTS_TO_ANALYZE:
                logger.info(f"Limiting to {self.settings.MAX_REQUESTS_TO_ANALYZE} requests")
                parsed_requests = self._prioritize_requests(parsed_requests)
            
            return parsed_requests
            
        except json.JSONDecodeError as e:
            raise HARParsingError(f"Invalid JSON format: {str(e)}")
        except Exception as e:
            raise HARParsingError(f"Failed to parse HAR file: {str(e)}")
    
    def _validate_har_structure(self, har_data: Dict[str, Any]) -> bool:
        """Validate basic HAR file structure"""
        return (
            isinstance(har_data, dict) and
            'log' in har_data and
            isinstance(har_data['log'], dict) and
            'entries' in har_data['log'] and
            isinstance(har_data['log']['entries'], list)
        )
    
    def _parse_entry(self, entry: Dict[str, Any], index: int) -> Optional[Dict[str, Any]]:
        """Parse a single HAR entry into our internal format"""
        try:
            request = entry.get('request', {})
            response = entry.get('response', {})
            
            # Extract basic request info
            method = request.get('method', 'GET')
            url = request.get('url', '')
            
            if not url:
                return None
            
            # Parse headers
            headers = {}
            for header in request.get('headers', []):
                name = header.get('name', '')
                value = header.get('value', '')
                if name and value:
                    headers[name.lower()] = value
            
            # Parse query parameters
            query_params = {}
            parsed_url = urlparse(url)
            if parsed_url.query:
                query_params = {k: v[0] if v else '' for k, v in parse_qs(parsed_url.query).items()}
            
            # Extract body
            post_data = request.get('postData', {})
            body = post_data.get('text', '') if post_data else ''
            body_size = len(body) if body else 0
            
            # Extract response info
            response_status = response.get('status', 0)
            response_content = response.get('content', {})
            response_content_type = response_content.get('mimeType', '')
            response_size = response_content.get('size', 0)
            
            # Get response body (limited for token efficiency)
            response_body = response_content.get('text', '')
            if len(response_body) > 1000:  # Truncate large responses
                response_body = response_body[:1000] + '...'
            
            return {
                'index': index,
                'method': method,
                'url': url,
                'headers': headers,
                'query_params': query_params,
                'body': body,
                'body_size': body_size,
                'response_status': response_status,
                'response_content_type': response_content_type,
                'response_size': response_size,
                'response_body': response_body
            }
            
        except Exception as e:
            logger.warning(f"Failed to parse entry {index}", error=str(e))
            return None
    
    def _should_include_request(self, request: Dict[str, Any]) -> bool:
        """Determine if a request should be included based on filtering criteria"""
        # Check response status
        status = request.get('response_status', 0)
        if status not in self.settings.INCLUDE_STATUS_CODES:
            return False
        
        # Check content type
        content_type = request.get('response_content_type', '').lower()
        
        # Exclude static assets and HTML
        for excluded_type in self.settings.EXCLUDE_MIME_TYPES:
            if content_type.startswith(excluded_type.lower()):
                return False
        
        # Include requests with JSON or XML content types
        api_content_types = ['application/json', 'application/xml', 'text/xml', 'text/plain']
        if any(content_type.startswith(ct) for ct in api_content_types):
            return True
        
        # Include requests with empty content type but successful status
        if not content_type and 200 <= status < 300:
            return True
        
        # Include requests with query parameters (likely API calls)
        if request.get('query_params'):
            return True
        
        # Include POST/PUT/PATCH requests with body content
        if request.get('method') in ['POST', 'PUT', 'PATCH'] and request.get('body'):
            return True
        
        return False
    
    def _prioritize_requests(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Prioritize requests when we have too many"""
        # Sort by priority criteria
        def priority_score(req):
            score = 0
            
            # Prefer JSON responses
            if 'json' in req.get('response_content_type', '').lower():
                score += 10
            
            # Prefer successful requests
            if 200 <= req.get('response_status', 0) < 300:
                score += 5
            
            # Prefer requests with meaningful response size
            response_size = req.get('response_size', 0)
            if 100 < response_size < 10000:  # Not too small, not too large
                score += 3
            
            # Prefer API-like URLs (contain 'api', 'v1', etc.)
            url = req.get('url', '').lower()
            if any(keyword in url for keyword in ['api', 'v1', 'v2', 'rest', 'graphql']):
                score += 8
            
            # Prefer non-GET requests (more likely to be API calls)
            if req.get('method', 'GET') != 'GET':
                score += 2
            
            return score
        
        # Sort by priority and take the top requests
        sorted_requests = sorted(requests, key=priority_score, reverse=True)
        return sorted_requests[:self.settings.MAX_REQUESTS_TO_ANALYZE]