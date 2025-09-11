/**
 * API client with real upload progress and better error handling
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

export class APIError extends Error {
  constructor(
    public status: number,
    public errorResponse: { error: string; status_code: number },
    message?: string
  ) {
    super(message || errorResponse.error);
    this.name = 'APIError';
  }
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
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new APIError(xhr.status, errorResponse));
          } catch (error) {
            reject(new APIError(xhr.status, {
              error: `HTTP ${xhr.status}: ${xhr.statusText}`,
              status_code: xhr.status
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