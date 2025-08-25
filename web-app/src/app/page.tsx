'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { 
  BookOpen, 
  Users, 
  BarChart3, 
  Settings, 
  Bell,
  Search,
  ChevronRight,
  Play,
  Calendar,
  Trophy,
  Star,
  Brain,
  Zap,
  Shield,
  Smartphone
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LearningAnalytics } from '@/components/charts/learning-analytics'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      // Redirect authenticated users to Easeboard
      if (user) {
        router.push('/easeboard')
      }
    }
    getUser()
  }, [supabase.auth, router])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  }

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Insights",
      description: "Smart analytics that predict your academic performance and suggest optimal study strategies",
      color: "text-purple-600"
    },
    {
      icon: Zap,
      title: "Real-time Sync",
      description: "Automatic synchronization with Canvas every 2 hours, with smart conflict resolution",
      color: "text-blue-600"
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Beautiful charts and insights to track your learning progress and identify improvement areas",
      color: "text-green-600"
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "AES-256 encryption for Canvas tokens, RLS isolation, and GDPR-compliant data handling",
      color: "text-red-600"
    },
    {
      icon: Smartphone,
      title: "PWA Ready",
      description: "Install as a native app with offline support, push notifications, and background sync",
      color: "text-indigo-600"
    },
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "Intelligent calendar integration with study session planning and deadline management",
      color: "text-orange-600"
    }
  ]

  const techStack = [
    { name: "Next.js 15", description: "App Router with Turbopack", category: "Frontend" },
    { name: "TypeScript", description: "Type-safe development", category: "Frontend" },
    { name: "Tailwind CSS", description: "Utility-first styling", category: "Frontend" },
    { name: "shadcn/ui", description: "Beautiful components", category: "Frontend" },
    { name: "Framer Motion", description: "Smooth animations", category: "Frontend" },
    { name: "Recharts", description: "Data visualization", category: "Frontend" },
    { name: "Supabase", description: "Backend as a Service", category: "Backend" },
    { name: "PostgreSQL", description: "Relational database", category: "Backend" },
    { name: "Row Level Security", description: "Data isolation", category: "Backend" },
    { name: "React Query", description: "Data fetching", category: "Backend" },
    { name: "PWA", description: "Progressive Web App", category: "Features" },
    { name: "Service Workers", description: "Offline support", category: "Features" }
  ]

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
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
              <Button variant="ghost" onClick={() => router.push('/login')}>
                Sign In
              </Button>
              <Button onClick={() => router.push('/login')}>
                Get Started
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-16"
        >
          {/* Hero Section */}
          <motion.div variants={itemVariants} className="text-center py-12">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-8"
            >
              <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6">
                Welcome to Easeboard
              </h1>
              <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto mb-8 leading-relaxed">
                The next-generation Canvas LMS Dashboard with AI-powered insights, 
                smart analytics, and comprehensive learning management
              </p>
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 py-3"
                onClick={() => router.push('/login')}
              >
                Start Learning Today
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="text-lg px-8 py-3"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                Explore Features
              </Button>
            </motion.div>

            {/* Quick Demo */}
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="mt-16"
            >
              <Card className="max-w-4xl mx-auto">
                <CardContent className="p-0">
                  <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Play className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                      <p className="text-lg font-medium text-slate-700">Interactive Demo Coming Soon</p>
                      <p className="text-slate-500">See Easeboard in action</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Features Section */}
          <motion.section variants={itemVariants} id="features" className="py-16">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                Powerful Features for Modern Learning
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Everything you need to excel in your academic journey, powered by cutting-edge technology
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg">
                    <CardHeader>
                      <feature.icon className={`h-12 w-12 ${feature.color} mb-4`} />
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Technology Showcase */}
          <motion.section variants={itemVariants} className="py-16">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                Built with Modern Technology
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Powered by the latest web technologies for performance, security, and scalability
              </p>
            </div>

            <Tabs defaultValue="frontend" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="frontend">Frontend</TabsTrigger>
                <TabsTrigger value="backend">Backend</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
              </TabsList>

              {["frontend", "backend", "features"].map((category) => (
                <TabsContent key={category} value={category} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {techStack
                      .filter(tech => tech.category.toLowerCase() === category)
                      .map((tech, index) => (
                        <motion.div
                          key={tech.name}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Card className="hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg">{tech.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-slate-600">{tech.description}</p>
                              <Badge variant="outline" className="mt-2">
                                {tech.category}
                              </Badge>
                            </CardContent>
                          </Card>
                        </motion.div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </motion.section>

          {/* Analytics Preview */}
          <motion.section variants={itemVariants} className="py-16">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                Beautiful Learning Analytics
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Visualize your progress with stunning charts and actionable insights
              </p>
            </div>
            <LearningAnalytics />
          </motion.section>

          {/* CTA Section */}
          <motion.section variants={itemVariants} className="py-16">
            <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
              <CardContent className="p-12 text-center">
                <h2 className="text-4xl font-bold mb-4">
                  Ready to Transform Your Learning?
                </h2>
                <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                  Join thousands of students who are already using Easeboard to excel in their studies
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button 
                    size="lg" 
                    variant="secondary"
                    className="text-lg px-8 py-3"
                    onClick={() => router.push('/login')}
                  >
                    Get Started Free
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="text-lg px-8 py-3 border-white text-white hover:bg-white hover:text-blue-600"
                  >
                    View Documentation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <BookOpen className="h-8 w-8 text-blue-400" />
                <span className="text-xl font-bold">Easeboard</span>
              </div>
              <p className="text-slate-400">
                Next-generation Canvas LMS Dashboard for modern learners
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Features</h3>
              <ul className="space-y-2 text-slate-400">
                <li>Dashboard Analytics</li>
                <li>Assignment Management</li>
                <li>Grade Tracking</li>
                <li>Smart Notifications</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Technology</h3>
              <ul className="space-y-2 text-slate-400">
                <li>Next.js 15</li>
                <li>Supabase</li>
                <li>PWA Support</li>
                <li>End-to-End Encryption</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-slate-400">
                <li>Documentation</li>
                <li>API Reference</li>
                <li>Community</li>
                <li>Contact</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
            <p>&copy; 2024 Easeboard. Built with ❤️ for students everywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
