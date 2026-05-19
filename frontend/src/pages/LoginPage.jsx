// ============================================================
// STEP 2: ADD STATE — Form state + error/loading state
// ============================================================
// WHAT CHANGED from Step 1:
//   1. Added useForm() — React Hook Form now controls the inputs
//   2. Added useState for error message (API errors)
//   3. Connected inputs to the form via register()
//   4. Added onSubmit handler (just console.log for now)
//
// WHAT register() DOES:
//   register("email") returns { onChange, onBlur, name, ref }
//   These get spread onto the <Input /> so React Hook Form
//   can track what the user types WITHOUT us writing useState.
//
// WHY NOT useState for each field?
//   With useState: const [email, setEmail] = useState('')
//   You'd need onChange handlers, value props, separate validation...
//   React Hook Form does ALL of that with one register() call.

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  // FORM STATE — React Hook Form handles email + password
  const {
    register,           // connects an input to the form
    handleSubmit,       // wraps our onSubmit, runs validation first
    formState: { isSubmitting }  // true while onSubmit is running (loading state)
  } = useForm()

  // ERROR STATE — shows API error messages ("Invalid credentials")
  const [error, setError] = useState(null)

  // HANDLER — what happens when form is submitted
  // Right now: just logs the data. Step 3 will wire the API.
  const onSubmit = async (data) => {
    setError(null)  // clear previous error
    console.log('Form submitted:', data)
    // data = { email: "whatever@typed.com", password: "whatever" }
    // Next step: call the API here
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your TourneyHub account</CardDescription>
        </CardHeader>

        <CardContent>
          {/* handleSubmit wraps onSubmit — it validates first, THEN calls our function */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Error message — only shows if error state is not null */}
            {error && (
              <div className="bg-danger/10 text-danger text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email', { required: true })}
                // ^^^ This ONE line does everything:
                // - Tracks what user types (no useState needed)
                // - Validates that field is not empty (required: true)
                // - Connects the input to the form data object
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password', { required: true })}
              />
            </div>

            {/* disabled while submitting — prevents double-clicks */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

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
