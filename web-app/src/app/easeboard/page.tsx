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
  Shield,
  Award,
  Brain,
  Activity,
  Home,
  Menu,
  X
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { LearningAnalytics } from '@/components/charts/learning-analytics'
import CanvasTokenSetup from '@/components/canvas-token-setup'

export default function EaseboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [canvasConnected, setCanvasConnected] = useState(false)
  const [checkingCanvas, setCheckingCanvas] = useState(true)
  const [showCanvasSetup, setShowCanvasSetup] = useState(false)
  const [selectedView, setSelectedView] = useState<'overview' | 'assignments' | 'grades' | 'schedule'>('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()

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

  // Fetch dashboard data
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['easeboard-dashboard', user?.id],
    queryFn: async () => {
      if (!user) return null
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      const response = await fetch('/api/dashboard', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      return response.json()
    },
    enabled: !!user && canvasConnected,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Search functionality
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['search-assignments', searchQuery, user?.id],
    queryFn: async () => {
      if (!user || !searchQuery || searchQuery.length < 2) return []
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return []

      const response = await fetch(`/api/canvas/assignments?search=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) return []
      const data = await response.json()
      return data.assignments || []
    },
    enabled: !!user && canvasConnected && searchQuery.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

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

  const navigateToPage = (path: string) => {
    router.push(path)
    setMobileMenuOpen(false)
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
          <p className="text-sage-600">Loading your Easeboard...</p>
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
            <CardDescription>Please sign in to access Easeboard</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Enhanced Navigation */}
      <nav className="bg-white/90 backdrop-blur-lg border-b border-slate-200/50 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-sage-500 to-sage-600 rounded-lg">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold bg-gradient-to-r from-sage-600 to-sage-800 bg-clip-text text-transparent">
                    Easeboard
                  </span>
                  <p className="text-xs text-slate-500">Student Dashboard</p>
                </div>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-1">
                <Button 
                  variant={selectedView === 'overview' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setSelectedView('overview')}
                  className="text-sm"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Overview
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigateToPage('/dashboard/assignments')}
                  className="text-sm"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Assignments
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigateToPage('/dashboard/grades')}
                  className="text-sm"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Grades
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigateToPage('/dashboard/schedule')}
                  className="text-sm"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
              </div>
            </div>
            
            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search assignments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              {canvasConnected && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSyncData} 
                  disabled={isDashboardLoading}
                >
                  <RotateCw className={`h-4 w-4 mr-2 ${isDashboardLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Sync</span>
                </Button>
              )}
              
              <Button variant="ghost" size="sm" onClick={() => navigateToPage('/settings')}>
                <Settings className="h-4 w-4" />
              </Button>
              
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
              
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.user_metadata.avatar_url} />
                <AvatarFallback className="bg-sage-100 text-sage-700 text-sm">
                  {user.user_metadata.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <div className="flex flex-col space-y-4 mt-6">
                    <div className="flex items-center space-x-3 pb-4 border-b">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.user_metadata.avatar_url} />
                        <AvatarFallback className="bg-sage-100 text-sage-700">
                          {user.user_metadata.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.user_metadata.name || 'Student'}</p>
                        <p className="text-sm text-slate-600">{user.email}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Button 
                        variant={selectedView === 'overview' ? 'default' : 'ghost'} 
                        className="w-full justify-start"
                        onClick={() => setSelectedView('overview')}
                      >
                        <Activity className="h-4 w-4 mr-3" />
                        Overview
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start"
                        onClick={() => navigateToPage('/dashboard/assignments')}
                      >
                        <BookOpen className="h-4 w-4 mr-3" />
                        Assignments
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start"
                        onClick={() => navigateToPage('/dashboard/grades')}
                      >
                        <BarChart3 className="h-4 w-4 mr-3" />
                        Grades
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start"
                        onClick={() => navigateToPage('/dashboard/schedule')}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Schedule
                      </Button>
                    </div>
                    
                    <div className="border-t pt-4 space-y-2">
                      {canvasConnected && (
                        <Button 
                          variant="outline" 
                          className="w-full justify-start"
                          onClick={handleSyncData} 
                          disabled={isDashboardLoading}
                        >
                          <RotateCw className={`h-4 w-4 mr-3 ${isDashboardLoading ? 'animate-spin' : ''}`} />
                          Sync Data
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start"
                        onClick={() => navigateToPage('/settings')}
                      >
                        <Settings className="h-4 w-4 mr-3" />
                        Settings
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-red-600 hover:text-red-700"
                        onClick={handleSignOut}
                      >
                        <LogOut className="h-4 w-4 mr-3" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      {/* Search Results Overlay */}
      <AnimatePresence>
        {searchQuery && searchQuery.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border-b border-slate-200 shadow-sm sticky top-16 z-40"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center space-x-2 mb-3">
                <Search className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-600">
                  {isSearching ? 'Searching...' : `Results for "${searchQuery}"`}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto">
                {(searchResults || []).map((assignment: any, index: number) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{assignment.title}</h4>
                          <p className="text-sm text-slate-600">{assignment.course_name}</p>
                          {assignment.due_date && (
                            <p className="text-xs text-slate-500 mt-1">
                              Due: {new Date(assignment.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Badge variant={assignment.status === 'overdue' ? 'destructive' : 'secondary'}>
                          {assignment.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!isSearching && (searchResults || []).length === 0 && (
                  <p className="text-slate-500 col-span-full text-center py-4">No assignments found</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Enhanced Welcome Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-sage-600 via-sage-600 to-sage-700 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-white transform -translate-x-32 -translate-y-32"></div>
              <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white transform translate-x-48 translate-y-48"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold mb-2">
                    {getCurrentTimeGreeting()}, {user.user_metadata.name?.split(' ')[0] || 'Student'}! 👋
                  </h1>
                  <p className="text-sage-100 flex items-center text-base md:text-lg">
                    <Sparkles className="w-5 h-5 mr-2" />
                    Take a deep breath and see what's on your peaceful study journey today ✨
                  </p>
                </div>
                
                {canvasConnected && dashboardData && (
                  <div className="grid grid-cols-2 lg:flex lg:items-center lg:space-x-6 gap-4 lg:gap-0 mt-4 lg:mt-0 text-sage-100">
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-bold">{dashboardData.stats?.total_courses || 0}</div>
                      <div className="text-sm opacity-90">Courses</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-bold">{dashboardData.stats?.due_soon || 0}</div>
                      <div className="text-sm opacity-90">Due Soon</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-bold">{dashboardData.stats?.completed_this_week || 0}</div>
                      <div className="text-sm opacity-90">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-bold">
                        {dashboardData.stats?.average_grade ? `${dashboardData.stats.average_grade.toFixed(1)}%` : '0%'}
                      </div>
                      <div className="text-sm opacity-90">Average</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
                <Card className="border-2 border-sage-200 bg-gradient-to-br from-sage-50 to-white shadow-lg">
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                      <div className="flex items-center space-x-4">
                        <div className="p-4 bg-sage-100 rounded-full">
                          <BookOpen className="w-8 h-8 text-sage-600" />
                        </div>
                        <div>
                          <CardTitle className="text-sage-900 text-xl">Connect to Canvas LMS</CardTitle>
                          <CardDescription className="text-sage-600">
                            Link your Canvas account to unlock your personalized academic dashboard
                          </CardDescription>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setShowCanvasSetup(true)}
                        className="bg-sage-600 hover:bg-sage-700 text-white px-6 py-3 w-full md:w-auto"
                        size="lg"
                      >
                        Get Started
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-3 text-sage-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm">Sync courses & assignments</span>
                      </div>
                      <div className="flex items-center space-x-3 text-sage-600">
                        <Shield className="w-5 h-5" />
                        <span className="text-sm">Secure & encrypted</span>
                      </div>
                      <div className="flex items-center space-x-3 text-sage-600">
                        <Zap className="w-5 h-5" />
                        <span className="text-sm">Real-time updates</span>
                      </div>
                      <div className="flex items-center space-x-3 text-sage-600">
                        <Brain className="w-5 h-5" />
                        <span className="text-sm">AI-powered insights</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Dashboard Content */}
          <AnimatePresence>
            {canvasConnected && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-6"
              >
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-700">Study Courses</p>
                            <p className="text-xl md:text-2xl font-bold text-blue-900">
                              {isDashboardLoading ? '-' : (dashboardData?.stats?.total_courses || 0)}
                            </p>
                          </div>
                          <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-amber-700">Due Soon</p>
                            <p className="text-xl md:text-2xl font-bold text-amber-900">
                              {isDashboardLoading ? '-' : (dashboardData?.stats?.due_soon || 0)}
                            </p>
                          </div>
                          <Clock className="h-6 w-6 md:h-8 md:w-8 text-amber-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-700">Completed</p>
                            <p className="text-xl md:text-2xl font-bold text-green-900">
                              {isDashboardLoading ? '-' : (dashboardData?.stats?.completed_this_week || 0)}
                            </p>
                          </div>
                          <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-purple-700">Average Grade</p>
                            <p className="text-xl md:text-2xl font-bold text-purple-900">
                              {isDashboardLoading ? '-' : (dashboardData?.stats?.average_grade ? `${dashboardData.stats.average_grade.toFixed(1)}%` : '0%')}
                            </p>
                          </div>
                          <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-purple-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Overview Content */}
                {selectedView === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Upcoming Tasks */}
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sage-900">Upcoming Tasks</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => navigateToPage('/dashboard/assignments')}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View All
                            </Button>
                          </div>
                          <CardDescription>Next 5 assignments due within 7 days</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {isDashboardLoading ? (
                            <div className="text-center py-8 text-sage-600">
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
                            <div className="text-center py-8 text-sage-600">
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
                            <CardTitle className="text-sage-900">Grade Progress</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => navigateToPage('/dashboard/grades')}>
                              <BarChart3 className="w-4 h-4 mr-2" />
                              Analytics
                            </Button>
                          </div>
                          <CardDescription>Current performance by course</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {isDashboardLoading ? (
                            <div className="text-center py-8 text-sage-600">
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
                            <div className="text-center py-8 text-sage-600">
                              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p>No grade data available</p>
                              <p className="text-sm text-slate-500">Sync with Canvas to see your grades</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Learning Analytics */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Learning Analytics</CardTitle>
                        <CardDescription>Visual insights into your academic performance</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <LearningAnalytics />
                      </CardContent>
                    </Card>
                  </div>
                )}
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

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg md:hidden z-50">
        <div className="grid grid-cols-4 h-16">
          <Button
            variant={selectedView === 'overview' ? 'default' : 'ghost'}
            className="h-full rounded-none flex-col"
            onClick={() => setSelectedView('overview')}
          >
            <Home className="h-4 w-4" />
            <span className="text-xs mt-1">Home</span>
          </Button>
          <Button
            variant="ghost"
            className="h-full rounded-none flex-col"
            onClick={() => navigateToPage('/dashboard/assignments')}
          >
            <BookOpen className="h-4 w-4" />
            <span className="text-xs mt-1">Tasks</span>
          </Button>
          <Button
            variant="ghost"
            className="h-full rounded-none flex-col"
            onClick={() => navigateToPage('/dashboard/grades')}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs mt-1">Grades</span>
          </Button>
          <Button
            variant="ghost"
            className="h-full rounded-none flex-col"
            onClick={() => navigateToPage('/dashboard/schedule')}
          >
            <Calendar className="h-4 w-4" />
            <span className="text-xs mt-1">Schedule</span>
          </Button>
        </div>
      </div>

      {/* Mobile Bottom Padding */}
      <div className="h-16 md:hidden"></div>
    </div>
  )
}
