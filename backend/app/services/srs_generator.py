import logging
import os
import tempfile
import time
import uuid
import docx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.srs_version import SRSVersion
from app.models.requirement_atom import RequirementAtom
from app.models.session import Session
from app.services.storage_service import StorageService
from app.services.aria_agent import get_groq_client
from app.utils.prompts import PROMPT_VERSION

logger = logging.getLogger(__name__)
settings = get_settings()

class SRSGenerator:
    @classmethod
    async def generate_srs(cls, session_id: uuid.UUID, db: AsyncSession) -> SRSVersion:
        """
        Generates an SRS Word document (.docx) for the session,
        uploads it to storage, and writes an SRSVersion record to the database.
        """
        start_time = time.time()
        logger.info(f"Starting SRS generation for session: {session_id}")

        # 1. Fetch the session and its requirement atoms
        session_result = await db.execute(select(Session).where(Session.id == session_id))
        session = session_result.scalar_one_or_none()
        if not session:
            raise ValueError(f"Session {session_id} not found.")

        atoms_result = await db.execute(
            select(RequirementAtom)
            .where(RequirementAtom.session_id == session_id)
            .where(RequirementAtom.status == "active")
        )
        atoms = atoms_result.scalars().all()

        # 2. Call Groq to generate a professional project summary/intro (optional but nice)
        summary_text = "No summary generated."
        llm_model = settings.GROQ_MODEL
        if atoms:
            client = get_groq_client()
            if not (settings.GROQ_API_KEY.startswith("test") or settings.GROQ_API_KEY.startswith("mock")):
                try:
                    prompt = (
                        "Write a short, professional executive summary (max 300 words) for a Software Requirements "
                        "Specification (SRS) based on the following requirement statements:\n"
                        + "\n".join([f"- {a.raw_text}" for a in atoms])
                    )
                    response = client.chat.completions.create(
                        model=settings.GROQ_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        timeout=settings.GROQ_TIMEOUT_SECONDS
                    )
                    summary_text = response.choices[0].message.content.strip()
                except Exception as e:
                    logger.error(f"Failed to generate Groq summary for SRS: {e}")
                    summary_text = "Executive summary generation timed out/failed."
            else:
                summary_text = "Mock executive summary for requirement atoms."

        # 3. Create the Word document using python-docx with professional styling
        doc = docx.Document()
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.enum.table import WD_TABLE_ALIGNMENT

        # Title
        title_p = doc.add_paragraph()
        title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        title_run = title_p.add_run("SOFTWARE REQUIREMENTS SPECIFICATION")
        title_run.font.name = "Arial"
        title_run.font.size = Pt(22)
        title_run.font.bold = True
        title_run.font.color.rgb = RGBColor(30, 58, 138)  # Navy Blue

        subtitle_p = doc.add_paragraph()
        subtitle_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        sub_run = subtitle_p.add_run("ReqSense AI Auto-Generated Document")
        sub_run.font.size = Pt(11)
        sub_run.font.italic = True
        sub_run.font.color.rgb = RGBColor(100, 116, 139)

        doc.add_paragraph()  # spacing

        # Executive Metadata Table
        meta_table = doc.add_table(rows=3, cols=2)
        meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        meta_table.style = 'Table Grid'

        headers_data = [
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

        # Section 1: Executive Summary
        h1 = doc.add_heading("1. Executive Summary", level=1)
        h1.runs[0].font.color.rgb = RGBColor(30, 58, 138)
        p_sum = doc.add_paragraph(summary_text)
        p_sum.paragraph_format.line_spacing = 1.25

        # Section 2: Functional Requirements Table
        h2 = doc.add_heading("2. Functional Requirements Table", level=1)
        h2.runs[0].font.color.rgb = RGBColor(30, 58, 138)

        if not atoms:
            doc.add_paragraph("No requirements captured during this session.")
        else:
            table = doc.add_table(rows=1, cols=4)
            table.style = 'Table Grid'
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            
            # Header Row
            hdr_cells = table.rows[0].cells
            hdr_titles = ["Ref #", "Subject Domain", "Action Statement", "Constraint Details"]
            for idx, text in enumerate(hdr_titles):
                p = hdr_cells[idx].paragraphs[0]
                run = p.add_run(text)
                run.bold = True
                run.font.color.rgb = RGBColor(30, 58, 138)

            # Data Rows
            for idx, atom in enumerate(atoms, start=1):
                row_cells = table.add_row().cells
                row_cells[0].paragraphs[0].add_run(f"REQ-{idx:03d}")
                row_cells[1].paragraphs[0].add_run(atom.subject)
                row_cells[2].paragraphs[0].add_run(atom.action)
                row_cells[3].paragraphs[0].add_run(atom.constraint_text or "N/A")

        doc.add_paragraph()

        # Section 3: Raw Captured Client Statements
        h3 = doc.add_heading("3. Raw Client Statements", level=1)
        h3.runs[0].font.color.rgb = RGBColor(30, 58, 138)
        if not atoms:
            doc.add_paragraph("No raw statements recorded.")
        else:
            for idx, atom in enumerate(atoms, start=1):
                p_raw = doc.add_paragraph(style='List Bullet')
                r_num = p_raw.add_run(f"REQ-{idx:03d}: ")
                r_num.bold = True
                r_stmt = p_raw.add_run(f'"{atom.raw_text}"')
                r_stmt.italic = True

        # 4. Save to a temporary file
        fd, temp_path = tempfile.mkstemp(suffix=".docx")
        try:
            os.close(fd)
            doc.save(temp_path)

            # 5. Determine version number (e.g. read existing versions for project)
            version_q = select(SRSVersion).where(SRSVersion.project_id == session.project_id)
            version_result = await db.execute(version_q)
            existing_count = len(version_result.scalars().all())
            version_str = f"1.{existing_count}"

            # 6. Upload to S3/R2
            file_url = StorageService.upload_srs(
                local_file_path=temp_path,
                project_id=str(session.project_id),
                version=version_str
            )
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        generation_latency_ms = int((time.time() - start_time) * 1000)

        # 7. Write SRSVersion row
        srs_version = SRSVersion(
            project_id=session.project_id,
            session_id=session.id,
            version=version_str,
            file_url=file_url,
            generated_by="ARIA",
            change_summary=f"Generated after ending session {session_id}.",
            llm_model=llm_model,
            prompt_version=PROMPT_VERSION,
            generation_latency_ms=generation_latency_ms
        )
        db.add(srs_version)
        await db.commit()
        await db.refresh(srs_version)

        # 8. Send notification email to the client if client_id is set
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
                        }
                    )
            except Exception as e:
                logger.error(f"Failed to queue session summary email for session {session_id}: {e}")

        logger.info(f"SRS version {version_str} successfully generated and saved.")
        return srs_version
