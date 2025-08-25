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
  Star
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
import { DashboardData, AssignmentWithDetails, NotificationWithDetails, GradeWithDetails } from '@/lib/types/database'

export default function EaseboardDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTab, setSelectedTab] = useState('overview')
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const dataService = new DataService()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [supabase.auth])

  // Dashboard data query
  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: () => user ? dataService.getDashboardData(user.id) : null,
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })

  // Search assignments query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['search', user?.id, searchQuery],
    queryFn: () => user && searchQuery ? dataService.searchAssignments(user.id, searchQuery) : [],
    enabled: !!user?.id && searchQuery.length > 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out successfully')
    router.push('/')
    router.refresh()
  }

  const handleSync = async () => {
    toast.info('Syncing Canvas data...')
    // Trigger sync and refresh dashboard data
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    toast.success('Sync completed!')
  }

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await dataService.markNotificationAsRead(notificationId)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Notification marked as read')
    } catch (error) {
      toast.error('Failed to update notification')
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there'
    
    if (hour < 12) return `Good morning, ${name}! ☀️`
    if (hour < 17) return `Good afternoon, ${name}! 🌤️`
    return `Good evening, ${name}! 🌙`
  }

  const getUpcomingDeadlines = (assignments: AssignmentWithDetails[] = []) => {
    return assignments
      .filter(a => a.due_date && new Date(a.due_date) > new Date())
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 5)
  }

  const getOverdueAssignments = (assignments: AssignmentWithDetails[] = []) => {
    return assignments.filter(a => a.status === 'overdue')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div 
              className="flex items-center space-x-2"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Easeboard
              </span>
            </motion.div>
            
            <div className="flex items-center space-x-4">
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

              {/* Sync Button */}
              <Button variant="ghost" size="icon" onClick={handleSync}>
                <RotateCw className="h-5 w-5" />
              </Button>

              {/* Notifications */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {(dashboardData?.notifications?.length ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {dashboardData?.notifications?.length ?? 0}
                      </span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Notifications</DialogTitle>
                    <DialogDescription>Stay updated with your latest activities</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {(dashboardData?.notifications?.length ?? 0) > 0 ? (
                      dashboardData?.notifications?.map((notification) => (
                        <div key={notification.id} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
                          <Bell className="h-4 w-4 text-blue-600 mt-1" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{notification.title}</p>
                            <p className="text-sm text-slate-600">{notification.message}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMarkNotificationRead(notification.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-center py-4">No new notifications</p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {/* Settings */}
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>

              {/* Sign out */}
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>

              {/* Avatar */}
              <Avatar>
                <AvatarImage src={user.user_metadata.avatar_url} />
                <AvatarFallback>
                  {user.user_metadata.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </nav>

      {/* Search Results */}
      <AnimatePresence>
        {searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border-b border-slate-200 shadow-sm"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center space-x-2 mb-3">
                <Search className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-600">
                  {isSearching ? 'Searching...' : `Results for "${searchQuery}"`}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(searchResults as AssignmentWithDetails[] || []).map((assignment) => (
                  <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{assignment.title}</h4>
                          <p className="text-sm text-slate-600">{assignment.course?.name}</p>
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
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-8">
            <motion.h1 
              className="text-3xl font-bold mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {getGreeting()}
            </motion.h1>
            <motion.p 
              className="text-blue-100 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Welcome to your personalized learning dashboard
            </motion.p>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-6 w-6" />
                  <div>
                    <p className="text-sm opacity-90">Total Courses</p>
                    <p className="text-xl font-bold">{dashboardData?.stats?.total_courses || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-6 w-6" />
                  <div>
                    <p className="text-sm opacity-90">Upcoming</p>
                    <p className="text-xl font-bold">{dashboardData?.stats?.upcoming_assignments || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-6 w-6" />
                  <div>
                    <p className="text-sm opacity-90">Completed</p>
                    <p className="text-xl font-bold">{dashboardData?.stats?.completed_assignments || 0}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-6 w-6" />
                  <div>
                    <p className="text-sm opacity-90">Avg Score</p>
                    <p className="text-xl font-bold">{Math.round(dashboardData?.stats?.average_score || 0)}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="grades">Grades</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Deadlines */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-orange-600" />
                      <span>Upcoming Deadlines</span>
                    </CardTitle>
                    <CardDescription>Next 7 days</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {getUpcomingDeadlines(dashboardData?.upcoming_assignments).map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium">{assignment.title}</p>
                          <p className="text-sm text-slate-600">{assignment.course?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {assignment.due_date && new Date(assignment.due_date).toLocaleDateString()}
                          </p>
                          <Badge variant="outline">
                            {assignment.time_until_due ? `${Math.floor(assignment.time_until_due / (24 * 60))}d` : 'Soon'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {getUpcomingDeadlines(dashboardData?.upcoming_assignments).length === 0 && (
                      <p className="text-slate-500 text-center py-4">No upcoming deadlines</p>
                    )}
                  </CardContent>
                </Card>

                {/* Overdue Assignments */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span>Needs Attention</span>
                    </CardTitle>
                    <CardDescription>Overdue assignments</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {getOverdueAssignments(dashboardData?.upcoming_assignments).map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div>
                          <p className="font-medium text-red-900">{assignment.title}</p>
                          <p className="text-sm text-red-700">{assignment.course?.name}</p>
                        </div>
                        <Badge variant="destructive">Overdue</Badge>
                      </div>
                    ))}
                    {getOverdueAssignments(dashboardData?.upcoming_assignments).length === 0 && (
                      <div className="text-center py-4">
                        <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <p className="text-green-600 font-medium">All caught up!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest progress and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardData?.recent_grades?.slice(0, 5).map((grade) => (
                      <div key={grade.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                            <Star className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">New grade received</p>
                            <p className="text-sm text-slate-600">
                              {grade.assignment?.title} - {grade.course?.name}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {grade.score ? `${Math.round(grade.score)}%` : grade.grade}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assignments" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Assignments</h2>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Assignment
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboardData?.upcoming_assignments?.map((assignment) => (
                  <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{assignment.title}</CardTitle>
                        <Badge variant={assignment.status === 'overdue' ? 'destructive' : 'secondary'}>
                          {assignment.status}
                        </Badge>
                      </div>
                      <CardDescription>{assignment.course?.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {assignment.due_date && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600 mb-3">
                          <Clock className="h-4 w-4" />
                          <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {assignment.points_possible && (
                        <div className="flex items-center space-x-2 text-sm text-slate-600 mb-3">
                          <TrendingUp className="h-4 w-4" />
                          <span>{assignment.points_possible} points</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        {assignment.status === 'upcoming' && (
                          <Button size="sm">
                            Start Work
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">Learning Analytics</h2>
                <p className="text-muted-foreground">
                  Track your progress and identify areas for improvement
                </p>
              </div>
              <LearningAnalytics />
            </TabsContent>

            <TabsContent value="grades" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Grades</h2>
                <Button variant="outline">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  GPA Calculator
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Grades</CardTitle>
                    <CardDescription>Your latest graded assignments</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {dashboardData?.recent_grades?.slice(0, 8).map((grade) => (
                      <div key={grade.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium">{grade.assignment?.title}</p>
                          <p className="text-sm text-slate-600">{grade.course?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {grade.score ? `${Math.round(grade.score)}%` : grade.grade}
                          </p>
                          {grade.graded_at && (
                            <p className="text-xs text-slate-500">
                              {new Date(grade.graded_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Grade Distribution</CardTitle>
                    <CardDescription>How you&apos;re performing across courses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Grade distribution visualization would go here */}
                      <div className="text-center py-8 text-slate-500">
                        Grade distribution chart coming soon
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Schedule</h2>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Event
                </Button>
              </div>

              <Card>
                <CardContent className="p-6">
                  <div className="text-center py-12 text-slate-500">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Schedule feature coming soon</p>
                    <p>Manage your classes, study sessions, and events</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  )
}
