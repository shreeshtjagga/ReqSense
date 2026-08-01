import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { registerUser } from '../../api/auth';
import { useToastStore } from '../../store/toastStore';

// ── Animated Isometric Cube (identical to Login) ────────────────────────────
const AnimatedCube = () => {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const getCubePoints = (W, H) => {
      const cx = W * 0.45;
      const cy = H * 0.48;
      const s  = Math.min(W, H) * 0.22;
      const dx = s;
      const dy = s * 0.5;
      const h  = s * 1.0;
      const top    = { x: cx,      y: cy - h        };
      const left   = { x: cx - dx, y: cy - h + dy   };
      const bottom = { x: cx,      y: cy - h + 2*dy };
      const right  = { x: cx + dx, y: cy - h + dy   };
      const bleft   = { x: cx - dx, y: cy + dy  };
      const bbottom = { x: cx,      y: cy + 2*dy };
      const bright  = { x: cx + dx, y: cy + dy  };
      return { top, left, bottom, right, bleft, bbottom, bright, cx, cy, h, dx, dy };
    };

    const EDGE_DEFS = [
      (p) => [p.top,    p.left  ],
      (p) => [p.left,   p.bottom],
      (p) => [p.bottom, p.right ],
      (p) => [p.right,  p.top   ],
      (p) => [p.left,   p.bleft ],
      (p) => [p.bleft,  p.bbottom],
      (p) => [p.bbottom,p.bottom],
      (p) => [p.right,  p.bright],
      (p) => [p.bright, p.bbottom],
    ];

    const COLORS = ['#E0F2FE','#93C5FD','#60A5FA','#38BDF8','#BFDBFE'];

    const sparks = EDGE_DEFS.map((edgeFn, i) => ({
      edgeFn,
      t:      Math.random(),
      speed:  (0.18 + Math.random() * 0.28) * (Math.random() < 0.5 ? 1 : -1),
      color:  COLORS[i % COLORS.length],
      tailLen:0.12 + Math.random() * 0.14,
      alpha:  0.75 + Math.random() * 0.25,
      width:  1.8 + Math.random() * 1.4,
    }));

    for (let k = 0; k < 8; k++) {
      sparks.push({
        edgeFn:  EDGE_DEFS[Math.floor(Math.random() * EDGE_DEFS.length)],
        t:       Math.random(),
        speed:   (0.12 + Math.random() * 0.22) * (Math.random() < 0.5 ? 1 : -1),
        color:   COLORS[Math.floor(Math.random() * COLORS.length)],
        tailLen: 0.08 + Math.random() * 0.10,
        alpha:   0.4  + Math.random() * 0.35,
        width:   1.0  + Math.random() * 1.0,
      });
    }

    let last = null;
    const draw = (ts) => {
      const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016;
      last = ts;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      const p = getCubePoints(W, H);

      // floor grid
      ctx.save();
      const rows = 6, cols = 6;
      for (let r = 0; r <= rows; r++) {
        const frac = r / rows;
        const startX = p.bleft.x + (p.bbottom.x - p.bleft.x) * frac;
        const startY = p.bleft.y + (p.bbottom.y - p.bleft.y) * frac;
        const endX   = p.bbottom.x + (p.bright.x - p.bbottom.x) * frac;
        const endY   = p.bbottom.y + (p.bright.y - p.bbottom.y) * frac;
        const ext = 0.38;
        const lx0 = startX + (startX - p.cx) * ext;
        const ly0 = startY + (startY - (p.cy + p.dy)) * ext * 0.5;
        const lx1 = endX   + (endX   - p.cx) * ext;
        const ly1 = endY   + (endY   - (p.cy + p.dy)) * ext * 0.5;
        ctx.strokeStyle = `rgba(37,99,235,${0.12 + (r === 0 || r === rows ? 0.04 : 0)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(lx0, ly0); ctx.lineTo(lx1, ly1); ctx.stroke();
      }
      for (let c = 0; c <= cols; c++) {
        const frac = c / cols;
        const startX = p.bleft.x  + (p.bbottom.x - p.bleft.x)  * frac;
        const startY = p.bleft.y  + (p.bbottom.y - p.bleft.y)  * frac;
        const endX   = p.left.x   + (p.bottom.x  - p.left.x)   * frac;
        const endY   = p.left.y   + (p.bottom.y  - p.left.y)   * frac;
        const ext = 0.38;
        const lx0 = startX + (startX - p.cx) * ext * 0.5;
        const ly0 = startY + (startY - (p.cy + p.dy)) * ext * 0.3;
        const lx1 = endX   + (endX   - p.cx) * ext * 0.5;
        const ly1 = endY   + (endY   - (p.cy + p.dy)) * ext * 0.3;
        ctx.strokeStyle = `rgba(37,99,235,${0.10 + (c === 0 || c === cols ? 0.04 : 0)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(lx0, ly0); ctx.lineTo(lx1, ly1); ctx.stroke();
      }
      ctx.restore();

      // cube faces
      ctx.save();
      const leftGrad = ctx.createLinearGradient(p.left.x, p.left.y, p.bbottom.x, p.bbottom.y);
      leftGrad.addColorStop(0, 'rgba(29,78,216,0.85)');
      leftGrad.addColorStop(1, 'rgba(11,37,119,0.95)');
      ctx.fillStyle = leftGrad;
      ctx.beginPath();
      ctx.moveTo(p.left.x, p.left.y); ctx.lineTo(p.bottom.x, p.bottom.y);
      ctx.lineTo(p.bbottom.x, p.bbottom.y); ctx.lineTo(p.bleft.x, p.bleft.y);
      ctx.closePath(); ctx.fill(); ctx.restore();

      ctx.save();
      const rightGrad = ctx.createLinearGradient(p.right.x, p.right.y, p.bbottom.x, p.bbottom.y);
      rightGrad.addColorStop(0, 'rgba(17,50,160,0.80)');
      rightGrad.addColorStop(1, 'rgba(6,18,61,0.97)');
      ctx.fillStyle = rightGrad;
      ctx.beginPath();
      ctx.moveTo(p.right.x, p.right.y); ctx.lineTo(p.bottom.x, p.bottom.y);
      ctx.lineTo(p.bbottom.x, p.bbottom.y); ctx.lineTo(p.bright.x, p.bright.y);
      ctx.closePath(); ctx.fill(); ctx.restore();

      ctx.save();
      const topGrad = ctx.createLinearGradient(p.top.x, p.top.y, p.bottom.x, p.bottom.y);
      topGrad.addColorStop(0,   'rgba(96,165,250,0.92)');
      topGrad.addColorStop(0.4, 'rgba(56,130,246,0.88)');
      topGrad.addColorStop(1,   'rgba(37,99,235,0.82)');
      ctx.fillStyle = topGrad;
      ctx.beginPath();
      ctx.moveTo(p.top.x, p.top.y); ctx.lineTo(p.left.x, p.left.y);
      ctx.lineTo(p.bottom.x, p.bottom.y); ctx.lineTo(p.right.x, p.right.y);
      ctx.closePath(); ctx.fill(); ctx.restore();

      // edges
      const drawEdge = (a, b, color, width, blur) => {
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.shadowColor = '#60A5FA'; ctx.shadowBlur = blur;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
      };
      drawEdge(p.top,  p.left,   'rgba(224,242,254,0.95)', 2.5, 14);
      drawEdge(p.left, p.bottom, 'rgba(147,197,253,0.65)', 1.8, 8);
      drawEdge(p.bottom,p.right, 'rgba(147,197,253,0.65)', 1.8, 8);
      drawEdge(p.right, p.top,  'rgba(224,242,254,0.90)', 2.5, 14);
      drawEdge(p.left,  p.bleft,  'rgba(96,165,250,0.55)', 1.5, 6);
      drawEdge(p.bottom,p.bbottom,'rgba(96,165,250,0.70)', 1.8, 8);
      drawEdge(p.right, p.bright, 'rgba(96,165,250,0.45)', 1.2, 4);
      drawEdge(p.bleft, p.bbottom,'rgba(59,130,246,0.40)', 1.2, 4);
      drawEdge(p.bright,p.bbottom,'rgba(59,130,246,0.35)', 1.0, 3);

      // sparks
      sparks.forEach((spark) => {
        spark.t += spark.speed * dt;
        if (spark.t > 1) spark.t = 0;
        if (spark.t < 0) spark.t = 1;
        const [A, B] = spark.edgeFn(p);
        const hx = A.x + (B.x - A.x) * spark.t;
        const hy = A.y + (B.y - A.y) * spark.t;
        const tailT = Math.max(0, spark.t - spark.tailLen);
        const tx = A.x + (B.x - A.x) * tailT;
        const ty = A.y + (B.y - A.y) * tailT;
        const grad = ctx.createLinearGradient(tx, ty, hx, hy);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, `${spark.color}55`);
        grad.addColorStop(1, spark.color + 'FF');
        ctx.save();
        ctx.globalAlpha = spark.alpha;
        ctx.strokeStyle = grad; ctx.lineWidth = spark.width; ctx.lineCap = 'round';
        ctx.shadowColor = spark.color; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.shadowBlur = 18; ctx.fillStyle = spark.color; ctx.globalAlpha = spark.alpha * 0.9;
        ctx.beginPath(); ctx.arc(hx, hy, spark.width * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
};

// ── Logo ────────────────────────────────────────────────────────────────────
const ReqSenseLogo = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="url(#rlt)" d="M50 12 L85 32 L50 52 L15 32 Z" />
    <path fill="url(#rll)" d="M15 32 L50 52 L50 88 L15 68 Z" />
    <path fill="url(#rlr)" d="M50 52 L85 32 L85 68 L50 88 Z" />
    <path fill="none" stroke="#93C5FD" strokeWidth="2.5" d="M50 12 L85 32 L50 52 L15 32 Z" />
    <path fill="none" stroke="#60A5FA" strokeWidth="2" d="M50 52 L50 88" />
    <defs>
      <linearGradient id="rlt" x1="15" y1="12" x2="85" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" /><stop offset="1" stopColor="#2563EB" />
      </linearGradient>
      <linearGradient id="rll" x1="15" y1="32" x2="50" y2="88" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2563EB" /><stop offset="1" stopColor="#1D4ED8" />
      </linearGradient>
      <linearGradient id="rlr" x1="50" y1="32" x2="85" y2="88" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1E3A8A" /><stop offset="1" stopColor="#172554" />
      </linearGradient>
    </defs>
  </svg>
);

// ── Inline SVG icons ────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84-.99-.01z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="2,4 12,13 22,4" />
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
    <rect x="5" y="11" width="14" height="11" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const PersonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9,22 9,12 15,12 15,22" />
  </svg>
);
const EyeIcon = ({ open }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const HelpIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const HeadsetIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
    <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5z" /><polyline points="9 12 11 14 15 10" />
  </svg>
);
const LockSmallIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round">
    <rect x="5" y="11" width="14" height="11" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"
    style={{ animation: 'spin 0.8s linear infinite', marginRight: 8 }}>
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

// ── Main Register Component ──────────────────────────────────────────────────
export const Register = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';
  const inviteOrg   = searchParams.get('org')    || '';
  const inviteRole  = searchParams.get('role')   || 'client';
  const inviteEmail = searchParams.get('email')  || '';
  const isInviteFlow = Boolean(inviteToken);

  const [name, setName]                     = useState('');
  const [email, setEmail]                   = useState(inviteEmail);
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]                 = useState(false);
  const [showConfirmPw, setShowConfirmPw]   = useState(false);
  const [role, setRole]                     = useState(isInviteFlow ? inviteRole : 'client');
  const [orgId, setOrgId]                   = useState(inviteOrg);
  const [loading, setLoading]               = useState(false);

  const navigate  = useNavigate();
  const showToast = useToastStore((s) => s.showToast);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      showToast('Please fill in all required fields.', 'error'); return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error'); return;
    }
    if (password.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error'); return;
    }
    setLoading(true);
    try {
      await registerUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role: isInviteFlow ? inviteRole : role,
        organization_id: (isInviteFlow ? inviteOrg : orgId).trim() || null,
        invite_token: inviteToken || null,
      });
      showToast('Registration successful! Please log in.', 'success');
      navigate('/login');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Registration failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => showToast('Google Sign-Up coming soon!', 'info');

  return (
    <div style={s.root}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── TOP HEADER (Logo on left, Help/Support on right) ─────────────── */}
      <div style={s.topHeader}>
        <div style={s.logoRow}>
          <ReqSenseLogo size={38} />
          <span style={s.logoText}>ReqSense <span style={s.aiText}>AI</span></span>
        </div>
        <div style={s.helpRow}>
          <button style={s.helpBtn} onClick={() => showToast('Help documentation available in your dashboard.', 'info')}>
            <HelpIcon /> Help
          </button>
          <span style={s.divider}>|</span>
          <button style={s.helpBtn} onClick={() => showToast('Contact support at support@reqsense.ai', 'info')}>
            <HeadsetIcon /> Contact Us
          </button>
        </div>
      </div>

      {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
      <div style={s.left}>
        <div style={s.cubeWrap}>
          <AnimatedCube />
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
      <div style={s.right}>
        <div style={{ ...s.card, maxWidth: 460, padding: '36px 44px 28px' }}>
          <div style={s.cardLogoWrap}>
            <ReqSenseLogo size={48} />
          </div>

          <h1 style={s.welcomeTitle}>{isInviteFlow ? 'Join Project' : 'Create Account'}</h1>
          <p style={s.welcomeSub}>
            {isInviteFlow ? 'Complete your profile to accept the invite' : 'Get started with ReqSense AI for free'}
          </p>

          {isInviteFlow && (
            <div style={s.inviteBanner}>
              You were invited as <strong>{inviteRole}</strong>. Your account will automatically connect.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={s.form}>
            {/* Full Name */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Full Name</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}><PersonIcon /></span>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={s.input}
                  onFocus={(e) => Object.assign(e.target.style, s.inputFocused)}
                  onBlur={(e)  => Object.assign(e.target.style, s.inputBlurred)}
                />
              </div>
            </div>

            {/* Email */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Email Address</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}><MailIcon /></span>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  disabled={isInviteFlow && Boolean(inviteEmail)}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ ...s.input, background: isInviteFlow && inviteEmail ? '#F1F5F9' : '#F8FAFC' }}
                  onFocus={(e) => Object.assign(e.target.style, s.inputFocused)}
                  onBlur={(e)  => Object.assign(e.target.style, s.inputBlurred)}
                />
              </div>
            </div>

            {/* Passwords — two columns */}
            <div style={s.twoCol}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Password</label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}><LockIcon /></span>
                  <input
                    id="reg-pw"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min 8 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...s.input, paddingRight: 40 }}
                    onFocus={(e) => Object.assign(e.target.style, s.inputFocused)}
                    onBlur={(e)  => Object.assign(e.target.style, s.inputBlurred)}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={s.eyeBtn}>
                    <EyeIcon open={showPw} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Confirm Password</label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}><LockIcon /></span>
                  <input
                    id="reg-confirm-pw"
                    type={showConfirmPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ ...s.input, paddingRight: 40 }}
                    onFocus={(e) => Object.assign(e.target.style, s.inputFocused)}
                    onBlur={(e)  => Object.assign(e.target.style, s.inputBlurred)}
                  />
                  <button type="button" onClick={() => setShowConfirmPw(v => !v)} style={s.eyeBtn}>
                    <EyeIcon open={showConfirmPw} />
                  </button>
                </div>
              </div>
            </div>

            {/* Role Radio Group */}
            {!isInviteFlow && (
              <div style={s.fieldGroup}>
                <label style={s.label}>I am joining as a...</label>
                <div style={s.roleGrid}>
                  {['client', 'developer'].map((r) => (
                    <label
                      key={r}
                      style={{
                        ...s.roleOption,
                        ...(role === r ? s.roleSelected : {}),
                      }}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                        style={{ display: 'none' }}
                      />
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Organization ID */}
            {!isInviteFlow && (
              <div style={s.fieldGroup}>
                <label style={s.label}>Organization ID <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Optional)</span></label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}><BuildingIcon /></span>
                  <input
                    id="reg-org"
                    type="text"
                    placeholder="Leave blank for new organization"
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    style={s.input}
                    onFocus={(e) => Object.assign(e.target.style, s.inputFocused)}
                    onBlur={(e)  => Object.assign(e.target.style, s.inputBlurred)}
                  />
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              id="register-submit"
              disabled={loading}
              style={{ ...s.signInBtn, opacity: loading ? 0.75 : 1 }}
            >
              {loading ? (
                <span style={s.spinWrap}><SpinnerIcon />{isInviteFlow ? 'Joining...' : 'Creating account...'}</span>
              ) : (
                <><span>{isInviteFlow ? 'Accept & Join' : 'Create Account'}</span><span style={s.arrow}>→</span></>
              )}
            </button>

            {/* Divider */}
            <div style={s.orRow}>
              <div style={s.orLine} />
              <span style={s.orText}>OR</span>
              <div style={s.orLine} />
            </div>

            {/* Google */}
            <button type="button" onClick={handleGoogle} style={s.googleBtn}>
              <GoogleIcon />
              <span style={{ marginLeft: 10 }}>Sign up with Google</span>
            </button>
          </form>

          <p style={s.registerRow}>
            Already have an account?{' '}
            <RouterLink to="/login" style={s.registerLink}>Sign In</RouterLink>
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Styles — mirrors Login exactly ──────────────────────────────────────────
const s = {
  root: {
    minHeight: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'row',
    background: 'linear-gradient(135deg, #020B2D 0%, #051A6B 40%, #0C3DB5 80%, #0F47D4 100%)',
    overflow: 'hidden',
    position: 'relative',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 36px',
    zIndex: 10,
  },
  left: {
    flex: '0 0 52%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '80px 36px 28px 36px',
    position: 'relative',
    overflow: 'hidden',
    color: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 3,
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 12 },
  logoText: { fontSize: '1.35rem', fontWeight: 800, letterSpacing: -0.5, color: '#fff' },
  aiText: { color: '#38BDF8' },
  helpRow: { display: 'flex', alignItems: 'center', gap: 12 },
  helpBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)',
    fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
    padding: '4px 2px', fontFamily: 'inherit', transition: 'color 0.2s',
  },
  divider: { color: 'rgba(255,255,255,0.25)', fontSize: '1.1rem' },
  cubeWrap: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px 0', minHeight: 0,
  },
  trustRow: { display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative', zIndex: 3 },
  trustText: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 },
  right: {
    flex: '0 0 48%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
    position: 'relative',
    zIndex: 2,
    overflowY: 'auto',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: 20,
    padding: '44px 44px 36px',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  cardLogoWrap: { marginBottom: 20 },
  welcomeTitle: {
    fontSize: '1.75rem', fontWeight: 800, color: '#0F172A',
    margin: '0 0 8px', textAlign: 'center', letterSpacing: -0.5,
  },
  welcomeSub: { fontSize: '0.9rem', color: '#64748B', margin: '0 0 20px', textAlign: 'center' },
  inviteBanner: {
    width: '100%', background: '#F0FDF4', border: '1px solid #86EFAC',
    borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem',
    color: '#15803D', marginBottom: 16, lineHeight: 1.5,
  },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: 0 },
  fieldGroup: { marginBottom: 14, width: '100%' },
  twoCol: { display: 'flex', gap: 12, marginBottom: 14, width: '100%' },
  label: { display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#1E293B', marginBottom: 6 },
  inputWrap: { position: 'relative', width: '100%' },
  inputIcon: {
    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
    display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 1,
  },
  input: {
    width: '100%', boxSizing: 'border-box', height: 46, paddingLeft: 44, paddingRight: 16,
    border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: '0.9rem', color: '#0F172A',
    background: '#F8FAFC', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  },
  inputFocused: { borderColor: '#2563EB', boxShadow: '0 0 0 3px rgba(37,99,235,0.12)', background: '#fff' },
  inputBlurred:  { borderColor: '#E2E8F0', boxShadow: 'none', background: '#F8FAFC' },
  eyeBtn: {
    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8',
    display: 'flex', alignItems: 'center', padding: 0,
  },
  roleRow: { display: 'flex', gap: 8, width: '100%' },
  roleOption: {
    flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 10,
    border: '1.5px solid #E2E8F0', fontSize: '0.83rem', fontWeight: 600,
    color: '#475569', cursor: 'pointer', transition: 'all 0.15s', background: '#F8FAFC',
  },
  roleSelected: {
    border: '1.5px solid #2563EB', color: '#2563EB',
    background: 'rgba(37,99,235,0.06)', boxShadow: '0 0 0 3px rgba(37,99,235,0.10)',
  },
  signInBtn: {
    width: '100%', height: 52,
    background: 'linear-gradient(90deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%)',
    color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 22px', fontFamily: 'inherit', letterSpacing: 0.2,
    boxShadow: '0 4px 20px rgba(37,99,235,0.45)', transition: 'transform 0.15s, box-shadow 0.15s',
    marginBottom: 16, marginTop: 4,
  },
  arrow: { fontSize: '1.2rem', fontWeight: 400 },
  spinWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' },
  orRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  orLine: { flex: 1, height: 1, background: '#E2E8F0' },
  orText: { fontSize: '0.78rem', fontWeight: 700, color: '#94A3B8', letterSpacing: 1 },
  googleBtn: {
    width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: '0.9rem',
    fontWeight: 600, color: '#1E293B', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'border-color 0.2s, background 0.2s', marginBottom: 16,
  },
  registerRow: { fontSize: '0.875rem', color: '#64748B', margin: '4px 0 0', textAlign: 'center' },
  registerLink: { color: '#2563EB', fontWeight: 700, textDecoration: 'none' },
  secBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: 'rgba(2,11,45,0.85)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: '8px 0', zIndex: 10,
  },
  secText: { fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.2 },
};

export default Register;
