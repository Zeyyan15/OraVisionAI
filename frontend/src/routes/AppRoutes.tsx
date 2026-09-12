/**
 * OraVisionAI — Application Route Hierarchy
 *
 * Configures:
 * - Public routes (/login, /register, /landing, etc.)
 * - Protected role shells (/patient/*, /dentist/*, /admin/*)
 * - Error/Status routes (/unauthorized, /deactivated, 404)
 * - Patient screening workflow (Phase 23)
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

// Layouts & Shells
import { PublicLayout } from '../components/layout/PublicLayout';
import { PatientShell } from '../components/layout/PatientShell';
import { DentistShell } from '../components/layout/DentistShell';
import { AdminShell } from '../components/layout/AdminShell';

// Public Pages
import { LandingPage } from '../pages/public/LandingPage';
import { LoginPage } from '../pages/public/LoginPage';
import { RegisterPage } from '../pages/public/RegisterPage';
import { UnauthorizedPage } from '../pages/public/UnauthorizedPage';
import { DeactivatedPage } from '../pages/public/DeactivatedPage';
import { NotFoundPage } from '../pages/public/NotFoundPage';

// Shell Home Pages
import { PatientDashboard } from '../pages/patient/PatientDashboard';
import { DentistDashboard } from '../pages/dentist/DentistDashboard';
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { AdminAuditLogsPage } from '../pages/admin/AdminAuditLogsPage';
import { AdminScreeningAnalyticsPage } from '../pages/admin/AdminScreeningAnalyticsPage';
import { AdminAITelemetryPage } from '../pages/admin/AdminAITelemetryPage';
import { AdminTelehealthAnalyticsPage } from '../pages/admin/AdminTelehealthAnalyticsPage';
import { AdminAIModelsPage } from '../pages/admin/AdminAIModelsPage';

// Patient Screening Pages (Phase 23)
import { NewScreeningPage } from '../pages/patient/NewScreeningPage';
import { ScreeningResultsPage } from '../pages/patient/ScreeningResultsPage';
import { ScreeningsListPage } from '../pages/patient/ScreeningsListPage';

// Patient Teleconsultation Pages (Phase 25)
import { PatientConsultationsPage } from '../pages/patient/PatientConsultationsPage';
import { PatientConsultationRoomPage } from '../pages/patient/PatientConsultationRoomPage';

// Dentist Clinical Pages (Phase 24 & 25)
import { DentistAppointmentsPage } from '../pages/dentist/DentistAppointmentsPage';
import { DentistScreeningReviewPage } from '../pages/dentist/DentistScreeningReviewPage';
import { DentistProfilePage } from '../pages/dentist/DentistProfilePage';
import { DentistConsultationRoomPage } from '../pages/dentist/DentistConsultationRoomPage';

// Communication & Notification Pages (Phase 27 & 28)
import { PatientMessagesPage } from '../pages/patient/PatientMessagesPage';
import { DentistMessagesPage } from '../pages/dentist/DentistMessagesPage';
import { NotificationsPage } from '../pages/shared/NotificationsPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Layout Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/deactivated" element={<DeactivatedPage />} />
      </Route>

      {/* Patient Shell & Protected Routes */}
      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/patient/dashboard" replace />} />
        <Route path="dashboard" element={<PatientDashboard />} />
        <Route path="screenings" element={<ScreeningsListPage />} />
        <Route path="screenings/new" element={<NewScreeningPage />} />
        <Route path="screenings/:screeningId" element={<ScreeningResultsPage />} />
        <Route path="consultations" element={<PatientConsultationsPage />} />
        <Route path="consultations/:consultationId" element={<PatientConsultationRoomPage />} />
        <Route path="messages" element={<PatientMessagesPage />} />
        <Route path="messages/:conversationId" element={<PatientMessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      {/* Dentist Shell & Protected Routes */}
      <Route
        path="/dentist"
        element={
          <ProtectedRoute allowedRoles={['dentist']}>
            <DentistShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dentist/dashboard" replace />} />
        <Route path="dashboard" element={<DentistDashboard />} />
        <Route path="appointments" element={<DentistAppointmentsPage />} />
        <Route path="screenings/:screeningId/review" element={<DentistScreeningReviewPage />} />
        <Route path="consultations/:consultationId" element={<DentistConsultationRoomPage />} />
        <Route path="profile" element={<DentistProfilePage />} />
        <Route path="messages" element={<DentistMessagesPage />} />
        <Route path="messages/:conversationId" element={<DentistMessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      {/* Admin Shell & Protected Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="audit-logs" element={<AdminAuditLogsPage />} />
        <Route path="analytics/screenings" element={<AdminScreeningAnalyticsPage />} />
        <Route path="analytics/ai-telemetry" element={<AdminAITelemetryPage />} />
        <Route path="analytics/telehealth" element={<AdminTelehealthAnalyticsPage />} />
        <Route path="ai-models" element={<AdminAIModelsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      {/* 404 Not Found Catch-All */}
      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
