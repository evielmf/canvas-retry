'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  ArrowLeft,
  Target,
  Award,
  Calendar,
  BookOpen,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { LearningAnalytics } from '@/components/charts/learning-analytics'

interface Grade {
  id: string
  assignment: {
    title: string
    points_possible: number
    due_date: string
  }
  course: {
    name: string
    course_code: string
    color: string
  }
  score: number
  grade: string
  graded_at: string
}

interface CourseGrade {
  course_id: string
  course_name: string
  course_code: string
  current_score: number
  final_score: number
  total_points: number
  earned_points: number
  letter_grade: string
  color: string
}

export default function GradesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('semester')
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [supabase.auth])

  // Fetch grades
  const { data: grades = [], isLoading: isGradesLoading, refetch: refetchGrades } = useQuery({
    queryKey: ['grades', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return []

      const response = await fetch('/api/canvas/grades', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch grades')
      }

      return response.json()
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch course grades summary
  const { data: courseGrades = [] } = useQuery({
    queryKey: ['course-grades', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return []

      const response = await fetch('/api/canvas/course-grades', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch course grades')
      }

      return response.json()
    },
    enabled: !!user,
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
        body: JSON.stringify({ sync_type: 'grades' })
      })

      if (response.ok) {
        toast.success('Grades synced successfully')
        refetchGrades()
      } else {
        toast.error('Failed to sync grades')
      }
    } catch (error) {
      toast.error('Failed to sync grades')
    }
  }

  const calculateOverallGPA = () => {
    if (courseGrades.length === 0) return 0
    
    const totalGradePoints = courseGrades.reduce((sum: number, course: CourseGrade) => {
      const gradePoint = convertToGradePoint(course.letter_grade)
      return sum + gradePoint
    }, 0)
    
    return (totalGradePoints / courseGrades.length).toFixed(2)
  }

  const convertToGradePoint = (letterGrade: string): number => {
    const gradeMap: { [key: string]: number } = {
      'A+': 4.0, 'A': 4.0, 'A-': 3.7,
      'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7,
      'D+': 1.3, 'D': 1.0, 'F': 0.0
    }
    return gradeMap[letterGrade] || 0
  }

  const getGradeColor = (score: number): string => {
    if (score >= 90) return 'text-green-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-yellow-600'
    if (score >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const getLetterGrade = (score: number): string => {
    if (score >= 97) return 'A+'
    if (score >= 93) return 'A'
    if (score >= 90) return 'A-'
    if (score >= 87) return 'B+'
    if (score >= 83) return 'B'
    if (score >= 80) return 'B-'
    if (score >= 77) return 'C+'
    if (score >= 73) return 'C'
    if (score >= 70) return 'C-'
    if (score >= 67) return 'D+'
    if (score >= 60) return 'D'
    return 'F'
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
          <p className="text-sage-600">Loading grades...</p>
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
                <BarChart3 className="h-6 w-6 text-sage-600" />
                <h1 className="text-xl font-semibold text-slate-900">Grades & Analytics</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={handleSync}
                disabled={isGradesLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isGradesLoading ? 'animate-spin' : ''}`} />
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
          className="space-y-8"
        >
          {/* Header */}
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Academic Performance</h2>
            <p className="text-slate-600">Track your grades and analyze your learning progress</p>
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700">Overall GPA</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-900">{calculateOverallGPA()}</div>
                  <p className="text-xs text-blue-600 mt-1">This semester</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-700">Courses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-900">{courseGrades.length}</div>
                  <p className="text-xs text-green-600 mt-1">Currently enrolled</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-purple-700">Assignments Graded</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-900">{grades.length}</div>
                  <p className="text-xs text-purple-600 mt-1">Total this semester</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700">Average Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-900">
                    {grades.length > 0 
                      ? (grades.reduce((sum: number, grade: Grade) => sum + grade.score, 0) / grades.length).toFixed(1)
                      : '0'
                    }%
                  </div>
                  <p className="text-xs text-orange-600 mt-1">Across all assignments</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="courses">By Course</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="recent">Recent Grades</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Course Grades Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Course Grades Summary</CardTitle>
                    <CardDescription>Current standings in each course</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {courseGrades.length === 0 ? (
                      <div className="text-center py-8">
                        <BookOpen className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600">No course grades available</p>
                        <Button onClick={handleSync} className="mt-4">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync Grades
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {courseGrades.map((course: CourseGrade) => (
                          <div key={course.course_id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center space-x-3">
                              <div 
                                className="w-3 h-3 rounded-full bg-blue-500"
                              />
                              <div>
                                <h4 className="font-medium text-slate-900">
                                  {course.course_code}
                                </h4>
                                <p className="text-sm text-slate-600">{course.course_name}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${getGradeColor(course.current_score)}`}>
                                {course.current_score.toFixed(1)}%
                              </div>
                              <Badge variant="outline">{course.letter_grade}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Grade Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Grade Distribution</CardTitle>
                    <CardDescription>Breakdown of your letter grades</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['A', 'B', 'C', 'D', 'F'].map((letter) => {
                        const count = courseGrades.filter((course: CourseGrade) => 
                          course.letter_grade.startsWith(letter)
                        ).length
                        const percentage = courseGrades.length > 0 ? (count / courseGrades.length) * 100 : 0
                        
                        return (
                          <div key={letter} className="flex items-center space-x-3">
                            <div className="w-8 text-sm font-medium">{letter}</div>
                            <div className="flex-1 bg-slate-200 rounded-full h-2">
                              <div 
                                className={`grade-distribution-bar ${
                                  letter === 'A' ? 'bg-green-500' :
                                  letter === 'B' ? 'bg-blue-500' :
                                  letter === 'C' ? 'bg-yellow-500' :
                                  letter === 'D' ? 'bg-orange-500' : 'bg-red-500'
                                }`}
                                ref={(el) => {
                                  if (el) el.style.width = `${percentage}%`;
                                }}
                              />
                            </div>
                            <div className="w-12 text-sm text-slate-600">{count}</div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Courses Tab */}
            <TabsContent value="courses" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Course Performance</CardTitle>
                      <CardDescription>Detailed breakdown by course</CardDescription>
                    </div>
                    <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Courses</SelectItem>
                        {courseGrades.map((course: CourseGrade) => (
                          <SelectItem key={course.course_id} value={course.course_id}>
                            {course.course_code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {courseGrades
                      .filter((course: CourseGrade) => selectedCourse === 'all' || course.course_id === selectedCourse)
                      .map((course: CourseGrade) => (
                        <Card key={course.course_id} className="hover:shadow-lg transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full bg-blue-500" />
                              <CardTitle className="text-lg">{course.course_code}</CardTitle>
                            </div>
                            <CardDescription className="text-sm">{course.course_name}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-600">Current Grade</span>
                              <span className={`text-lg font-bold ${getGradeColor(course.current_score)}`}>
                                {course.current_score.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-600">Letter Grade</span>
                              <Badge variant="outline">{course.letter_grade}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-600">Points</span>
                              <span className="text-sm font-medium">
                                {course.earned_points.toFixed(1)} / {course.total_points.toFixed(1)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Learning Analytics</CardTitle>
                  <CardDescription>Visual insights into your academic performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <LearningAnalytics />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recent Grades Tab */}
            <TabsContent value="recent" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Grades</CardTitle>
                      <CardDescription>Latest assignment grades and feedback</CardDescription>
                    </div>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {grades.length === 0 ? (
                    <div className="text-center py-8">
                      <Award className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600">No grades available</p>
                      <Button onClick={handleSync} className="mt-4">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Grades
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {grades
                        .sort((a: Grade, b: Grade) => new Date(b.graded_at).getTime() - new Date(a.graded_at).getTime())
                        .slice(0, 10)
                        .map((grade: Grade) => (
                          <div key={grade.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow">
                            <div className="flex items-center space-x-4">
                              <div className="w-3 h-3 rounded-full bg-blue-500" />
                              <div>
                                <h4 className="font-medium text-slate-900">{grade.assignment.title}</h4>
                                <p className="text-sm text-slate-600">
                                  {grade.course.course_code} - {grade.course.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Graded {new Date(grade.graded_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${getGradeColor((grade.score / grade.assignment.points_possible) * 100)}`}>
                                {grade.score} / {grade.assignment.points_possible}
                              </div>
                              <div className="text-sm text-slate-600">
                                {((grade.score / grade.assignment.points_possible) * 100).toFixed(1)}%
                              </div>
                              <Badge variant="outline" className="mt-1">
                                {getLetterGrade((grade.score / grade.assignment.points_possible) * 100)}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  )
}
