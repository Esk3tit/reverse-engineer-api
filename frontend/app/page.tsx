"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Upload, FileText, Terminal, Copy, Check, Loader2, AlertCircle, Globe, Clock, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"

import { apiClient, type CurlResponse, APIError } from "@/lib/api"

export default function ReverseEngineeringTool() {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [curlResult, setCurlResult] = useState<CurlResponse | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  // Check backend health on component mount
  useEffect(() => {
    checkBackendHealth()
  }, [])

  const checkBackendHealth = async () => {
    try {
      await apiClient.healthCheck()
      setBackendStatus('online')
    } catch (error) {
      setBackendStatus('offline')
      console.warn('Backend health check failed:', error)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.name.endsWith(".har")) {
        setFile(droppedFile)
        setError("")
        toast.success("HAR file loaded successfully!")
      } else {
        setError("Please upload a valid .har file")
        toast.error("Invalid file type. Please upload a .har file.")
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.name.endsWith(".har")) {
        setFile(selectedFile)
        setError("")
        toast.success("HAR file loaded successfully!")
      } else {
        setError("Please upload a valid .har file")
        toast.error("Invalid file type. Please upload a .har file.")
      }
    }
  }

  const handleSubmit = async () => {
    if (!file || !description.trim()) {
      setError("Please upload a .har file and provide a description")
      toast.error("Please provide both a HAR file and description")
      return
    }

    if (backendStatus === 'offline') {
      setError("Backend service is currently unavailable")
      toast.error("Backend service is offline. Please try again later.")
      return
    }

    setIsProcessing(true)
    setError("")
    setProgress(0)
    setCurlResult(null)

    try {
      toast.loading("Processing HAR file...", { id: 'processing' })
      
      const result = await apiClient.reverseEngineerHAR(
        file,
        description,
        (progressValue) => setProgress(progressValue.percentage)
      )

      setCurlResult(result)
      setProgress(100)
      toast.success("Curl command generated successfully!", { id: 'processing' })
      
    } catch (error) {
      console.error('API Error:', error)
      
      if (error instanceof APIError) {
        setError(error.message)
        toast.error(error.message, { id: 'processing' })
      } else {
        setError("An unexpected error occurred. Please try again.")
        toast.error("An unexpected error occurred", { id: 'processing' })
      }
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }

  const copyToClipboard = async () => {
    if (!curlResult) return
    
    try {
      await navigator.clipboard.writeText(curlResult.curl_command)
      setCopied(true)
      toast.success("Curl command copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
      toast.error("Failed to copy to clipboard")
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">API Reverse Engineer</h1>
                <p className="text-sm text-muted-foreground">Extract curl commands from HAR files</p>
              </div>
            </div>
            
            {/* Backend Status Indicator */}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${
                backendStatus === 'online' ? 'bg-green-500' : 
                backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              <span className="text-sm text-muted-foreground">
                {backendStatus === 'online' ? 'Backend Online' : 
                 backendStatus === 'offline' ? 'Backend Offline' : 'Checking...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Process Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`flex items-center gap-3 p-4 rounded-lg bg-card border ${
              file ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'
            }`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                file ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'
              } text-sm font-medium`}>
                {file ? <Check className="h-4 w-4" /> : '1'}
              </div>
              <div>
                <h3 className="font-medium text-foreground">Upload HAR File</h3>
                <p className="text-sm text-muted-foreground">Drop your .har file here</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 p-4 rounded-lg bg-card border ${
              description.trim() ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'
            }`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                description.trim() ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
              } text-sm font-medium`}>
                {description.trim() ? <Check className="h-4 w-4" /> : '2'}
              </div>
              <div>
                <h3 className="font-medium text-foreground">Describe API</h3>
                <p className="text-sm text-muted-foreground">Tell us what you're looking for</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 p-4 rounded-lg bg-card border ${
              curlResult ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'
            }`}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                curlResult ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
              } text-sm font-medium`}>
                {curlResult ? <Check className="h-4 w-4" /> : '3'}
              </div>
              <div>
                <h3 className="font-medium text-foreground">Get Curl Command</h3>
                <p className="text-sm text-muted-foreground">Copy and use the result</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing HAR file...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Section */}
            <div className="space-y-6">
              {/* File Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload HAR File
                  </CardTitle>
                  <CardDescription>Upload your HTTP Archive file to analyze API requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive
                        ? "border-primary bg-primary/5"
                        : file
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-border hover:border-primary/50"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      accept=".har"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isProcessing}
                    />
                    {file ? (
                      <div className="space-y-2">
                        <FileText className="h-8 w-8 mx-auto text-green-600" />
                        <p className="font-medium text-foreground">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        >
                          Ready to process
                        </Badge>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-foreground font-medium">Drop your .har file here</p>
                        <p className="text-sm text-muted-foreground">or click to browse</p>
                        <p className="text-xs text-muted-foreground">Maximum file size: 50MB</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Description Input */}
              <Card>
                <CardHeader>
                  <CardTitle>API Description</CardTitle>
                  <CardDescription>Describe the API endpoint you want to reverse engineer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="description">What API are you looking for?</Label>
                    <Textarea
                      id="description"
                      placeholder="e.g., Return the API that fetches the weather of San Francisco"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-2 min-h-[100px]"
                      disabled={isProcessing}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Be as specific as possible. Examples: "weather API", "user login endpoint", "search products API"
                    </p>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={!file || !description.trim() || isProcessing || backendStatus === 'offline'}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing HAR file...
                      </>
                    ) : (
                      <>
                        <Terminal className="mr-2 h-4 w-4" />
                        Generate Curl Command
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Output Section */}
            <div className="space-y-6">
              {/* Backend Status Alert */}
              {backendStatus === 'offline' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Backend service is currently offline. Please check if the API server is running on localhost:8000.
                    <Button variant="outline" size="sm" onClick={checkBackendHealth} className="ml-2">
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Curl Command Output */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Terminal className="h-5 w-5" />
                      Generated Curl Command
                    </span>
                    {curlResult && (
                      <Button variant="outline" size="sm" onClick={copyToClipboard} className="ml-2 bg-transparent">
                        {copied ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                          </>
                        )}
                      </Button>
                    )}
                  </CardTitle>
                  <CardDescription>Your extracted API request as a curl command</CardDescription>
                </CardHeader>
                <CardContent>
                  {curlResult ? (
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto text-foreground whitespace-pre-wrap">
                        {curlResult.curl_command}
                      </pre>
                    </div>
                  ) : (
                    <div className="bg-muted p-8 rounded-lg text-center">
                      <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Upload a HAR file and provide a description to generate your curl command
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Request Details */}
              {curlResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Request Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Method
                      </span>
                      <Badge variant="secondary">{curlResult.request_method}</Badge>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Endpoint
                      </span>
                      <span className="text-sm font-mono text-foreground max-w-[200px] truncate" title={curlResult.request_url}>
                        {new URL(curlResult.request_url).hostname}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Requests Analyzed
                      </span>
                      <Badge variant="outline">{curlResult.metadata?.total_requests_analyzed || 'Unknown'}</Badge>
                    </div>
                    {curlResult.metadata?.content_type && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Content Type
                        </span>
                        <Badge variant="outline">{curlResult.metadata.content_type}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}