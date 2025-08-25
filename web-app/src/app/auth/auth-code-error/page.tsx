'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Home } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="mx-auto mb-4 w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center"
            >
              <AlertCircle className="w-8 h-8 text-destructive" />
            </motion.div>
            <CardTitle className="text-destructive">Authentication Error</CardTitle>
            <CardDescription>
              There was an error processing your authentication request. This could be due to an expired or invalid link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Please try:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Signing in again</li>
                <li>Requesting a new authentication link</li>
                <li>Checking if the link has expired</li>
              </ul>
            </div>
            
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/login">
                  <Home className="w-4 h-4 mr-2" />
                  Back to Login
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">
                  Go to Home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
