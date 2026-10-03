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
import { UserPlus, ArrowRight, Stethoscope, User as UserIcon, Check, Circle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordRequirements = [
    {
      id: 'length',
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      id: 'uppercase',
      label: 'One uppercase letter',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'number',
      label: 'One number',
      met: /[0-9]/.test(password),
    },
    {
      id: 'special',
      label: 'One special character',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const isPasswordValid = passwordRequirements.every((r) => r.met);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const confirmPasswordError =
    confirmPasswordTouched && confirmPassword.length > 0 && password !== confirmPassword
      ? 'Passwords do not match.'
      : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    setConfirmPasswordTouched(true);

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setErrorMessage('Please fill in all required registration fields.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage('Password must satisfy all 4 security requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="new-password"
              disabled={loading}
              toggleAriaLabel={{
                show: 'Show password',
                hide: 'Hide password',
              }}
            />

            {/* Password Requirements Live Feedback */}
            <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/80 space-y-1.5" aria-live="polite">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Password Requirements
                </span>
                {isPasswordValid && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    All requirements met
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                {passwordRequirements.map((req) => (
                  <div
                    key={req.id}
                    className={`flex items-center gap-1.5 text-xs transition-colors duration-150 ${
                      req.met
                        ? 'text-emerald-700 font-medium'
                        : 'text-slate-500'
                    }`}
                  >
                    {req.met ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                    ) : (
                      <Circle className="h-2 w-2 text-slate-300 fill-slate-300 shrink-0 ml-0.5 mr-1" aria-hidden="true" />
                    )}
                    <span>{req.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <PasswordInput
              label="Confirm Password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (!confirmPasswordTouched) {
                  setConfirmPasswordTouched(true);
                }
              }}
              onBlur={() => setConfirmPasswordTouched(true)}
              placeholder="••••••••"
              autoComplete="new-password"
              error={confirmPasswordError}
              helperText={
                passwordsMatch
                  ? '✓ Passwords match'
                  : undefined
              }
              disabled={loading}
              toggleAriaLabel={{
                show: 'Show confirm password',
                hide: 'Hide confirm password',
              }}
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
