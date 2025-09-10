# HAR Reverse Engineering API Backend

This is the FastAPI backend service for the HAR reverse engineering application. It processes .har files and uses LLM analysis to identify relevant API requests and generate curl commands.

## Features

- **HAR File Processing**: Parse and filter HTTP requests from HAR files
- **Smart Filtering**: Automatically exclude static assets and focus on API endpoints
- **LLM Analysis**: Use GPT-4 to intelligently match user descriptions to requests
- **Curl Generation**: Generate clean, executable curl commands with security considerations
- **Token Optimization**: Efficient LLM usage through request compression and filtering

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Setup

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
OPENAI_API_KEY=your_actual_api_key_here
```

### 3. Run the Development Server

```bash
# Start the FastAPI development server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### 4. API Documentation

Once running, you can access:
- **Interactive API docs**: http://localhost:8000/docs
- **ReDoc documentation**: http://localhost:8000/redoc
- **Health check**: http://localhost:8000/health

## API Endpoints

### POST `/api/reverse-engineer`

Main endpoint for processing HAR files.

**Request:**
- `har_file`: Uploaded .har file (multipart/form-data)
- `description`: Text description of the API to find

**Response:**
```json
{
  "curl_command": "curl -X GET 'https://api.example.com/weather?city=SF'",
  "request_url": "https://api.example.com/weather?city=SF",
  "request_method": "GET",
  "description": "weather API for San Francisco",
  "metadata": {
    "total_requests_analyzed": 25,
    "selected_request_status": 200,
    "content_type": "application/json"
  }
}
```

## Architecture

```
app/
├── services/
│   ├── har_parser.py      # HAR file parsing and filtering
│   ├── llm_service.py     # LLM integration and analysis
│   └── curl_generator.py  # Curl command generation
├── models.py              # Pydantic data models
├── config.py              # Configuration management
├── exceptions.py          # Custom exceptions
└── utils/
    └── logging.py         # Structured logging setup
```

## Configuration

Key configuration options in `.env`:

```bash
# LLM Settings
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-2024-08-06
OPENAI_MAX_TOKENS=4096

# Processing Limits
MAX_FILE_SIZE=52428800           # 50MB max file size
MAX_REQUESTS_TO_ANALYZE=50       # Limit for token efficiency

# CORS
CORS_ORIGINS=["http://localhost:3000"]
```

## Docker Deployment

### Build and Run

```bash
# Build the image
docker build -t har-api .

# Run the container
docker run -p 8000:8000 --env-file .env har-api
```

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest
```

### Code Quality

```bash
# Format code
black .

# Lint code
ruff check .
```

### Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit

# Setup hooks
pre-commit install

# Run hooks manually
pre-commit run --all-files
```

## How It Works

1. **File Upload**: User uploads a .har file through the frontend
2. **HAR Parsing**: Backend extracts and filters HTTP requests, excluding static assets
3. **Smart Filtering**: Prioritizes API-like requests based on:
   - Response content type (JSON, XML preferred)
   - HTTP status codes (2xx responses)
   - URL patterns (contains 'api', 'v1', etc.)
   - Request methods (POST/PUT/PATCH get higher priority)
4. **LLM Analysis**: Compressed request data sent to GPT-4 with user description
5. **Curl Generation**: Selected request converted to executable curl command with:
   - Proper header formatting
   - Security masking for sensitive data
   - JSON formatting for request bodies
6. **Response**: Returns formatted curl command with metadata

## Security Considerations

- **Sensitive Data Masking**: Authentication headers are automatically masked in curl output
- **Input Validation**: File size limits and content validation
- **Error Handling**: Detailed logging without exposing sensitive information
- **CORS Configuration**: Restricted to configured frontend origins

## Performance Optimization

- **Request Filtering**: Pre-filters requests before LLM analysis
- **Token Compression**: Minimizes token usage through smart data compression
- **Response Caching**: Request deduplication and prioritization
- **Async Processing**: Non-blocking file processing and LLM calls

## Troubleshooting

### Common Issues

1. **OpenAI API Key Issues**
   ```bash
   # Verify your API key is set
   echo $OPENAI_API_KEY
   ```

2. **Large HAR Files**
   - Files over 50MB are rejected
   - Use browser dev tools to export smaller, targeted HAR files

3. **No Matching Requests Found**
   - Check that HAR file contains API requests (not just page loads)
   - Try more specific descriptions
   - Verify requests return JSON/XML content

### Logs and Debugging

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# View structured logs
tail -f app.log | jq .
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License.