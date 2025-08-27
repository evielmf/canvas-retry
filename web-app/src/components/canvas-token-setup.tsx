'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface CanvasTokenSetupProps {
  onComplete?: () => void
}

export default function CanvasTokenSetup({ onComplete }: CanvasTokenSetupProps) {
  const [formData, setFormData] = useState({
    canvas_url: '',
    canvas_name: '',
    api_token: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic client-side validation
    if (!formData.canvas_url || !formData.canvas_name || !formData.api_token) {
      toast.error('Please fill in all fields')
      return
    }

    if (formData.api_token.length < 20) {
      toast.error('Canvas API token appears to be too short. Please check your token.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/canvas/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed')
      }

      toast.success(data.message || 'Canvas connection setup successful!')
      
      // Reset form
      setFormData({
        canvas_url: '',
        canvas_name: '',
        api_token: ''
      })

      // Call completion callback
      onComplete?.()

    } catch (error) {
      console.error('Canvas setup error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to setup Canvas connection')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Connect to Canvas</CardTitle>
        <CardDescription>
          Enter your Canvas LMS details to sync your courses and assignments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="canvas_url">Canvas URL</Label>
            <Input
              id="canvas_url"
              type="text"
              placeholder="e.g., myschool.instructure.com"
              value={formData.canvas_url}
              onChange={(e) => handleInputChange('canvas_url', e.target.value)}
              required
            />
            <p className="text-sm text-muted-foreground">
              Your Canvas domain (without https://)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="canvas_name">Institution Name</Label>
            <Input
              id="canvas_name"
              type="text"
              placeholder="e.g., My University"
              value={formData.canvas_name}
              onChange={(e) => handleInputChange('canvas_name', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_token">Canvas API Token</Label>
            <Input
              id="api_token"
              type="password"
              placeholder="Your Canvas API token"
              value={formData.api_token}
              onChange={(e) => handleInputChange('api_token', e.target.value)}
              required
            />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>To get your Canvas API token:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Log into your Canvas account</li>
                <li>Go to Account → Settings</li>
                <li>Scroll to "Approved Integrations"</li>
                <li>Click "+ New Access Token"</li>
                <li>Enter "EaseBoard" as the purpose</li>
                <li>Copy the generated token (shown only once!)</li>
              </ol>
              <p className="text-xs text-orange-600 mt-2">
                ⚠️ Canvas tokens are long (usually 60+ characters) and may start with numbers and special characters.
              </p>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !formData.canvas_url || !formData.canvas_name || !formData.api_token}
          >
            {isLoading ? 'Connecting...' : 'Connect Canvas'}
          </Button>
        </form>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Why do we need this?</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Sync your courses and assignments</li>
            <li>• Track grades and deadlines</li>
            <li>• Get personalized insights</li>
            <li>• Receive smart reminders</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Your credentials are stored securely and only used to access your Canvas data.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
