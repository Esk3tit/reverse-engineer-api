"""
LLM service for analyzing HAR requests and finding the best match
"""
import json
import structlog
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI

from app.config import get_settings
from app.exceptions import LLMServiceError

logger = structlog.get_logger()


class LLMService:
    """Service to interact with LLM for request analysis"""
    
    def __init__(self):
        self.settings = get_settings()
        self.client = AsyncOpenAI(api_key=self.settings.OPENAI_API_KEY)
    
    async def find_best_request(
        self, 
        requests: List[Dict[str, Any]], 
        description: str
    ) -> Optional[Dict[str, Any]]:
        """
        Use LLM to find the best matching request for the given description
        
        Args:
            requests: List of parsed HAR requests
            description: User description of the API to find
            
        Returns:
            The best matching request or None
        """
        try:
            logger.info(f"Analyzing {len(requests)} requests with LLM")
            
            # Prepare requests for analysis (compress to save tokens)
            compressed_requests = [
                self._compress_request_for_analysis(req, i) 
                for i, req in enumerate(requests)
            ]
            
            # Create the analysis prompt
            system_prompt = self._create_system_prompt()
            user_prompt = self._create_user_prompt(compressed_requests, description)
            
            # Call LLM with structured output
            response = await self.client.chat.completions.create(
                model=self.settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=self.settings.OPENAI_TEMPERATURE,
                max_completion_tokens=self.settings.OPENAI_MAX_TOKENS,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "request_analysis",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "selected_index": {
                                    "type": "integer",
                                    "description": "Index of the best matching request (-1 if none match)"
                                },
                                "confidence": {
                                    "type": "number",
                                    "minimum": 0,
                                    "maximum": 1,
                                    "description": "Confidence score for the selection"
                                },
                                "reasoning": {
                                    "type": "string",
                                    "description": "Explanation of why this request was selected"
                                },
                                "alternatives": {
                                    "type": "array",
                                    "items": {"type": "integer"},
                                    "description": "Alternative request indices worth considering"
                                }
                            },
                            "required": ["selected_index", "confidence", "reasoning"]
                        }
                    }
                }
            )
            
            # Parse response
            result = json.loads(response.choices[0].message.content)
            selected_index = result.get("selected_index", -1)
            confidence = result.get("confidence", 0.0)
            reasoning = result.get("reasoning", "No reasoning provided")
            
            logger.info(
                "LLM analysis complete",
                selected_index=selected_index,
                confidence=confidence,
                reasoning=reasoning
            )
            
            # Return the selected request if confidence is high enough
            if selected_index >= 0 and selected_index < len(requests) and confidence > 0.3:
                return requests[selected_index]
            else:
                logger.warning(f"No confident match found. Confidence: {confidence}")
                return None
                
        except Exception as e:
            logger.error(f"LLM analysis failed: {str(e)}")
            raise LLMServiceError(f"Failed to analyze requests: {str(e)}")
    
    def _compress_request_for_analysis(self, request: Dict[str, Any], index: int) -> Dict[str, Any]:
        """Compress request data to minimize token usage"""
        # Only include essential headers
        important_headers = {}
        headers = request.get('headers', {})
        
        important_header_keys = [
            'authorization', 'content-type', 'accept', 'user-agent',
            'x-api-key', 'x-auth-token', 'cookie'
        ]
        
        for key in important_header_keys:
            if key in headers:
                important_headers[key] = headers[key]
        
        # Truncate body if too long
        body = request.get('body', '')
        if body and len(body) > 500:
            body = body[:500] + '...'
        
        # Truncate response body
        response_body = request.get('response_body', '')
        if response_body and len(response_body) > 300:
            response_body = response_body[:300] + '...'
        
        return {
            'index': index,
            'method': request.get('method', 'GET'),
            'url': request.get('url', ''),
            'headers': important_headers,
            'query_params': request.get('query_params', {}),
            'body': body,
            'response_status': request.get('response_status', 0),
            'response_content_type': request.get('response_content_type', ''),
            'response_size': request.get('response_size', 0),
            'response_body_preview': response_body
        }
    
    def _create_system_prompt(self) -> str:
        """Create the system prompt for LLM analysis"""
        return """You are an expert at analyzing HTTP requests from HAR files to identify API endpoints.

Your task is to:
1. Analyze a list of HTTP requests from a HAR file
2. Find the request that best matches the user's description
3. Return the index of the best matching request

Key considerations:
- Focus on requests that return JSON, XML, or other structured data (not HTML)
- Look for requests that match the functional description provided by the user
- Consider the URL path, query parameters, request method, and response content
- Prioritize API endpoints over static assets or page loads
- If multiple requests seem relevant, choose the one most likely to be the primary API call

Return your analysis as JSON with:
- selected_index: The index of the best matching request (-1 if no good match)
- confidence: A score from 0-1 indicating how confident you are in the selection
- reasoning: A brief explanation of why you selected this request
- alternatives: List of other request indices that could be relevant (optional)

Be conservative - only return a high confidence score if you're quite sure the request matches the description."""

    def _create_user_prompt(self, requests: List[Dict[str, Any]], description: str) -> str:
        """Create the user prompt with requests and description"""
        requests_json = json.dumps(requests, indent=2)
        
        return f"""User wants to find this API: "{description}"

Here are the HTTP requests from the HAR file to analyze:

{requests_json}

Please identify which request best matches the user's description and return your analysis as JSON."""