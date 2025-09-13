"""
Pydantic models for request/response schemas
"""
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional


class HARRequest(BaseModel):
    """Parsed HAR request representation"""
    method: str
    url: str
    headers: Dict[str, str]
    query_params: Dict[str, str] = Field(default_factory=dict)
    body: Optional[str] = None
    body_size: int = 0
    response_status: int
    response_content_type: str = ""
    response_size: int = 0
    response_body: Optional[str] = None


class CurlResponse(BaseModel):
    """Response model for curl command generation"""
    curl_command: str = Field(description="Generated curl command")
    request_url: str = Field(description="The URL of the selected request")
    request_method: str = Field(description="HTTP method of the request")
    description: str = Field(description="User's original description")
    metadata: Dict[str, Any] = Field(
        description="Additional information about the analysis",
        default_factory=dict
    )


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str = Field(description="Error message")
    status_code: int = Field(description="HTTP status code")
    details: Optional[Dict[str, Any]] = Field(
        description="Additional error details",
        default=None
    )


class LLMAnalysisRequest(BaseModel):
    """Request model for LLM analysis"""
    requests: List[Dict[str, Any]]
    description: str
    max_candidates: int = 5


class LLMAnalysisResponse(BaseModel):
    """Response from LLM analysis"""
    selected_request_index: int = Field(description="Index of the best matching request")
    confidence: float = Field(description="Confidence score (0-1)")
    reasoning: str = Field(description="Why this request was selected")
    alternative_indices: List[int] = Field(
        description="Alternative request indices",
        default_factory=list
    )

class ExecuteCurlRequest(BaseModel):
    """Request model for executing curl commands"""
    curl_command: str = Field(description="The curl command to execute")


class ExecuteCurlResponse(BaseModel):
    """Response model for curl command execution"""
    success: bool = Field(description="Whether the execution was successful")
    status_code: int = Field(description="HTTP status code of the response")
    headers: Dict[str, str] = Field(description="Response headers", default_factory=dict)
    body: str = Field(description="Response body content")
    execution_time: int = Field(description="Execution time in milliseconds")
    error: Optional[str] = Field(description="Error message if execution failed", default=None)