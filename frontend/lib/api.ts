/**
 * API client with real upload progress, better error handling, and curl execution
 */

export interface CurlResponse {
  curl_command: string;
  request_url: string;
  request_method: string;
  description: string;
  metadata: {
    total_requests_analyzed: number;
    selected_request_status: number;
    content_type: string;
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  stage: 'uploading' | 'processing' | 'complete';
}

export interface APIExecutionResult {
  success: boolean;
  status_code: number;
  headers: Record<string, string>;
  body: string;
  execution_time: number;
  error?: string;
}

export interface ErrorResponse {
  error: string;
  status_code: number;
  details?: Record<string, any>;
}

export class APIError extends Error {
  constructor(
    public status: number,
    public errorResponse: ErrorResponse,
    message?: string
  ) {
    super(message || errorResponse.error);
    this.name = 'APIError';
  }
}

// Map backend error shapes to user-friendly messages that don't crash the UI
function mapFriendlyError(status: number, err: ErrorResponse): { message: string; details?: Record<string, any> } {
  const raw = (err?.error || '').toLowerCase();
  if (status === 404 || raw.includes('no matching api request')) {
    return {
      message: 'No matching API request found for your description. Try refining your description.',
    };
  }
  if (status === 400) {
    if (raw.includes('file must be a .har')) {
      return { message: 'Please upload a valid .har file.' };
    }
    if (raw.includes('no valid api requests')) {
      return { message: 'No API requests were found in the HAR file.' };
    }
    return { message: 'Your request could not be processed. Please check the inputs and try again.' };
  }
  if (status >= 500) {
    return { message: 'The server had an issue processing this request. Please try again later.' };
  }
  return { message: err?.error || `HTTP ${status}` };
}

class APIClient {
  private baseURL: string;
  private abortController: AbortController | null = null;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  async reverseEngineerHAR(
    harFile: File,
    description: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<CurlResponse> {
    // Cancel any existing request
    this.abort();
    const controller = new AbortController();
    this.abortController = controller;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('har_file', harFile);
      formData.append('description', description);

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentage = Math.round((event.loaded / event.total) * 70); // 70% for upload
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage,
            stage: 'uploading'
          });
        }
      };

      // Handle state changes
      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
          if (onProgress) {
            onProgress({
              loaded: harFile.size,
              total: harFile.size,
              percentage: 85,
              stage: 'processing'
            });
          }
        }
      };

      // Handle completion
      xhr.onload = () => {
        if (onProgress) {
          onProgress({
            loaded: harFile.size,
            total: harFile.size,
            percentage: 100,
            stage: 'complete'
          });
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new APIError(xhr.status, {
              error: 'Invalid response format',
              status_code: xhr.status
            }));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText) as ErrorResponse;
            // Map common backend errors to friendly messages without throwing generic overlay-worthy errors
            const friendly = mapFriendlyError(xhr.status, errorResponse);
            reject(new APIError(xhr.status, { ...errorResponse, error: friendly.message }));
          } catch (error) {
            const friendly = mapFriendlyError(xhr.status, { error: xhr.statusText || 'Unknown error', status_code: xhr.status, details: undefined });
            reject(new APIError(xhr.status, {
              error: friendly.message,
              status_code: xhr.status,
              details: friendly.details
            }));
          }
        }
      };

      // Handle errors
      xhr.onerror = () => {
        reject(new APIError(0, {
          error: 'Network error occurred. Please check your connection.',
          status_code: 0
        }));
      };

      // Handle timeout
      xhr.ontimeout = () => {
        reject(new APIError(0, {
          error: 'Request timed out. The file may be too large or the server is busy.',
          status_code: 0
        }));
      };

      // Handle abort
      xhr.onabort = () => {
        reject(new APIError(0, {
          error: 'Request was cancelled.',
          status_code: 0
        }));
      };

      // Configure request
      xhr.open('POST', `${this.baseURL}/api/reverse-engineer`);
      xhr.timeout = 120000; // 2 minute timeout
      
      // Connect abort controller
      controller.signal.addEventListener('abort', () => {
        xhr.abort();
      });

      // Send request
      xhr.send(formData);
    });
  }

  async executeAPI(curlCommand: string): Promise<APIExecutionResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseURL}/api/execute-curl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          curl_command: curlCommand
        }),
      });

      const executionTime = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          status_code: response.status,
          headers: {},
          body: '',
          execution_time: executionTime,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const result = await response.json();
      return {
        success: true,
        status_code: result.status_code,
        headers: result.headers || {},
        body: result.body || '',
        execution_time: executionTime,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        status_code: 0,
        headers: {},
        body: '',
        execution_time: executionTime,
        error: error instanceof Error ? error.message : 'Network error occurred'
      };
    }
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async healthCheck(): Promise<{ status: string; version: string }> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      return await response.json();
    } catch (error) {
      throw new Error('Backend service is unavailable');
    }
  }

  // Test the backend with a small request
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new APIClient();