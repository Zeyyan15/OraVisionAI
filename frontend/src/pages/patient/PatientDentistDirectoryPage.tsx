/**
 * OraVisionAI — Patient Dentist Directory & Consultation Booking
 *
 * Discovers approved dental specialists, reviews credentials,
 * and facilitates instant appointment scheduling.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DentistProfile, Appointment } from '../../types/dentist';
import { listApprovedDentists } from '../../api/dentistEndpoints';
import { BookAppointmentModal } from '../../components/patient/BookAppointmentModal';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import {
  Stethoscope,
  Search,
  MapPin,
  Briefcase,
  Calendar,
  CalendarCheck,
  Building,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { formatAppointmentDateTime } from '../../utils/dateTimeUtils';

export const PatientDentistDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [dentists, setDentists] = useState<DentistProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedDentistForBooking, setSelectedDentistForBooking] = useState<DentistProfile | null>(null);
  const [bookedAppointmentSuccess, setBookedAppointmentSuccess] = useState<Appointment | null>(null);

  const fetchDentists = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listApprovedDentists();
      setDentists(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dental practitioners.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDentists();
  }, []);

  // Extract unique specialties
  const specialties = useMemo(() => {
    const list = Array.from(new Set(dentists.map((d) => d.specialization).filter(Boolean)));
    return ['all', ...list];
  }, [dentists]);

  // Filter dentists
  const filteredDentists = useMemo(() => {
    return dentists.filter((d) => {
      const matchesSearch =
        `${d.first_name} ${d.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.specialization && d.specialization.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.clinic_name && d.clinic_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.clinic_address && d.clinic_address.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesSpecialty =
        selectedSpecialty === 'all' || d.specialization?.toLowerCase() === selectedSpecialty.toLowerCase();

      return matchesSearch && matchesSpecialty;
    });
  }, [dentists, searchTerm, selectedSpecialty]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Find a Dental Practitioner
            </h1>
            <Badge variant="info" className="text-xs">
              Verified Network
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Connect with certified dental professionals for clinical reviews and teleconsultations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDentists}
            disabled={loading}
            leftIcon={RefreshCw}
            className={loading ? 'animate-spin-icon' : ''}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/patient/appointments')}
            leftIcon={Calendar}
          >
            My Appointments
          </Button>
        </div>
      </div>

      {/* Success Banner when appointment is booked */}
      {bookedAppointmentSuccess && (
        <Alert
          variant="success"
          onClose={() => setBookedAppointmentSuccess(null)}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900">
                Consultation appointment requested successfully!
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Scheduled for{' '}
                {new Date(bookedAppointmentSuccess.scheduled_start).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                <span className="font-semibold">{formatAppointmentDateTime(bookedAppointmentSuccess.scheduled_start)}</span>
                . The dental clinic will review and confirm your session.
              </p>
            </div>
          </div>
          <Link
            to="/patient/appointments"
            className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 underline ml-4 shrink-0"
          >
            View in My Appointments →
          </Link>
        </Alert>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by dentist name, specialty, or clinic location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-clinical-500 shadow-sm"
          />
        </div>

        {specialties.length > 2 && (
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {specialties.map((spec) => (
              <button
                key={spec}
                onClick={() => setSelectedSpecialty(spec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedSpecialty === spec
                    ? 'bg-clinical-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {spec === 'all' ? 'All Specialties' : spec}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Practitioner Cards Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <LoadingSkeleton variant="card" count={3} />
        </div>
      ) : error ? (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : filteredDentists.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Stethoscope className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No Verified Practitioners Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm
                ? `No dentists matched your search "${searchTerm}". Try a different keyword.`
                : 'No approved practitioners are currently listed in the directory.'}
            </p>
            {searchTerm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedSpecialty('all');
                }}
              >
                Clear Search Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDentists.map((dentist) => (
            <Card
              key={dentist.id}
              className="flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-clinical-50 border border-clinical-200 text-clinical-700 flex items-center justify-center font-bold text-base shrink-0">
                    {dentist.first_name[0]}{dentist.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CardTitle className="text-base text-slate-900 font-semibold truncate">
                        Dr. {dentist.first_name} {dentist.last_name}
                      </CardTitle>
                    </div>
                    <p className="text-xs font-medium text-clinical-600 mt-0.5">
                      {dentist.specialization || 'General Dentistry'}
                    </p>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-700 mt-1">
                      <UserCheck className="h-3.5 w-3.5 shrink-0" />
                      <span>Verified License: {dentist.license_number}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1 flex flex-col justify-between pt-0">
                <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  {dentist.clinic_name && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Building className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="font-medium truncate">{dentist.clinic_name}</span>
                    </div>
                  )}
                  {dentist.clinic_address && (
                    <div className="flex items-start gap-2 text-slate-500">
                      <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{dentist.clinic_address}</span>
                    </div>
                  )}
                  {dentist.years_of_experience > 0 && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Briefcase className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{dentist.years_of_experience} years clinical experience</span>
                    </div>
                  )}
                  {dentist.bio && (
                    <p className="text-slate-600 text-xs italic bg-slate-50 p-2 rounded-lg line-clamp-3">
                      "{dentist.bio}"
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    onClick={() => setSelectedDentistForBooking(dentist)}
                    className="w-full"
                    variant="primary"
                    size="sm"
                    leftIcon={Calendar}
                  >
                    Book Consultation
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Appointment Booking Modal */}
      <BookAppointmentModal
        dentist={selectedDentistForBooking}
        isOpen={Boolean(selectedDentistForBooking)}
        onClose={() => setSelectedDentistForBooking(null)}
        onSuccess={(appointment) => {
          setBookedAppointmentSuccess(appointment);
        }}
      />
    </div>
  );
};

export default PatientDentistDirectoryPage;
