/**
 * OraVisionAI — Login Page
 * Email/password baseline authentication matching frozen backend contract.
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
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
    if (loading) return;
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
    <AuthLayout mode="login">
          <div className="auth-form-heading">
            <span className="auth-heading-icon"><LockKeyhole size={22} strokeWidth={1.5} /></span>
            <h1>Your care. Your space.</h1>
            <p>Welcome back. Sign in to continue your oral health journey.</p>
          </div>
          {errorMessage && (
            <Alert variant="danger" className="mb-4" onClose={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading}>
            <Input
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoComplete="email"
              disabled={loading}
            />
            <PasswordInput
              label="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
              rightIcon={ArrowRight}
            >
              {loading ? 'Signing you in...' : 'Sign in to your account'}
            </Button>
          </form>

          <div className="auth-switch-account">
            <span>New to OraVisionAI?</span>
            <Link to="/register">Create your account <ArrowRight size={14} /></Link>
          </div>
          <div className="auth-purpose-note"><span /> For patients, practitioners, and the people who care.</div>
    </AuthLayout>
  );
};

export default LoginPage;
