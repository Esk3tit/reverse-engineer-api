"""
FastAPI backend for HAR file reverse engineering
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog
import uvicorn
from typing import Dict, Any

from app.config import get_settings
from app.models import CurlResponse, ErrorResponse, ExecuteCurlRequest, ExecuteCurlResponse
from app.services.har_parser import HARParser
from app.services.llm_service import LLMService
from app.services.curl_generator import CurlGenerator
from app.exceptions import HARParsingError, LLMServiceError
from app.utils.logging import setup_logging

import subprocess
import json
import re
import time

# Setup logging
logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    setup_logging()
    logger.info("Starting HAR Reverse Engineering API")
    
    # Initialize services
    app.state.har_parser = HARParser()
    app.state.llm_service = LLMService()
    app.state.curl_generator = CurlGenerator()
    
    yield
    
    # Shutdown
    logger.info("Shutting down HAR Reverse Engineering API")

# Create FastAPI app
settings = get_settings()
app = FastAPI(
    title="HAR Reverse Engineering API",
    description="Extract curl commands from HAR files using LLM analysis",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "HAR Reverse Engineering API", "status": "healthy"}

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "services": {
            "har_parser": "ready",
            "llm_service": "ready",
            "curl_generator": "ready"
        }
    }

@app.post("/api/reverse-engineer", response_model=CurlResponse)
async def reverse_engineer_api(
    har_file: UploadFile = File(...),
    description: str = Form(...)
):
    """
    Main endpoint to reverse engineer API requests from HAR file
    
    Args:
        har_file: Uploaded .har file
        description: User description of the API to find
        
    Returns:
        CurlResponse with the generated curl command and metadata
    """
    try:
        # Validate file type
        if not har_file.filename.endswith('.har'):
            raise HTTPException(
                status_code=400,
                detail="File must be a .har file"
            )
        
        # Read and parse HAR file
        logger.info("Processing HAR file", filename=har_file.filename)
        har_content = await har_file.read()
        
        # Parse HAR file
        har_parser = app.state.har_parser
        parsed_requests = await har_parser.parse_har_file(har_content)
        
        if not parsed_requests:
            raise HTTPException(
                status_code=400,
                detail="No valid API requests found in HAR file"
            )
        
        logger.info(
            "Parsed HAR file", 
            total_requests=len(parsed_requests),
            description_length=len(description)
        )
        
        # Use LLM to find the best matching request
        llm_service = app.state.llm_service
        best_request = await llm_service.find_best_request(
            requests=parsed_requests,
            description=description
        )
        
        if not best_request:
            raise HTTPException(
                status_code=404,
                detail="No matching API request found for the given description"
            )
        
        # Generate curl command
        curl_generator = app.state.curl_generator
        curl_command = await curl_generator.generate_curl(best_request)
        
        logger.info("Successfully generated curl command")
        
        return CurlResponse(
            curl_command=curl_command,
            request_url=best_request.get("url", ""),
            request_method=best_request.get("method", "GET"),
            description=description,
            metadata={
                "total_requests_analyzed": len(parsed_requests),
                "selected_request_status": best_request.get("response_status"),
                "content_type": best_request.get("response_content_type")
            }
        )
        
    except HARParsingError as e:
        logger.error("HAR parsing failed", error=str(e))
        raise HTTPException(status_code=400, detail=f"Invalid HAR file: {str(e)}")
    
    except LLMServiceError as e:
        logger.error("LLM service failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    except HTTPException as e:
        # Preserve intended HTTP status (e.g., 404 when no match is found)
        logger.error("Request failed", status_code=e.status_code, detail=str(e.detail))
        raise e
    
    except Exception as e:
        logger.error("Unexpected error", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/execute-curl", response_model=ExecuteCurlResponse)
async def execute_curl_command(request: ExecuteCurlRequest):
    """
    Execute a curl command and return the response
    
    Args:
        request: Contains the curl command to execute
        
    Returns:
        ExecuteCurlResponse with the API response details
    """
    try:
        logger.info("Executing curl command")
        
        # Security: Parse and validate the curl command
        if not request.curl_command.strip().startswith('curl'):
            raise HTTPException(
                status_code=400,
                detail="Invalid command: must be a curl command"
            )
        
        # Add timeout and response headers to curl command
        enhanced_command = enhance_curl_command(request.curl_command)
        
        start_time = time.time()
        
        # Execute curl command with security limits
        result = subprocess.run(
            enhanced_command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,  # 30 second timeout
            env={'PATH': '/usr/bin:/bin'}  # Restricted PATH for security
        )
        
        execution_time = int((time.time() - start_time) * 1000)  # Convert to milliseconds
        
        if result.returncode == 0:
            # Parse successful response
            response_data = parse_curl_response(result.stdout)
            
            return ExecuteCurlResponse(
                success=True,
                status_code=response_data.get('status_code', 200),
                headers=response_data.get('headers', {}),
                body=response_data.get('body', ''),
                execution_time=execution_time
            )
        else:
            # Handle curl errors
            error_message = result.stderr.strip() if result.stderr else 'Unknown curl error'
            
            return ExecuteCurlResponse(
                success=False,
                status_code=0,
                headers={},
                body='',
                execution_time=execution_time,
                error=error_message
            )
            
    except subprocess.TimeoutExpired:
        logger.error("Curl command timed out")
        return ExecuteCurlResponse(
            success=False,
            status_code=0,
            headers={},
            body='',
            execution_time=30000,
            error="Request timed out after 30 seconds"
        )
    
    except Exception as e:
        logger.error(f"Failed to execute curl command: {str(e)}")
        return ExecuteCurlResponse(
            success=False,
            status_code=0,
            headers={},
            body='',
            execution_time=0,
            error=f"Execution failed: {str(e)}"
        )

def enhance_curl_command(curl_command: str) -> str:
    """
    Enhance curl command with additional flags for better response parsing
    """
    # Add flags to get response headers and status code
    enhanced = curl_command.strip()
    
    # Add response headers flag if not present
    if '-i' not in enhanced and '--include' not in enhanced:
        enhanced = enhanced.replace('curl ', 'curl -i ', 1)
    
    # Add status code flag if not present  
    if '-w' not in enhanced and '--write-out' not in enhanced:
        enhanced += ' -w "\\n---CURL_STATUS_CODE:%{http_code}---\\n"'
    
    # Add timeout if not present
    if '--max-time' not in enhanced and '-m' not in enhanced:
        enhanced += ' --max-time 30'
    
    # Add connection timeout
    if '--connect-timeout' not in enhanced:
        enhanced += ' --connect-timeout 10'
    
    # Follow redirects by default
    if '-L' not in enhanced and '--location' not in enhanced:
        enhanced += ' -L'
    
    # Disable certificate verification for testing (optional - remove in production)
    if '-k' not in enhanced and '--insecure' not in enhanced:
        enhanced += ' -k'
    
    return enhanced

def parse_curl_response(curl_output: str) -> Dict[str, Any]:
    """
    Parse curl response to extract status code, headers, and body
    """
    try:
        # Extract status code
        status_match = re.search(r'---CURL_STATUS_CODE:(\d+)---', curl_output)
        status_code = int(status_match.group(1)) if status_match else 200
        
        # Remove status code marker
        clean_output = re.sub(r'---CURL_STATUS_CODE:\d+---\s*', '', curl_output)
        
        # Split headers and body
        parts = clean_output.split('\r\n\r\n', 1)
        if len(parts) < 2:
            parts = clean_output.split('\n\n', 1)
        
        if len(parts) >= 2:
            headers_section = parts[0]
            body = parts[1].strip()
        else:
            headers_section = ''
            body = clean_output.strip()
        
        # Parse headers
        headers = {}
        if headers_section:
            header_lines = headers_section.split('\n')[1:]  # Skip status line
            for line in header_lines:
                if ':' in line:
                    key, value = line.split(':', 1)
                    headers[key.strip().lower()] = value.strip()
        
        return {
            'status_code': status_code,
            'headers': headers,
            'body': body
        }
        
    except Exception as e:
        logger.warning(f"Failed to parse curl response: {str(e)}")
        return {
            'status_code': 200,
            'headers': {},
            'body': curl_output
        }

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail,
            status_code=exc.status_code
        ).dict()
    )

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )