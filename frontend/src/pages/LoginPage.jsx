import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Trophy, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { loginUser, guestLogin } from '@/api/authApi'
import useAuthStore from '@/stores/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((state) => state.login)
  const redirectTo = decodeURIComponent(searchParams.get('redirect') || '/tournaments')

  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm()

  const [error, setError] = useState(null)

  const handleGuestLogin = async () => {
    setError(null)
    try {
      const res = await guestLogin()
      login(res.token, res.userId)
      navigate(redirectTo, { replace: true })
    } catch {
      setError('Guest login failed. Try again.')
    }
  }

  const onSubmit = async (data) => {
    setError(null)
    try {
      // STEP A: Call the backend API
      const response = await loginUser(data.email, data.password)

      // STEP B: Save token to Zustand + localStorage
      login(response.token, response.userId)

      // STEP C: Redirect back to where the user was going
      navigate(redirectTo, { replace: true })
    } catch (err) {
      // Show the backend error message (or a generic one)
      setError(err.response?.data?.error || 'Login failed. Try again.')
    }
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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-neutral-950 px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={handleGuestLogin}>
            <User className="h-4 w-4" />
            Continue as Guest (No Sign-up)
          </Button>

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
