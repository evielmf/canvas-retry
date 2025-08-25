'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

const progressData = [
  { month: 'Jan', completed: 4, started: 8 },
  { month: 'Feb', completed: 6, started: 12 },
  { month: 'Mar', completed: 8, started: 15 },
  { month: 'Apr', completed: 12, started: 18 },
  { month: 'May', completed: 15, started: 22 },
  { month: 'Jun', completed: 18, started: 25 },
]

const performanceData = [
  { subject: 'React', score: 95 },
  { subject: 'TypeScript', score: 88 },
  { subject: 'Node.js', score: 82 },
  { subject: 'Python', score: 91 },
  { subject: 'UI/UX', score: 79 },
]

const categoryData = [
  { name: 'Programming', value: 45, color: '#3b82f6' },
  { name: 'Design', value: 25, color: '#8b5cf6' },
  { name: 'Business', value: 20, color: '#10b981' },
  { name: 'Marketing', value: 10, color: '#f59e0b' },
]

export function LearningAnalytics() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Course Progress Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Learning Progress</CardTitle>
          <CardDescription>Monthly course completion trends</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="started" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Performance</CardTitle>
          <CardDescription>Your scores across different subjects</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="subject" 
                tick={{ fontSize: 12 }}
                axisLine={false}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, stroke: '#10b981', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Distribution */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Learning Categories</CardTitle>
          <CardDescription>Distribution of your course enrollments by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
            <ResponsiveContainer width="100%" height={300} className="lg:w-1/2">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                  labelLine={false}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="lg:w-1/2 space-y-4">
              {categoryData.map((category, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ '--indicator-color': category.color, backgroundColor: 'var(--indicator-color)' } as React.CSSProperties}
                    />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <span className="text-sm text-slate-600">{category.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
