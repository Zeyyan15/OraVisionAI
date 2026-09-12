# OraVisionAI — Phase 16 Documentation: Conversations & Messaging Module

**Subsystem**: Direct Patient-Dentist Conversations & Asynchronous Messaging  
**Status**: Production-Ready, Complete, Verified  
**Schema Invariant**: Exactly 23 Tables Preserved (Zero New Migrations)  
**Phases Frozen**: Phases 3B through 15 completely preserved  

---

## 1. Executive Summary & Domain Scope

Phase 16 establishes persistent, secure, 1-on-1 asynchronous communication between patients and their authorized treating dentists.

### Core Boundaries & Guarantees
1. **Communication Infrastructure Only**: The messaging subsystem is solely communication infrastructure. It does NOT provide automated diagnosis, treatment plans, prescriptions, medication suggestions, risk scoring, AI inference, or NLP clinical interpretations.
2. **Server-Controlled Direct Messaging**: Phase 16 strictly implements `conversation_type="direct"`. The client cannot select or provide `conversation_type`. `consultation_chat` is deferred and reserved for future consultation/Stream Chat integration.
3. **Text Messaging Only**: Messages are restricted to `message_type="text"`. Attachments (`attachment_storage_path`) and `screening_share` are deferred to future phases. Client-supplied storage paths are rejected. All persisted messages have `attachment_storage_path = None`.
4. **Relationship-Governed Clinical Access**: Initiating or participating in a conversation strictly requires an active `PatientDentistRelationship` (`status == 'active'`). Unlinked patients and dentists cannot communicate (`403 Forbidden`).
5. **No Stream SDK / External Integration**: Stream identifiers (`stream_channel_id`, `stream_message_id`) are server-generated strings (`channel_{uuid}`, `msg_{uuid}`) reserved for future Stream integration. Zero external API calls, SDK dependencies, token minting, or webhooks exist.
6. **Zero Database Migrations**: The existing 23-table PostgreSQL schema is 100% complete and preserved. No tables, columns, constraints, or indexes were altered.

---

## 2. Authorization & Relationship Model

### Actor Criteria
- **Patient**: Must be authenticated via Firebase, active (`user.is_active == True`), and have role `patient`.
- **Dentist**: Must be authenticated via Firebase, active (`user.is_active == True`), have role `dentist`, and have `dentist.verification_status == 'approved'`.
- **Administrator**: Oversight role with read-only inspection access.

### Access Control Rules
1. **Active Patient-Dentist Relationship Required**:
   - `POST /api/dentists/{dentist_id}/conversations` and `POST /api/patients/{patient_id}/conversations` query `patient_dentist_relationships` where `status == 'active'`.
   - If no active relationship exists, access is denied with `403 Forbidden`.
2. **Server-Derived Identity**:
   - For patients: `patient_id` is derived from `current_user.id`.
   - For dentists: `dentist_id` is derived from `current_user.id`.
   - For messages: `sender_id` is derived from `current_user.id`.
   - Client payloads cannot provide or override identity fields.
3. **Participant Isolation**:
   - Unrelated dentists and cross-patient requests are blocked with `403 Forbidden`.
4. **Admin Oversight Constraints**:
   - Admins can inspect conversation listings, thread details, and message histories (`GET` routes).
   - Admins CANNOT post messages (`POST .../messages` returns `403 Forbidden`).
   - Admins CANNOT mark messages read (`PATCH .../read` returns `403 Forbidden`).
   - Administrative inspection emits an audit event with `actor_role="admin"`.

---

## 3. Lifecycle & Workflow Rules

### Conversation Lifecycle
```
                 [ Patient or Dentist Outreach ]
                               │
                               ▼
                        ┌───────────┐
                        │  active   │ ◄────────┐
                        └─────┬─────┘          │
                              │                │
                 (Participant/Admin Archive)   │ (Server-controlled
                              │                │  reactivation upon
                              ▼                │  re-outreach with
                       ┌─────────────┐         │  active relationship)
                       │  archived   │ ────────┘
                       └─────────────┘
```

1. **Idempotent Initiation**:
   - If an active direct conversation already exists between the patient and dentist, `POST` returns the existing thread with `200 OK`.
   - If no thread exists, the server generates a unique `stream_channel_id`, creates the thread with `is_active=True`, and returns `201 Created`.
2. **Archiving (`is_active = False`)**:
   - `PATCH /api/conversations/{conversation_id}/archive` accepts an empty payload (`extra="forbid"`).
   - The server unconditionally marks `is_active = False`.
   - When a conversation is archived, attempting to post new messages returns `400 Bad Request: Conversation is archived`.
3. **Server-Controlled Reactivation**:
   - Clients cannot submit `is_active=True`.
   - If outreach is re-initiated via `POST /api/dentists/{dentist_id}/conversations` or `POST /api/patients/{patient_id}/conversations`, the server re-validates that the `PatientDentistRelationship` remains `active`, reactivates the archived thread (`is_active=True`), and returns `200 OK`.

### Message Read Lifecycle
1. **Creation**:
   - Message is posted with `is_read = False` and `read_at = None`.
   - Parent `Conversation.last_message_at` is updated to message timestamp.
2. **Read Receipts**:
   - `PATCH /api/conversations/{conversation_id}/read` performs a single atomic SQL update marking unread messages where `sender_id != current_user.id` as `is_read = True`, `read_at = now()`.
   - Senders cannot mark their own messages as read.
   - Admins receive `403 Forbidden`.

---

## 4. API Endpoints Reference

All 9 endpoints are mounted under `/api`:

| Method | Path | Auth / Role | Summary | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/dentists/{dentist_id}/conversations` | Patient (`active`) | Initiate/reactivate thread with dentist | `201 Created`, `200 OK`, `403 Forbidden`, `404 Not Found` |
| `POST` | `/api/patients/{patient_id}/conversations` | Dentist (`approved`) | Initiate/reactivate thread with patient | `201 Created`, `200 OK`, `403 Forbidden`, `404 Not Found` |
| `GET` | `/api/conversations` | Patient, Dentist, Admin | List threads scoped to caller | `200 OK`, `401 Unauthorized` |
| `GET` | `/api/conversations/{conversation_id}` | Participant, Admin | Retrieve conversation details | `200 OK`, `403 Forbidden`, `404 Not Found` |
| `PATCH` | `/api/conversations/{conversation_id}/archive` | Participant, Admin | Archive conversation thread | `200 OK`, `403 Forbidden`, `404 Not Found` |
| `POST` | `/api/conversations/{conversation_id}/messages` | Participant (Non-admin) | Post text message in active thread | `201 Created`, `400 Bad Request`, `403 Forbidden` |
| `GET` | `/api/conversations/{conversation_id}/messages` | Participant, Admin | List messages with limit/offset | `200 OK`, `403 Forbidden`, `404 Not Found` |
| `GET` | `/api/conversations/{conversation_id}/messages/{message_id}` | Participant, Admin | Retrieve single message details | `200 OK`, `403 Forbidden`, `404 Not Found` |
| `PATCH` | `/api/conversations/{conversation_id}/read` | Participant (Non-admin) | Mark incoming unread messages as read | `200 OK`, `403 Forbidden`, `404 Not Found` |

---

## 5. Schemas & Models

### Conversation Schemas
- `ConversationCreate`: Empty schema (`extra="forbid"`). Server unconditionally enforces `conversation_type="direct"`.
- `ConversationArchive`: Empty schema (`extra="forbid"`). Server unconditionally sets `is_active=False`.
- `ConversationResponse`: Full entity representation including `id`, `patient_id`, `dentist_id`, `stream_channel_id`, `conversation_type`, `is_active`, `last_message_at`, `created_at`, `updated_at`, enriched with `patient_name`, `dentist_name`, `clinic_name`, and `unread_count`.
- `ConversationListResponse`: Container with `total` and `items: List[ConversationResponse]`.

### Message Schemas
- `MessageCreate`: Accepts `content` (1–4000 characters) and `message_type: Literal["text"] = "text"`. `extra="forbid"`. Client cannot pass `sender_id`, `attachment_storage_path`, or `stream_message_id`.
- `MessageResponse`: Full entity representation including `id`, `conversation_id`, `sender_id`, `stream_message_id`, `message_type`, `content`, `attachment_storage_path`, `is_read`, `read_at`, `created_at`, `sender_name`, `sender_role`.
- `MessageListResponse`: Container with `total`, `limit`, `offset`, and `items: List[MessageResponse]`.
- `MessageReadResponse`: Response container with `marked_read_count` and `conversation_id`.

---

## 6. Concurrency & Transaction Strategy

1. **Unique Constraint Authority**:
   - `UniqueConstraint("patient_id", "dentist_id", "conversation_type", name="uq_patient_dentist_conv")` is the definitive PostgreSQL concurrency authority.
2. **Graceful Duplicate Handling**:
   - If concurrent initiation requests occur, SQLAlchemy catches `IntegrityError`, calls `await db.rollback()`, and re-queries the committed conversation record.
   - If the existing record was archived, it is reactivated and returned.
3. **Single-Statement Read Receipts**:
   - Executed via `UPDATE messages SET is_read = TRUE, read_at = :now WHERE conversation_id = :cid AND sender_id != :uid AND is_read = FALSE;` preventing row-by-row race conditions.

---

## 7. Audit Logging & Privacy Integrity

The subsystem emits 6 dedicated audit events to the immutable `audit_logs` table:

| Action | Resource Type | Resource ID | Logged Details (Structural Only) |
| :--- | :--- | :--- | :--- |
| `CONVERSATION_CREATED` | `conversation` | `conversation.id` | `{"patient_id": "...", "dentist_id": "...", "conversation_type": "direct", "stream_channel_id": "...", "created_by_role": "..."}` |
| `CONVERSATION_VIEWED` | `conversation` | `conversation.id` | `{"actor_id": "...", "actor_role": "..."}` |
| `CONVERSATION_ARCHIVED` | `conversation` | `conversation.id` | `{"archived_by_id": "...", "actor_role": "..."}` |
| `MESSAGE_SENT` | `message` | `message.id` | `{"conversation_id": "...", "sender_id": "...", "message_type": "text", "character_count": N}` |
| `MESSAGES_VIEWED` | `conversation` | `conversation.id` | `{"message_count": N, "limit": N, "offset": N, "viewer_role": "..."}` |
| `MESSAGES_READ` | `conversation` | `conversation.id` | `{"marked_read_count": N, "reader_id": "..."}` |

### Privacy Invariants
- **No plaintext message content** is ever written to audit logs.
- **No attachment contents or storage paths** are recorded.
- **No credentials, tokens, or passwords** are recorded.
- **No unnecessary clinical content** is recorded.

---

## 8. Deferred Capabilities & Future Boundaries

The following features are explicitly deferred to future phases:
1. `conversation_type="consultation_chat"`: Reserved for synchronized video consultation chat channels.
2. `message_type="image"` & file attachments: Reserved for dedicated virus-scanned upload workflows.
3. `message_type="screening_share"`: Reserved for formal clinical report and AI finding sharing.
4. Stream Chat API & SDK Integration: Placeholder strings (`channel_{uuid}`, `msg_{uuid}`) maintain database compatibility until external provider integration.
