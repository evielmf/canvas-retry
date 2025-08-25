'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  GraduationCap, 
  TrendingUp, 
  Bell, 
  Plus,
  Filter,
  Search,
  Settings,
  LogOut,
  RotateCw,
  AlertTriangle,
  CheckCircle,
  Star,
  Users,
  BarChart3,
  Target,
  Zap,
  MessageSquare,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Shield
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { DataService } from '@/lib/services/data-service'
import { LearningAnalytics } from '@/components/charts/learning-analytics'
import CanvasTokenSetup from '@/components/canvas-token-setup'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [canvasConnected, setCanvasConnected] = useState(false)
  const [checkingCanvas, setCheckingCanvas] = useState(true)
  const [showCanvasSetup, setShowCanvasSetup] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Check for Canvas integration
  const checkCanvasIntegration = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false

      const response = await fetch('/api/canvas/validate-token', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        return data.connected || false
      }
      return false
    } catch (error) {
      console.error('Error checking Canvas integration:', error)
      return false
    }
  }

  useEffect(() => {
    const initializeDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        const connected = await checkCanvasIntegration()
        setCanvasConnected(connected)
        setCheckingCanvas(false)
        
        // If not connected, show setup modal after a brief delay
        if (!connected) {
          setTimeout(() => setShowCanvasSetup(true), 1000)
        }
      }
      
      setLoading(false)
    }

    initializeDashboard()
  }, [supabase.auth])

  const handleCanvasSetupComplete = () => {
    setShowCanvasSetup(false)
    setCanvasConnected(true)
    toast.success('Canvas integration completed successfully!')
  }

  const getCurrentTimeGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out successfully')
    router.push('/')
    router.refresh()
  }

  if (loading || checkingCanvas) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-sage-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-sage-600">Loading your dashboard...</p>
        </motion.div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please sign in to access your dashboard</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-sage-600" />
              <span className="text-xl font-bold bg-gradient-to-r from-sage-600 to-sage-800 bg-clip-text text-transparent">
                EaseBoard
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
                <Settings className="h-5 w-5" />
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
              <Avatar>
                <AvatarImage src={user.user_metadata.avatar_url} />
                <AvatarFallback className="bg-sage-100 text-sage-700">
                  {user.user_metadata.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-sage-600 to-sage-700 text-white rounded-2xl p-8 shadow-lg"
          >
            <h1 className="text-3xl font-bold mb-2">
              {getCurrentTimeGreeting()}, {user.user_metadata.name?.split(' ')[0] || 'Student'}! 👋
            </h1>
            <p className="text-sage-100 flex items-center">
              <Sparkles className="w-4 h-4 mr-2" />
              Take a deep breath and see what's on your peaceful study journey today ✨
            </p>
          </motion.div>

          {/* Canvas Setup Prompt (if not connected) */}
          <AnimatePresence>
            {!canvasConnected && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-2 border-sage-200 bg-gradient-to-br from-sage-50 to-white">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 bg-sage-100 rounded-full">
                          <BookOpen className="w-6 h-6 text-sage-600" />
                        </div>
                        <div>
                          <CardTitle className="text-sage-900">Connect to Canvas</CardTitle>
                          <CardDescription className="text-sage-600">
                            Link your Canvas LMS to get started with your personalized dashboard
                          </CardDescription>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setShowCanvasSetup(true)}
                        className="bg-sage-600 hover:bg-sage-700 text-white"
                      >
                        Get Started
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2 text-sage-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Sync courses & assignments</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sage-600">
                        <Shield className="w-4 h-4" />
                        <span className="text-sm">Secure & encrypted</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sage-600">
                        <Zap className="w-4 h-4" />
                        <span className="text-sm">Real-time updates</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dashboard Content (if Canvas connected) */}
          <AnimatePresence>
            {canvasConnected && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-8"
              >
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-blue-700">Study Courses</CardTitle>
                          <BookOpen className="h-4 w-4 text-blue-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-900">-</div>
                        <p className="text-xs text-blue-600 mt-1">Loading...</p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-amber-700">Due Soon</CardTitle>
                          <Clock className="h-4 w-4 text-amber-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-amber-900">-</div>
                        <p className="text-xs text-amber-600 mt-1">Next 7 days</p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-green-700">Completed</CardTitle>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-900">-</div>
                        <p className="text-xs text-green-600 mt-1">This week</p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-purple-700">Average Grade</CardTitle>
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-purple-900">-</div>
                        <p className="text-xs text-purple-600 mt-1">Overall performance</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Main Dashboard Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Upcoming Tasks */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sage-900">Upcoming Tasks</CardTitle>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View All
                        </Button>
                      </div>
                      <CardDescription>Next 5 assignments due within 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-sage-600">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Loading assignments...</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Grade Progress */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sage-900">Grade Progress</CardTitle>
                        <Button variant="outline" size="sm">
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Analytics
                        </Button>
                      </div>
                      <CardDescription>Visual charts showing academic performance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-sage-600">
                        <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Loading grade data...</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Navigation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-sage-200 hover:border-sage-300">
                      <CardHeader>
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-sage-100 rounded-lg">
                            <BookOpen className="h-5 w-5 text-sage-600" />
                          </div>
                          <div>
                            <CardTitle className="text-sage-900">Assignments</CardTitle>
                            <CardDescription>Manage your coursework</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-sage-200 hover:border-sage-300">
                      <CardHeader>
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-sage-100 rounded-lg">
                            <Calendar className="h-5 w-5 text-sage-600" />
                          </div>
                          <div>
                            <CardTitle className="text-sage-900">Schedule</CardTitle>
                            <CardDescription>View your weekly calendar</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-sage-200 hover:border-sage-300">
                      <CardHeader>
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-sage-100 rounded-lg">
                            <BarChart3 className="h-5 w-5 text-sage-600" />
                          </div>
                          <div>
                            <CardTitle className="text-sage-900">Grades</CardTitle>
                            <CardDescription>Track your progress</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Canvas Setup Modal */}
      <Dialog open={showCanvasSetup} onOpenChange={setShowCanvasSetup}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <CanvasTokenSetup onComplete={handleCanvasSetupComplete} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
