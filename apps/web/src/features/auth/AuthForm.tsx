import { type AuthResponse, FIELD_LIMITS } from '@finance/shared';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { getApiErrorMessage } from '@/lib/errors';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/features/auth/useAuth';

const modeConfig = {
  login: {
    endpoint: '/auth/login',
    heading: 'Sign in',
    submitLabel: 'Sign in',
    loadingLabel: 'Signing in...',
    fallbackError: 'Login failed. Please try again.',
    passwordLabel: 'Password',
    passwordAutoComplete: 'current-password' as const,
    footer: (
      <p className="mt-4 text-center text-sm text-content-secondary">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="text-content-primary font-medium hover:underline"
        >
          Create one
        </Link>
      </p>
    ),
  },
  register: {
    endpoint: '/auth/register',
    heading: 'Create account',
    submitLabel: 'Create account',
    loadingLabel: 'Creating account...',
    fallbackError: 'Registration failed. Please try again.',
    passwordLabel: (
      <>
        Password{' '}
        <span className="ml-1 text-content-muted font-normal">
          (min. 8 characters)
        </span>
      </>
    ),
    passwordAutoComplete: 'new-password' as const,
    footer: (
      <p className="mt-4 text-center text-sm text-content-secondary">
        Already have an account?{' '}
        <Link
          to="/login"
          className="text-content-primary font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    ),
  },
} as const;

interface AuthFormProps {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProps) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    endpoint,
    heading,
    submitLabel,
    loadingLabel,
    fallbackError,
    passwordLabel,
    passwordAutoComplete,
    footer,
  } = modeConfig[mode];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>(endpoint, {
        email,
        password,
      });
      login(data.accessToken, data.user);
      void navigate({ to: '/', replace: true });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, fallbackError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-subtle flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-content-primary text-center mb-8">
          Finance Dashboard
        </h1>

        <div className="bg-surface rounded-lg border border-border-base p-6">
          <h2 className="text-lg font-medium text-content-primary mb-6">
            {heading}
          </h2>

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-4"
          >
            <FormField label="Email">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </FormField>

            <FormField label={passwordLabel}>
              <Input
                type="password"
                required
                minLength={mode === 'register' ? FIELD_LIMITS.PASSWORD_MIN : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={passwordAutoComplete}
              />
            </FormField>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full py-2">
              {loading ? loadingLabel : submitLabel}
            </Button>
          </form>

          {footer}
        </div>
      </div>
    </div>
  );
}
