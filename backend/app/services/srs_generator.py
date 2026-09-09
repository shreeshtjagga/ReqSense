import logging
import os
import tempfile
import time
import uuid
import docx
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.srs_version import SRSVersion
from app.models.requirement_atom import RequirementAtom
from app.models.session import Session
from app.models.message import Message
from app.models.project import Project
from app.models.contradiction import Contradiction
from app.models.change_request import ChangeRequest
from app.services.storage_service import StorageService
from app.services.aria_agent import get_groq_client
from app.utils.prompts import PROMPT_VERSION

logger = logging.getLogger(__name__)
settings = get_settings()

class SRSGenerator:
    @classmethod
    async def generate_srs(cls, session_id: uuid.UUID, db: AsyncSession) -> SRSVersion:
        start_time = time.time()
        logger.info(f"Starting SRS generation for session: {session_id}")

        session_result = await db.execute(select(Session).where(Session.id == session_id))
        session = session_result.scalar_one_or_none()
        if not session:
            raise ValueError(f"Session {session_id} not found.")

        project_result = await db.execute(select(Project).where(Project.id == session.project_id))
        project = project_result.scalar_one_or_none()
        project_name = project.name if project else "Unknown Project"

        atoms_result = await db.execute(
            select(RequirementAtom)
            .where(RequirementAtom.project_id == session.project_id)
            .where(RequirementAtom.status == "active")
            .order_by(RequirementAtom.created_at)
        )
        atoms = atoms_result.scalars().all()

        conflicted_count_result = await db.execute(
            select(RequirementAtom)
            .where(RequirementAtom.project_id == session.project_id)
            .where(RequirementAtom.status == "conflicted")
        )
        conflicted_count = len(conflicted_count_result.scalars().all())

        client_msgs_result = await db.execute(
            select(Message)
            .join(Session, Session.id == Message.session_id)
            .where(
                Session.project_id == session.project_id,
                Message.sender.in_(["client", "user"]),
                Message.message_type == "normal",
            )
            .order_by(Message.created_at)
        )
        client_messages = client_msgs_result.scalars().all()

        session_ids_q = select(Session.id).where(Session.project_id == session.project_id)
        cr_ids_q = select(ChangeRequest.id).where(ChangeRequest.project_id == session.project_id)

        contradictions_q = (
            select(Contradiction)
            .where(
                or_(
                    Contradiction.session_id.in_(session_ids_q),
                    Contradiction.change_request_id.in_(cr_ids_q)
                )
            )
            .order_by(Contradiction.detected_at)
        )
        contradictions_res = await db.execute(contradictions_q)
        contradictions = contradictions_res.scalars().all()

        pending_contradiction_atom_ids = set()
        for c in contradictions:
            if c.status == "pending":
                if c.atom_1_id:
                    pending_contradiction_atom_ids.add(c.atom_1_id)
                if c.atom_2_id:
                    pending_contradiction_atom_ids.add(c.atom_2_id)

        # Strictly exclude any atoms tied to pending contradictions until resolved by a developer
        verified_atoms = [
            a for a in atoms
            if a.status == "active" and a.id not in pending_contradiction_atom_ids
        ]
        atoms = verified_atoms
        conflicted_count = max(conflicted_count, len(pending_contradiction_atom_ids))

        summary_text = "No summary generated."
        llm_model = settings.GROQ_MODEL
        if atoms:
            client = get_groq_client()
            if not settings.groq_is_mocked:
                try:
                    system_msg = (
                        "You are a senior technical writer specialising in Software Requirements Specifications (SRS). "
                        "Write clear, professional prose. Be concise. Do not use bullet points or headers — "
                        "produce a flowing executive summary paragraph."
                    )
                    user_msg = (
                        f"Write a short executive summary (150–250 words) for an SRS document "
                        f"for a project called \"{project_name}\".\n\n"
                        "Base it on these captured requirements:\n"
                        + "\n".join([f"- {a.raw_text}" for a in atoms])
                    )
                    response = client.chat.completions.create(
                        model=settings.GROQ_MODEL,
                        messages=[
                            {"role": "system", "content": system_msg},
                            {"role": "user", "content": user_msg},
                        ],
                        timeout=settings.GROQ_TIMEOUT_SECONDS,
                    )
                    summary_text = response.choices[0].message.content.strip()
                except Exception as e:
                    logger.error(f"Failed to generate Groq summary for SRS: {e}")
                    summary_text = "Executive summary generation timed out/failed. Please review requirements below."
            else:
                summary_text = (
                    f"This document specifies the requirements for the {project_name} project. "
                    f"{len(atoms)} requirement atoms were captured across the gathering sessions."
                )

        doc = docx.Document()
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.enum.table import WD_TABLE_ALIGNMENT

        title_p = doc.add_paragraph()
        title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        title_run = title_p.add_run("SOFTWARE REQUIREMENTS SPECIFICATION")
        title_run.font.name = "Arial"
        title_run.font.size = Pt(22)
        title_run.font.bold = True
        title_run.font.color.rgb = RGBColor(30, 58, 138)

        subtitle_p = doc.add_paragraph()
        subtitle_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        sub_run = subtitle_p.add_run(f"{project_name} — ReqSense AI Auto-Generated Document")
        sub_run.font.size = Pt(11)
        sub_run.font.italic = True
        sub_run.font.color.rgb = RGBColor(100, 116, 139)

        doc.add_paragraph()

        meta_table = doc.add_table(rows=4, cols=2)
        meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        meta_table.style = 'Table Grid'

        headers_data = [
            ("Project Name", project_name),
            ("Project Reference", str(session.project_id)),
            ("Generated Timestamp", time.strftime("%Y-%m-%d %H:%M:%S UTC")),
            ("Specification Generator", "ARIA AI System"),
        ]
        for row_idx, (label, val) in enumerate(headers_data):
            cell_lbl = meta_table.cell(row_idx, 0)
            cell_val = meta_table.cell(row_idx, 1)

            p_lbl = cell_lbl.paragraphs[0]
            r_lbl = p_lbl.add_run(label)
            r_lbl.bold = True
            r_lbl.font.color.rgb = RGBColor(30, 58, 138)

            p_val = cell_val.paragraphs[0]
            p_val.add_run(val)

        doc.add_paragraph()

        h1 = doc.add_heading("1. Executive Summary", level=1)
        h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)
        p_sum = doc.add_paragraph(summary_text)
        p_sum.paragraph_format.line_spacing = 1.25

        h2 = doc.add_heading("2. Functional Requirements", level=1)
        h2.runs[0].font.color.rgb = RGBColor(30, 58, 138)

        if conflicted_count:
            doc.add_paragraph(
                f"Note: {conflicted_count} requirement(s) are currently excluded from this specification "
                f"pending resolution of an active contradiction. Review the Contradictions tab before "
                f"treating this document as final."
            ).runs[0].font.italic = True

        if not atoms:
            doc.add_paragraph("No requirements captured for this project yet.")
        else:
            from collections import defaultdict
            atoms_by_subject = defaultdict(list)
            for atom in atoms:
                subj = (atom.subject or "").strip() or "General System Requirements"
                atoms_by_subject[subj].append(atom)

            atom_idx = 1
            for sub_idx, (subject_group, group_atoms) in enumerate(atoms_by_subject.items(), start=1):
                sub_h = doc.add_heading(f"2.{sub_idx} {subject_group}", level=2)
                sub_h.runs[0].font.color.rgb = RGBColor(30, 58, 138)

                table = doc.add_table(rows=1, cols=4)
                table.style = 'Table Grid'
                table.alignment = WD_TABLE_ALIGNMENT.CENTER

                hdr_cells = table.rows[0].cells
                hdr_titles = ["Ref #", "Subject Domain", "Action Statement", "Constraint Details"]
                for idx, text in enumerate(hdr_titles):
                    p = hdr_cells[idx].paragraphs[0]
                    run = p.add_run(text)
                    run.bold = True
                    run.font.color.rgb = RGBColor(30, 58, 138)

                for atom in group_atoms:
                    row_cells = table.add_row().cells
                    row_cells[0].paragraphs[0].add_run(f"REQ-{atom_idx:03d}")
                    row_cells[1].paragraphs[0].add_run(atom.subject or "Unspecified")
                    row_cells[2].paragraphs[0].add_run(atom.action or "Unspecified")
                    row_cells[3].paragraphs[0].add_run(atom.constraint_text or "N/A")
                    atom_idx += 1

                doc.add_paragraph()

        h3 = doc.add_heading("3. Verbatim Client Statements", level=1)
        h3.runs[0].font.color.rgb = RGBColor(30, 58, 138)
        note_p = doc.add_paragraph(
            "The following are the client's exact statements during requirements gathering sessions, "
            "in chronological order."
        )
        note_p.paragraph_format.space_after = Pt(6)
        if not client_messages:
            doc.add_paragraph("No client statements recorded.")
        else:
            for idx, msg in enumerate(client_messages, start=1):
                p_raw = doc.add_paragraph(style='List Bullet')
                r_num = p_raw.add_run(f"S{idx:03d}: ")
                r_num.bold = True
                r_stmt = p_raw.add_run(f'"{msg.content or "N/A"}"')
                r_stmt.italic = True

        doc.add_paragraph()

        h4 = doc.add_heading("4. Requirement Conflicts & Clarifications", level=1)
        h4.runs[0].font.color.rgb = RGBColor(30, 58, 138)
        note_p4 = doc.add_paragraph(
            "The following contradictions, user shifts, or priority conflicts were detected by the RDCD "
            "contradiction checker during gather sessions and change request reviews."
        )
        note_p4.paragraph_format.space_after = Pt(6)

        if not contradictions:
            doc.add_paragraph("No requirement conflicts or contradictions were detected.")
        else:
            table4 = doc.add_table(rows=1, cols=4)
            table4.style = 'Table Grid'
            table4.alignment = WD_TABLE_ALIGNMENT.CENTER

            hdr_cells4 = table4.rows[0].cells
            hdr_titles4 = ["Source & Type", "ARIA Conflict Message", "Status", "Resolution Notes"]
            for idx, text in enumerate(hdr_titles4):
                p = hdr_cells4[idx].paragraphs[0]
                run = p.add_run(text)
                run.bold = True
                run.font.color.rgb = RGBColor(30, 58, 138)

            for c in contradictions:
                row_cells = table4.add_row().cells
                source_str = "Chat" if c.source == "chat" else "Change Request"
                type_str = (c.conflict_type or "unknown").replace("_", " ").title()
                row_cells[0].paragraphs[0].add_run(f"{source_str} - {type_str}")
                row_cells[1].paragraphs[0].add_run(c.aria_message or "No message")
                row_cells[2].paragraphs[0].add_run(c.status.title())
                row_cells[3].paragraphs[0].add_run(c.resolution or "Pending stakeholder review.")

        fd, temp_path = tempfile.mkstemp(suffix=".docx")
        try:
            os.close(fd)
            doc.save(temp_path)

            version_q = select(SRSVersion).where(SRSVersion.project_id == session.project_id)
            version_result = await db.execute(version_q)
            existing_count = len(version_result.scalars().all())
            version_str = f"1.{existing_count}"

            file_url = StorageService.upload_srs(
                local_file_path=temp_path,
                project_id=str(session.project_id),
                version=version_str,
            )
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        generation_latency_ms = int((time.time() - start_time) * 1000)

        srs_version = SRSVersion(
            project_id=session.project_id,
            session_id=session.id,
            version=version_str,
            file_url=file_url,
            generated_by="ARIA",
            change_summary=(
                f"Generated after ending session {session_id}. "
                f"{len(atoms)} active requirements, {len(client_messages)} client statements"
                + (f", {conflicted_count} excluded (pending contradiction resolution)." if conflicted_count else ".")
            ),
            llm_model=llm_model,
            prompt_version=PROMPT_VERSION,
            generation_latency_ms=generation_latency_ms,
        )
        db.add(srs_version)
        await db.commit()
        await db.refresh(srs_version)

        if session.client_id:
            try:
                from app.models.user import User
                client_user_res = await db.execute(select(User).where(User.id == session.client_id))
                client_user = client_user_res.scalar_one_or_none()
                if client_user and client_user.email:
                    from app.services.notification_service import send_session_summary_email
                    download_url = StorageService.get_download_url(file_url)
                    send_session_summary_email(
                        to_email=client_user.email,
                        context={
                            "session_id": str(session_id),
                            "version": version_str,
                            "download_url": download_url,
                        },
                    )
            except Exception as e:
                logger.error(f"Failed to queue session summary email for session {session_id}: {e}")

        logger.info(f"SRS {version_str} generated for project {session.project_id} ({len(atoms)} atoms, {len(client_messages)} client statements, {generation_latency_ms}ms)")
        return srs_version
