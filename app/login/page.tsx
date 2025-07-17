"use client"

import type React from "react"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client" // Import client-side Supabase client

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false) // New state to toggle between login/signup
  const router = useRouter()
  const supabase = createClient() // Initialize client-side Supabase

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (isSignUp) {
      // Handle Sign Up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/api/auth/callback`, // Redirect after email confirmation
        },
      })

      if (error) {
        toast({
          title: "Signup Failed",
          description: error.message,
          variant: "destructive",
        })
      } else if (data.user) {
        toast({
          title: "Signup Successful",
          description: "Please check your email to confirm your account.",
        })
        setIsSignUp(false) // Switch back to login after successful signup
      } else {
        toast({
          title: "Signup Initiated",
          description: "Please check your email to complete the signup process.",
        })
        setIsSignUp(false) // Also switch back if no user but email sent
      }
    } else {
      // Handle Login
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      })

      if (result?.error) {
        toast({
          title: "Login Failed",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Login Successful",
          description: "Redirecting to file explorer...",
        })
        router.push("/")
      }
    }
    setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-950">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{isSignUp ? "Sign Up" : "Login"} to Brand Library</CardTitle>
          <CardDescription>
            {isSignUp ? "Create your account to get started." : "Enter your email and password to access your assets."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? "Signing Up..." : "Logging in..."}
                </>
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Login"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <Button variant="link" onClick={() => setIsSignUp(false)} className="p-0 h-auto">
                  Login
                </Button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <Button variant="link" onClick={() => setIsSignUp(true)} className="p-0 h-auto">
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
