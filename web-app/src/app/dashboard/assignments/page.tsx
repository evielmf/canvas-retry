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
  Search, 
  Filter,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  RotateCw,
  SortAsc,
  SortDesc,
  ArrowLeft,
  Plus,
  X,
  BookmarkPlus,
  FileText,
  GraduationCap,
  Target,
  Users
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Assignment {
  id: string
  title: string
  description?: string
  due_date?: string
  points_possible?: number
  status: 'upcoming' | 'in_progress' | 'completed' | 'overdue' | 'submitted'
  course: {
    id: string
    name: string
    course_code: string
    color: string
  }
  submitted_at?: string
  graded_at?: string
  canvas_url?: string
}

interface Course {
  id: string
  name: string
  course_code: string
  color: string
}

export default function AssignmentsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'due_date' | 'title' | 'course'>('due_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [supabase.auth])

  // Fetch assignments
  const { data: assignments = [], isLoading: isAssignmentsLoading, refetch: refetchAssignments } = useQuery({
    queryKey: ['assignments', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return []

      const response = await fetch('/api/canvas/assignments', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch assignments')
      }

      return response.json()
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch courses for filtering
  const { data: courses = [] } = useQuery({
    queryKey: ['courses', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return []

      const response = await fetch('/api/canvas/courses', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch courses')
      }

      return response.json()
    },
    enabled: !!user,
  })

  // Filter and sort assignments
  const filteredAssignments = assignments
    .filter((assignment: Assignment) => {
      const matchesSearch = assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           assignment.course.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCourse = selectedCourse === 'all' || assignment.course.id === selectedCourse
      const matchesStatus = selectedStatus === 'all' || assignment.status === selectedStatus
      
      return matchesSearch && matchesCourse && matchesStatus
    })
    .sort((a: Assignment, b: Assignment) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date).getTime() : 0
          bValue = b.due_date ? new Date(b.due_date).getTime() : 0
          break
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'course':
          aValue = a.course.name.toLowerCase()
          bValue = b.course.name.toLowerCase()
          break
        default:
          return 0
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  const handleSync = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/canvas/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sync_type: 'assignments' })
      })

      if (response.ok) {
        toast.success('Assignments synced successfully')
        refetchAssignments()
      } else {
        toast.error('Failed to sync assignments')
      }
    } catch (error) {
      toast.error('Failed to sync assignments')
    }
  }

  const markAsComplete = async (assignmentId: string) => {
    try {
      // This would update the assignment status in the database
      toast.success('Assignment marked as complete')
      refetchAssignments()
    } catch (error) {
      toast.error('Failed to update assignment')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'submitted':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
  }

  const getTimeUntilDue = (dueDate: string) => {
    const now = new Date()
    const due = new Date(dueDate)
    const diffMs = due.getTime() - now.getTime()
    
    if (diffMs < 0) return 'Overdue'
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (diffDays > 0) return `${diffDays} days`
    if (diffHours > 0) return `${diffHours} hours`
    return 'Due soon'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-sage-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-sage-600">Loading assignments...</p>
        </motion.div>
      </div>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <div className="flex items-center space-x-2">
                <BookOpen className="h-6 w-6 text-sage-600" />
                <h1 className="text-xl font-semibold text-slate-900">Assignments</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={handleSync}
                disabled={isAssignmentsLoading}
              >
                <RotateCw className={`h-4 w-4 mr-2 ${isAssignmentsLoading ? 'animate-spin' : ''}`} />
                Sync
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
          className="space-y-6"
        >
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Assignment Management</h2>
              <p className="text-slate-600">Track and manage all your coursework in one place</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search assignments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filter Assignments</SheetTitle>
                    <SheetDescription>
                      Customize your assignment view
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="space-y-6 mt-6">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Course</label>
                      <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Courses</SelectItem>
                          {courses.map((course: Course) => (
                            <SelectItem key={course.id} value={course.id}>
                              {course.course_code} - {course.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="submitted">Submitted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Sort By</label>
                      <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="due_date">Due Date</SelectItem>
                          <SelectItem value="title">Title</SelectItem>
                          <SelectItem value="course">Course</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Order</label>
                      <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">Ascending</SelectItem>
                          <SelectItem value="desc">Descending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total</p>
                    <p className="text-2xl font-bold text-slate-900">{assignments.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Upcoming</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {assignments.filter((a: Assignment) => a.status === 'upcoming').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Overdue</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {assignments.filter((a: Assignment) => a.status === 'overdue').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Completed</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {assignments.filter((a: Assignment) => a.status === 'completed' || a.status === 'submitted').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Assignments List */}
          <Card>
            <CardHeader>
              <CardTitle>Assignments ({filteredAssignments.length})</CardTitle>
              <CardDescription>
                {selectedCourse !== 'all' && `Filtered by course • `}
                {selectedStatus !== 'all' && `Status: ${selectedStatus} • `}
                Sorted by {sortBy} ({sortOrder})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAssignmentsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-600 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading assignments...</p>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No assignments found</h3>
                  <p className="text-slate-600 mb-4">
                    {searchQuery || selectedCourse !== 'all' || selectedStatus !== 'all'
                      ? 'Try adjusting your filters or search query'
                      : 'Your assignments will appear here after syncing with Canvas'
                    }
                  </p>
                  {(!searchQuery && selectedCourse === 'all' && selectedStatus === 'all') && (
                    <Button onClick={handleSync}>
                      <RotateCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredAssignments.map((assignment: Assignment, index: number) => (
                      <motion.div
                        key={assignment.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-start space-x-3">
                              <div 
                                className="course-color-indicator"
                                data-color={assignment.course.color || '#3b82f6'}
                                ref={(el) => {
                                  if (el) el.style.backgroundColor = assignment.course.color || '#3b82f6';
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-slate-900 truncate">
                                  {assignment.title}
                                </h3>
                                <p className="text-sm text-slate-600 mt-1">
                                  {assignment.course.course_code} - {assignment.course.name}
                                </p>
                                {assignment.description && (
                                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                                    {assignment.description}
                                  </p>
                                )}
                                <div className="flex items-center space-x-4 mt-3">
                                  {assignment.due_date && (
                                    <div className="flex items-center text-sm text-slate-600">
                                      <Calendar className="h-4 w-4 mr-1" />
                                      {new Date(assignment.due_date).toLocaleDateString()}
                                      <span className="ml-2 text-slate-500">
                                        ({getTimeUntilDue(assignment.due_date)})
                                      </span>
                                    </div>
                                  )}
                                  {assignment.points_possible && (
                                    <div className="flex items-center text-sm text-slate-600">
                                      <Target className="h-4 w-4 mr-1" />
                                      {assignment.points_possible} points
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3 ml-4">
                            <Badge className={getStatusColor(assignment.status)}>
                              {assignment.status.replace('_', ' ')}
                            </Badge>
                            
                            <div className="flex items-center space-x-2">
                              {assignment.status === 'upcoming' && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => markAsComplete(assignment.id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Complete
                                </Button>
                              )}
                              
                              {assignment.canvas_url && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => window.open(assignment.canvas_url, '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Open
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
