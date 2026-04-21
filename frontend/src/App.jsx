import { AnimatePresence, animate, motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BarChart3,
  Database,
  Download,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  ScanSearch,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analyze', label: 'Analyze', icon: ScanSearch },
  { to: '/bulk', label: 'Bulk Upload', icon: Upload },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
];

const chartPalette = ['#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE', '#2563EB', '#1D4ED8', '#F8FAFC', '#0F172A'];
const clusterAccentPalette = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#F8FAFC', '#1D4ED8'];
const topSkillBlocklist = new Set([
  'city',
  'state',
  'street',
  'to',
  'the',
  'and',
  'for',
  'with',
  'year',
  'years',
  'experience',
  'work',
  'summary',
  'objective',
  'name',
  'date',
  'address',
  'email',
  'phone',
  'reference',
]);

const AppDataContext = createContext(null);

const pageVariants = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

const pageTransition = {
  duration: 0.35,
  ease: [0.25, 0.46, 0.45, 0.94],
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const fadeItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } },
};

function fetchJSON(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

function sanitizeTopSkills(skills = []) {
  return skills.filter((entry) => {
    const tokens = String(entry.skill || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (!tokens.length) {
      return false;
    }
    return !tokens.every((token) => topSkillBlocklist.has(token));
  });
}

function useAppData() {
  return useContext(AppDataContext);
}

function CountUp({ value }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value || 0, {
      duration: 1,
      ease: 'easeOut',
      onUpdate(latest) {
        setDisplay(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [value]);

  return <>{formatNumber(display)}</>;
}

function ConfidenceRing({ score }) {
  const value = Math.max(0, Math.min(1, score || 0));
  const size = 132;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (1 - value);

  return (
    <div className="confidence-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="confidence-ring-svg">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(100, 116, 139, 0.28)" strokeWidth={stroke} fill="transparent" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#3B82F6"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dash }}
          transition={{ duration: 1.15, ease: 'easeOut' }}
        />
      </svg>
      <div className="confidence-ring-center">
        <span>Confidence</span>
        <strong>{Math.round(value * 100)}%</strong>
      </div>
    </div>
  );
}

async function fetchPdfOrDocText(file) {
  const name = file.name.toLowerCase();
  const data = await file.arrayBuffer();

  if (name.endsWith('.pdf')) {
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
    }
    return pages.join('\n\n');
  }

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const result = await mammoth.extractRawText({ arrayBuffer: data });
    return result.value || '';
  }

  throw new Error('Unsupported file. Use PDF or DOCX.');
}

function DashboardConstitution() {
  const nodes = useMemo(() => {
    const count = 12;
    const radius = 118;
    return Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2;
      const wobble = index % 2 === 0 ? 0.84 : 1.08;
      return {
        id: index,
        x: 160 + Math.cos(angle) * radius * wobble,
        y: 160 + Math.sin(angle) * radius * (index % 3 === 0 ? 0.76 : 1),
        r: index % 4 === 0 ? 16 : 12,
      };
    });
  }, []);

  const links = useMemo(() => {
    const list = [];
    for (let index = 0; index < nodes.length; index += 1) {
      const next = (index + 1) % nodes.length;
      const skip = (index + 3) % nodes.length;
      list.push([nodes[index], nodes[next]]);
      if (index % 2 === 0) list.push([nodes[index], nodes[skip]]);
    }
    return list;
  }, [nodes]);

  return (
    <motion.svg viewBox="0 0 320 320" className="constellation-svg" aria-hidden>
      <defs>
        <radialGradient id="constellationGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(59,130,246,0.34)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0)" />
        </radialGradient>
      </defs>
      <circle cx="160" cy="160" r="142" fill="url(#constellationGlow)" />
      {links.map(([start, end], index) => (
        <motion.line
          key={`link-${index}`}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={index % 2 === 0 ? '#3B82F6' : '#93C5FD'}
          strokeOpacity="0.24"
          strokeWidth="1"
          strokeDasharray="2 8"
          animate={{ strokeDashoffset: [0, -20] }}
          transition={{ duration: 7 + index * 0.2, repeat: Infinity, ease: 'linear' }}
        />
      ))}
      {nodes.map((node, index) => (
        <motion.g key={node.id} animate={{ y: [0, -4, 0] }} transition={{ duration: 3.8 + index * 0.2, repeat: Infinity, ease: 'easeInOut' }}>
          <motion.circle
            cx={node.x}
            cy={node.y}
            r={node.r + 8}
            fill={index % 2 === 0 ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.12)'}
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <circle cx={node.x} cy={node.y} r={node.r} fill={index % 2 === 0 ? '#3B82F6' : '#F8FAFC'} />
        </motion.g>
      ))}
    </motion.svg>
  );
}

function ShellNavbar({ onMenuOpen }) {
  return (
    <header className="navbar-shell">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Database size={16} />
          </span>
          <span>SkillMap</span>
        </Link>

        <nav className="nav-links desktop-only">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {({ isActive }) => (
                <span className="nav-link-inner">
                  {isActive ? <motion.span className="nav-pill" layoutId="nav-pill" transition={{ duration: 0.35, ease: 'easeInOut' }} /> : null}
                  <span className="nav-link-text">{item.label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <Link to="/analyze" className="btn-cta desktop-only">
            Get Started <ArrowRight size={15} />
          </Link>
          <button type="button" className="menu-button mobile-only" onClick={onMenuOpen} aria-label="Open navigation">
            <Menu size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileMenu({ open, onClose }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="mobile-menu-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="mobile-menu-panel" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
            <div className="mobile-menu-top">
              <span>Navigation</span>
              <button type="button" className="menu-button" onClick={onClose} aria-label="Close navigation">
                <X size={18} />
              </button>
            </div>
            <div className="mobile-menu-links">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={onClose}>
                  {({ isActive }) => (
                    <span className={`mobile-nav-link ${isActive ? 'active' : ''}`}>
                      {isActive ? <motion.span className="mobile-nav-pill" layoutId="mobile-nav-pill" transition={{ duration: 0.35, ease: 'easeInOut' }} /> : null}
                      <span>{item.label}</span>
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function AppShell() {
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        setLoading(true);
        const [statsData, clusterData] = await Promise.all([fetchJSON('/stats'), fetchJSON('/clusters')]);
        if (!alive) return;
        setStats(statsData);
        setClusters(clusterData);
      } catch (requestError) {
        if (!alive) return;
        setError(requestError.message || 'Failed to load data.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <AppDataContext.Provider value={{ stats, clusters, loading, error }}>
      <div className="app-shell">
        <ShellNavbar onMenuOpen={() => setMobileMenuOpen(true)} />
        <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        <main className="app-main">
          {error ? <div className="notice-banner">{error}</div> : null}
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={(
                  <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
                    <DashboardPage />
                  </motion.div>
                )}
              />
              <Route
                path="/analyze"
                element={(
                  <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
                    <AnalyzePage />
                  </motion.div>
                )}
              />
              <Route
                path="/bulk"
                element={(
                  <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
                    <BulkUploadPage />
                  </motion.div>
                )}
              />
              <Route
                path="/insights"
                element={(
                  <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
                    <InsightsPage />
                  </motion.div>
                )}
              />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </AppDataContext.Provider>
  );
}

function DashboardPage() {
  const { stats, clusters, loading } = useAppData();
  const totalResumes = stats?.total_resumes || 0;
  const topSkills = sanitizeTopSkills(stats?.top_skill_domains || []).slice(0, 6);

  return (
    <motion.div className="page-stack" variants={staggerContainer} initial="hidden" animate="show">
      <motion.section className="hero-shell" variants={fadeItem} whileHover={{ y: -2 }}>
        <div className="hero-layout">
          <div className="hero-copy">
            <div className="eyebrow">AI Talent Platform</div>
            <h1>Map talent. Not just keywords.</h1>
            <p>SkillMap uses BERT + UMAP clustering to group resumes into high-signal skill profiles with a clean review flow.</p>
            <div className="hero-actions">
              <Link to="/analyze" className="button-primary">
                Analyze Resume
              </Link>
              <Link to="/bulk" className="button-secondary">
                Bulk Upload
              </Link>
            </div>
          </div>

          <div className="hero-visual">
            <DashboardConstitution clusters={clusters} />
          </div>
        </div>
      </motion.section>

      <motion.section className="stat-grid" variants={fadeItem}>
        <StatCard icon={Database} label="Resumes analyzed" value={stats?.total_resumes || 0} loading={loading} />
        <StatCard icon={Sparkles} label="Clusters found" value={stats?.clusters_found || clusters.length} loading={loading} />
        <StatCard icon={BarChart3} label="Skill domains" value={topSkills.length} loading={loading} />
      </motion.section>

      <motion.section className="section-card" variants={fadeItem}>
        <SectionHeader title="Skill clusters" subtitle="Three-column overview of the current profile groups." />
        <div className="cluster-grid">
          {clusters.map((cluster, index) => {
            const ratio = totalResumes ? Math.round((cluster.resume_count / totalResumes) * 100) : 0;
            return (
              <motion.article key={cluster.id} className="cluster-card" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                <div className="cluster-accent" style={{ backgroundColor: clusterAccentPalette[index % clusterAccentPalette.length] }} />
                <div className="cluster-topline">
                  <span className="cluster-dot" style={{ backgroundColor: clusterAccentPalette[index % clusterAccentPalette.length] }} />
                  <span className="cluster-index">{String(cluster.id).padStart(2, '0')}</span>
                </div>
                <h3>{cluster.name}</h3>
                <div className="cluster-count">{formatNumber(cluster.resume_count)} resumes</div>
                <div className="mini-progress-track">
                  <motion.div className="mini-progress-fill" initial={{ width: 0 }} animate={{ width: `${Math.max(10, ratio)}%` }} transition={{ duration: 0.7 }} />
                </div>
              </motion.article>
            );
          })}
        </div>
      </motion.section>

      <motion.section className="section-card" variants={fadeItem}>
        <SectionHeader title="Top skills" subtitle="Filtered to remove non-skill terms." />
        <div className="skill-strip">
          {topSkills.map((skill) => (
            <div key={skill.skill} className="skill-chip">
              {skill.skill}
            </div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <motion.div className="stat-card" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <div className="stat-icon-wrap">
        <Icon size={16} />
      </div>
      <div className="stat-value">{loading ? <span className="shimmer-line" /> : <CountUp value={value} />}</div>
      <div className="stat-label">{label}</div>
    </motion.div>
  );
}

function AnalyzePage() {
  const { clusters } = useAppData();
  const [mode, setMode] = useState('text');
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  async function onFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setError('');
    setResult(null);

    try {
      const text = await fetchPdfOrDocText(file);
      setResumeText(text.trim());
      setFileName(file.name);
      setMode('file');
    } catch (requestError) {
      setError(requestError.message || 'Unable to extract text from file.');
    } finally {
      setExtracting(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function onAnalyze(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await fetchJSON('/predict', {
        method: 'POST',
        body: JSON.stringify({ resume_text: resumeText.trim() }),
      });
      setResult(data);
    } catch (requestError) {
      setError(requestError.message || 'Unable to analyze resume.');
    } finally {
      setLoading(false);
    }
  }

  const confidence = result?.confidence_score || 0;
  const matchedProfiles = clusters.find((item) => item.id === result?.cluster_id)?.resume_count || 0;
  const skills = (result?.top_skills || []).slice(0, 5);

  return (
    <motion.div className="analyze-grid" variants={staggerContainer} initial="hidden" animate="show">
      <motion.section className="panel" variants={fadeItem} whileHover={{ y: -3 }}>
        <div className="section-head-row analyze-head">
          <SectionHeader title="Analyze resume" subtitle="Paste text or upload a file for direct parsing." />
          <button type="button" className="button-accent upload-trigger" onClick={openFilePicker}>
            <Upload size={15} /> Upload resume
          </button>
        </div>

        <div className="underline-tabs">
          <button type="button" className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>
            Text
          </button>
          <button type="button" className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}>
            File
          </button>
        </div>

        <form onSubmit={onAnalyze} className="stacked-form">
          {mode === 'text' ? (
            <textarea
              className="clean-textarea"
              placeholder="Paste resume content here..."
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
            />
          ) : (
            <div className="file-panel">
              <label className="file-dropzone">
                <Upload size={18} />
                <span>Upload PDF or DOCX</span>
                <small>Text is extracted locally before analysis.</small>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onFileSelect} hidden />
              </label>

              <div className="file-preview-meta">
                <span>{fileName || 'No file selected'}</span>
                {extracting ? <span className="muted">Extracting...</span> : null}
              </div>

              <textarea
                className="clean-textarea preview"
                placeholder="Extracted text preview..."
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
              />
            </div>
          )}

          <button type="submit" className="button-primary full" disabled={!resumeText.trim() || loading || extracting}>
            {loading ? <LoaderCircle size={16} className="spin" /> : <ScanSearch size={16} />}
            Analyze Resume
          </button>
        </form>

        {error ? <div className="notice-banner">{error}</div> : null}
      </motion.section>

      <motion.section className="panel" variants={fadeItem} whileHover={{ y: -3 }}>
        {result ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="result-panel">
            <div className="result-headline">
              <div>
                <h3>{result.cluster_name}</h3>
                <p>{formatNumber(matchedProfiles)} matched profiles</p>
              </div>
              <div className="result-ring-wrap">
                <ConfidenceRing score={confidence} />
              </div>
            </div>

            <div className="result-skills-block">
              <div className="section-subhead">Skills</div>
              <div className="pill-row">
                {skills.map((skill) => (
                  <span key={skill} className="skill-pill">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="empty-panel">
            <div className="empty-border">
              <p>Result state appears here after analysis.</p>
            </div>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}

function BulkUploadPage() {
  const [slots, setSlots] = useState([{ id: 1, text: '' }]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const idRef = useRef(2);

  function addSlot(text = '') {
    setSlots((current) => [...current, { id: idRef.current++, text }]);
  }

  function updateSlot(id, text) {
    setSlots((current) => current.map((slot) => (slot.id === id ? { ...slot, text } : slot)));
  }

  function removeSlot(id) {
    setSlots((current) => (current.length > 1 ? current.filter((slot) => slot.id !== id) : current));
  }

  async function handleDrop(event) {
    event.preventDefault();
    setError('');

    const files = Array.from(event.dataTransfer.files || []);
    for (const file of files) {
      try {
        const text = await fetchPdfOrDocText(file);
        addSlot(text.trim());
      } catch {
        setError('Only PDF and DOCX files are supported.');
      }
    }
  }

  async function analyzeAll() {
    const payload = slots.map((slot) => slot.text.trim()).filter(Boolean);
    setLoading(true);
    setResults([]);
    setProgress(0);
    setError('');

    try {
      const collected = [];
      for (let index = 0; index < payload.length; index += 1) {
        const prediction = await fetchJSON('/predict', {
          method: 'POST',
          body: JSON.stringify({ resume_text: payload[index] }),
        });

        collected.push({
          index,
          cluster_id: prediction.cluster_id,
          cluster_name: prediction.cluster_name,
          confidence_score: prediction.confidence_score,
          top_skills: prediction.top_skills,
        });

        setProgress(Math.round(((index + 1) / payload.length) * 100));
      }
      setResults(collected);
    } catch (requestError) {
      setError(requestError.message || 'Bulk analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const headers = ['index', 'cluster_id', 'cluster_name', 'confidence_score', 'top_skills'];
    const rows = results.map((item) => [
      item.index,
      item.cluster_id,
      item.cluster_name,
      item.confidence_score,
      (item.top_skills || []).join(' | '),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'skillmap-bulk-results.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div className="page-stack" variants={staggerContainer} initial="hidden" animate="show">
      <motion.section className="panel" variants={fadeItem} whileHover={{ y: -3 }}>
        <SectionHeader title="Bulk upload" subtitle="Drop files or build a queue of resume slots." />

        <div className="drop-zone clean" onDrop={handleDrop} onDragOver={(event) => event.preventDefault()}>
          <Upload size={18} />
          <div>
            <strong>Drag and drop files here</strong>
            <p>PDF or DOCX only</p>
          </div>
        </div>

        <div className="bulk-actions">
          <button type="button" className="button-secondary" onClick={() => addSlot('')}>
            Add slot
          </button>
          <button type="button" className="button-primary" onClick={analyzeAll} disabled={loading}>
            {loading ? <LoaderCircle size={16} className="spin" /> : <ScanSearch size={16} />} Analyze all
          </button>
        </div>

        {loading ? (
          <div className="progress-shell">
            <div className="progress-label">Processing {progress}%</div>
            <div className="progress-track">
              <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.22 }} />
            </div>
          </div>
        ) : null}

        <div className="slot-list">
          {slots.map((slot, index) => (
            <motion.div key={slot.id} className="slot-row" whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
              <div className="slot-header">
                <strong>Resume {index + 1}</strong>
                <button type="button" className="icon-button" onClick={() => removeSlot(slot.id)}>
                  <X size={14} />
                </button>
              </div>
              <textarea className="clean-textarea preview" value={slot.text} onChange={(event) => updateSlot(slot.id, event.target.value)} placeholder="Paste resume content" />
            </motion.div>
          ))}
        </div>

        {error ? <div className="notice-banner">{error}</div> : null}
      </motion.section>

      <motion.section className="panel" variants={fadeItem} whileHover={{ y: -3 }}>
        <div className="section-head-row">
          <SectionHeader title="Results" subtitle="Plain table output for screening." />
          <button type="button" className="button-accent" onClick={exportCsv} disabled={!results.length}>
            <Download size={15} /> Export CSV
          </button>
        </div>

        <div className="table-shell">
          <table className="results-table">
            <thead>
              <tr>
                <th>Resume</th>
                <th>Cluster</th>
                <th>Confidence</th>
                <th>Top skills</th>
              </tr>
            </thead>
            <tbody>
              {results.length ? (
                results.map((row) => (
                  <tr key={row.index}>
                    <td>Resume {row.index + 1}</td>
                    <td>
                      <span className={`cluster-badge ${clusterAccentClass(row.cluster_id)}`}>{row.cluster_name}</span>
                    </td>
                    <td>{Math.round((row.confidence_score || 0) * 100)}%</td>
                    <td>{(row.top_skills || []).slice(0, 4).join(', ')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No results yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </motion.div>
  );
}

function clusterAccentClass(clusterId = 0) {
  const classes = ['cluster-badge-blue', 'cluster-badge-white', 'cluster-badge-navy', 'cluster-badge-steel'];
  return classes[clusterId % classes.length];
}

function InsightsPage() {
  const { stats } = useAppData();
  const distribution = stats?.cluster_distribution || [];
  const topSkills = sanitizeTopSkills(stats?.top_skill_domains || []).slice(0, 10);
  const pieData = topSkills.slice(0, 6).map((item, index) => ({ ...item, fill: chartPalette[index % chartPalette.length] }));

  return (
    <motion.div className="page-stack" variants={staggerContainer} initial="hidden" animate="show">
      <motion.section className="panel" variants={fadeItem} whileHover={{ y: -3 }}>
        <SectionHeader title="Cluster insights" subtitle="Minimal charts with blue and white accents." />

        <div className="insight-grid">
          <div className="chart-shell">
            <SectionStripeTitle>Resumes per cluster</SectionStripeTitle>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, color: '#F8FAFC' }}
                    cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                  />
                  <Bar dataKey="resume_count" radius={[10, 10, 0, 0]}>
                    {distribution.map((entry, index) => (
                      <Cell key={entry.id} fill={chartPalette[index % chartPalette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-shell">
            <SectionStripeTitle>Skill mix</SectionStripeTitle>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="count" nameKey="skill" innerRadius={66} outerRadius={112} paddingAngle={3}>
                    {pieData.map((entry) => (
                      <Cell key={entry.skill} fill={entry.fill} />
                    ))}
                  </Pie>
                    <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#F8FAFC' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section className="panel" variants={fadeItem} whileHover={{ y: -3 }}>
        <SectionStripeTitle>Top 10 skills</SectionStripeTitle>
        <div className="skill-list">
          {topSkills.map((skill, index) => (
            <motion.div key={skill.skill} className="skill-row-block" whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
              <div className="skill-row-header">
                <span>{skill.skill}</span>
                <strong>{formatNumber(skill.count)}</strong>
              </div>
              <div className="mini-progress-track">
                <div className="mini-progress-fill" style={{ width: `${Math.max(14, 100 - index * 8)}%`, background: `linear-gradient(90deg, ${chartPalette[index % chartPalette.length]}, #FFFFFF)` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function SectionStripeTitle({ children }) {
  return (
    <div className="stripe-title">
      <span />
      <h3>{children}</h3>
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
