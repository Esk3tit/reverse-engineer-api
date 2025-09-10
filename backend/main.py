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
from app.models import CurlResponse, ErrorResponse
from app.services.har_parser import HARParser
from app.services.llm_service import LLMService
from app.services.curl_generator import CurlGenerator
from app.exceptions import HARParsingError, LLMServiceError
from app.utils.logging import setup_logging

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
    
    except Exception as e:
        logger.error("Unexpected error", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

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