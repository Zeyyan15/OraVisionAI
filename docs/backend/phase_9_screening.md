# OraVisionAI — Phase 9A Backend Documentation
## Screening Lifecycle & Firebase Storage Integration

---

## 1. Overview

Phase 9A implements the backend infrastructure for patient oral health screening sessions and secure cloud image storage.
It establishes the foundation for future AI inference pipelines (EfficientNet classification, YOLO lesion detection, XAI heatmaps) while strictly separating data storage from inference execution.

---

## 2. Screening Lifecycle Flow

```
Patient Client
      │
      ▼ POST /api/screenings
[Screening Created: status="pending", is_deleted=False]
      │
      ▼ POST /api/screenings/{id}/images (multipart/form-data)
[StorageService Validation: MIME, Magic Bytes, Extension, Size]
      │
      ▼
[Firebase Storage Upload: screenings/{patient_id}/{screening_id}/{safe_uuid}.ext]
      │
      ▼
[PostgreSQL: screening_images metadata record inserted]
      │
      ▼
[Ready for AI Inference Service (Future Phase 9B)]
```

---

## 3. Endpoints

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/api/screenings` | `require_patient` | Create a new screening session header |
| `GET` | `/api/screenings` | `require_patient` | List patient's active screenings (paginated) |
| `GET` | `/api/screenings/{id}` | `require_patient` | Retrieve detailed screening session with attached images |
| `POST` | `/api/screenings/{id}/images` | `require_patient` | Upload oral photograph and persist metadata |
| `DELETE` | `/api/screenings/{id}` | `require_patient` | Soft-delete a screening session (audit preserved) |

---

## 4. File Validation & Security Rules

1. **Allowed Extensions**: `.jpg`, `.jpeg`, `.png`, `.webp` (case-insensitive).
2. **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`.
3. **Magic Bytes Signature Inspection**:
   - JPEG: Starts with `\xff\xd8`
   - PNG: Starts with `\x89PNG\r\n\x1a\n`
   - WEBP: Starts with `RIFF....WEBP`
4. **Size Restriction**: Max upload size governed by `MAX_UPLOAD_SIZE_BYTES` (default: 15 MB).
5. **Collision-Resistant Filenames**: Generates safe UUID-based filenames (`uuid4().hex.ext`), avoiding directory traversal attacks and namespace collisions.

---

## 5. Storage Architecture & Rollback

- **Storage Structure**:
  ```
  screenings/
      <patient_id>/
          <screening_id>/
              <uuid4_hash>.jpg
  ```
- **Transaction Safety**: If a PostgreSQL database commit fails after the cloud upload completes, `StorageService.delete_storage_object` is triggered to remove the uploaded object, preventing orphaned files in Firebase Storage.

---

## 6. Soft-Delete Behavior

- Deleting a screening sets `is_deleted = True` and `deleted_at = func.now()`.
- Soft-deleted screenings are excluded from all patient listings (`GET /api/screenings`) and detail lookups (`GET /api/screenings/{id}`).
- Database records and stored clinical images are preserved for audit and clinical review integrity.

---

## 7. Configuration Variables

| Variable | Default | Purpose |
|---|---|---|
| `FIREBASE_STORAGE_BUCKET` | `""` | Firebase Cloud Storage bucket name |
| `MAX_UPLOAD_SIZE_BYTES` | `15728640` (15 MB) | Maximum allowable upload file size |
| `ALLOWED_IMAGE_MIME_TYPES` | `["image/jpeg","image/png","image/webp"]` | Permitted upload MIME content types |
| `ALLOWED_IMAGE_EXTENSIONS` | `[".jpg",".jpeg",".png",".webp"]` | Permitted image file extensions |
