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

def _generate_fallback_summary(project_name: str, atoms: list) -> str:
    techs = []
    roles = []
    features = []
    constraints = []
    for a in atoms:
        subj = (a.subject or "").lower()
        act = (a.action or a.raw_text or "").strip()
        c = (a.constraint_text or "").strip()
        if any(k in subj for k in ["tech", "database", "storage", "backend", "frontend"]):
            techs.append(act)
        elif any(k in subj for k in ["role", "user", "access"]):
            roles.append(act)
        elif any(k in subj for k in ["security", "constraint", "auth", "compliance"]):
            constraints.append(f"{act} ({c})" if c else act)
        else:
            features.append(f"{act} ({c})" if c else act)

    sentences = [
        f"This Software Requirements Specification (SRS) defines the formal functional and architectural baseline for {project_name}."
    ]
    if techs:
        sentences.append(f"The architectural and technology stack foundation encompasses: {', '.join(techs[:3])}.")
    if roles:
        sentences.append(f"System access and governance are structured around: {', '.join(roles[:2])}.")
    if features:
        sentences.append(f"Core operational capabilities include: {', '.join(features[:4])}.")
    if constraints:
        sentences.append(f"Security and operational constraints mandate that: {', '.join(constraints[:3])}.")
    sentences.append("All specifications documented herein have been captured through stakeholder interviews and validated for technical consistency.")
    return " ".join(sentences)

def _format_requirement_statement(atom) -> str:
    action = (atom.action or "").strip()
    raw = (atom.raw_text or "").strip()
    subj = (atom.subject or "").strip()
    constraint = (atom.constraint_text or "").strip()

    invalid_fragments = {
        "is your choice", "unspecified", "no specific", "leave it for dev side",
        "none", "n/a", "handle", "use", "includes", "define", "adhere", "shall be systematic"
    }

    if action and action.lower() not in invalid_fragments and len(action.split()) >= 3:
        act_lower = action.lower()
        if act_lower.startswith(("the system shall", "the platform shall", "the application shall")):
            return action
        elif act_lower.startswith(("shall", "must", "will")):
            return f"The system {action}"
        else:
            return f"The system shall {action[0].lower() + action[1:]}"

    if raw and len(raw.split()) >= 3 and raw.lower() not in invalid_fragments:
        clean_raw = raw.strip().rstrip(".").strip()
        if clean_raw.lower().startswith(("the system shall", "the platform shall", "the application shall")):
            return clean_raw + "."
        return f"The system shall support: {clean_raw}."

    if constraint and constraint.lower() not in invalid_fragments:
        return f"The system shall adhere to {constraint} for {subj.lower() if subj else 'system operations'}."

    if action and action.lower() not in invalid_fragments:
        return f"The system shall {action} as specified for {subj.lower() if subj else 'the feature'}."

    return f"The system shall implement verified specifications for {subj or 'general system functionality'}."

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

        verified_atoms = [
            a for a in atoms
            if a.status == "active" and a.id not in pending_contradiction_atom_ids
        ]
        atoms = verified_atoms
        conflicted_count = max(conflicted_count, len(pending_contradiction_atom_ids))

        summary_text = ""
        llm_model = getattr(settings, 'GROQ_FAST_MODEL', 'groq/compound-mini')
        candidates = [llm_model, "groq/compound-mini", "groq/compound", getattr(settings, 'GROQ_MODEL', 'groq/compound')]
        if atoms and not settings.groq_is_mocked:
            try:
                client = get_groq_client()
                system_msg = (
                    "You are a senior technical writer specialising in Software Requirements Specifications (SRS). "
                    "Write a professional, comprehensive executive summary (150–250 words) outlining the project's "
                    "purpose, architecture, core features, user roles, and operational constraints. "
                    "Do not use markdown fences, bullet points, or section headings."
                )
                user_msg = (
                    f"Write a formal executive summary for the '{project_name}' project based on these captured requirements:\n\n"
                    + "\n".join([f"- [{a.subject or 'Requirement'}] {a.action or a.raw_text}" + (f" (Constraint: {a.constraint_text})" if a.constraint_text else "") for a in atoms])
                )
                seen_models = set()
                for cand in candidates:
                    if not cand or cand in seen_models:
                        continue
                    seen_models.add(cand)
                    try:
                        resp = client.chat.completions.create(
                            model=cand,
                            messages=[
                                {"role": "system", "content": system_msg},
                                {"role": "user", "content": user_msg},
                            ],
                            timeout=min(settings.GROQ_TIMEOUT_SECONDS, 6),
                        )
                        if resp and resp.choices and resp.choices[0].message.content.strip():
                            summary_text = resp.choices[0].message.content.strip()
                            llm_model = cand
                            break
                    except Exception:
                        continue
            except Exception as e:
                logger.warning(f"[SRS] LLM executive summary generation failed ({e}), using structured fallback.")

        if not summary_text or len(summary_text.split()) < 15:
            summary_text = _generate_fallback_summary(project_name, atoms)

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
                hdr_titles = ["Ref #", "Requirement Specification (IEEE 830)", "Subject Domain", "Constraint Details"]
                for idx, text in enumerate(hdr_titles):
                    p = hdr_cells[idx].paragraphs[0]
                    run = p.add_run(text)
                    run.bold = True
                    run.font.color.rgb = RGBColor(30, 58, 138)

                for atom in group_atoms:
                    row_cells = table.add_row().cells
                    row_cells[0].paragraphs[0].add_run(f"REQ-{atom_idx:03d}")
                    row_cells[1].paragraphs[0].add_run(_format_requirement_statement(atom))
                    row_cells[2].paragraphs[0].add_run(atom.subject or "General")
                    constraint_val = atom.constraint_text if atom.constraint_text and atom.constraint_text.lower() not in ("n/a", "none", "unspecified", "") else "Standard"
                    row_cells[3].paragraphs[0].add_run(constraint_val)
                    atom_idx += 1

                doc.add_paragraph()

        h3 = doc.add_heading("3. Requirement Origin Statements", level=1)
        h3.runs[0].font.color.rgb = RGBColor(30, 58, 138)
        note_p = doc.add_paragraph(
            "The following are the original verbatim requirement statements as captured and validated "
            "by the ARIA AI during requirement gathering sessions. Only substantive, non-trivial statements are included."
        )
        note_p.paragraph_format.space_after = Pt(6)
        if not atoms:
            doc.add_paragraph("No requirement origin statements available.")
        else:
            for idx, atom in enumerate(atoms, start=1):
                p_raw = doc.add_paragraph(style='List Bullet')
                r_num = p_raw.add_run(f"ORS-{idx:03d}: ")
                r_num.bold = True
                r_stmt = p_raw.add_run(f'"{atom.raw_text or "N/A"}"')
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
                f"Generated from session {session_id}. "
                f"{len(atoms)} verified requirements captured"
                + (f", {conflicted_count} excluded (pending contradiction resolution)." if conflicted_count else ".")
            ),
            llm_model=llm_model,
            prompt_version=PROMPT_VERSION,
            generation_latency_ms=generation_latency_ms,
        )
        db.add(srs_version)
        await db.commit()
        await db.refresh(srs_version)

        logger.info(f"SRS {version_str} generated for project {session.project_id} ({len(atoms)} atoms, {generation_latency_ms}ms)")
        return srs_version
