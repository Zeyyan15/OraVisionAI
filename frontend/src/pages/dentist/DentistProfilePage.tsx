/**
 * OraVisionAI — Dentist Professional Profile & Credentials Page (Phase 24)
 *
 * Enables treating dentists to update professional profile metadata
 * and manage administrative credential verification documentation.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDentist } from '../../hooks/useDentist';
import { DentistVerificationCard } from '../../components/dentist/DentistVerificationCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import {
  User,
  ArrowLeft,
  Save,
  Stethoscope,
  CheckCircle2,
} from 'lucide-react';
import { DentistProfileUpdate } from '../../types/dentist';

export const DentistProfilePage: React.FC = () => {
  const {
    profile,
    profileLoading,
    profileError,
    updateProfile,
    verification,
    submittingVerification,
    submitVerification,
  } = useDentist();

  const [formData, setFormData] = useState<DentistProfileUpdate>({
    specialization: '',
    clinic_name: '',
    clinic_address: '',
    years_of_experience: 0,
    bio: '',
    phone_number: '',
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        specialization: profile.specialization || 'General Dentistry',
        clinic_name: profile.clinic_name || '',
        clinic_address: profile.clinic_address || '',
        years_of_experience: profile.years_of_experience || 0,
        bio: profile.bio || '',
        phone_number: profile.phone_number || '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      await updateProfile(formData);
      setSaveSuccess('Practitioner profile updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update practitioner profile';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link
          to="/dentist/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Clinical Workspace</span>
        </Link>
        <div className="flex items-center gap-2">
          <User className="h-6 w-6 text-clinical-600" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Practitioner Profile & Credentials
          </h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Manage clinical practice details, clinic affiliations, and regulatory verification documents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Profile Edit Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-clinical-600" />
                <div>
                  <CardTitle className="text-base text-slate-900">
                    Clinical Practice Information
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Details displayed to patients on consultation schedules and diagnostic reports
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="p-6 space-y-4">
                {saveSuccess && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>{saveSuccess}</span>
                  </div>
                )}

                {saveError && (
                  <Alert variant="danger" title="Update Error">
                    {saveError}
                  </Alert>
                )}

                {profileError && (
                  <Alert variant="warning" title="Notice">
                    {profileError}
                  </Alert>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="specialization"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Specialization / Clinical Discipline
                    </label>
                    <Input
                      id="specialization"
                      type="text"
                      value={formData.specialization || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, specialization: e.target.value }))
                      }
                      placeholder="e.g. Oral Medicine & Pathology, Periodontics"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="years_of_experience"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Years of Clinical Experience
                    </label>
                    <Input
                      id="years_of_experience"
                      type="number"
                      min={0}
                      value={formData.years_of_experience ?? 0}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          years_of_experience: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="clinic_name"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Affiliated Clinic or Practice Name
                    </label>
                    <Input
                      id="clinic_name"
                      type="text"
                      value={formData.clinic_name || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, clinic_name: e.target.value }))
                      }
                      placeholder="e.g. Metro Oral Health Center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="phone_number"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Practice Contact Phone
                    </label>
                    <Input
                      id="phone_number"
                      type="tel"
                      value={formData.phone_number || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, phone_number: e.target.value }))
                      }
                      placeholder="+1 (555) 012-3456"
                    />
                  </div>

                  <div className="col-span-full space-y-1">
                    <label
                      htmlFor="clinic_address"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Clinic Physical Address
                    </label>
                    <Input
                      id="clinic_address"
                      type="text"
                      value={formData.clinic_address || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, clinic_address: e.target.value }))
                      }
                      placeholder="123 Medical Center Blvd, Suite 400"
                    />
                  </div>

                  <div className="col-span-full space-y-1">
                    <label htmlFor="bio" className="block text-xs font-semibold text-slate-700">
                      Professional Clinical Biography
                    </label>
                    <textarea
                      id="bio"
                      rows={3}
                      value={formData.bio || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                      placeholder="Summary of clinical background, certifications, and areas of focus..."
                      className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-clinical-500 focus:outline-none"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="border-t border-slate-100 bg-slate-50/50 flex justify-end p-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={saving || profileLoading}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Right Column: Verification Status Card (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <DentistVerificationCard
            profile={profile}
            verification={verification}
            submitting={submittingVerification}
            onSubmit={submitVerification}
          />
        </div>
      </div>
    </div>
  );
};

export default DentistProfilePage;
