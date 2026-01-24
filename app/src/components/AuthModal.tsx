import { useState } from 'preact/hooks'
import {
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  sendEmailLink,
} from '../services/firebase'

type AuthMode = 'initial' | 'signup' | 'signin' | 'emaillink' | 'emaillink-confirm'

interface AuthModalProps {
  onClose: () => void
}

const buttonBase =
  'rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]'

export function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('initial')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError('')
      await signInWithGoogle()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSignUp = async (e: Event) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }
    try {
      setLoading(true)
      setError('')
      await signUpWithEmail(email, password)
      onClose()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sign up failed'
      if (errorMsg.includes('already-in-use')) {
        setError('Email already in use. Try signing in instead.')
      } else {
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSignIn = async (e: Event) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }
    try {
      setLoading(true)
      setError('')
      await signInWithEmail(email, password)
      onClose()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sign in failed'
      if (errorMsg.includes('invalid-credential')) {
        setError('Invalid email or password')
      } else {
        setError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmailLink = async (e: Event) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email')
      return
    }
    try {
      setLoading(true)
      setError('')
      await sendEmailLink(email)
      setMode('emaillink-confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <button
          onClick={onClose}
          class="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>

        {mode === 'initial' && (
          <div class="space-y-4">
            <div>
              <h2 class="text-xl font-semibold">Sign in to follow runners</h2>
              <p class="mt-1 text-sm text-slate-600">
                Choose your preferred authentication method
              </p>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              class={`${buttonBase} w-full bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 disabled:opacity-50`}
            >
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-slate-200"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="bg-white px-2 text-slate-600">Or continue with email</span>
              </div>
            </div>

            <button
              onClick={() => {
                setMode('signin')
                setError('')
                setEmail('')
                setPassword('')
              }}
              class={`${buttonBase} w-full bg-slate-100 text-slate-900 hover:bg-slate-200`}
            >
              Sign in with Email
            </button>

            <button
              onClick={() => {
                setMode('signup')
                setError('')
                setEmail('')
                setPassword('')
              }}
              class={`${buttonBase} w-full bg-slate-100 text-slate-900 hover:bg-slate-200`}
            >
              Create Account
            </button>

            <button
              onClick={() => {
                setMode('emaillink')
                setError('')
                setEmail('')
              }}
              class={`${buttonBase} w-full bg-slate-100 text-slate-900 hover:bg-slate-200`}
            >
              Sign in with Passwordless Link
            </button>
          </div>
        )}

        {mode === 'signin' && (
          <form onSubmit={handleEmailSignIn} class="space-y-4">
            <div>
              <h2 class="text-xl font-semibold">Sign in</h2>
              <p class="mt-1 text-sm text-slate-600">Enter your email and password</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                disabled={loading}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                disabled={loading}
              />
            </div>

            {error && <p class="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              class={`${buttonBase} w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50`}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('initial')
                setError('')
              }}
              class={`${buttonBase} w-full bg-slate-100 text-slate-900`}
            >
              Back
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleEmailSignUp} class="space-y-4">
            <div>
              <h2 class="text-xl font-semibold">Create account</h2>
              <p class="mt-1 text-sm text-slate-600">Enter your email and password</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                disabled={loading}
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                placeholder="At least 6 characters"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                disabled={loading}
              />
            </div>

            {error && <p class="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              class={`${buttonBase} w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50`}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('initial')
                setError('')
              }}
              class={`${buttonBase} w-full bg-slate-100 text-slate-900`}
            >
              Back
            </button>
          </form>
        )}

        {mode === 'emaillink' && (
          <form onSubmit={handleSendEmailLink} class="space-y-4">
            <div>
              <h2 class="text-xl font-semibold">Passwordless sign in</h2>
              <p class="mt-1 text-sm text-slate-600">
                We'll send you a link to sign in securely
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                disabled={loading}
              />
            </div>

            {error && <p class="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              class={`${buttonBase} w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50`}
            >
              {loading ? 'Sending link...' : 'Send sign-in link'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('initial')
                setError('')
              }}
              class={`${buttonBase} w-full bg-slate-100 text-slate-900`}
            >
              Back
            </button>
          </form>
        )}

        {mode === 'emaillink-confirm' && (
          <div class="space-y-4">
            <div>
              <h2 class="text-xl font-semibold">Check your email</h2>
              <p class="mt-1 text-sm text-slate-600">
                We've sent a sign-in link to <strong>{email}</strong>
              </p>
            </div>

            <div class="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              Click the link in the email to complete sign in. You can close this window.
            </div>

            <button
              onClick={onClose}
              class={`${buttonBase} w-full bg-slate-100 text-slate-900`}
            >
              Done
            </button>

            <button
              onClick={() => {
                setMode('emaillink')
                setError('')
              }}
              class={`${buttonBase} w-full bg-slate-100 text-slate-900`}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
