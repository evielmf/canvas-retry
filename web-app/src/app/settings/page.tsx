'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  Settings, 
  User as UserIcon, 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  Database,
  Plus,
  Trash2,
  Edit,
  Key,
  ExternalLink,
  Moon,
  Sun,
  Monitor
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

import { DataService } from '@/lib/services/data-service'
import { CanvasTokenManager } from '@/lib/services/canvas-service'
import { Profile, CanvasConnection, CanvasConnectionForm } from '@/lib/types/database'

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [canvasDialogOpen, setCanvasDialogOpen] = useState(false)
  const [canvasForm, setCanvasForm] = useState<CanvasConnectionForm>({
    canvas_url: '',
    canvas_name: '',
    access_token: ''
  })
  
  const router = useRouter()
  const { theme, setTheme } = useTheme()
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

  // Profile query
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => user ? dataService.getProfile(user.id) : null,
    enabled: !!user?.id,
  })

  // Canvas connections query
  const { data: canvasConnections, isLoading: isConnectionsLoading } = useQuery({
    queryKey: ['canvas-connections', user?.id],
    queryFn: () => user ? dataService.getCanvasConnections(user.id) : [],
    enabled: !!user?.id,
  })

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: (updates: Partial<Profile>) => dataService.updateProfile(user!.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Profile updated successfully')
    },
    onError: (error) => {
      toast.error('Failed to update profile')
      console.error('Profile update error:', error || 'Unknown error occurred')
    }
  })

  // Canvas connection mutation
  const addCanvasConnectionMutation = useMutation({
    mutationFn: async (form: CanvasConnectionForm) => {
      const salt = CanvasTokenManager.generateSalt()
      const encryptedToken = CanvasTokenManager.encryptToken(form.access_token, salt)
      
      return dataService.addCanvasConnection({
        user_id: user!.id,
        canvas_url: form.canvas_url,
        canvas_name: form.canvas_name,
        encrypted_token: encryptedToken,
        token_salt: salt,
        status: 'connected',
        last_sync: null
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-connections'] })
      setCanvasDialogOpen(false)
      setCanvasForm({ canvas_url: '', canvas_name: '', access_token: '' })
      toast.success('Canvas connection added successfully')
    },
    onError: (error) => {
      toast.error('Failed to add Canvas connection')
      console.error('Canvas connection error:', error || 'Unknown error occurred')
    }
  })

  // Remove connection mutation
  const removeConnectionMutation = useMutation({
    mutationFn: (connectionId: string) => dataService.removeCanvasConnection(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-connections'] })
      toast.success('Canvas connection removed')
    },
    onError: (error) => {
      toast.error('Failed to remove connection')
      console.error('Canvas connection removal error:', error || 'Unknown error occurred')
    }
  })

  const handleProfileUpdate = (field: keyof Profile, value: string | boolean | object) => {
    updateProfileMutation.mutate({ [field]: value })
  }

  const handleCanvasSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canvasForm.canvas_url || !canvasForm.canvas_name || !canvasForm.access_token) {
      toast.error('Please fill in all fields')
      return
    }
    addCanvasConnectionMutation.mutate(canvasForm)
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
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => router.back()}>
                ← Back
              </Button>
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>
            <Avatar>
              <AvatarImage src={user.user_metadata.avatar_url} />
              <AvatarFallback>
                {user.user_metadata.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="profile">
                <UserIcon className="h-4 w-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="canvas">
                <Database className="h-4 w-4 mr-2" />
                Canvas
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="appearance">
                <Palette className="h-4 w-4 mr-2" />
                Appearance
              </TabsTrigger>
              <TabsTrigger value="privacy">
                <Shield className="h-4 w-4 mr-2" />
                Privacy
              </TabsTrigger>
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-6">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={user.user_metadata.avatar_url} />
                      <AvatarFallback className="text-xl">
                        {user.user_metadata.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="full_name">Full Name</Label>
                          <Input
                            id="full_name"
                            value={profile?.full_name || ''}
                            onChange={(e) => handleProfileUpdate('full_name', e.target.value)}
                            placeholder="Enter your full name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            value={user.email || ''}
                            disabled
                            className="opacity-50"
                          />
                        </div>
                        <div>
                          <Label htmlFor="timezone">Timezone</Label>
                          <Select
                            value={profile?.timezone || 'UTC'}
                            onValueChange={(value: string) => handleProfileUpdate('timezone', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UTC">UTC</SelectItem>
                              <SelectItem value="America/New_York">Eastern Time</SelectItem>
                              <SelectItem value="America/Chicago">Central Time</SelectItem>
                              <SelectItem value="America/Denver">Mountain Time</SelectItem>
                              <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium mb-4">Account Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Member since</p>
                        <p className="font-medium">
                          {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">Last sign in</p>
                        <p className="font-medium">
                          {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-600">User ID</p>
                        <p className="font-mono text-xs">{user.id}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Email verified</p>
                        <Badge variant={user.email_confirmed_at ? 'default' : 'secondary'}>
                          {user.email_confirmed_at ? 'Verified' : 'Unverified'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Canvas Settings */}
            <TabsContent value="canvas" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Canvas Connections</CardTitle>
                      <CardDescription>
                        Manage your Canvas LMS connections for data synchronization
                      </CardDescription>
                    </div>
                    <Dialog open={canvasDialogOpen} onOpenChange={setCanvasDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Connection
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Canvas Connection</DialogTitle>
                          <DialogDescription>
                            Connect your Canvas LMS account to sync courses, assignments, and grades
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCanvasSubmit} className="space-y-4">
                          <div>
                            <Label htmlFor="canvas_name">Connection Name</Label>
                            <Input
                              id="canvas_name"
                              value={canvasForm.canvas_name}
                              onChange={(e) => setCanvasForm(prev => ({ ...prev, canvas_name: e.target.value }))}
                              placeholder="e.g., University Canvas"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="canvas_url">Canvas URL</Label>
                            <Input
                              id="canvas_url"
                              value={canvasForm.canvas_url}
                              onChange={(e) => setCanvasForm(prev => ({ ...prev, canvas_url: e.target.value }))}
                              placeholder="https://yourschool.instructure.com"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="access_token">Access Token</Label>
                            <Input
                              id="access_token"
                              type="password"
                              value={canvasForm.access_token}
                              onChange={(e) => setCanvasForm(prev => ({ ...prev, access_token: e.target.value }))}
                              placeholder="Canvas API access token"
                              required
                            />
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCanvasDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={addCanvasConnectionMutation.isPending}>
                              {addCanvasConnectionMutation.isPending ? 'Connecting...' : 'Connect'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {canvasConnections?.map((connection) => (
                      <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Database className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">{connection.canvas_name}</h4>
                            <p className="text-sm text-slate-600">{connection.canvas_url}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant={connection.status === 'connected' ? 'default' : 'secondary'}>
                                {connection.status}
                              </Badge>
                              {connection.last_sync && (
                                <span className="text-xs text-slate-500">
                                  Last sync: {new Date(connection.last_sync).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeConnectionMutation.mutate(connection.id)}
                            disabled={removeConnectionMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(!canvasConnections || canvasConnections.length === 0) && (
                      <div className="text-center py-8 text-slate-500">
                        <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="font-medium">No Canvas connections</p>
                        <p className="text-sm">Add a connection to sync your Canvas data</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Settings */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Customize how and when you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Assignment Reminders</h4>
                        <p className="text-sm text-slate-600">Get notified about upcoming assignments</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Grade Updates</h4>
                        <p className="text-sm text-slate-600">Receive notifications when grades are posted</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Study Reminders</h4>
                        <p className="text-sm text-slate-600">Smart reminders to maintain study consistency</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Canvas Sync Updates</h4>
                        <p className="text-sm text-slate-600">Get notified when data is synced from Canvas</p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>
                    Customize the look and feel of your dashboard
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-base font-medium">Theme</Label>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <Button
                        variant={theme === 'light' ? 'default' : 'outline'}
                        onClick={() => setTheme('light')}
                        className="h-20 flex-col"
                      >
                        <Sun className="h-6 w-6 mb-2" />
                        Light
                      </Button>
                      <Button
                        variant={theme === 'dark' ? 'default' : 'outline'}
                        onClick={() => setTheme('dark')}
                        className="h-20 flex-col"
                      >
                        <Moon className="h-6 w-6 mb-2" />
                        Dark
                      </Button>
                      <Button
                        variant={theme === 'system' ? 'default' : 'outline'}
                        onClick={() => setTheme('system')}
                        className="h-20 flex-col"
                      >
                        <Monitor className="h-6 w-6 mb-2" />
                        System
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Settings */}
            <TabsContent value="privacy" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Privacy & Security</CardTitle>
                  <CardDescription>
                    Manage your data privacy and security settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Analytics Data Collection</h4>
                        <p className="text-sm text-slate-600">Help improve Easeboard with anonymous usage data</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Data Encryption</h4>
                        <p className="text-sm text-slate-600">All sensitive data is encrypted with AES-256</p>
                      </div>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium mb-4 text-red-600">Danger Zone</h3>
                    <div className="space-y-4">
                      <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account
                      </Button>
                      <p className="text-sm text-slate-600">
                        This action cannot be undone. All your data will be permanently deleted.
                      </p>
                    </div>
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
