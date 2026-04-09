import {
  loginSchema,
  registerSchema,
  type AuthResponse,
} from '@finance/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
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
  readonly mode: 'login' | 'register';
}

interface FormValues { email: string; password: string }

export function AuthForm({ mode }: AuthFormProps) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(mode === 'login' ? loginSchema : registerSchema),
  });

  async function onSubmit(values: FormValues) {
    setServerError('');
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>(endpoint, values);
      login(data.accessToken, data.user);
      void navigate({ to: '/', replace: true });
    } catch (err: unknown) {
      setServerError(getApiErrorMessage(err, fallbackError));
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
              void handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            <FormField label="Email" error={errors.email?.message}>
              <Input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email')}
              />
            </FormField>

            <FormField label={passwordLabel} error={errors.password?.message}>
              <Input
                type="password"
                placeholder="••••••••"
                autoComplete={passwordAutoComplete}
                {...register('password')}
              />
            </FormField>

            {serverError && (
              <p className="text-sm text-danger">{serverError}</p>
            )}

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
