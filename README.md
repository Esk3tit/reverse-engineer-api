# HAR Reverse Engineering Tool

A powerful web application that extracts curl commands from HAR (HTTP Archive) files using AI-powered analysis. Simply upload a HAR file, describe the API you're looking for, and get a ready-to-use curl command.

![HAR Reverse Engineering Tool](https://via.placeholder.com/800x400/6366f1/ffffff?text=HAR+Reverse+Engineering+Tool)

## 🚀 Features

- **Smart HAR Processing**: Automatically filters and analyzes HTTP requests
- **AI-Powered Matching**: Uses GPT-4 to intelligently match API descriptions to requests
- **Clean Curl Generation**: Produces executable curl commands with proper formatting
- **Security Conscious**: Automatically masks sensitive authentication data
- **Real-time Progress**: Live progress updates during processing
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS
- **Drag & Drop**: Easy file upload with drag-and-drop support

## 🏗️ Architecture

```
HAR Reverse Engineering Tool/
├── frontend/           # Next.js + TypeScript + Tailwind CSS
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
├── backend/            # FastAPI + Python
│   ├── app/
│   │   ├── services/
│   │   ├── models.py
│   │   └── config.py
│   └── main.py
├── docker-compose.yml  # Full stack deployment
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **State Management**: React Hooks
- **Notifications**: Sonner

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.13+
- **AI Integration**: OpenAI
- **File Processing**: JSON parsing with smart filtering
- **Logging**: Structured logging with structlog

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- OpenAI API key

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd har-reverse-engineering-tool
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env and add your OpenAI API key:
# OPENAI_API_KEY=your_actual_api_key_here

# Run the backend
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Setup environment
cp .env.local.example .env.local
# Edit .env.local if needed:
# NEXT_PUBLIC_API_URL=http://localhost:8000

# Run the frontend
npm run dev
```

### 4. Open Your Browser

- Frontend: http://localhost:3000
- Backend API Docs: http://localhost:8000/docs

## 🐳 Docker Deployment

For the easiest setup, use Docker Compose:

```bash
# Setup environment files
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# Edit backend/.env and add your OpenAI API key
nano backend/.env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

## 📖 Usage

### 1. Generate a HAR File

1. Open your browser's Developer Tools (F12)
2. Go to the **Network** tab
3. Navigate to the website with the API you want to reverse engineer
4. Interact with the site to trigger the API calls
5. Right-click on the Network tab and select "Save all as HAR with content"

### 2. Upload and Analyze

1. **Upload HAR File**: Drag and drop your .har file or click to browse
2. **Describe the API**: Enter a description like:
   - "Weather API for San Francisco"
   - "User login endpoint"
   - "Search products API with filters"
3. **Generate**: Click "Generate Curl Command"
4. **Copy**: Copy the generated curl command and use it in your projects

### Example Descriptions

- ✅ **Good**: "API that fetches weather data for San Francisco"
- ✅ **Good**: "User authentication endpoint that returns a JWT token"
- ✅ **Good**: "Search API that filters products by category and price"
- ❌ **Too vague**: "Get data"
- ❌ **Too vague**: "Login"

## 🔧 Configuration

### Backend Configuration

Edit `backend/.env`:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional
OPENAI_MODEL=gpt-4o-2024-08-06
MAX_FILE_SIZE=52428800  # 50MB
MAX_REQUESTS_TO_ANALYZE=50
LOG_LEVEL=INFO
```

### Frontend Configuration

Edit `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🧪 API Reference

### POST `/api/reverse-engineer`

Analyze a HAR file and generate a curl command.

**Request:**
- `har_file`: Multipart file upload (.har file)
- `description`: Form field with API description

**Response:**
```json
{
  "curl_command": "curl -X GET 'https://api.example.com/weather?city=SF' -H 'Accept: application/json'",
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

## 🔒 Security Features

- **Sensitive Data Masking**: Authentication headers are automatically masked
- **File Size Limits**: HAR files are limited to 50MB
- **Input Validation**: Comprehensive validation of uploads and inputs
- **CORS Protection**: Restricted to configured frontend origins
- **Error Handling**: Detailed logging without exposing sensitive information

## 🎯 How It Works

1. **File Upload**: User uploads a HAR file through the drag-and-drop interface
2. **Smart Filtering**: Backend filters out static assets (CSS, JS, images) and focuses on API endpoints
3. **Request Prioritization**: Ranks requests based on:
   - Response content type (JSON/XML preferred)
   - HTTP status codes (2xx responses)
   - URL patterns (contains 'api', 'v1', etc.)
   - Request methods (POST/PUT/PATCH get priority)
4. **AI Analysis**: GPT-4 analyzes the filtered requests against the user's description
5. **Curl Generation**: Converts the selected request into a properly formatted curl command
6. **Security Processing**: Masks sensitive authentication data in the output

## 🧪 Development

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend type checking
cd frontend
npm run type-check
```

### Code Quality

```bash
# Backend linting and formatting
cd backend
black .
ruff check .

# Frontend linting
cd frontend
npm run lint
```

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**:
   ```bash
   # Production environment variables
   export OPENAI_API_KEY=your_production_key
   export NEXT_PUBLIC_API_URL=https://your-backend-domain.com
   ```

2. **Build and Deploy**:
   ```bash
   # Using Docker Compose
   docker-compose -f docker-compose.prod.yml up -d
   
   # Or build separately
   docker build -t har-backend ./backend
   docker build -t har-frontend ./frontend
   ```

### Environment Variables for Production

**Backend**:
```bash
OPENAI_API_KEY=your_production_key
DEBUG=false
LOG_LEVEL=WARNING
CORS_ORIGINS=["https://your-frontend-domain.com"]
```

**Frontend**:
```bash
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
NODE_ENV=production
```

## 🙋‍♂️ Support

If you have any questions or run into issues:

1. Check the [Issues](../../issues) page
2. Review the API documentation at http://localhost:8000/docs
3. Ensure your OpenAI API key is properly configured
4. Verify that both frontend and backend services are running

## 🎉 Acknowledgments

- Built with [Next.js](https://nextjs.org/) and [FastAPI](https://fastapi.tiangolo.com/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide React](https://lucide.dev/)
- AI powered by [OpenAI GPT-4](https://openai.com/)

---

**Happy API Reverse Engineering! 🔍✨**