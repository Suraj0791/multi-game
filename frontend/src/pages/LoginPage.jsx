// ============================================================
// STEP 1: STATIC HTML — No logic, no state, just the visual
// ============================================================
// We're building the LOGIN PAGE.
// Right now: hardcoded inputs, hardcoded button, zero functionality.
// Goal: make it LOOK right before adding any brain.

import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  return (
    // Full screen centered — the login page has NO navbar (it's outside Layout)
    <div className="min-h-screen bg-background flex items-center justify-center p-4">

      {/* Card — the white box that contains the form */}
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-2">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your TourneyHub account</CardDescription>
        </CardHeader>

        <CardContent>
          {/* The form — right now just static HTML */}
          <form className="space-y-4">

            {/* Email field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
              />
            </div>

            {/* Submit button */}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>

          {/* Link to register page */}
          <p className="text-center text-sm text-muted-foreground mt-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
