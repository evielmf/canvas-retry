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
  const queryClient = useQueryClient()

  // Fetch dashboard data
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['dashboard-data', user?.id],
    queryFn: async () => {
      if (!user) return null
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      const response = await fetch('/api/dashboard/data', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        // If it's a 404 or connection error, return default data structure
        if (response.status === 404 || response.status === 400) {
          return {
            connected: false,
            stats: { total_courses: 0, due_soon: 0, completed_this_week: 0, average_grade: 0 },
            upcoming_assignments: [],
            course_progress: []
          }
        }
        throw new Error('Failed to fetch dashboard data')
      }

      return response.json()
    },
    enabled: !!user && !loading && !checkingCanvas,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  })

  useEffect(() => {
    const initializeDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
      setCheckingCanvas(false)
    }

    initializeDashboard()
  }, [supabase.auth])

  // Update Canvas connection status based on dashboard data
  useEffect(() => {
    if (dashboardData) {
      const isConnected = dashboardData.connected || false
      setCanvasConnected(isConnected)
      
      // If not connected, show setup modal after a brief delay
      if (!isConnected && !showCanvasSetup) {
        setTimeout(() => setShowCanvasSetup(true), 1000)
      }
    }
  }, [dashboardData, showCanvasSetup])

  const handleCanvasSetupComplete = () => {
    setShowCanvasSetup(false)
    setCanvasConnected(true)
    toast.success('Canvas integration completed successfully!')
    // Refresh dashboard data
    refetchDashboard()
  }

  const handleSyncData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/canvas/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sync_type: 'incremental' })
      })

      if (response.ok) {
        toast.success('Data synced successfully!')
        refetchDashboard()
      } else {
        toast.error('Failed to sync data')
      }
    } catch (error) {
      toast.error('Failed to sync data')
    }
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
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-green-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-green-600">Loading your dashboard...</p>
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
              <BookOpen className="h-8 w-8 text-green-600" />
              <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
                EaseBoard
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              {canvasConnected && (
                <Button variant="outline" onClick={handleSyncData} disabled={isDashboardLoading}>
                  <RotateCw className={`h-4 w-4 mr-2 ${isDashboardLoading ? 'animate-spin' : ''}`} />
                  Sync
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
                <Settings className="h-5 w-5" />
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
              <Avatar>
                <AvatarImage src={user.user_metadata.avatar_url} />
                <AvatarFallback className="bg-green-100 text-green-700">
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
            className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-2xl p-8 shadow-lg"
            style={{ backgroundColor: '#059669' }} // Fallback green color
          >
            <h1 className="text-3xl font-bold mb-2 text-white">
              {getCurrentTimeGreeting()}, {user.user_metadata.name?.split(' ')[0] || 'Student'}! 👋
            </h1>
            <p className="text-green-100 flex items-center">
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
                <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 bg-green-100 rounded-full">
                          <BookOpen className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <CardTitle className="text-slate-900">Connect to Canvas</CardTitle>
                          <CardDescription className="text-slate-600">
                            Link your Canvas LMS to get started with your personalized dashboard
                          </CardDescription>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setShowCanvasSetup(true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Get Started
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">Sync courses & assignments</span>
                      </div>
                      <div className="flex items-center space-x-2 text-green-600">
                        <Shield className="w-4 h-4" />
                        <span className="text-sm">Secure & encrypted</span>
                      </div>
                      <div className="flex items-center space-x-2 text-green-600">
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
                        <div className="text-2xl font-bold text-blue-900">
                          {isDashboardLoading ? '-' : (dashboardData?.stats?.total_courses || 0)}
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          {isDashboardLoading ? 'Loading...' : 'Active courses'}
                        </p>
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
                        <div className="text-2xl font-bold text-amber-900">
                          {isDashboardLoading ? '-' : (dashboardData?.stats?.due_soon || 0)}
                        </div>
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
                        <div className="text-2xl font-bold text-green-900">
                          {isDashboardLoading ? '-' : (dashboardData?.stats?.completed_this_week || 0)}
                        </div>
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
                        <div className="text-2xl font-bold text-purple-900">
                          {isDashboardLoading ? '-' : (dashboardData?.stats?.average_grade ? `${dashboardData.stats.average_grade.toFixed(1)}%` : '0%')}
                        </div>
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
                        <CardTitle className="text-slate-900">Upcoming Tasks</CardTitle>
                        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/assignments')}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View All
                        </Button>
                      </div>
                      <CardDescription>Next 5 assignments due within 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isDashboardLoading ? (
                        <div className="text-center py-8 text-slate-600">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Loading assignments...</p>
                        </div>
                      ) : dashboardData?.upcoming_assignments?.length > 0 ? (
                        <div className="space-y-3">
                          {dashboardData.upcoming_assignments.slice(0, 5).map((assignment: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 rounded-lg border hover:shadow-sm transition-shadow">
                              <div>
                                <h4 className="font-medium text-slate-900">{assignment.title}</h4>
                                <p className="text-sm text-slate-600">{assignment.course_name}</p>
                                <p className="text-xs text-slate-500">
                                  Due {new Date(assignment.due_date).toLocaleDateString()}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {assignment.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-600">
                          <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No upcoming assignments</p>
                          <p className="text-sm text-slate-500">You're all caught up!</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Grade Progress */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-slate-900">Grade Progress</CardTitle>
                        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/grades')}>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Analytics
                        </Button>
                      </div>
                      <CardDescription>Visual charts showing academic performance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isDashboardLoading ? (
                        <div className="text-center py-8 text-slate-600">
                          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Loading grade data...</p>
                        </div>
                      ) : dashboardData?.course_progress?.length > 0 ? (
                        <div className="space-y-3">
                          {dashboardData.course_progress.slice(0, 4).map((course: any, index: number) => (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{course.course_code}</p>
                                  <p className="text-xs text-slate-600">{course.course_name}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-slate-900">{course.current_grade}%</p>
                                <Badge variant="outline" className="text-xs">{course.letter_grade}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-600">
                          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No grade data available</p>
                          <p className="text-sm text-slate-500">Sync with Canvas to see your grades</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Navigation */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-green-200 hover:border-green-300"
                          onClick={() => router.push('/dashboard/assignments')}>
                      <CardHeader>
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <BookOpen className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <CardTitle className="text-slate-900">Assignments</CardTitle>
                            <CardDescription>Manage your coursework</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-green-200 hover:border-green-300"
                          onClick={() => router.push('/dashboard/schedule')}>
                      <CardHeader>
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Calendar className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <CardTitle className="text-slate-900">Schedule</CardTitle>
                            <CardDescription>View your weekly calendar</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-green-200 hover:border-green-300"
                          onClick={() => router.push('/dashboard/grades')}>
                      <CardHeader>
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <BarChart3 className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <CardTitle className="text-slate-900">Grades</CardTitle>
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
          <DialogHeader className="sr-only">
            <DialogTitle>Canvas LMS Setup</DialogTitle>
            <DialogDescription>
              Connect your Canvas LMS account to sync your courses, assignments, and grades.
            </DialogDescription>
          </DialogHeader>
          <CanvasTokenSetup onComplete={handleCanvasSetupComplete} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
