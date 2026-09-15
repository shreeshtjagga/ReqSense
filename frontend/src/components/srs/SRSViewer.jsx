import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Stack,
  Divider,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArticleIcon from '@mui/icons-material/Article';
import { formatDateTime } from '../../utils/helpers';
import { downloadSrsDocx } from '../../api/srs';
import { useToastStore } from '../../store/toastStore';
import Button from '../common/Button';

const SUBJECT_LABELS = {
  'user role': 'User Roles & Permissions',
  'user roles': 'User Roles & Permissions',
  'tech stack': 'Architecture & Technology Stack',
  'technology stack': 'Architecture & Technology Stack',
  'auth': 'Authentication & Access Control',
  'authentication': 'Authentication & Access Control',
  'feature': 'Core Functional Features',
  'features': 'Core Functional Features',
  'constraint': 'System Constraints & Rules',
  'constraints': 'System Constraints & Rules',
  'integration': 'External Integrations & APIs',
  'integrations': 'External Integrations & APIs',
};

function cleanSubject(raw) {
  if (!raw) return 'General Requirements';
  const key = raw.trim().toLowerCase();
  return SUBJECT_LABELS[key] || raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildRequirementStatement(atom) {
  const action = (atom.action || '').trim();
  const raw = (atom.raw_text || '').trim();
  if (action) {
    if (/^(the system|the platform|users|allow|provide|support|integrate|require|enable|ensure)/i.test(action)) {
      return action.charAt(0).toUpperCase() + action.slice(1);
    }
    if (/^use /i.test(action)) return `The system shall ${action}.`;
    return `The system shall support ${action}.`;
  }
  return raw || 'Requirement as captured.';
}

function groupAtomsBySubject(atoms) {
  const groups = {};
  for (const atom of atoms) {
    const key = cleanSubject(atom.subject);
    if (!groups[key]) groups[key] = [];
    groups[key].push(atom);
  }
  return groups;
}

function SectionHeader({ number, title }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
      <Box
        sx={{
          width: 26, height: 26, borderRadius: 1.5, bgcolor: '#334155',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>{number}</Typography>
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#0F172A', fontSize: '1.05rem' }}>{title}</Typography>
    </Stack>
  );
}

export const SRSViewer = ({ srsData, onShowHistory, projectName = 'Project' }) => {
  const showToast = useToastStore((s) => s.showToast);
  const [downloading, setDownloading] = useState(false);

  if (!srsData) return null;

  const { version, created_at, download_url, atoms = [], generated_by, change_summary } = srsData;

  const handleDownload = async () => {
    if (!download_url) {
      showToast('Download link not available. Try regenerating the SRS document.', 'warning');
      return;
    }
    setDownloading(true);
    try {
      showToast('Preparing SRS document download…', 'info');
      const safeProjectName = (projectName || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeProjectName}_SRS_v${version || '1.0'}.docx`;
      await downloadSrsDocx(download_url, filename);
      showToast('SRS document downloaded successfully!', 'success');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      showToast(detail || 'Download failed. Try regenerating the SRS document.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const grouped = groupAtomsBySubject(atoms);
  const groupEntries = Object.entries(grouped);
  let globalIdx = 1;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <Box sx={{ p: { xs: 2.5, md: 3 }, bgcolor: '#1E293B', color: '#FFFFFF' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
              <ArticleIcon sx={{ fontSize: 24, color: '#94A3B8' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: '#FFFFFF' }}>
                Software Requirements Specification
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              <Chip label={`Version ${version || '1.0'}`} size="small" sx={{ bgcolor: '#334155', color: '#F8FAFC', fontWeight: 600, fontSize: '0.75rem' }} />
              <Chip label={`${atoms.length} Requirement${atoms.length !== 1 ? 's' : ''}`} size="small" sx={{ bgcolor: '#334155', color: '#CBD5E1', fontSize: '0.75rem' }} />
              {generated_by && (
                <Chip label={`By ${generated_by}`} size="small" sx={{ bgcolor: '#334155', color: '#94A3B8', fontSize: '0.72rem' }} />
              )}
            </Stack>
            <Typography variant="body2" sx={{ mt: 1, color: '#94A3B8', fontSize: '0.8rem' }}>
              Generated {formatDateTime(created_at)} · {projectName}
            </Typography>
            {change_summary && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#94A3B8', fontStyle: 'italic' }}>
                {change_summary}
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ mt: { xs: 1, md: 0 } }}>
            {onShowHistory && (
              <Button
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={onShowHistory}
                sx={{ borderColor: '#475569', color: '#F1F5F9', '&:hover': { borderColor: '#94A3B8', bgcolor: '#334155' } }}
              >
                History
              </Button>
            )}
            <Button
              variant="contained"
              color="primary"
              startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
              disabled={downloading || !download_url}
              onClick={handleDownload}
            >
              {downloading ? 'Downloading…' : 'Download .DOCX'}
            </Button>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
        {/* ── Section 1: Executive Summary ── */}
        <Box sx={{ mb: 3.5 }}>
          <SectionHeader number="1" title="Executive Summary" />
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#F8FAFC', borderColor: '#E2E8F0' }}>
            <Typography variant="body2" sx={{ lineHeight: 1.7, color: 'text.secondary' }}>
              This Software Requirements Specification formally captures all verified functional requirements
              for the <strong>{projectName}</strong> project.
              {atoms.length > 0
                ? ` A total of ${atoms.length} unique requirement${atoms.length !== 1 ? 's' : ''} have been extracted and
                  validated across ${groupEntries.length} domain${groupEntries.length !== 1 ? 's' : ''} from client
                  gathering sessions. Each requirement has been analysed for conflicts and duplicates before inclusion.`
                : ' No requirements have been captured yet.'}
            </Typography>
          </Paper>
        </Box>

        {/* ── Section 2: Functional Requirements ── */}
        <Box sx={{ mb: 3.5 }}>
          <SectionHeader number="2" title="Functional Requirements" />
          {atoms.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No active requirements yet. Start a gathering session to capture requirements.
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              {groupEntries.map(([subject, groupAtoms], gIdx) => {
                const startIdx = globalIdx;
                globalIdx += groupAtoms.length;
                return (
                  <Accordion
                    key={subject}
                    defaultExpanded
                    disableGutters
                    elevation={0}
                    sx={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px !important',
                      overflow: 'hidden',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon sx={{ color: '#64748B' }} />}
                      sx={{
                        bgcolor: '#F8FAFC',
                        borderBottom: '1px solid #E2E8F0',
                        py: 0.5,
                        '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5 },
                      }}
                    >
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#1E293B' }}>
                        2.{gIdx + 1} &nbsp;{subject}
                      </Typography>
                      <Chip
                        label={`${groupAtoms.length} req.`}
                        size="small"
                        sx={{ bgcolor: '#E2E8F0', color: '#475569', fontWeight: 600, fontSize: '0.7rem', ml: 'auto' }}
                      />
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                              <TableCell sx={{ fontWeight: 700, color: '#475569', width: 100, fontSize: '0.75rem' }}>Ref #</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem' }}>Requirement Statement</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: '#475569', width: 220, fontSize: '0.75rem' }}>Constraint / Rule</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {groupAtoms.map((atom, aIdx) => (
                              <TableRow key={atom.id} sx={{ '&:hover': { bgcolor: '#F8FAFC' }, '&:last-child td': { borderBottom: 0 } }}>
                                <TableCell>
                                  <Chip
                                    label={`REQ-${String(startIdx + aIdx).padStart(3, '0')}`}
                                    size="small"
                                    sx={{ bgcolor: '#F1F5F9', color: '#334155', fontWeight: 600, fontSize: '0.7rem', fontFamily: 'monospace' }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ lineHeight: 1.6, fontSize: '0.85rem' }}>
                                    {buildRequirementStatement(atom)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {atom.constraint_text && !['n/a', 'none', 'unspecified', 'empty'].includes((atom.constraint_text || '').toLowerCase().trim()) ? (
                                    <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#475569' }}>{atom.constraint_text}</Typography>
                                  ) : (
                                    <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.8rem', fontStyle: 'italic' }}>None specified</Typography>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Stack>
          )}
        </Box>

        {/* ── Section 3: Original Captures ── */}
        {atoms.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <SectionHeader number="3" title="Original Requirement Captures" />
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <Typography variant="body2" color="text.secondary">
                  Verbatim requirement statements as captured and validated by ARIA AI during gathering sessions.
                </Typography>
              </Box>
              <Stack divider={<Divider />}>
                {atoms.map((atom, idx) => (
                  <Box key={atom.id} sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.4, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'text.disabled', mb: 0.3 }}>
                        ORS-{String(idx + 1).padStart(3, '0')}
                      </Typography>
                      <Typography variant="body2" sx={{ lineHeight: 1.6, fontStyle: 'italic' }}>
                        "{atom.raw_text}"
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled">
            Auto-generated by ARIA AI. Requirements flagged as conflicted are excluded until contradictions are resolved.
            Download the .DOCX for the full formatted specification.
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default SRSViewer;
