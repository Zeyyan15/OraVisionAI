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
import { UserPlus, ArrowRight, Stethoscope, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
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
    setErrorMessage(null);
    setLoading(true);

    try {
      await register(email, password, role, firstName, lastName);
      if (role === 'dentist') {
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
    <div className="w-full max-w-lg my-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-clinical-100 text-clinical-700 mb-2">
            <UserPlus className="h-6 w-6" />
          </div>
          <CardTitle>Create OraVisionAI Account</CardTitle>
          <CardDescription>
            Join the platform for AI oral health screening and clinical collaboration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <Alert variant="danger" className="mb-4" onClose={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          {/* Role Choice: patient or dentist only */}
          <div className="mb-6 space-y-2">
            <label className="block text-sm font-medium text-slate-700">Account Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('patient')}
                className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                  role === 'patient'
                    ? 'border-clinical-600 bg-clinical-50 text-clinical-800 ring-2 ring-clinical-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <UserIcon className="h-5 w-5 text-clinical-600" />
                <div className="text-left">
                  <div className="font-semibold">Patient</div>
                  <div className="text-xs text-slate-500">Screening & Telehealth</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('dentist')}
                className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                  role === 'dentist'
                    ? 'border-clinical-600 bg-clinical-50 text-clinical-800 ring-2 ring-clinical-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Stethoscope className="h-5 w-5 text-clinical-600" />
                <div className="text-left">
                  <div className="font-semibold">Dentist</div>
                  <div className="text-xs text-slate-500">Clinical Evaluation</div>
                </div>
              </button>
            </div>

            {role === 'dentist' && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200 mt-2">
                * Note: Dental practitioner accounts require administrative license verification before clinical consultation features are fully enabled.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
              />
              <Input
                label="Last Name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
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
            />

            <Input
              label="Password (min 6 characters)"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              rightIcon={ArrowRight}
            >
              Complete Registration
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-clinical-600 hover:text-clinical-700">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
