"""
OraVisionAI — Phase 34 Chat File Attachments & Share Report Verification Suite

Comprehensive test coverage across all Phase 34 requirements:
1. Valid JPEG attachment validation (MIME, ext, magic bytes, storage path)
2. Valid PNG attachment validation
3. Valid WEBP attachment validation
4. Valid PDF document attachment validation
5. File validation: rejection of oversized file (>10MB)
6. File validation: rejection of disallowed file extension (.exe, .zip)
7. File validation: rejection of extension-MIME mismatch
8. File validation: rejection of spoofed magic bytes (text payload with .jpg header)
9. File validation: rejection of empty 0-byte attachment
10. Send message with single image attachment (verifies message_type="image", DB row, notification)
11. Send message with single PDF attachment (verifies message_type="attachment", DB row, notification)
12. Send message with multiple attachments (up to 5 files, mixed types)
13. Send message with both text caption and attachments
14. Send message with attachments only (no text caption)
15. Send message with > 5 attachments rejected with HTTP 400
16. Non-participant sending attachments rejected with HTTP 403
17. Administrator sending attachments rejected with HTTP 403
18. Authorized participant generates valid 15-minute signed URL for attachment
19. Non-participant requesting attachment signed URL rejected with HTTP 403
20. Dentist shares authorized clinical report in conversation (verifies message_type="report_share", report_id, zero PDF duplication)
21. Patient attempting to share clinical report rejected with HTTP 403
22. Dentist attempting to share another patient's report rejected with HTTP 403
23. Shareable reports endpoint returns authorized reports for conversation's patient; patient rejected with HTTP 403
24. Backward compatibility: existing text messages, pagination, and read receipts work without regressions
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

# Setup path and env
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.session import get_session_factory
from app.models.audit_log import AuditLog
from app.models.conversation import Conversation
from app.models.dentist import Dentist
from app.models.message import Message
from app.models.message_attachment import MessageAttachment
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.report import Report
from app.models.screening import Screening
from app.models.user import User
from app.schemas.message import MessageCreate, ReportShareRequest
from app.services.conversation_service import ConversationService
from app.services.storage_service import StorageService


# Test binary payloads with authentic magic bytes
JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00" + b"\x01" * 100 + b"\xff\xd9"
PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x10\x00\x00\x00\x10\x08\x06\x00\x00\x00\x1f\xf3\xffa" + b"\x00" * 80 + b"IEND\xaeB`\x82"
WEBP_BYTES = b"RIFF\x24\x00\x00\x00WEBPVP8 \x18\x00\x00\x000\x01\x00\x9d\x01\x2a\x10\x00\x10\x00" + b"\x00" * 40
PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"


async def run_phase34_suite():
    print("=" * 80)
    print("ORAVISIONAI PHASE 34 — CHAT ATTACHMENTS & REPORT SHARING VERIFICATION SUITE")
    print("=" * 80)

    test_suffix = uuid.uuid4().hex[:8]
    factory = get_session_factory()
    passed = 0
    total = 24

    user_ids = []
    dentist_ids = []
    patient_ids = []
    conv_ids = []
    message_ids = []
    screening_ids = []
    report_ids = []

    try:
        # =====================================================================
        # SETUP TEST FIXTURES
        # =====================================================================
        print("\n[SETUP] Creating test users, patients, dentists, relationships, screening, and report...")
        async with factory() as db:
            now_dt = datetime.now(timezone.utc)

            # 1. Treating Dentist
            u_dentist = User(
                id=uuid.uuid4(),
                email=f"dentist_{test_suffix}@test.oravision.ai",
                firebase_uid=f"fb_dentist_{test_suffix}",
                first_name="Marcus",
                last_name="Vance",
                role="dentist",
                is_active=True,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(u_dentist)
            user_ids.append(u_dentist.id)

            dentist = Dentist(
                id=uuid.uuid4(),
                user_id=u_dentist.id,
                license_number=f"LIC-{test_suffix[:6].upper()}",
                clinic_name="Vance Oral Care Center",
                verification_status="approved",
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(dentist)
            dentist_ids.append(dentist.id)

            # 2. Patient 1 (in conversation)
            u_patient = User(
                id=uuid.uuid4(),
                email=f"patient_{test_suffix}@test.oravision.ai",
                firebase_uid=f"fb_patient_{test_suffix}",
                first_name="Jane",
                last_name="Doe",
                role="patient",
                is_active=True,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(u_patient)
            user_ids.append(u_patient.id)

            patient = Patient(
                id=uuid.uuid4(),
                user_id=u_patient.id,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(patient)
            patient_ids.append(patient.id)

            # 3. Patient 2 (unrelated)
            u_patient2 = User(
                id=uuid.uuid4(),
                email=f"patient2_{test_suffix}@test.oravision.ai",
                firebase_uid=f"fb_patient2_{test_suffix}",
                first_name="Bob",
                last_name="Smith",
                role="patient",
                is_active=True,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(u_patient2)
            user_ids.append(u_patient2.id)

            patient2 = Patient(
                id=uuid.uuid4(),
                user_id=u_patient2.id,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(patient2)
            patient_ids.append(patient2.id)

            # 4. Outside Dentist (unrelated)
            u_dentist2 = User(
                id=uuid.uuid4(),
                email=f"dentist2_{test_suffix}@test.oravision.ai",
                firebase_uid=f"fb_dentist2_{test_suffix}",
                first_name="Elena",
                last_name="Rostova",
                role="dentist",
                is_active=True,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(u_dentist2)
            user_ids.append(u_dentist2.id)

            dentist2 = Dentist(
                id=uuid.uuid4(),
                user_id=u_dentist2.id,
                license_number=f"LIC2-{test_suffix[:6].upper()}",
                clinic_name="Rostova Dental",
                verification_status="approved",
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(dentist2)
            dentist_ids.append(dentist2.id)

            # 5. Administrator
            u_admin = User(
                id=uuid.uuid4(),
                email=f"admin_{test_suffix}@test.oravision.ai",
                firebase_uid=f"fb_admin_{test_suffix}",
                first_name="Admin",
                last_name="User",
                role="admin",
                is_active=True,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(u_admin)
            user_ids.append(u_admin.id)

            # 6. Active Relationship: dentist <-> patient
            rel = PatientDentistRelationship(
                id=uuid.uuid4(),
                patient_id=patient.id,
                dentist_id=dentist.id,
                status="active",
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(rel)

            # 7. Active Conversation: patient <-> dentist
            conv = Conversation(
                id=uuid.uuid4(),
                patient_id=patient.id,
                dentist_id=dentist.id,
                stream_channel_id=f"channel_{test_suffix}",
                conversation_type="direct",
                is_active=True,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(conv)
            conv_ids.append(conv.id)

            # 8. Screening & Clinical Report for Patient 1
            screening1 = Screening(
                id=uuid.uuid4(),
                patient_id=patient.id,
                created_by_id=u_patient.id,
                status="completed",
                is_deleted=False,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(screening1)
            screening_ids.append(screening1.id)

            report1 = Report(
                id=uuid.uuid4(),
                screening_id=screening1.id,
                report_number=f"RPT-{test_suffix[:6].upper()}-01",
                report_title="Comprehensive Oral Health Screening",
                pdf_storage_path=f"reports/{screening1.id}/report.pdf",
                summary="Clear oral mucosa with no suspicious findings.",
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(report1)
            report_ids.append(report1.id)

            # 9. Screening & Report for Patient 2 (to test unauthorized report sharing)
            screening2 = Screening(
                id=uuid.uuid4(),
                patient_id=patient2.id,
                created_by_id=u_patient2.id,
                status="completed",
                is_deleted=False,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(screening2)
            screening_ids.append(screening2.id)

            report2 = Report(
                id=uuid.uuid4(),
                screening_id=screening2.id,
                report_number=f"RPT-{test_suffix[:6].upper()}-02",
                report_title="Patient 2 Screening Report",
                pdf_storage_path=f"reports/{screening2.id}/report.pdf",
                summary="Localized erythema.",
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(report2)
            report_ids.append(report2.id)

            await db.commit()

        print("[SETUP] Fixtures created successfully.")

        # =====================================================================
        # TEST 1: Valid JPEG Validation
        # =====================================================================
        ext, mime, att_type = StorageService.validate_chat_attachment(JPEG_BYTES, "photo.jpg", "image/jpeg")
        assert ext in [".jpg", ".jpeg"]
        assert mime == "image/jpeg"
        assert att_type == "image"
        print(f"[PASS] TEST 1: Valid JPEG validated (ext={ext}, mime={mime}, type={att_type})")
        passed += 1

        # =====================================================================
        # TEST 2: Valid PNG Validation
        # =====================================================================
        ext, mime, att_type = StorageService.validate_chat_attachment(PNG_BYTES, "scan.png", "image/png")
        assert ext == ".png"
        assert mime == "image/png"
        assert att_type == "image"
        print(f"[PASS] TEST 2: Valid PNG validated (ext={ext}, mime={mime}, type={att_type})")
        passed += 1

        # =====================================================================
        # TEST 3: Valid WEBP Validation
        # =====================================================================
        ext, mime, att_type = StorageService.validate_chat_attachment(WEBP_BYTES, "oral_view.webp", "image/webp")
        assert ext == ".webp"
        assert mime == "image/webp"
        assert att_type == "image"
        print(f"[PASS] TEST 3: Valid WEBP validated (ext={ext}, mime={mime}, type={att_type})")
        passed += 1

        # =====================================================================
        # TEST 4: Valid PDF Document Validation
        # =====================================================================
        ext, mime, att_type = StorageService.validate_chat_attachment(PDF_BYTES, "records.pdf", "application/pdf")
        assert ext == ".pdf"
        assert mime == "application/pdf"
        assert att_type == "document"
        print(f"[PASS] TEST 4: Valid PDF document validated (ext={ext}, mime={mime}, type={att_type})")
        passed += 1

        # =====================================================================
        # TEST 5: Oversized File Rejection (>10 MB)
        # =====================================================================
        try:
            oversized_payload = b"\xff\xd8\xff" + b"\x00" * (10 * 1024 * 1024 + 10)
            StorageService.validate_chat_attachment(oversized_payload, "big.jpg", "image/jpeg")
            assert False, "Oversized file should have been rejected"
        except ValueError as e:
            assert "exceeds maximum allowed limit" in str(e)
            print("[PASS] TEST 5: Oversized file rejected (>10MB)")
            passed += 1

        # =====================================================================
        # TEST 6: Disallowed Extension Rejection (.exe, .zip)
        # =====================================================================
        try:
            StorageService.validate_chat_attachment(b"MZ\x90\x00", "malware.exe", "application/octet-stream")
            assert False, "Disallowed extension should have been rejected"
        except ValueError as e:
            assert "Unsupported file extension" in str(e)
            print("[PASS] TEST 6: Disallowed file extension (.exe) rejected")
            passed += 1

        # =====================================================================
        # TEST 7: Extension-MIME Mismatch Rejection
        # =====================================================================
        try:
            StorageService.validate_chat_attachment(JPEG_BYTES, "photo.jpg", "application/pdf")
            assert False, "MIME-extension mismatch should have been rejected"
        except ValueError as e:
            assert "does not match declared MIME" in str(e)
            print("[PASS] TEST 7: Extension-MIME mismatch rejected (.jpg with application/pdf)")
            passed += 1

        # =====================================================================
        # TEST 8: Spoofed Magic Bytes Rejection
        # =====================================================================
        try:
            fake_jpeg = b"This is plain text pretending to be a JPEG image"
            StorageService.validate_chat_attachment(fake_jpeg, "fake.jpg", "image/jpeg")
            assert False, "Spoofed magic bytes should have been rejected"
        except ValueError as e:
            assert "does not match JPEG header signature" in str(e)
            print("[PASS] TEST 8: Spoofed magic bytes rejected (invalid JPEG header)")
            passed += 1

        # =====================================================================
        # TEST 9: Empty File Rejection (0 bytes)
        # =====================================================================
        try:
            StorageService.validate_chat_attachment(b"", "empty.png", "image/png")
            assert False, "Empty file should have been rejected"
        except ValueError as e:
            assert "empty (0 bytes)" in str(e)
            print("[PASS] TEST 9: Empty 0-byte file rejected")
            passed += 1

        # =====================================================================
        # TEST 10: Send Single Image Attachment Message
        # =====================================================================
        async with factory() as db:
            msg_resp = await ConversationService.send_message_with_attachments(
                db=db,
                conversation_id=conv.id,
                user=u_patient,
                files=[("molar_photo.jpg", JPEG_BYTES, "image/jpeg")],
                content="Here is a photo of my upper left molar",
            )
            assert msg_resp.message_type == "image"
            assert msg_resp.conversation_id == conv.id
            assert msg_resp.sender_id == u_patient.id
            assert len(msg_resp.attachments) == 1
            att = msg_resp.attachments[0]
            assert att.original_filename == "molar_photo.jpg"
            assert att.attachment_type == "image"
            assert msg_resp.attachment_storage_path is not None
            message_ids.append(msg_resp.id)

            # Check recipient notification
            stmt_notif = select(Notification).where(
                Notification.user_id == u_dentist.id,
                Notification.notification_type == "new_message",
            ).order_by(Notification.created_at.desc())
            notif = (await db.execute(stmt_notif)).scalars().first()
            assert notif is not None
            assert "attachment" in notif.message.lower()
            print(f"[PASS] TEST 10: Single image attachment sent: message_type='{msg_resp.message_type}', id={msg_resp.id}")
            passed += 1

        # =====================================================================
        # TEST 11: Send Single PDF Document Attachment Message
        # =====================================================================
        async with factory() as db:
            msg_resp_pdf = await ConversationService.send_message_with_attachments(
                db=db,
                conversation_id=conv.id,
                user=u_dentist,
                files=[("treatment_instructions.pdf", PDF_BYTES, "application/pdf")],
                content="Please review these post-op instructions",
            )
            assert msg_resp_pdf.message_type == "attachment"
            assert len(msg_resp_pdf.attachments) == 1
            assert msg_resp_pdf.attachments[0].attachment_type == "document"
            message_ids.append(msg_resp_pdf.id)

            stmt_notif_p = select(Notification).where(
                Notification.user_id == u_patient.id,
                Notification.notification_type == "new_message",
            ).order_by(Notification.created_at.desc())
            notif_p = (await db.execute(stmt_notif_p)).scalars().first()
            assert notif_p is not None
            print(f"[PASS] TEST 11: Single PDF attachment sent: message_type='{msg_resp_pdf.message_type}', id={msg_resp_pdf.id}")
            passed += 1

        # =====================================================================
        # TEST 12: Multiple Attachments Upload (Up to 5 files, mixed)
        # =====================================================================
        async with factory() as db:
            multi_files = [
                ("view1.jpg", JPEG_BYTES, "image/jpeg"),
                ("view2.png", PNG_BYTES, "image/png"),
                ("view3.webp", WEBP_BYTES, "image/webp"),
                ("doc.pdf", PDF_BYTES, "application/pdf"),
            ]
            msg_resp_multi = await ConversationService.send_message_with_attachments(
                db=db,
                conversation_id=conv.id,
                user=u_patient,
                files=multi_files,
                content="Multiple photos and medical chart",
            )
            assert msg_resp_multi.message_type == "attachment"
            assert len(msg_resp_multi.attachments) == 4
            message_ids.append(msg_resp_multi.id)
            print(f"[PASS] TEST 12: Multiple mixed attachments sent: {len(msg_resp_multi.attachments)} attachments")
            passed += 1

        # =====================================================================
        # TEST 13: Both Text Caption and Attachments
        # =====================================================================
        assert msg_resp_multi.content == "Multiple photos and medical chart"
        print("[PASS] TEST 13: Message preserves both text caption and attachments")
        passed += 1

        # =====================================================================
        # TEST 14: Caption-less Attachment Message (Files only)
        # =====================================================================
        async with factory() as db:
            msg_resp_no_text = await ConversationService.send_message_with_attachments(
                db=db,
                conversation_id=conv.id,
                user=u_patient,
                files=[("molar.jpg", JPEG_BYTES, "image/jpeg")],
                content=None,
            )
            assert msg_resp_no_text.content == ""
            assert len(msg_resp_no_text.attachments) == 1
            message_ids.append(msg_resp_no_text.id)
            print("[PASS] TEST 14: Caption-less attachment message sent successfully (empty content string)")
            passed += 1

        # =====================================================================
        # TEST 15: Reject More Than 5 Files
        # =====================================================================
        async with factory() as db:
            six_files = [
                ("1.jpg", JPEG_BYTES, "image/jpeg"),
                ("2.jpg", JPEG_BYTES, "image/jpeg"),
                ("3.jpg", JPEG_BYTES, "image/jpeg"),
                ("4.jpg", JPEG_BYTES, "image/jpeg"),
                ("5.jpg", JPEG_BYTES, "image/jpeg"),
                ("6.jpg", JPEG_BYTES, "image/jpeg"),
            ]
            try:
                await ConversationService.send_message_with_attachments(
                    db=db,
                    conversation_id=conv.id,
                    user=u_patient,
                    files=six_files,
                )
                assert False, "Should reject > 5 files"
            except HTTPException as e:
                assert e.status_code == 400
                assert "Maximum of 5 attachments" in e.detail
                print("[PASS] TEST 15: Rejection of > 5 files enforced (HTTP 400)")
                passed += 1

        # =====================================================================
        # TEST 16: Non-Participant Attachment Send Rejected (HTTP 403)
        # =====================================================================
        async with factory() as db:
            try:
                await ConversationService.send_message_with_attachments(
                    db=db,
                    conversation_id=conv.id,
                    user=u_patient2,  # outside patient
                    files=[("test.jpg", JPEG_BYTES, "image/jpeg")],
                )
                assert False, "Non-participant should be rejected"
            except HTTPException as e:
                assert e.status_code == 403
                print("[PASS] TEST 16: Non-participant sending attachments rejected with HTTP 403")
                passed += 1

        # =====================================================================
        # TEST 17: Admin Attachment Send Rejected (HTTP 403)
        # =====================================================================
        async with factory() as db:
            try:
                await ConversationService.send_message_with_attachments(
                    db=db,
                    conversation_id=conv.id,
                    user=u_admin,  # admin
                    files=[("test.jpg", JPEG_BYTES, "image/jpeg")],
                )
                assert False, "Admin should be rejected"
            except HTTPException as e:
                assert e.status_code == 403
                print("[PASS] TEST 17: Administrator sending attachments rejected with HTTP 403")
                passed += 1

        # =====================================================================
        # TEST 18: Authorized Participant Generates 15-Minute Signed URL
        # =====================================================================
        async with factory() as db:
            target_attachment = msg_resp.attachments[0]
            # Patient accesses their attachment
            url_resp = await ConversationService.get_attachment_signed_url(
                db=db,
                attachment_id=target_attachment.id,
                user=u_patient,
            )
            assert url_resp.attachment_id == target_attachment.id
            assert url_resp.expires_in == 900
            assert len(url_resp.signed_url) > 0
            assert url_resp.filename == target_attachment.original_filename

            # Dentist accesses the attachment
            url_resp_d = await ConversationService.get_attachment_signed_url(
                db=db,
                attachment_id=target_attachment.id,
                user=u_dentist,
            )
            assert url_resp_d.attachment_id == target_attachment.id

            # Verify audit log
            stmt_audit = select(AuditLog).where(
                AuditLog.action == "ATTACHMENT_ACCESSED",
                AuditLog.resource_id == str(target_attachment.id),
            )
            audit_entry = (await db.execute(stmt_audit)).scalars().first()
            assert audit_entry is not None
            print(f"[PASS] TEST 18: Authorized participants obtained 15-min signed URL (expires_in={url_resp.expires_in}s)")
            passed += 1

        # =====================================================================
        # TEST 19: Non-Participant Signed URL Access Rejected (HTTP 403)
        # =====================================================================
        async with factory() as db:
            try:
                await ConversationService.get_attachment_signed_url(
                    db=db,
                    attachment_id=target_attachment.id,
                    user=u_patient2,  # outsider
                )
                assert False, "Non-participant should be rejected from getting signed URL"
            except HTTPException as e:
                assert e.status_code == 403
                print("[PASS] TEST 19: Non-participant signed URL request rejected with HTTP 403")
                passed += 1

        # =====================================================================
        # TEST 20: Dentist Shares Authorized Clinical Report
        # =====================================================================
        async with factory() as db:
            share_req = ReportShareRequest(
                report_id=report1.id,
                note="Please review this report prior to our teleconsultation.",
            )
            shared_msg = await ConversationService.share_report_in_conversation(
                db=db,
                conversation_id=conv.id,
                user=u_dentist,
                data=share_req,
            )
            assert shared_msg.message_type == "report_share"
            assert shared_msg.report_id == report1.id
            assert shared_msg.report_number == report1.report_number
            assert shared_msg.report_title == report1.report_title
            assert shared_msg.content == "Please review this report prior to our teleconsultation."
            message_ids.append(shared_msg.id)

            # Check notification dispatched to patient
            stmt_notif_rep = select(Notification).where(
                Notification.user_id == u_patient.id,
                Notification.title == "Clinical Report Shared",
            ).order_by(Notification.created_at.desc())
            notif_rep = (await db.execute(stmt_notif_rep)).scalars().first()
            assert notif_rep is not None
            assert report1.report_number in notif_rep.message

            # Check zero PDF duplication in storage (file_storage_path is referenced, not cloned)
            assert shared_msg.attachment_storage_path == report1.pdf_storage_path

            # Check audit log
            stmt_audit_rep = select(AuditLog).where(
                AuditLog.action == "REPORT_SHARED_IN_CHAT",
                AuditLog.resource_id == str(shared_msg.id),
            )
            audit_rep = (await db.execute(stmt_audit_rep)).scalars().first()
            assert audit_rep is not None
            print(f"[PASS] TEST 20: Clinical report shared: message_type='{shared_msg.message_type}', report_number='{shared_msg.report_number}'")
            passed += 1

        # =====================================================================
        # TEST 21: Patient Cannot Share Report (HTTP 403)
        # =====================================================================
        async with factory() as db:
            try:
                await ConversationService.share_report_in_conversation(
                    db=db,
                    conversation_id=conv.id,
                    user=u_patient,
                    data=ReportShareRequest(report_id=report1.id),
                )
                assert False, "Patient should not be allowed to share report"
            except HTTPException as e:
                assert e.status_code == 403
                assert "Only clinical practitioners" in e.detail
                print("[PASS] TEST 21: Patient sharing report rejected with HTTP 403")
                passed += 1

        # =====================================================================
        # TEST 22: Dentist Cannot Share Another Patient's Report (HTTP 403)
        # =====================================================================
        async with factory() as db:
            try:
                # Attempt to share report2 (which belongs to patient2) in conv (patient1)
                await ConversationService.share_report_in_conversation(
                    db=db,
                    conversation_id=conv.id,
                    user=u_dentist,
                    data=ReportShareRequest(report_id=report2.id),
                )
                assert False, "Dentist sharing another patient's report should be rejected"
            except HTTPException as e:
                assert e.status_code == 403
                assert "different patient" in e.detail.lower()
                print("[PASS] TEST 22: Dentist sharing another patient's report rejected with HTTP 403")
                passed += 1

        # =====================================================================
        # TEST 23: Shareable Reports Endpoint Filtering & Authorization
        # =====================================================================
        async with factory() as db:
            # Dentist gets shareable reports for conv (patient1)
            shareable_reports = await ConversationService.get_shareable_reports_for_dentist(
                db=db,
                conversation_id=conv.id,
                user=u_dentist,
            )
            assert len(shareable_reports) >= 1
            report_numbers = [r.report_number for r in shareable_reports]
            assert report1.report_number in report_numbers
            # Crucial: report2 (patient2) must NOT be present
            assert report2.report_number not in report_numbers

            # Patient attempting to list shareable reports is rejected (HTTP 403)
            try:
                await ConversationService.get_shareable_reports_for_dentist(
                    db=db,
                    conversation_id=conv.id,
                    user=u_patient,
                )
                assert False, "Patient should be rejected from listing shareable reports"
            except HTTPException as e:
                assert e.status_code == 403
                print("[PASS] TEST 23: Shareable reports list filters by patient and blocks patient access (HTTP 403)")
                passed += 1

        # =====================================================================
        # TEST 24: Backward Compatibility — Text Messages & Pagination
        # =====================================================================
        async with factory() as db:
            # 1. Send normal text message
            text_msg = await ConversationService.send_message(
                db=db,
                conversation_id=conv.id,
                user=u_dentist,
                data=MessageCreate(content="Standard clinical follow-up text message."),
            )
            assert text_msg.message_type == "text"
            assert text_msg.content == "Standard clinical follow-up text message."
            assert len(text_msg.attachments) == 0
            assert text_msg.report_id is None
            message_ids.append(text_msg.id)

            # 2. List messages
            msg_list = await ConversationService.list_messages(
                db=db,
                conversation_id=conv.id,
                user=u_patient,
                limit=50,
                offset=0,
            )
            assert msg_list.total >= 4
            found_shared_rep = False
            found_attachment = False
            found_text = False
            for m in msg_list.items:
                if m.message_type == "report_share":
                    print(f"DEBUG report_share message: id={m.id}, report_id={m.report_id}, report_number={m.report_number}, report_title={m.report_title}, report1.id={report1.id}, report1.number={report1.report_number}")
                    found_shared_rep = True
                    assert m.report_number == report1.report_number
                if m.attachments:
                    found_attachment = True
                if m.message_type == "text":
                    found_text = True
            assert found_shared_rep, "Shared report message should be in message list"
            assert found_attachment, "Attachment message should be in message list"
            assert found_text, "Text message should be in message list"

            # 3. Mark read
            read_resp = await ConversationService.mark_messages_read(
                db=db,
                conversation_id=conv.id,
                user=u_patient,
            )
            assert read_resp.conversation_id == conv.id
            assert read_resp.marked_read_count >= 1
            print(f"[PASS] TEST 24: Backward compatibility intact: text message, list (total={msg_list.total}), read receipts ({read_resp.marked_read_count} marked)")
            passed += 1

    finally:
        print("\n[CLEANUP] Cleaning up Phase 34 test fixtures...")
        async with factory() as db:
            if message_ids:
                stmt_atts = select(MessageAttachment.storage_path).where(MessageAttachment.message_id.in_(message_ids))
                res_atts = await db.execute(stmt_atts)
                for p in res_atts.scalars().all():
                    try:
                        StorageService.delete_file(p)
                    except Exception:
                        pass
                await db.execute(delete(MessageAttachment).where(MessageAttachment.message_id.in_(message_ids)))
                await db.execute(delete(Message).where(Message.id.in_(message_ids)))
            if conv_ids:
                await db.execute(delete(Conversation).where(Conversation.id.in_(conv_ids)))
            if report_ids:
                await db.execute(delete(Report).where(Report.id.in_(report_ids)))
            if screening_ids:
                await db.execute(delete(Screening).where(Screening.id.in_(screening_ids)))
            if patient_ids:
                await db.execute(delete(PatientDentistRelationship).where(PatientDentistRelationship.patient_id.in_(patient_ids)))
                await db.execute(delete(Patient).where(Patient.id.in_(patient_ids)))
            if dentist_ids:
                await db.execute(delete(Dentist).where(Dentist.id.in_(dentist_ids)))
            if user_ids:
                await db.execute(delete(AuditLog).where(AuditLog.user_id.in_(user_ids)))
                await db.execute(delete(Notification).where(Notification.user_id.in_(user_ids)))
                await db.execute(delete(User).where(User.id.in_(user_ids)))
            await db.commit()
        print("[CLEANUP] Cleanup completed successfully.")

    print("\n" + "=" * 80)
    print(f"PHASE 34 SUITE RESULT: {passed} / {total} PASSED ({(passed / total) * 100:.1f}%)")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_phase34_suite())
