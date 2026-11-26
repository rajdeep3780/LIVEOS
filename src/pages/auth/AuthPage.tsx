import { ArrowRight, Check, Lock, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import { extractErrorMessage } from '../../services/api.ts';

export function AuthPage() {
  const { user, loading, loginWithEmail, registerWithEmail, loginWithGoogle } =
    useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0C0E]">
        <div className="text-sm text-[#9CA3AF]">Loading LIFEOS...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(displayName.trim(), email.trim(), password);
      }
    } catch (err) {
      setError(
        extractErrorMessage(
          err,
          mode === 'login' ? 'Unable to sign in.' : 'Unable to register account.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(extractErrorMessage(err, 'Google Sign-In failed.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-[#0B0C0E] text-[#F4F5F7] lg:grid-cols-12">
      {/* Left Narrative Column */}
      <div className="flex flex-col justify-between border-b border-[#23262E] bg-[#101216] p-8 sm:p-12 lg:col-span-6 lg:border-r lg:border-b-0">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F97316] font-display text-sm font-bold text-white">
              L
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-white">
              LIFEOS
            </span>
          </div>

          <div className="mt-14 max-w-lg">
            <h1 className="font-display text-3xl leading-tight font-bold text-white sm:text-4xl [text-wrap:balance]">
              Your Life. Your People. Everything in Progress.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[#9CA3AF]">
              A calm operating system for tracking Matters — household repairs,
              personal responsibilities, pending follow-ups, and shared family or
              community commitments.
            </p>

            <div className="mt-10 space-y-5 border-t border-[#23262E] pt-8">
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#523018] bg-[#26180F] text-[#F97316]">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    Clear ownership &amp; next actions
                  </div>
                  <p className="mt-0.5 text-sm text-[#9CA3AF]">
                    Every Matter answers who is responsible, what happened, what
                    happens next, and when to follow up.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#523018] bg-[#26180F] text-[#F97316]">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    Private Personal, Family &amp; Community Spaces
                  </div>
                  <p className="mt-0.5 text-sm text-[#9CA3AF]">
                    Start immediately with your private Personal Space, and create
                    invitation-only spaces for family or committees.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#523018] bg-[#26180F] text-[#F97316]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    Nothing important gets lost in follow-up
                  </div>
                  <p className="mt-0.5 text-sm text-[#9CA3AF]">
                    Track exactly who or what you are waiting on, chronological
                    activity timelines, and final resolutions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-[#6B7280]">
          Private by design. No public feeds or open profiles.
        </p>
      </div>

      {/* Right Authentication Form Column */}
      <div className="flex items-center justify-center p-6 sm:p-12 lg:col-span-6">
        <div className="w-full max-w-md rounded-lg border border-[#262930] bg-[#14161A] p-6 sm:p-8">
          <div className="flex rounded-md border border-[#23262E] bg-[#0E1013] p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 rounded py-2 text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-[#1D2027] text-white'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 rounded py-2 text-sm font-medium transition-colors ${
                mode === 'register'
                  ? 'bg-[#1D2027] text-white'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="mt-6">
            <h2 className="font-display text-xl font-semibold text-white">
              {mode === 'login' ? 'Welcome back' : 'Create your LIFEOS account'}
            </h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              {mode === 'login'
                ? 'Sign in to access your Personal, Family, and Community Spaces.'
                : 'A private Personal Space is created automatically when you join.'}
            </p>
          </div>

          {error && (
            <div className="mt-5 rounded-md border border-[#522424] bg-[#291416] px-3.5 py-2.5 text-sm text-[#FCA5A5]">
              {error}
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || submitting}
              className="flex w-full items-center justify-center gap-2.5 rounded-md border border-[#2E323D] bg-[#1A1D23] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#22262E] disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
                />
              </svg>
              <span>
                {googleLoading ? 'Connecting...' : 'Continue with Google'}
              </span>
            </button>
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#23262E]" />
            <span className="text-xs text-[#6B7280]">or with email</span>
            <div className="h-px flex-1 bg-[#23262E]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
                >
                  Display Name
                </label>
                <input
                  id="auth-display-name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3.5 py-2.5 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
              >
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3.5 py-2.5 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
              >
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'
                }
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3.5 py-2.5 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || googleLoading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#EA580C] disabled:opacity-50"
            >
              <span>
                {submitting
                  ? mode === 'login'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
