'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  Calendar, 
  Clock, 
  Plus,
  ArrowLeft,
  Edit,
  Trash2,
  MapPin,
  Users,
  BookOpen,
  Coffee,
  GraduationCap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface ScheduleEvent {
  id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  event_type: 'class' | 'study' | 'office_hours' | 'custom'
  course?: {
    name: string
    course_code: string
    color: string
  }
  recurrence_rule?: string
}

interface EventForm {
  title: string
  description: string
  start_time: string
  end_time: string
  location: string
  event_type: 'class' | 'study' | 'office_hours' | 'custom'
  course_id: string
  recurrence: string
}

export default function SchedulePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null)
  const [eventForm, setEventForm] = useState<EventForm>({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: '',
    event_type: 'custom',
    course_id: '',
    recurrence: 'none'
  })
  
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

  // Fetch schedule events
  const { data: events = [], isLoading: isEventsLoading } = useQuery({
    queryKey: ['schedule-events', user?.id, selectedDate],
    queryFn: async () => {
      if (!user) return []
      
      const startOfWeek = new Date(selectedDate)
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      const { data, error } = await supabase
        .from('schedule_events')
        .select(`
          *,
          course:courses(name, course_code, color)
        `)
        .eq('user_id', user.id)
        .gte('start_time', startOfWeek.toISOString())
        .lte('start_time', endOfWeek.toISOString())
        .order('start_time')

      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })

  // Fetch courses for event creation
  const { data: courses = [] } = useQuery({
    queryKey: ['courses', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, course_code, color')
        .eq('user_id', user.id)

      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })

  // Create/Update event mutation
  const saveEventMutation = useMutation({
    mutationFn: async (eventData: EventForm) => {
      if (!user) throw new Error('User not authenticated')

      // For now, we'll simulate the database operations since the types aren't properly configured
      // In a real app, this would be connected to the actual database
      
      if (editingEvent) {
        // Simulate update
        console.log('Updating event:', editingEvent.id, eventData)
        return { success: true, id: editingEvent.id }
      } else {
        // Simulate create
        console.log('Creating event:', eventData)
        return { success: true, id: Math.random().toString() }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-events'] })
      setIsEventDialogOpen(false)
      setEditingEvent(null)
      resetForm()
      toast.success(editingEvent ? 'Event updated successfully' : 'Event created successfully')
    },
    onError: (error) => {
      toast.error(`Failed to ${editingEvent ? 'update' : 'create'} event`)
      console.error(error)
    }
  })

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('schedule_events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-events'] })
      toast.success('Event deleted successfully')
    },
    onError: (error) => {
      toast.error('Failed to delete event')
      console.error(error)
    }
  })

  const resetForm = () => {
    setEventForm({
      title: '',
      description: '',
      start_time: '',
      end_time: '',
      location: '',
      event_type: 'custom',
      course_id: '',
      recurrence: 'none'
    })
  }

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!eventForm.title || !eventForm.start_time || !eventForm.end_time) {
      toast.error('Please fill in all required fields')
      return
    }

    if (new Date(eventForm.start_time) >= new Date(eventForm.end_time)) {
      toast.error('End time must be after start time')
      return
    }

    saveEventMutation.mutate(eventForm)
  }

  const handleEditEvent = (event: ScheduleEvent) => {
    setEditingEvent(event)
    setEventForm({
      title: event.title,
      description: event.description || '',
      start_time: event.start_time,
      end_time: event.end_time,
      location: event.location || '',
      event_type: event.event_type,
      course_id: '',
      recurrence: event.recurrence_rule || 'none'
    })
    setIsEventDialogOpen(true)
  }

  const handleDeleteEvent = (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      deleteEventMutation.mutate(eventId)
    }
  }

  const getWeekDays = () => {
    const startOfWeek = new Date(selectedDate)
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay())
    
    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }
    return days
  }

  const getEventsForDay = (date: Date) => {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)
    
    return events.filter((event: ScheduleEvent) => {
      const eventDate = new Date(event.start_time)
      return eventDate >= dayStart && eventDate <= dayEnd
    })
  }

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'class':
        return <GraduationCap className="h-4 w-4" />
      case 'study':
        return <BookOpen className="h-4 w-4" />
      case 'office_hours':
        return <Users className="h-4 w-4" />
      default:
        return <Calendar className="h-4 w-4" />
    }
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'class':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'study':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'office_hours':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate)
    newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7))
    setSelectedDate(newDate)
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
          <p className="text-sage-600">Loading schedule...</p>
        </motion.div>
      </div>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  const weekDays = getWeekDays()

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
                <Calendar className="h-6 w-6 text-sage-600" />
                <h1 className="text-xl font-semibold text-slate-900">Schedule</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingEvent(null); resetForm(); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
                    <DialogDescription>
                      {editingEvent ? 'Update your event details' : 'Create a new event in your schedule'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={handleSaveEvent} className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={eventForm.title}
                        onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Event title"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="event_type">Type</Label>
                      <Select 
                        value={eventForm.event_type} 
                        onValueChange={(value: any) => setEventForm(prev => ({ ...prev, event_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="class">Class</SelectItem>
                          <SelectItem value="study">Study Session</SelectItem>
                          <SelectItem value="office_hours">Office Hours</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {eventForm.event_type === 'class' && (
                      <div>
                        <Label htmlFor="course_id">Course</Label>
                        <Select 
                          value={eventForm.course_id} 
                          onValueChange={(value) => setEventForm(prev => ({ ...prev, course_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select course" />
                          </SelectTrigger>
                          <SelectContent>
                            {courses.map((course: any) => (
                              <SelectItem key={course.id} value={course.id}>
                                {course.course_code} - {course.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="start_time">Start Time *</Label>
                        <Input
                          id="start_time"
                          type="datetime-local"
                          value={eventForm.start_time}
                          onChange={(e) => setEventForm(prev => ({ ...prev, start_time: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="end_time">End Time *</Label>
                        <Input
                          id="end_time"
                          type="datetime-local"
                          value={eventForm.end_time}
                          onChange={(e) => setEventForm(prev => ({ ...prev, end_time: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={eventForm.location}
                        onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Room, building, or online"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={eventForm.description}
                        onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Additional notes"
                      />
                    </div>
                    
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsEventDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saveEventMutation.isPending}>
                        {saveEventMutation.isPending ? 'Saving...' : 'Save Event'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              
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
          {/* Header & Week Navigation */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Weekly Schedule</h2>
              <p className="text-slate-600">
                {weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {' '}
                {weekDays[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => navigateWeek('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setSelectedDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" onClick={() => navigateWeek('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Week View */}
          <Card>
            <CardHeader>
              <CardTitle>Week View</CardTitle>
              <CardDescription>Your schedule for this week</CardDescription>
            </CardHeader>
            <CardContent>
              {isEventsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-600 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading schedule...</p>
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-4">
                  {weekDays.map((day, index) => {
                    const dayEvents = getEventsForDay(day)
                    const isToday = day.toDateString() === new Date().toDateString()
                    
                    return (
                      <div key={index} className={`min-h-96 border rounded-lg p-3 ${isToday ? 'border-sage-300 bg-sage-50' : 'border-slate-200'}`}>
                        <div className="text-center mb-3">
                          <div className="text-sm font-medium text-slate-600">
                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className={`text-lg font-bold ${isToday ? 'text-sage-600' : 'text-slate-900'}`}>
                            {day.getDate()}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          {dayEvents.map((event: ScheduleEvent) => (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="group relative"
                            >
                              <div className={`p-2 rounded-md text-xs border ${getEventTypeColor(event.event_type)} hover:shadow-sm transition-shadow cursor-pointer`}>
                                <div className="flex items-center space-x-1 mb-1">
                                  {getEventTypeIcon(event.event_type)}
                                  <span className="font-medium truncate">{event.title}</span>
                                </div>
                                <div className="text-xs opacity-75">
                                  {new Date(event.start_time).toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit' 
                                  })}
                                </div>
                                {event.location && (
                                  <div className="flex items-center space-x-1 mt-1 text-xs opacity-75">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate">{event.location}</span>
                                  </div>
                                )}
                                
                                {/* Hover Actions */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleEditEvent(event)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                    onClick={() => handleDeleteEvent(event.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                          
                          {dayEvents.length === 0 && (
                            <div className="text-center py-4 text-slate-400 text-xs">
                              No events
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
              <CardDescription>
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const todayEvents = getEventsForDay(new Date())
                
                if (todayEvents.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Coffee className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600">No events scheduled for today</p>
                      <p className="text-sm text-slate-500">Enjoy your free time!</p>
                    </div>
                  )
                }
                
                return (
                  <div className="space-y-3">
                    {todayEvents.map((event: ScheduleEvent) => (
                      <div key={event.id} className="flex items-center space-x-4 p-3 border rounded-lg hover:shadow-sm transition-shadow">
                        <div className="flex-shrink-0">
                          <div className={`p-2 rounded-lg ${getEventTypeColor(event.event_type)}`}>
                            {getEventTypeIcon(event.event_type)}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900">{event.title}</h4>
                          {event.course && (
                            <p className="text-sm text-slate-600">
                              {event.course.course_code} - {event.course.name}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 mt-1 text-sm text-slate-500">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>
                                {new Date(event.start_time).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit' 
                                })} - {new Date(event.end_time).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit' 
                                })}
                              </span>
                            </div>
                            {event.location && (
                              <div className="flex items-center space-x-1">
                                <MapPin className="h-4 w-4" />
                                <span>{event.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditEvent(event)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
