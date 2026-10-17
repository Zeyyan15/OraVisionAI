import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Mic, MessageSquare, Calendar, Clock, ArrowRight, ArrowUpRight, RefreshCw, Search, Check, Headphones } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { listConsultations } from '../../api/consultations';
import { ConsultationResponse, ConsultationStatus } from '../../types/consultation';
import { formatAppointmentDate, formatAppointmentTime, formatAppointmentDay, formatAppointmentMonth } from '../../utils/dateTimeUtils';

type Filter = 'all' | ConsultationStatus;
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All sessions' }, { id: 'scheduled', label: 'Scheduled' },
  { id: 'active', label: 'Active' }, { id: 'ended', label: 'Completed' }, { id: 'failed', label: 'Closed' },
];
const statusLabels: Record<ConsultationStatus, string> = { scheduled: 'Scheduled', active: 'Active now', ended: 'Completed', failed: 'Closed' };
const modalities = { video: { icon: Video, label: 'Video consultation' }, audio: { icon: Mic, label: 'Audio consultation' }, chat: { icon: MessageSquare, label: 'Chat consultation' } };
const statusVariant = (status: ConsultationStatus) => status === 'active' ? 'success' : status === 'scheduled' ? 'info' : status === 'failed' ? 'danger' : 'neutral';
const initials = (name?: string | null) => (name || 'Dental practitioner').replace(/^Dr\.?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const sessionTime = (session: ConsultationResponse) => {
  const time = Date.parse(session.scheduled_start || session.created_at);
  return Number.isNaN(time) ? 0 : time;
};

export const PatientConsultationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<ConsultationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listConsultations();
      setConsultations(response?.items || response?.consultations || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load consultations.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void fetchConsultations(); }, [fetchConsultations]);
  const counts = useMemo(() => Object.fromEntries(filters.map(item => [item.id, item.id === 'all' ? consultations.length : consultations.filter(session => session.session_status === item.id).length])) as Record<Filter, number>, [consultations]);
  const upcoming = consultations.filter(session => session.session_status === 'scheduled').sort((a, b) => sessionTime(a) - sessionTime(b));
  const featured = consultations.find(session => session.session_status === 'active') || upcoming.find(session => sessionTime(session) >= Date.now()) || upcoming[0];
  const filtered = useMemo(() => consultations.filter(session =>
    (filter === 'all' || session.session_status === filter) &&
    `${session.dentist_name || ''} ${session.clinic_name || ''} ${session.consultation_type}`.toLowerCase().includes(query.trim().toLowerCase())
  ).sort((a, b) => {
    const order = { active: 0, scheduled: 1, ended: 2, failed: 3 };
    return order[a.session_status] - order[b.session_status] || (a.session_status === 'scheduled' ? sessionTime(a) - sessionTime(b) : sessionTime(b) - sessionTime(a));
  }), [consultations, filter, query]);
  const enter = (id: string) => navigate(`/patient/consultations/${id}`);
  const clearFilters = () => { setFilter('all'); setQuery(''); };

  return (
    <div className='teleconsultations mx-auto max-w-6xl space-y-7'>
      <header className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='results-eyebrow'>Care, wherever you are</p>
          <h1 className='mt-2 text-3xl font-semibold tracking-tight text-[#173f38] sm:text-4xl'>Teleconsultations</h1>
          <p className='mt-3 max-w-xl text-sm leading-relaxed text-slate-500'>Your time with a dentist. Join a consultation, prepare for your next visit, or revisit past sessions.</p>
        </div>
        <Button type='button' variant='outline' onClick={() => navigate('/patient/appointments')} className='!h-auto min-h-10 py-2'>
          <Calendar className='mr-2 h-4 w-4' />Manage appointments<ArrowUpRight className='ml-2 h-4 w-4' />
        </Button>
      </header>
      {loading ? <LoadingSkeleton variant='card' count={3} /> : error ? <ErrorState title='Could not load your sessions' message={error} onRetry={fetchConsultations} /> : <>
        <div className='grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]'>
          <section className='relative overflow-hidden rounded-2xl bg-[#173f38] p-6 text-white sm:p-8' aria-label='Featured consultation'>
            <div className='pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full border border-white/10' />
            <div className='pointer-events-none absolute -right-4 -top-4 h-48 w-48 rounded-full border border-white/10' />
            <div className='relative flex h-full flex-col'>
              <div className='flex items-center justify-between gap-3'>
                <p className='text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200'>{featured?.session_status === 'active' ? 'Your active session' : featured ? 'Your next consultation' : 'Connect with your dentist'}</p>
                <Video className='h-5 w-5 text-emerald-200' />
              </div>
              {featured ? <>
                <div className='mt-6 flex items-center gap-4'>
                  <span className='flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-lg font-medium'>{initials(featured.dentist_name)}</span>
                  <div className='min-w-0'><h2 className='text-xl font-semibold tracking-tight sm:text-2xl'>{featured.dentist_name || 'Your dental practitioner'}</h2><p className='mt-1 text-sm text-emerald-100/75'>{featured.clinic_name || 'Dental clinic'}</p></div>
                </div>
                <div className='mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-emerald-50'>
                  <span className='flex items-center gap-2'><Calendar className='h-4 w-4 text-emerald-200' />{featured.scheduled_start ? formatAppointmentDate(featured.scheduled_start) : 'Date to be confirmed'}</span>
                  <span className='flex items-center gap-2'><Clock className='h-4 w-4 text-emerald-200' />{featured.scheduled_start ? formatAppointmentTime(featured.scheduled_start) : 'Time to be confirmed'}</span>
                </div>
                <div className='mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5'>
                  <span className='flex items-center gap-2 text-xs text-emerald-100/80'>{React.createElement(modalities[featured.consultation_type].icon, { className: 'h-4 w-4' })}{modalities[featured.consultation_type].label}</span>
                  <Button type='button' onClick={() => enter(featured.id)} className='!h-auto min-h-10 !bg-white px-5 py-2 !text-[#173f38] hover:!bg-emerald-50'>{featured.session_status === 'active' ? 'Open active room' : 'Open waiting room'}<ArrowRight className='ml-2 h-4 w-4' /></Button>
                </div>
              </> : <>
                <h2 className='mt-8 max-w-md text-2xl font-semibold tracking-tight'>Your next conversation starts here.</h2>
                <p className='mt-3 max-w-md text-sm leading-relaxed text-emerald-100/80'>Consultation rooms appear here when they are created for your appointments.</p>
                <Button type='button' onClick={() => navigate('/patient/dentists')} className='mt-6 !h-auto min-h-10 self-start !bg-white py-2 !text-[#173f38]'>Find a dentist<ArrowRight className='ml-2 h-4 w-4' /></Button>
              </>}
            </div>
          </section>
          <aside className='rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7'>
            <span className='results-icon'><Headphones className='h-5 w-5' /></span>
            <h2 className='mt-4 text-lg font-semibold tracking-tight text-slate-800'>A little preparation helps</h2>
            <p className='mt-2 text-sm leading-relaxed text-slate-500'>Settle in before opening your room.</p>
            <ul className='mt-5 space-y-3 text-sm text-slate-600'>{['Choose a quiet, well-lit space', 'Keep your screening results nearby', 'Check your camera and microphone in the room'].map(text => <li key={text} className='flex items-start gap-2.5'><Check className='mt-0.5 h-4 w-4 shrink-0 text-[#087f70]' /><span>{text}</span></li>)}</ul>
          </aside>
        </div>
        <div className='flex flex-wrap gap-x-7 gap-y-3 border-b border-slate-200 pb-6 text-sm text-slate-500' aria-label='Consultation overview'>
          <span><strong className='mr-2 font-semibold tabular-nums text-slate-900'>{counts.scheduled}</strong>Scheduled</span>
          <span className='flex items-center'><span className='mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500' /><strong className='mr-2 font-semibold tabular-nums text-slate-900'>{counts.active}</strong>Active</span>
          <span><strong className='mr-2 font-semibold tabular-nums text-slate-900'>{counts.ended}</strong>Completed</span>
        </div>
        <section className='space-y-5' aria-label='Consultation sessions'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div><h2 className='text-xl font-semibold tracking-tight text-[#173f38]'>Your sessions</h2><p className='mt-1 text-xs text-slate-500'>All appointment times are shown in UTC.</p></div>
            <Button type='button' variant='ghost' size='sm' onClick={fetchConsultations}><RefreshCw className='mr-2 h-3.5 w-3.5' />Refresh</Button>
          </div>
          <div className='flex flex-col justify-between gap-4 2xl:flex-row 2xl:items-center'>
            <div className='flex gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1' aria-label='Filter by session status'>
              {filters.map(item => <button key={item.id} type='button' aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087f70] ${filter === item.id ? 'bg-white text-[#087f70] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{item.label}<span className={`ml-2 tabular-nums ${filter === item.id ? 'text-[#087f70]' : 'text-slate-400'}`}>{counts[item.id]}</span></button>)}
            </div>
            <div className='relative w-full 2xl:w-64'>
              <Search className='pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400' />
              <input type='search' aria-label='Search consultations' placeholder='Search dentist or clinic' value={query} onChange={event => setQuery(event.target.value)} className='h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#087f70] focus:ring-1 focus:ring-[#087f70]' />
            </div>
          </div>
          {filtered.length === 0 ? <EmptyState icon={Video} title={consultations.length === 0 ? 'Your consultations will appear here' : 'No matching sessions'} description={consultations.length === 0 ? 'Book an appointment with a dentist to get started.' : 'Try another status or search for a different dentist or clinic.'} actionLabel={consultations.length === 0 ? 'Find a dentist' : 'Clear filters'} onAction={consultations.length === 0 ? () => navigate('/patient/dentists') : clearFilters} className='!rounded-2xl !border-solid' /> : <div className='space-y-3'>
            {filtered.map(session => {
              const Icon = modalities[session.consultation_type].icon;
              return <article key={session.id} className={`flex flex-col gap-5 rounded-2xl border bg-white p-5 transition-shadow hover:shadow-sm sm:p-6 xl:flex-row xl:items-center ${session.session_status === 'active' ? 'border-emerald-200' : 'border-slate-200/80'}`}>
                <div className='flex min-w-0 flex-1 items-start gap-4'>
                  <div className='flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50'><span className='text-[10px] font-semibold uppercase tracking-wider text-slate-400'>{session.scheduled_start ? formatAppointmentMonth(session.scheduled_start) : 'DATE'}</span><span className='text-xl font-semibold tabular-nums text-[#173f38]'>{session.scheduled_start ? formatAppointmentDay(session.scheduled_start) : '—'}</span></div>
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'><h3 className='text-base font-semibold text-slate-800'>{session.dentist_name || 'Dental practitioner'}</h3><Badge className='whitespace-nowrap' variant={statusVariant(session.session_status)}>{statusLabels[session.session_status]}</Badge></div>
                    <p className='mt-1 text-sm text-slate-500'>{session.clinic_name || 'Dental clinic'}</p>
                    <div className='mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500'>
                      <span className='flex items-center gap-1.5'><Icon className='h-3.5 w-3.5 text-[#087f70]' />{modalities[session.consultation_type].label}</span>
                      <span className='flex items-center gap-1.5'><Clock className='h-3.5 w-3.5' />{session.scheduled_start ? `${formatAppointmentDate(session.scheduled_start)} · ${formatAppointmentTime(session.scheduled_start)}` : 'Time to be confirmed'}</span>
                      {session.duration_seconds > 0 && <span>{Math.max(1, Math.round(session.duration_seconds / 60))} min duration</span>}
                    </div>
                  </div>
                </div>
                <Button type='button' size='sm' variant={session.session_status === 'active' ? 'primary' : 'outline'} onClick={() => enter(session.id)} className='!h-auto min-h-10 shrink-0 py-2 xl:min-w-44'>{session.session_status === 'active' ? 'Open active room' : session.session_status === 'scheduled' ? 'Open waiting room' : 'View session summary'}<ArrowRight className='ml-2 h-4 w-4' /></Button>
              </article>;
            })}
          </div>}
        </section>
      </>}
    </div>
  );
};
