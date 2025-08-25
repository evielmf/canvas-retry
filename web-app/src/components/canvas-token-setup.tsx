/*
Canvas Token Setup Component for Next.js Frontend
This component guides users through Canvas API token setup
*/

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
  ExternalLink, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  BookOpen,
  Zap,
  Shield,
  Clock
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface CanvasTokenSetupProps {
  onComplete?: () => void
}

interface SetupStep {
  id: number
  title: string
  description: string
  completed: boolean
}

export default function CanvasTokenSetup({ onComplete }: CanvasTokenSetupProps) {
  const [canvasUrl, setCanvasUrl] = useState('')
  const [canvasName, setCanvasName] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([
    { id: 1, title: 'Enter Canvas Details', description: 'Provide your Canvas URL and institution name', completed: false },
    { id: 2, title: 'Add API Token', description: 'Enter your Canvas API token for secure access', completed: false },
    { id: 3, title: 'Validate Connection', description: 'Test connection to your Canvas instance', completed: false },
    { id: 4, title: 'Sync Data', description: 'Import your courses, assignments, and grades', completed: false }
  ])
  
  const router = useRouter()
  const supabase = createClient()

  // Common Canvas URLs for quick selection
  const commonCanvasUrls = [
    'https://canvas.instructure.com',
    'https://university.instructure.com',
    'https://college.instructure.com',
    'https://school.instructure.com'
  ]

  const handleCanvasUrlChange = (url: string) => {
    setCanvasUrl(url)
    if (url && !canvasName) {
      // Auto-detect institution name from URL
      try {
        const domain = new URL(url).hostname
        const name = domain.split('.')[0]
        setCanvasName(name.charAt(0).toUpperCase() + name.slice(1))
      } catch {
        // Invalid URL, ignore
      }
    }
  }

  const validateInputs = () => {
    if (!canvasUrl || !canvasName || !apiToken) {
      toast.error('Please fill in all fields')
      return false
    }

    try {
      new URL(canvasUrl)
    } catch {
      toast.error('Please enter a valid Canvas URL')
      return false
    }

    if (apiToken.length < 10) {
      toast.error('API token appears to be too short')
      return false
    }

    return true
  }

  const setupCanvasIntegration = async () => {
    if (!validateInputs()) return

    setLoading(true)
    setValidating(true)

    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Please log in to continue')
        router.push('/login')
        return
      }

      // Step 1: Complete basic info
      updateStep(1, true)
      setCurrentStep(2)

      // Step 2: Complete token entry
      updateStep(2, true)
      setCurrentStep(3)

      // Step 3: Validate connection with backend
      const response = await fetch('/api/canvas/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          canvas_url: canvasUrl.trim(),
          canvas_name: canvasName.trim(),
          api_token: apiToken.trim()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to setup Canvas integration')
      }

      const connection = await response.json()
      
      // Step 3: Complete validation
      updateStep(3, true)
      setCurrentStep(4)
      setValidating(false)
      setSyncing(true)

      // Step 4: Wait for initial sync to complete
      toast.success('Canvas connection established! Syncing your data...')
      
      // Poll for sync completion
      await pollSyncStatus(connection.id, session.access_token)
      
      // Step 4: Complete sync
      updateStep(4, true)
      setSyncing(false)

      toast.success('🎉 Canvas integration setup complete!')
      
      // Redirect to dashboard after brief delay
      setTimeout(() => {
        if (onComplete) {
          onComplete()
        } else {
          router.push('/dashboard')
        }
      }, 2000)

    } catch (error) {
      console.error('Canvas setup failed:', error)
      toast.error(error instanceof Error ? error.message : 'Setup failed')
      setValidating(false)
      setSyncing(false)
      setCurrentStep(Math.max(1, currentStep - 1))
    } finally {
      setLoading(false)
    }
  }

  const pollSyncStatus = async (connectionId: string, token: string) => {
    const maxAttempts = 30 // 5 minutes max
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/canvas/connections/${connectionId}/sync/status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const status = await response.json()
          
          if (!status.is_syncing && status.last_sync?.status === 'completed') {
            return // Sync completed
          }
          
          if (status.last_sync?.status === 'failed') {
            throw new Error('Data sync failed')
          }
        }

        await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
        attempts++
      } catch (error) {
        console.error('Sync status check failed:', error)
        break
      }
    }
  }

  const updateStep = (stepId: number, completed: boolean) => {
    setSetupSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed } : step
    ))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto mb-4 w-16 h-16 bg-primary rounded-2xl flex items-center justify-center"
          >
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-3xl font-bold text-foreground">Connect Your Canvas</h1>
          <p className="text-muted-foreground mt-2">
            Integrate your Canvas LMS to get started with EaseBoard
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {setupSteps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step.completed 
                    ? 'bg-green-500 text-white' 
                    : currentStep === step.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }
                `}>
                  {step.completed ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    step.id
                  )}
                </div>
                {index < setupSteps.length - 1 && (
                  <div className={`
                    w-16 h-1 mx-2
                    ${step.completed ? 'bg-green-500' : 'bg-muted'}
                  `} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h3 className="font-medium">{setupSteps[currentStep - 1]?.title}</h3>
            <p className="text-sm text-muted-foreground">
              {setupSteps[currentStep - 1]?.description}
            </p>
          </div>
        </div>

        {/* Main Setup Card */}
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Canvas Integration Setup</CardTitle>
                <CardDescription>
                  Connect your Canvas LMS to sync courses, assignments, and grades
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInstructions(true)}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                How to get token
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Canvas URL */}
            <div className="space-y-2">
              <Label htmlFor="canvas-url">Canvas URL</Label>
              <Input
                id="canvas-url"
                type="url"
                placeholder="https://your-school.instructure.com"
                value={canvasUrl}
                onChange={(e) => handleCanvasUrlChange(e.target.value)}
                disabled={loading}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {commonCanvasUrls.map((url) => (
                  <Button
                    key={url}
                    variant="outline"
                    size="sm"
                    onClick={() => handleCanvasUrlChange(url)}
                    disabled={loading}
                  >
                    {url.replace('https://', '')}
                  </Button>
                ))}
              </div>
            </div>

            {/* Canvas Name */}
            <div className="space-y-2">
              <Label htmlFor="canvas-name">Institution Name</Label>
              <Input
                id="canvas-name"
                placeholder="My University"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* API Token */}
            <div className="space-y-2">
              <Label htmlFor="api-token">Canvas API Token</Label>
              <div className="relative">
                <Input
                  id="api-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your Canvas API token"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Your token is encrypted and stored securely</span>
              </div>
            </div>

            {/* Features Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm">Parallel sync</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm">Auto-sync every 2h</span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm">Secure encryption</span>
              </div>
            </div>

            {/* Setup Button */}
            <Button
              onClick={setupCanvasIntegration}
              disabled={loading || !canvasUrl || !canvasName || !apiToken}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {validating ? 'Validating...' : syncing ? 'Syncing Data...' : 'Setting up...'}
                </>
              ) : (
                'Connect Canvas'
              )}
            </Button>

            {/* Status Messages */}
            <AnimatePresence>
              {validating && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-blue-600 dark:text-blue-400">
                      Validating Canvas connection...
                    </span>
                  </div>
                </motion.div>
              )}

              {syncing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                >
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                    <span className="text-green-600 dark:text-green-400">
                      Importing your Canvas data... This may take a few minutes.
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Instructions Dialog */}
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How to Get Your Canvas API Token</DialogTitle>
            <DialogDescription>
              Follow these steps to generate your Canvas API token
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-1">1</Badge>
                <div>
                  <h4 className="font-medium">Log into Canvas</h4>
                  <p className="text-sm text-muted-foreground">
                    Go to your Canvas homepage and make sure you're logged in
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-1">2</Badge>
                <div>
                  <h4 className="font-medium">Access Account Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Click on "Account" in the left sidebar, then click "Settings"
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-1">3</Badge>
                <div>
                  <h4 className="font-medium">Find Approved Integrations</h4>
                  <p className="text-sm text-muted-foreground">
                    Scroll down to the "Approved Integrations" section
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-1">4</Badge>
                <div>
                  <h4 className="font-medium">Generate New Token</h4>
                  <p className="text-sm text-muted-foreground">
                    Click "+ New Access Token" button
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-1">5</Badge>
                <div>
                  <h4 className="font-medium">Set Purpose</h4>
                  <p className="text-sm text-muted-foreground">
                    Enter "EaseBoard Integration" as the purpose
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Badge variant="outline" className="mt-1">6</Badge>
                <div>
                  <h4 className="font-medium">Copy Token</h4>
                  <p className="text-sm text-muted-foreground">
                    Click "Generate Token" and copy the generated token immediately
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Important:</p>
                  <p className="text-amber-700 dark:text-amber-300">
                    The token will only be shown once. Make sure to copy it immediately and paste it into EaseBoard.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowInstructions(false)}>
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
