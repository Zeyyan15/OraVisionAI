"""
OraVisionAI — Clinical PDF Report Renderer

Generates publication-quality, clinician-readable PDF screening reports using ReportLab.
Converts structured diagnostic snapshots (patient info, 7-class AI predictions, YOLO detections,
primary XAI heatmaps, risk assessments, and dentist reviews) into a unified clinical PDF.
"""

from __future__ import annotations

import io
import logging
from typing import Any, Dict, List, Optional

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Image as RLImage,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

logger = logging.getLogger(__name__)

# Brand & Clinical Color Palette
PRIMARY_COLOR = colors.HexColor("#1E3A8A")     # Deep Navy
SECONDARY_COLOR = colors.HexColor("#0D9488")   # Teal
ALERT_COLOR = colors.HexColor("#DC2626")       # Crimson Alert
SUCCESS_COLOR = colors.HexColor("#16A34A")     # Emerald
BG_LIGHT = colors.HexColor("#F8FAFC")          # Slate 50
BORDER_COLOR = colors.HexColor("#CBD5E1")      # Slate 300
TEXT_DARK = colors.HexColor("#0F172A")         # Slate 900
TEXT_MUTED = colors.HexColor("#64748B")        # Slate 500


class PDFReportRenderer:
    """Renders structured JSON report snapshots into medical-grade PDF documents."""

    @classmethod
    def render_pdf(cls, snapshot: Dict[str, Any]) -> bytes:
        """
        Builds and compiles the PDF document from the report snapshot.
        Returns raw PDF bytes.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        normal = styles["Normal"]

        # Custom Clinical Styles
        title_style = ParagraphStyle(
            "DocTitle",
            parent=normal,
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=PRIMARY_COLOR,
        )
        subtitle_style = ParagraphStyle(
            "DocSubtitle",
            parent=normal,
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=SECONDARY_COLOR,
        )
        meta_style = ParagraphStyle(
            "MetaText",
            parent=normal,
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            textColor=TEXT_MUTED,
        )
        heading1_style = ParagraphStyle(
            "Heading1_Custom",
            parent=normal,
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=PRIMARY_COLOR,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            "Body_Custom",
            parent=normal,
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=TEXT_DARK,
        )
        bold_body_style = ParagraphStyle(
            "BoldBody_Custom",
            parent=normal,
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=TEXT_DARK,
        )
        disclaimer_style = ParagraphStyle(
            "Disclaimer",
            parent=normal,
            fontName="Helvetica-Oblique",
            fontSize=7.5,
            leading=9.5,
            textColor=colors.HexColor("#991B1B"),
        )

        story: List[Any] = []

        # =========================================================================
        # 1. Header Banner
        # =========================================================================
        header_data = [
            [
                Paragraph("<b>ORAVISIONAI</b>", title_style),
                Paragraph(f"<b>Report No:</b> {snapshot.get('report_number', 'N/A')}<br/><b>Date:</b> {snapshot.get('screening_date', 'N/A')}", meta_style),
            ],
            [
                Paragraph("CLINICAL AI ORAL SCREENING & TELECONSULTATION REPORT", subtitle_style),
                Paragraph(f"<b>Status:</b> {str(snapshot.get('screening_status', 'completed')).upper()}", meta_style),
            ],
        ]
        header_table = Table(header_data, colWidths=[3.8 * inch, 3.4 * inch])
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(header_table)
        story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceAfter=8, spaceBefore=4))

        # =========================================================================
        # 2. Clinical Notice & Disclaimer Banner
        # =========================================================================
        disclaimer_text = (
            "<b>IMPORTANT CLINICAL NOTICE:</b> This AI-generated screening report provides assistive diagnostic "
            "recommendations based on deep learning analysis (EfficientNetB0 & OraVisionAI YOLO). "
            "It does NOT constitute a definitive medical diagnosis and must be evaluated by a licensed dental professional."
        )
        disclaimer_table = Table(
            [[Paragraph(disclaimer_text, disclaimer_style)]],
            colWidths=[7.2 * inch],
        )
        disclaimer_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF2F2")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#FCA5A5")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(disclaimer_table)
        story.append(Spacer(1, 8))

        # =========================================================================
        # 3. Patient & Screening Information
        # =========================================================================
        patient_info = snapshot.get("patient", {})
        screening_info = snapshot.get("screening", {})

        p_name = f"{patient_info.get('first_name', '')} {patient_info.get('last_name', '')}".strip() or "Anonymous Patient"
        p_dob = str(patient_info.get("date_of_birth") or "Not Recorded")
        p_gender = str(patient_info.get("gender") or "Not Specified").title()
        p_notes = str(screening_info.get("clinical_notes") or "None reported.")

        patient_data = [
            [
                Paragraph("<b>Patient Name:</b>", bold_body_style),
                Paragraph(p_name, body_style),
                Paragraph("<b>Screening ID:</b>", bold_body_style),
                Paragraph(str(screening_info.get("id", "N/A"))[:18] + "...", body_style),
            ],
            [
                Paragraph("<b>Date of Birth:</b>", bold_body_style),
                Paragraph(p_dob, body_style),
                Paragraph("<b>Total Images:</b>", bold_body_style),
                Paragraph(str(snapshot.get("total_images", 1)), body_style),
            ],
            [
                Paragraph("<b>Gender:</b>", bold_body_style),
                Paragraph(p_gender, body_style),
                Paragraph("<b>Report Title:</b>", bold_body_style),
                Paragraph(snapshot.get("report_title", "Oral Health Screening"), body_style),
            ],
            [
                Paragraph("<b>Patient Notes:</b>", bold_body_style),
                Paragraph(p_notes, body_style),
                Paragraph("", body_style),
                Paragraph("", body_style),
            ],
        ]

        info_table = Table(patient_data, colWidths=[1.3 * inch, 2.3 * inch, 1.3 * inch, 2.3 * inch])
        info_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("SPAN", (1, 3), (3, 3)),
        ]))
        story.append(Paragraph("1. PATIENT & SCREENING INFORMATION", heading1_style))
        story.append(info_table)
        story.append(Spacer(1, 8))

        # =========================================================================
        # 4. AI Classification & Probability Distribution
        # =========================================================================
        ai_pred = snapshot.get("primary_prediction", {})
        predicted_class = ai_pred.get("predicted_class", "Undetermined")
        confidence = float(ai_pred.get("confidence", 0.0))
        model_name = ai_pred.get("model_name", "OravisionAI_7Teeth_EfficientNetB0")
        model_version = ai_pred.get("model_version", "v1.0")

        pred_box_data = [
            [
                Paragraph("<b>AI Predicted Finding:</b>", bold_body_style),
                Paragraph(f"<font color='#1E3A8A'><b>{predicted_class.upper()}</b></font>", ParagraphStyle("Pred", parent=bold_body_style, fontSize=11, leading=13)),
                Paragraph("<b>Model Confidence:</b>", bold_body_style),
                Paragraph(f"<b>{confidence * 100:.1f}%</b>", ParagraphStyle("Conf", parent=bold_body_style, fontSize=11, leading=13, textColor=SECONDARY_COLOR)),
            ],
            [
                Paragraph("<b>Classifier Backbone:</b>", meta_style),
                Paragraph(f"{model_name} ({model_version})", meta_style),
                Paragraph("<b>Inference Latency:</b>", meta_style),
                Paragraph(f"{ai_pred.get('inference_duration_ms', 45)} ms", meta_style),
            ]
        ]
        pred_table = Table(pred_box_data, colWidths=[1.6 * inch, 2.0 * inch, 1.6 * inch, 2.0 * inch])
        pred_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#93C5FD")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))

        story.append(Paragraph("2. AI CLASSIFICATION FINDINGS", heading1_style))
        story.append(pred_table)
        story.append(Spacer(1, 6))

        # 7-Class Probability Distribution Table
        probabilities = ai_pred.get("probabilities", [])
        if probabilities:
            prob_rows = [
                [
                    Paragraph("<b>Class Index</b>", bold_body_style),
                    Paragraph("<b>Condition Name</b>", bold_body_style),
                    Paragraph("<b>Code</b>", bold_body_style),
                    Paragraph("<b>Probability Score</b>", bold_body_style),
                    Paragraph("<b>Confidence Bar</b>", bold_body_style),
                ]
            ]
            for p in probabilities:
                p_val = float(p.get("probability", 0.0))
                bar_len = int(p_val * 20)
                bar_str = "█" * bar_len + "░" * (20 - bar_len)
                prob_rows.append([
                    Paragraph(str(p.get("class_index", 0)), body_style),
                    Paragraph(str(p.get("class_name", "")), body_style),
                    Paragraph(str(p.get("class_code", "")), body_style),
                    Paragraph(f"{p_val * 100:.2f}%", body_style),
                    Paragraph(f"<font color='#0D9488'>{bar_str}</font>", ParagraphStyle("Bar", parent=body_style, fontSize=7, leading=8)),
                ])

            prob_table = Table(prob_rows, colWidths=[0.8 * inch, 2.2 * inch, 0.8 * inch, 1.4 * inch, 2.0 * inch])
            prob_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(prob_table)
            story.append(Spacer(1, 8))

        # =========================================================================
        # 5. Spatial AI Lesion Detections (YOLO)
        # =========================================================================
        detections = snapshot.get("detections", [])
        story.append(Paragraph("3. SPATIAL LESION DETECTIONS (OraVisionAI YOLO)", heading1_style))
        if detections:
            det_rows = [
                [
                    Paragraph("<b>#</b>", bold_body_style),
                    Paragraph("<b>Detected Entity</b>", bold_body_style),
                    Paragraph("<b>Confidence</b>", bold_body_style),
                    Paragraph("<b>Bounding Box (x_min, y_min, x_max, y_max)</b>", bold_body_style),
                ]
            ]
            for idx, d in enumerate(detections, start=1):
                bbox = d.get("bbox", {})
                bbox_str = f"[{bbox.get('x_min', 0.0):.2f}, {bbox.get('y_min', 0.0):.2f}, {bbox.get('x_max', 0.0):.2f}, {bbox.get('y_max', 0.0):.2f}]"
                det_rows.append([
                    Paragraph(str(idx), body_style),
                    Paragraph(str(d.get("class_name", "Lesion")), body_style),
                    Paragraph(f"{float(d.get('confidence', 0.0)) * 100:.1f}%", body_style),
                    Paragraph(bbox_str, body_style),
                ])
            det_table = Table(det_rows, colWidths=[0.5 * inch, 2.5 * inch, 1.5 * inch, 2.7 * inch])
            det_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]))
            story.append(det_table)
        else:
            story.append(Paragraph("<i>No discrete spatial bounding boxes detected by YOLO model.</i>", body_style))
        story.append(Spacer(1, 8))

        # =========================================================================
        # 6. Explainable AI (XAI) Summary
        # =========================================================================
        xai_items = snapshot.get("xai_results", [])
        story.append(Paragraph("4. EXPLAINABLE AI (XAI) VISUALIZATION SUMMARY", heading1_style))
        if xai_items:
            xai_rows = [
                [
                    Paragraph("<b>Method</b>", bold_body_style),
                    Paragraph("<b>User-Facing Role</b>", bold_body_style),
                    Paragraph("<b>Target Layer</b>", bold_body_style),
                    Paragraph("<b>Storage Artifact Reference</b>", bold_body_style),
                ]
            ]
            for x in xai_items:
                is_p = x.get("is_primary_user_facing", False)
                role_badge = "PRIMARY" if is_p else "SECONDARY"
                role_color = "#1E3A8A" if is_p else "#64748B"
                xai_rows.append([
                    Paragraph(str(x.get("method", "")).replace("_", " ").title(), body_style),
                    Paragraph(f"<font color='{role_color}'><b>{role_badge}</b></font>", body_style),
                    Paragraph(str(x.get("target_layer", "N/A") or "N/A"), body_style),
                    Paragraph(str(x.get("overlay_image_storage_path", ""))[:45] + "...", meta_style),
                ])
            xai_table = Table(xai_rows, colWidths=[1.8 * inch, 1.2 * inch, 1.7 * inch, 2.5 * inch])
            xai_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]))
            story.append(xai_table)
        else:
            story.append(Paragraph("<i>XAI heatmap explanations not yet generated for this screening.</i>", body_style))
        story.append(Spacer(1, 8))

        # =========================================================================
        # 7. Risk Assessment (if present)
        # =========================================================================
        risk_info = snapshot.get("risk_assessment")
        story.append(Paragraph("5. MULTI-FACTOR RISK ASSESSMENT", heading1_style))
        if risk_info:
            risk_lvl = str(risk_info.get("risk_level", "low")).upper()
            risk_score = float(risk_info.get("risk_score", 0.0))
            risk_rows = [
                [
                    Paragraph("<b>Triage Risk Level:</b>", bold_body_style),
                    Paragraph(f"<b>{risk_lvl}</b>", bold_body_style),
                    Paragraph("<b>Risk Score:</b>", bold_body_style),
                    Paragraph(f"{risk_score:.1f} / 100", body_style),
                ],
                [
                    Paragraph("<b>Triage Recommendation:</b>", bold_body_style),
                    Paragraph(str(risk_info.get("recommended_action", "Routine monitoring")), body_style),
                    Paragraph("", body_style),
                    Paragraph("", body_style),
                ]
            ]
            risk_table = Table(risk_rows, colWidths=[1.5 * inch, 2.1 * inch, 1.3 * inch, 2.3 * inch])
            risk_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("SPAN", (1, 1), (3, 1)),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            story.append(risk_table)
        else:
            story.append(Paragraph("<i>Multi-factor clinical risk assessment unavailable for this screening session.</i>", body_style))
        story.append(Spacer(1, 8))

        # =========================================================================
        # 8. Licensed Dentist Professional Assessment
        # =========================================================================
        dentist_assessments = snapshot.get("dentist_assessments", [])
        story.append(Paragraph("6. LICENSED DENTIST CLINICAL ASSESSMENT", heading1_style))
        if dentist_assessments:
            d_eval = dentist_assessments[0]
            d_rows = [
                [
                    Paragraph("<b>Clinical Observations:</b>", bold_body_style),
                    Paragraph(str(d_eval.get("clinical_observations", "")), body_style),
                ],
                [
                    Paragraph("<b>Diagnosis Notes:</b>", bold_body_style),
                    Paragraph(str(d_eval.get("diagnosis_notes", "")), body_style),
                ],
                [
                    Paragraph("<b>Treatment Plan:</b>", bold_body_style),
                    Paragraph(str(d_eval.get("treatment_recommendation", "")), body_style),
                ],
                [
                    Paragraph("<b>Specialist Referral:</b>", bold_body_style),
                    Paragraph(f"{'Required - ' + str(d_eval.get('referral_specialty', 'Oral Surgery')) if d_eval.get('referral_needed') else 'None Required'}", body_style),
                ],
            ]
            d_table = Table(d_rows, colWidths=[1.8 * inch, 5.4 * inch])
            d_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#86EFAC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(d_table)
        else:
            story.append(Paragraph("<i>Clinical dentist evaluation pending. This screening report contains AI-assisted screening findings only.</i>", body_style))

        # Build document
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
