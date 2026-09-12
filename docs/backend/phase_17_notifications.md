# OraVisionAI — Phase 17: Notifications & Notification Management

**Status**: IMPLEMENTED & FROZEN  
**Database Tables**: Exactly 23 tables preserved in `Base.metadata`  
**Migrations**: 0 new migrations  
**Frozen Dependencies**: Phases 3B through 16 remain frozen and unaltered  

---

## 1. Executive Objective

Phase 17 implements persistent, multi-tenant in-app notifications and notification state management on top of the existing `notifications` database entity.

> [!IMPORTANT]
> **Clinical Safety Disclaimer**: Phase 17 is strictly operational messaging and communication infrastructure. It is **NOT** a clinical diagnosis engine. It performs zero automated clinical decision-making, disease diagnosis, risk re-scoring, treatment recommendation, medication prescription, or NLP clinical analysis.

---

## 2. Existing Database Schema

The `notifications` table was provisioned in the initial migration `001_initial_database_schema` without requiring schema modifications:

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `default=uuid.uuid4` | Unique record identifier |
| `user_id` | `UUID` | Foreign Key to `users.id`, `ON DELETE CASCADE`, NOT NULL | Recipient user ID |
| `notification_type` | `VARCHAR(50)` | Checked by `chk_notification_type`, NOT NULL | Operational notification category |
| `title` | `VARCHAR(200)` | NOT NULL | Brief headline |
| `message` | `TEXT` | NOT NULL | Safe operational message body |
| `action_url` | `VARCHAR(255)` | Nullable | Deep link target for in-app client navigation |
| `is_read` | `BOOLEAN` | Default `False`, NOT NULL | Read status flag |
| `read_at` | `TIMESTAMPTZ` | Nullable | Timestamp when marked as read |
| `created_at` | `TIMESTAMPTZ` | Server default `now()`, NOT NULL | Timestamp when created |

### Check Constraint: `chk_notification_type`
Restricts permissible categories to:
- `screening_completed`
- `screening_failed`
- `appointment_booked`
- `appointment_confirmed`
- `appointment_cancelled`
- `dentist_verified`
- `dentist_assessment_added`
- `new_message`
- `system_alert`

### Index: `idx_notifications_user_unread`
Composite index on `("user_id", "is_read", "created_at")`. Supports direct unread filtering and timestamp ordering for user inboxes.

---

## 3. Server-Controlled Notification Creation & Authorization

1. **No Public Creation Endpoint**: Ordinary clients (patients, dentists) cannot call any HTTP endpoint to create notifications. There is NO `POST /api/notifications` endpoint.
2. **Server-Derived Identity**: The recipient (`user_id`), notification type, title, and body are generated exclusively by internal server workflows.
3. **Multi-Tenant User Isolation**:
   - `GET /api/notifications` filters strictly by `Notification.user_id == current_user.id`.
   - `GET /api/notifications/{id}` returns `404 Not Found` if the requested notification belongs to another user (preventing ID enumeration).
   - `PATCH /api/notifications/{id}/read` permits mutation only if `notification.user_id == current_user.id`.
   - Admins can only view and mutate their own notifications through these endpoints; cross-user tampering is strictly prevented.

---

## 4. Healthcare Privacy & PHI Protection

Notifications adhere to strict clinical data minimization:
1. **Zero Diagnostic Labels**: Notifications do not disclose cancer classification, lesion names, confidence percentages, or risk levels.
2. **Zero Message Plaintext**: Message notifications alert users that a communication was received without exposing message body text in alerts.
3. **Zero Credentials**: No passwords, tokens, API keys, or cloud storage URLs are placed in notifications.
4. **Action URL Navigation**: Resource context is handled via relative paths (e.g. `/appointments/{uuid}`, `/conversations/{uuid}`, `/screenings/{uuid}`). Access to the underlying resource remains independently authorized by that resource's domain service.

---

## 5. Read / Unread Lifecycle

- **Initial State**: Notifications are created with `is_read=False` and `read_at=None`.
- **Individual Read**: `PATCH /api/notifications/{id}/read` sets `is_read=True` and `read_at=now()` idempotently. If already read, `read_at` is preserved.
- **Bulk Read**: `PATCH /api/notifications/read-all` executes an atomic SQL UPDATE on all unread records belonging to `current_user.id`, returning `marked_read_count`.
- **Unread Count**: `GET /api/notifications/unread-count` returns a lightweight integer count (`{"unread_count": int}`).

---

## 6. Pagination & Ordering Realities

- **Pagination**: Standard `limit` (1–100, default 50) and `offset` ($\ge 0$, default 0).
- **Ordering**:
  - Primary sort: `Notification.created_at.desc()`.
  - Secondary sort: `Notification.id.desc()` as a deterministic tie-breaker.
- **Index Alignment**: The primary sort aligns with `idx_notifications_user_unread` (`user_id`, `is_read`, `created_at`). The secondary sort `id DESC` is not indexed and functions as an in-memory/temporary tie-breaker. Cursor/keyset pagination remains deferred.

---

## 7. Application-Level Duplicate Suppression Limitations

- **Best-Effort Only**: The database schema does not possess an `idempotency_key` column or unique constraint.
- **Suppression Window**: Before creating single-occurrence event notifications, `NotificationService` checks for an existing record with identical `(user_id, notification_type, action_url)` within the last 300 seconds.
- **Concurrency Note**: This application-level check prevents ordinary rapid double-clicks and sequential retries, but does not provide absolute database-level concurrency safety under race conditions. Strong database-level unique keys are deferred to a future migration.

---

## 8. Domain Integrations with Frozen Phases

### A. Appointment Integration (Phase 14 Frozen)
`NotificationService` provides server-side helper methods without modifying `AppointmentService`:
- `notify_appointment_booked`: Sent to Assigned Dentist (`appointment.dentist.user_id`).
- `notify_appointment_confirmed`: Sent to Booking Patient (`appointment.patient.user_id`).
- `notify_appointment_cancelled`:
  - If Patient cancels: Recipient is Assigned Dentist (`appointment.dentist.user_id`).
  - If Dentist cancels: Recipient is Booking Patient (`appointment.patient.user_id`).
  - If Admin cancels: Recipients are **both** Patient and Dentist. The Admin actor receives no notification.

### B. Messaging Integration (Phase 16 Frozen)
`NotificationService.notify_new_message`:
- Recipient is strictly the opposing conversation participant.
- Senders never receive notifications for their own messages.
- Admins never receive participant message notifications.
- Payload contains safe text (`"You have received a new message from {name}."`) without message plaintext.

### C. Dentist Assessment Integration (Phase 13 Frozen)
`NotificationService.notify_dentist_assessment_added`:
- Triggers **only when an assessment is finalized** (`is_finalized=True`).
- Draft assessments (`is_finalized=False`) never generate notifications.
- Recipient is the screening patient (`screening.patient.user_id`).

### D. Screening Integration (Phase 9 Frozen)
`NotificationService.notify_screening_completed` & `notify_screening_failed`:
- `screening_completed` corresponds to `screening.status = "completed"` upon AI inference finish.
- Report generation in Phase 11 is a distinct downstream task and does not trigger separate notifications.
- Safe templates contain no diagnostic labels.

### E. System Alerts
`NotificationService.create_system_alert`:
- Internal server-side method for administrative workflows (e.g. account activation/deactivation).
- Validates target user existence; no public client creation endpoint.

---

## 9. API Endpoint Specification

All endpoints are mounted under `/api/notifications` with `get_current_active_user` authentication:

| Method | Path | Auth | Roles | Request | Response | Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Bearer Token | Patient, Dentist, Admin | Query: `is_read`, `limit`, `offset` | `NotificationListResponse` | List user's notifications (newest first) |
| `GET` | `/api/notifications/unread-count` | Bearer Token | Patient, Dentist, Admin | None | `NotificationUnreadCountResponse` | Fast scalar unread count |
| `GET` | `/api/notifications/{id}` | Bearer Token | Patient, Dentist, Admin | None | `NotificationResponse` | Get single owned notification (404 if not owner) |
| `PATCH` | `/api/notifications/{id}/read` | Bearer Token | Patient, Dentist, Admin | None | `NotificationResponse` | Mark notification as read idempotently |
| `PATCH` | `/api/notifications/read-all` | Bearer Token | Patient, Dentist, Admin | None | `NotificationReadAllResponse` | Mark all user unread notifications read |

---

## 10. Audit Logging & Security

The following regulatory audit events are written to `audit_logs`:
- `NOTIFICATION_VIEWED`: Recorded on single notification retrieval.
- `NOTIFICATION_READ`: Recorded on single notification read transition.
- `NOTIFICATIONS_READ_ALL`: Recorded on bulk read transition with `marked_read_count`.

**Audit Privacy**: Audit details contain only minimal structural IDs (`user_id`, `notification_type`, `read_at`, `marked_read_count`). Message bodies, clinical details, tokens, and passwords are never logged.

---

## 11. Deferred Future Work

The following features are outside Phase 17 scope and deferred:
1. Push notifications & Firebase Cloud Messaging (FCM).
2. Email notifications (SendGrid / SMTP).
3. SMS alerts (Twilio).
4. WebSockets / real-time streaming bells.
5. Teleconsultation-specific notification types (e.g. `consultation_started`, requiring schema migration).
6. Strong database-level idempotency keys.
7. Frontend notification bell / drawer UI.
