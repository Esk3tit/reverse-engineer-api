"use client"

import type React from "react"

import { useState } from "react"
import { Upload, FileText, Terminal, Copy, Check, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

export default function ReverseEngineeringTool() {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [curlCommand, setCurlCommand] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [dragActive, setDragActive] = useState(false)

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
      } else {
        setError("Please upload a valid .har file")
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.name.endsWith(".har")) {
        setFile(selectedFile)
        setError("")
      } else {
        setError("Please upload a valid .har file")
      }
    }
  }

  const handleSubmit = async () => {
    if (!file || !description.trim()) {
      setError("Please upload a .har file and provide a description")
      return
    }

    setIsProcessing(true)
    setError("")

    // Simulate API call - replace with actual backend integration
    setTimeout(() => {
      setCurlCommand(`curl -X GET "https://api.example.com/weather?city=san-francisco" \\
  -H "Accept: application/json" \\
  -H "User-Agent: Mozilla/5.0 (compatible; API-Tool/1.0)" \\
  -H "Authorization: Bearer your-api-key-here"`)
      setIsProcessing(false)
    }, 3000)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">API Reverse Engineer</h1>
              <p className="text-sm text-muted-foreground">Extract curl commands from HAR files</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Process Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                1
              </div>
              <div>
                <h3 className="font-medium text-foreground">Upload HAR File</h3>
                <p className="text-sm text-muted-foreground">Drop your .har file here</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">
                2
              </div>
              <div>
                <h3 className="font-medium text-foreground">Describe API</h3>
                <p className="text-sm text-muted-foreground">Tell us what you're looking for</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">
                3
              </div>
              <div>
                <h3 className="font-medium text-foreground">Get Curl Command</h3>
                <p className="text-sm text-muted-foreground">Copy and use the result</p>
              </div>
            </div>
          </div>

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
                    />
                    {file ? (
                      <div className="space-y-2">
                        <FileText className="h-8 w-8 mx-auto text-green-600" />
                        <p className="font-medium text-foreground">{file.name}</p>
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
                    />
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={!file || !description.trim() || isProcessing}
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
                    {curlCommand && (
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
                  {curlCommand ? (
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto text-foreground whitespace-pre-wrap">
                        {curlCommand}
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

              {/* Additional Info */}
              {curlCommand && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Request Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm font-medium text-muted-foreground">Method</span>
                      <Badge variant="secondary">GET</Badge>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm font-medium text-muted-foreground">Endpoint</span>
                      <span className="text-sm font-mono text-foreground">api.example.com</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-muted-foreground">Auth Required</span>
                      <Badge variant="outline">Bearer Token</Badge>
                    </div>
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
