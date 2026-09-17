/**
 * OraVisionAI — Login Page
 * Email/password baseline authentication matching frozen backend contract.
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname;

  const isPathAllowedForRole = (path: string, role: string): boolean => {
    if (!path || typeof path !== 'string') return false;
    if (['/unauthorized', '/deactivated', '/login', '/register', '/'].includes(path)) {
      return false;
    }
    if (role === 'admin') return path.startsWith('/admin');
    if (role === 'dentist') return path.startsWith('/dentist');
    if (role === 'patient') return path.startsWith('/patient');
    return false;
  };

  const getRoleDashboard = (role: string): string => {
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'dentist') return '/dentist/dashboard';
    if (role === 'patient') return '/patient/dashboard';
    return '/unauthorized';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const profile = await login(email, password);
      // Determine redirection target strictly by authoritative profile role
      if (from && isPathAllowedForRole(from, profile.role)) {
        navigate(from, { replace: true });
      } else {
        navigate(getRoleDashboard(profile.role), { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Login failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md my-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-clinical-100 text-clinical-700 mb-2">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle>Sign In to OraVisionAI</CardTitle>
          <CardDescription>
            Enter your account credentials to access your clinical dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <Alert variant="danger" className="mb-4" onClose={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              rightIcon={ArrowRight}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-semibold text-clinical-600 hover:text-clinical-700">
              Create an account
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
