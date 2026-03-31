'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="size-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200"
          >
            <Bot className="size-5 text-white" />
          </motion.div>
          <p className="text-sm text-slate-400">Cargando...</p>
        </div>
      </div>
    )
  }

  // Authenticated
  if (session?.user) {
    // Store user info for components to use
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dayless-user', JSON.stringify(session.user))
    }
    return <>{children}</>
  }

  // Not authenticated
  return <LoginScreen />
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Email o contraseña incorrectos')
      }
      // On success, useSession will auto-detect the new session
      // and re-render with children
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail)
    setPassword(demoPass)
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 size-80 rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-80 rounded-full bg-slate-200/40 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-emerald-50/30 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex size-16 items-center justify-center rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-200 mb-4"
          >
            <Bot className="size-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">dayless.ai</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center justify-center gap-1">
            <Sparkles className="size-3.5 text-emerald-500" />
            Tu Scrum Master con IA
          </p>
        </div>

        {/* Card */}
        <Card className="border-slate-200/80 bg-white/80 backdrop-blur-sm shadow-xl shadow-slate-200/50">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-lg">Iniciar sesión</CardTitle>
            <CardDescription>
              Entra a tu espacio de trabajo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 border-slate-200 bg-slate-50/50 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-400"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 border-slate-200 bg-slate-50/50 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-400"
                    required
                    autoComplete="current-password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 shadow-sm shadow-emerald-200 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              {/* Auto-register hint */}
              <p className="text-center text-xs text-slate-400 pt-1">
                ¿Primera vez? Tu cuenta se crea automáticamente al entrar.
              </p>
            </form>

            {/* Demo accounts */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-[11px] text-center text-slate-400 mb-2">Cuentas de demo</p>
              <div className="flex flex-col gap-1.5">
                {[
                  { name: 'Ana López', email: 'ana@dayless.ai', pass: 'demo1234' },
                  { name: 'Carlos Rodríguez', email: 'carlos@dayless.ai', pass: 'demo1234' },
                ].map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => fillDemo(demo.email, demo.pass)}
                    className="text-left text-[11px] text-slate-500 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded-md px-3 py-1.5 transition-colors font-mono"
                  >
                    {demo.email} / {demo.pass}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400 mt-6">
          Dayless.ai &copy; {new Date().getFullYear()} · AI Scrum Master
        </p>
      </motion.div>
    </div>
  )
}
