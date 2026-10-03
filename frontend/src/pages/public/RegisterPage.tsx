/**
 * OraVisionAI — Registration Page
 *
 * Registration Role Invariant:
 * Only 'patient' or 'dentist' roles are selectable.
 * 'admin' is strictly forbidden and never exposed.
 * Dentist registration is server-authoritative and enters 'pending verification' status.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, ArrowRight, Stethoscope, User as UserIcon, Check, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<'patient' | 'dentist'>('patient');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setLoading(true);

    try {
      const profile = await register(email, password, role, firstName, lastName);
      if (profile.role === 'dentist') {
        navigate('/dentist/dashboard', { replace: true });
      } else {
        navigate('/patient/dashboard', { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout mode="register">
          <div className="auth-form-heading auth-register-heading">
            <span className="auth-heading-icon"><UserPlus size={22} strokeWidth={1.5} /></span>
            <h1>A clearer picture starts here.</h1>
            <p>Create your account. Take the next step toward better oral care.</p>
          </div>
          {errorMessage && (
            <Alert variant="danger" className="mb-4" onClose={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="auth-form auth-register-form" aria-busy={loading}>
          <fieldset className="auth-role-fieldset" disabled={loading}>
            <legend>I'm joining as a</legend>
            <div className="auth-role-options">
              {(['patient', 'dentist'] as const).map((option) => {
                const Icon = option === 'patient' ? UserIcon : Stethoscope;
                return (
                  <label key={option} className={`auth-role-option${role === option ? ' is-selected' : ''}`}>
                    <input type="radio" name="account-type" value={option} checked={role === option} onChange={() => setRole(option)} />
                    <Icon size={20} strokeWidth={1.5} />
                    <span><strong>{option === 'patient' ? 'Patient' : 'Dentist'}</strong><small>{option === 'patient' ? 'My oral health' : 'Care for patients'}</small></span>
                    <span className="auth-role-check">{role === option && <Check size={10} strokeWidth={3} />}</span>
                  </label>
                );
              })}
            </div>
            {role === 'dentist' && (
              <p className="auth-verification-note"><ShieldCheck size={16} /> Practitioner accounts require license verification before consultation features are enabled.</p>
            )}
          </fieldset>
            <div className="auth-name-fields">
              <Input
                label="First Name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                autoComplete="given-name"
                disabled={loading}
              />
              <Input
                label="Last Name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                autoComplete="family-name"
                disabled={loading}
              />
            </div>

            <Input
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane.doe@example.com"
              autoComplete="email"
              disabled={loading}
            />

            <PasswordInput
              label="Password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="new-password"
              helperText="Use at least 6 characters."
              disabled={loading}
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
              rightIcon={ArrowRight}
            >
              {loading ? 'Creating your account...' : 'Create your account'}
            </Button>
          </form>

          <div className="auth-switch-account">
            <span>Already have an account?</span>
            <Link to="/login">Sign in <ArrowRight size={14} /></Link>
          </div>
    </AuthLayout>
  );
};

export default RegisterPage;
