import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

const LIMITS = { name: 100, title: 200, body: 20000 };
const FONT_OPTIONS = [
    { label: 'Raleway',           value: "'Raleway', sans-serif" },
    { label: 'Lato',              value: "'Lato', sans-serif" },
    { label: 'Merriweather',      value: "'Merriweather', serif" },
    { label: 'Playfair Display',  value: "'Playfair Display', serif" },
    { label: 'Libre Baskerville', value: "'Libre Baskerville', serif" },
    { label: 'Georgia',           value: "Georgia, serif" },
    { label: 'Courier New',       value: "'Courier New', monospace" },
];
const HL_COLORS = ['#fdff00', '#ff9a00', '#00ff04', '#00c5ff', '#ff00a7'];
const DRAW_COLORS = ['#212529', '#343a40', '#495057', '#6c757d', '#adb5bd'];

// ── HELPERS ───────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 10); }
const DANGEROUS = [/<script[\s\S]*?>[\s\S]*?<\/script>/gi, /<[^>]+>/g, /javascript\s*:/gi, /on\w+\s*=/gi, /data\s*:/gi, /vbscript\s*:/gi];
function sanitize(s) { let r = s; for (const x of DANGEROUS) r = r.replace(x, ''); return r; }
function isSuspicious(s) { return DANGEROUS.some(rx => { rx.lastIndex = 0; return rx.test(s); }); }
function applyLimit(s, f) { return s.slice(0, LIMITS[f]); }
function escapeHTML(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }
function wordCount(t) { return t.trim() ? t.trim().split(/\s+/).length : 0; }
function timeAgo(ts) { const d = (Date.now() - ts) / 1e3; if (d < 60) return 'just now'; if (d < 3600) return `${Math.floor(d / 60)}m ago`; if (d < 86400) return `${Math.floor(d / 3600)}h ago`; return `${Math.floor(d / 86400)}d ago`; }

async function getIndex() { try { const r = await window.storage.get('classes-index', true); return r?.value ? JSON.parse(r.value) : []; } catch { return []; } }
async function setIndex(list) { await window.storage.set('classes-index', JSON.stringify(list), true); }
async function getClassMeta(id) { try { const r = await window.storage.get(`class-${id}`, true); return r?.value ? JSON.parse(r.value) : null; } catch { return null; } }
async function loadEssays(id) { try { const r = await window.storage.get(`essays-${id}`, true); return r?.value ? JSON.parse(r.value) : []; } catch { return []; } }
async function saveEssays(id, essays) { await window.storage.set(`essays-${id}`, JSON.stringify(essays), true); }
async function loadAssignments(classId) { try { const r = await window.storage.get(`assignments-${classId}`, true); return r?.value ? JSON.parse(r.value) : []; } catch { return []; } }
async function saveAssignmentsIndex(classId, list) { await window.storage.set(`assignments-${classId}`, JSON.stringify(list), true); }
async function getAssignment(id) { try { const r = await window.storage.get(`assignment-${id}`, true); return r?.value ? JSON.parse(r.value) : null; } catch { return null; } }
async function saveAssignment(a) { await window.storage.set(`assignment-${a.id}`, JSON.stringify(a), true); }
async function loadSubmissions(assignmentId) { try { const r = await window.storage.get(`submissions-${assignmentId}`, true); return r?.value ? JSON.parse(r.value) : []; } catch { return []; } }
async function saveSubmissions(assignmentId, subs) { await window.storage.set(`submissions-${assignmentId}`, JSON.stringify(subs), true); }

const fonts = `@import url('https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Lato:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');`;
const css = `
  *{box-sizing:border-box;margin:0;padding:0;}
  ol,ul{padding-left:28px;}
  .app{min-height:100vh;background:#f8f9fa;font-family:'Raleway',sans-serif;color:#212529;}
  .header{background:#212529;color:#f8f9fa;padding:18px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #6c757d;}
  .header-title{font-family:'Raleway',sans-serif;font-size:1.5rem;font-weight:700;letter-spacing:.04em;}
  .header-subtitle{font-size:.72rem;color:#6c757d;letter-spacing:.15em;text-transform:uppercase;margin-top:2px;}
  .mode-badge{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;padding:5px 12px;border-radius:2px;}
  .mode-badge.teacher{background:#343a40;color:#dee2e6;}
  .shell{max-width:720px;margin:48px auto;padding:0 24px;}
  .card{background:#ffffff;border:1px solid #dee2e6;border-radius:4px;padding:40px 48px;box-shadow:0 2px 20px rgba(33,37,41,.07);}
  .card-heading{font-family:'Raleway',sans-serif;font-size:1.6rem;font-weight:700;margin-bottom:6px;}
  .card-sub{font-size:.82rem;color:#6c757d;letter-spacing:.04em;margin-bottom:32px;border-bottom:1px solid #dee2e6;padding-bottom:20px;}
  .field-group{margin-bottom:20px;}
  .field-label{display:block;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#6c757d;margin-bottom:6px;font-weight:600;}
  .field-input{width:100%;padding:10px 14px;border:1px solid #dee2e6;border-radius:3px;font-family:'Raleway',sans-serif;font-size:.97rem;background:#f8f9fa;color:#212529;outline:none;transition:border-color .2s;}
  .field-input:focus{border-color:#6c757d;background:#ffffff;}
  .field-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236c757d' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;cursor:pointer;}
  .field-textarea{min-height:300px;resize:vertical;line-height:1.75;}
  .char-row{display:flex;justify-content:space-between;margin-top:5px;font-size:.72rem;color:#adb5bd;}
  .char-warn{color:#6c757d;}
  .btn-primary{width:100%;padding:13px;background:#212529;color:#f8f9fa;border:none;border-radius:3px;font-family:'Raleway',sans-serif;font-size:1rem;font-weight:600;cursor:pointer;margin-top:8px;transition:background .2s;letter-spacing:.04em;}
  .btn-primary:hover{background:#343a40;}
  .btn-primary:disabled{background:#adb5bd;cursor:not-allowed;}
  .btn-secondary{width:100%;padding:11px;background:transparent;color:#212529;border:1px solid #dee2e6;border-radius:3px;font-family:'Raleway',sans-serif;font-size:.95rem;font-weight:600;cursor:pointer;margin-top:8px;transition:all .2s;}
  .btn-secondary:hover{border-color:#212529;}
  .error-msg{color:#8b2020;font-size:.85rem;margin-bottom:12px;padding:10px 14px;background:#fdf0f0;border:1px solid #e8c4c4;border-radius:3px;}
  .warn-msg{color:#495057;font-size:.85rem;margin-bottom:12px;padding:10px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:3px;}
  .success-box{background:#f0f7ee;border:1px solid #8abe80;border-radius:3px;padding:20px 24px;margin-top:20px;text-align:center;}
  .success-box .check{font-size:1.8rem;}
  .success-box p{color:#2d5a27;font-size:.95rem;margin-top:8px;}
  .class-banner{background:#212529;color:#6c757d;padding:10px 24px;font-size:.78rem;letter-spacing:.06em;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
  .class-name{font-weight:700;color:#f8f9fa;font-size:.9rem;}
  .teacher-shell{max-width:960px;margin:40px auto;padding:0 24px;}
  .teacher-heading{font-family:'Raleway',sans-serif;font-size:1.4rem;font-weight:700;margin-bottom:4px;}
  .teacher-meta{font-size:.78rem;color:#6c757d;margin-bottom:28px;}
  .top-bar{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;}
  .refresh-btn{padding:8px 18px;background:transparent;border:1px solid #dee2e6;border-radius:3px;font-family:'Raleway',sans-serif;font-size:.8rem;cursor:pointer;color:#6c757d;transition:all .15s;}
  .refresh-btn:hover{border-color:#6c757d;color:#212529;}
  .class-list{display:flex;flex-direction:column;gap:10px;margin:16px 0;}
  .class-item{padding:14px 18px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:all .15s;}
  .class-item:hover{border-color:#6c757d;background:#ffffff;transform:translateX(3px);}
  .class-item-name{font-weight:600;font-size:.95rem;}
  .class-item-meta{font-size:.75rem;color:#adb5bd;margin-top:2px;}
  .essay-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:16px;}
  .essay-card{background:#ffffff;border:1px solid #dee2e6;border-radius:4px;padding:22px 24px;position:relative;overflow:hidden;transition:box-shadow .2s,border-color .2s,transform .15s;}
  .essay-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:#6c757d;transform:scaleX(0);transition:transform .2s;transform-origin:left;}
  .essay-card:hover{box-shadow:0 4px 24px rgba(33,37,41,.12);border-color:#6c757d;transform:translateY(-2px);}
  .essay-card:hover::before{transform:scaleX(1);}
  .essay-author{font-weight:600;font-size:1.05rem;margin-bottom:3px;}
  .essay-title-small{font-size:.82rem;color:#6c757d;font-style:italic;margin-bottom:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .essay-preview{font-size:.83rem;color:#495057;line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
  .essay-footer{margin-top:14px;display:flex;justify-content:space-between;align-items:center;}
  .essay-wc{font-size:.7rem;color:#adb5bd;padding-right:12px;}
  .display-btn{font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;background:#212529;color:#f8f9fa;border:none;padding:5px 12px;border-radius:2px;cursor:pointer;font-family:'Raleway',sans-serif;transition:background .15s;white-space:nowrap;}
  .display-btn:hover{background:#8b2020;}
  .delete-btn{font-size:.7rem;background:none;border:1px solid #dee2e6;color:#adb5bd;padding:5px 12px;border-radius:2px;cursor:pointer;font-family:'Raleway',sans-serif;transition:all .15s;white-space:nowrap;}
  .delete-btn:hover{border-color:#8b2020;color:#8b2020;}
  .empty-state{text-align:center;padding:80px 0;color:#adb5bd;}
  .empty-state .icon{font-size:3rem;opacity:.4;}
  .empty-state p{margin-top:12px;font-style:italic;font-size:.95rem;}
  .modal-overlay{position:fixed;inset:0;background:rgba(33,37,41,.6);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(2px);}
  .modal{background:#ffffff;border:1px solid #dee2e6;border-radius:4px;padding:40px 48px;width:400px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(33,37,41,.2);}
  .modal h2{font-family:'Raleway',sans-serif;font-size:1.3rem;font-weight:700;margin-bottom:8px;}
  .modal-close{position:absolute;top:0;right:0;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#adb5bd;padding:4px 8px;line-height:1;}
  .divider{display:flex;align-items:center;gap:12px;margin:20px 0;color:#adb5bd;font-size:.78rem;}
  .divider::before,.divider::after{content:'';flex:1;border-top:1px solid #dee2e6;}
  .pin-error{color:#8b2020;font-size:.82rem;margin-top:8px;}
  .wb-root{position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#ffffff;display:flex;flex-direction:column;font-family:'Raleway',sans-serif;overflow:hidden;}
  .wb-header{background:#212529;color:#f8f9fa;padding:12px 32px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;border-bottom:3px solid #6c757d;}
  .wb-toolbar{background:#e9ecef;border-bottom:1px solid #dee2e6;padding:10px 24px;display:flex;align-items:center;gap:12px;flex-shrink:0;flex-wrap:wrap;}
  .wb-content{flex:1;overflow-y:auto;position:relative;}
  .wb-footer{background:#f8f9fa;border-top:1px solid #dee2e6;padding:14px 32px;display:flex;gap:12px;align-items:center;flex-shrink:0;}
  .home-shell{max-width:860px;margin:72px auto;padding:0 24px;}
  .home-intro{text-align:center;margin-bottom:48px;}
  .home-intro-heading{font-family:'Raleway',sans-serif;font-size:1.8rem;font-weight:700;color:#212529;margin-bottom:8px;}
  .home-intro-sub{font-size:.92rem;color:#6c757d;}
  .home-cards{display:grid;grid-template-columns:1fr 1fr;gap:24px;}
  .home-card{background:#ffffff;border:1px solid #dee2e6;border-radius:4px;padding:40px 36px;display:flex;flex-direction:column;transition:border-color .2s,box-shadow .2s,transform .15s;}
  .home-card:hover{border-color:#6c757d;box-shadow:0 4px 24px rgba(33,37,41,.1);transform:translateY(-2px);}
  .home-card-icon{font-size:2.2rem;margin-bottom:20px;}
  .home-card-heading{font-family:'Raleway',sans-serif;font-size:1.25rem;font-weight:700;margin-bottom:10px;color:#212529;}
  .home-card-desc{font-size:.88rem;color:#6c757d;line-height:1.75;flex:1;margin-bottom:28px;}
  .rte-wrap{border:1px solid #dee2e6;border-radius:3px;background:#ffffff;transition:border-color .2s;}
  .rte-wrap:focus-within{border-color:#6c757d;background:#ffffff;}
  .rte-toolbar{display:flex;align-items:center;gap:2px;padding:6px 8px;background:#f8f9fa;border-bottom:1px solid #dee2e6;border-radius:3px 3px 0 0;flex-wrap:wrap;}
  .rte-btn{min-width:28px;height:26px;padding:0 6px;border:1px solid transparent;background:none;border-radius:2px;cursor:pointer;font-family:'Raleway',sans-serif;font-size:.82rem;color:#495057;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;}
  .rte-btn:hover{background:#dee2e6;border-color:#adb5bd;}
  .rte-font-select{height:26px;padding:0 6px;border:1px solid transparent;background:none;border-radius:2px;cursor:pointer;font-family:'Raleway',sans-serif;font-size:.82rem;color:#495057;outline:none;transition:all .15s;}
  .rte-font-select:hover{background:#dee2e6;border-color:#adb5bd;}
  .rte-sep{width:1px;height:16px;background:#dee2e6;margin:0 4px;flex-shrink:0;}
  .rte-body{min-height:300px;padding:16px 20px;font-family:'Raleway',sans-serif;font-size:.97rem;line-height:1.75;color:#212529;outline:none;border-radius:0 0 3px 3px;background:#f8f9fa;cursor:text;overflow-y:auto;}
  .rte-body:focus{background:#ffffff;}
  .rte-body:empty::before{content:attr(data-placeholder);color:#adb5bd;pointer-events:none;}
`;

// ── WRITE PAGE (student, via QR) ─────────────────────────────
function WritePage() {
    const { assignmentId } = useParams();
    const navigate = useNavigate();
    const [assignment, setAssignment] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [name, setName] = useState('');
    const [body, setBody] = useState('');
    const bodyRef = useRef(null);
    const [editorFont, setEditorFont] = useState(FONT_OPTIONS[0].value);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [warn, setWarn] = useState('');

    useEffect(() => {
        getAssignment(assignmentId).then(a => { if (a) setAssignment(a); else setNotFound(true); });
    }, [assignmentId]);

    function handleChange(field, val, setter) {
        setWarn(isSuspicious(val) ? '⚠ Some characters were removed for security.' : '');
        setter(applyLimit(val, field));
    }

    const fmt = cmd => e => { e.preventDefault(); document.execCommand(cmd, false, null); bodyRef.current?.focus(); };

    async function handleSubmit() {
        const bodyText = (bodyRef.current?.textContent || '').trim();
        const bodyHtml = bodyRef.current?.innerHTML || '';
        if (!name.trim() || !bodyText) { setError('Please fill in all fields.'); return; }
        const cn = sanitize(name.trim());
        if (!cn) { setError('Submission contained invalid content.'); return; }
        const cleanHtml = bodyHtml
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/javascript\s*:/gi, '');
        setError(''); setWarn(''); setSubmitting(true);
        try {
            const subs = await loadSubmissions(assignmentId);
            subs.push({ id: Date.now(), name: cn, title: assignment.title, body: bodyText.slice(0, LIMITS.body), bodyHTML: cleanHtml, submittedAt: Date.now() });
            await saveSubmissions(assignmentId, subs);
            setSubmitted(true);
        } catch { setError('Submission failed. Please try again.'); }
        setSubmitting(false);
    }

    if (notFound) return (
        <div className="shell"><div className="card">
            <div className="card-heading">Assignment Not Found</div>
            <div className="card-sub">This link may be expired or invalid.</div>
            <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/')}>← Back to Home</button>
        </div></div>
    );

    if (!assignment) return <div className="shell"><p style={{ padding: '40px 0', color: '#adb5bd', fontStyle: 'italic' }}>Loading…</p></div>;

    if (submitted) return (
        <div className="shell"><div className="card">
            <div className="card-heading">Submitted!</div>
            <div className="card-sub">Your teacher will review your work shortly.</div>
            <div className="success-box"><div className="check">✓</div><p><strong>{name}</strong> — response submitted to <em>{assignment.title}</em>.</p></div>
            <button className="btn-secondary" onClick={() => navigate('/')}>← Back to Home</button>
        </div></div>
    );

    return (
        <div className="shell"><div className="card">
            <div className="card-heading" style={{ textAlign: 'center' }}>{assignment.title}</div>
            {assignment.prompt
                ? <div className="card-sub" style={{ whiteSpace: 'pre-wrap', marginBottom: 32, textAlign: 'center' }}>{assignment.prompt}</div>
                : <div className="card-sub" style={{ textAlign: 'center' }}>Write and submit your response below.</div>}
            <div className="field-group">
                <label className="field-label">Your Name</label>
                <input className="field-input" value={name} onChange={e => handleChange('name', e.target.value, setName)} placeholder="First and last name" maxLength={LIMITS.name} />
                <div className="char-row"><span /><span className={name.length > LIMITS.name * .9 ? 'char-warn' : ''}>{name.length}/{LIMITS.name}</span></div>
            </div>
            <div className="field-group">
                <label className="field-label">Your Response</label>
                <div className="rte-wrap">
                    <div className="rte-toolbar">
                        <button className="rte-btn" style={{ fontWeight: 700 }} onMouseDown={fmt('bold')} title="Bold">B</button>
                        <button className="rte-btn" style={{ fontStyle: 'italic' }} onMouseDown={fmt('italic')} title="Italic">I</button>
                        <button className="rte-btn" style={{ textDecoration: 'underline' }} onMouseDown={fmt('underline')} title="Underline">U</button>
                        <button className="rte-btn" style={{ textDecoration: 'line-through' }} onMouseDown={fmt('strikeThrough')} title="Strikethrough">S</button>
                        <span className="rte-sep" />
                        <button className="rte-btn" onMouseDown={fmt('insertUnorderedList')} title="Bullet list">• List</button>
                        <button className="rte-btn" onMouseDown={fmt('insertOrderedList')} title="Numbered list">1. List</button>
                        <span className="rte-sep" />
                        <button className="rte-btn" onMouseDown={e => { e.preventDefault(); document.execCommand('removeFormat'); }} title="Clear formatting">✕ Format</button>
                        <span className="rte-sep" />
                        <select className="rte-font-select" value={editorFont} onChange={e => setEditorFont(e.target.value)} title="Font">
                            {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                    </div>
                    <div
                        ref={bodyRef}
                        contentEditable
                        suppressContentEditableWarning
                        className="rte-body"
                        data-placeholder="Begin writing here…"
                        spellCheck={assignment.spellCheck !== false}
                        style={{ fontFamily: editorFont }}
                        onInput={() => setBody(bodyRef.current?.textContent || '')}
                    />
                </div>
                <div className="char-row"><span>{wordCount(body)} words</span><span className={body.length > LIMITS.body * .9 ? 'char-warn' : ''}>{body.length}/{LIMITS.body}</span></div>
            </div>
            {warn && <p className="warn-msg">{warn}</p>}
            {error && <p className="error-msg">{error}</p>}
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Response'}</button>
        </div></div>
    );
}

// ── HOME VIEW ─────────────────────────────────────────────────
function HomeView() {
    const navigate = useNavigate();
    return (
        <div className="home-shell">
            <div className="home-intro">
                <div className="home-intro-heading">Welcome to Essay Workshop</div>
                <div className="home-intro-sub">Select how you'd like to continue.</div>
            </div>
            <div className="home-cards">
                <div className="home-card">
                    <div className="home-card-icon">📝</div>
                    <div className="home-card-heading">Submit an Essay</div>
                    <p className="home-card-desc">Write and submit your essay to your teacher's class.</p>
                    <button className="btn-primary" onClick={() => navigate('/student')}>Start Writing →</button>
                </div>
                <div className="home-card">
                    <div className="home-card-icon">🔑</div>
                    <div className="home-card-heading">Teacher Access</div>
                    <p className="home-card-desc">View submitted essays, annotate student work, and manage your class.</p>
                    <button className="btn-primary" onClick={() => navigate('/teacher')}>Enter Classroom →</button>
                </div>
            </div>
        </div>
    );
}

// ── STUDENT VIEW ──────────────────────────────────────────────
function StudentView() {
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [selectedClass, setSelectedClass] = useState('');
    const [classInfo, setClassInfo] = useState(null);
    const [name, setName] = useState('');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [warn, setWarn] = useState('');

    useEffect(() => {
        getIndex().then(list => { setClasses(list.sort((a, b) => a.name.localeCompare(b.name))); setLoadingClasses(false); });
    }, []);

    function handleSelectClass(id) {
        setSelectedClass(id);
        const found = classes.find(c => c.id === id);
        setClassInfo(found || null);
        setError('');
    }

    function handleChange(field, val, setter) {
        setWarn(isSuspicious(val) ? '⚠ Some characters were removed for security.' : '');
        setter(applyLimit(val, field));
    }

    async function handleSubmit() {
        if (!classInfo) { setError('Please select your class.'); return; }
        if (!name.trim() || !title.trim() || !body.trim()) { setError('Please fill in all fields.'); return; }
        const cn = sanitize(name.trim()), ct = sanitize(title.trim()), cb = sanitize(body.trim());
        if (!cn || !ct || !cb) { setError('Submission contained invalid content.'); return; }
        setError(''); setWarn(''); setSubmitting(true);
        try {
            const essays = await loadEssays(classInfo.id);
            essays.push({ id: Date.now(), name: cn, title: ct, body: cb, submittedAt: Date.now() });
            await saveEssays(classInfo.id, essays); setSubmitted(true);
        } catch { setError('Submission failed. Please try again.'); }
        setSubmitting(false);
    }

    if (submitted) return (
        <div className="shell"><div className="card">
            <div className="card-heading">Essay Submitted!</div>
            <div className="card-sub">Your teacher will review it shortly.</div>
            <div className="success-box"><div className="check">✓</div><p><strong>{name}</strong> — <em>"{title}"</em> submitted to <strong>{classInfo.name}</strong>.</p></div>
            <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => { setSubmitted(false); setName(''); setTitle(''); setBody(''); }}>Submit another essay</button>
            <button className="btn-secondary" onClick={() => navigate('/')}>← Back to Home</button>
        </div></div>
    );

    return (
        <div className="shell"><div className="card">
            <div className="card-heading">Submit Your Essay</div>
            <div className="card-sub">Select your class, then write and submit your essay.</div>

            <div className="field-group">
                <label className="field-label">Your Class</label>
                {loadingClasses
                    ? <div style={{ color: '#adb5bd', fontSize: '.9rem', padding: '10px 0' }}>Loading classes…</div>
                    : classes.length === 0
                        ? <div style={{ color: '#8b2020', fontSize: '.85rem', padding: '10px 0' }}>No classes set up yet. Ask your teacher to create one.</div>
                        : <select className="field-input field-select" value={selectedClass} onChange={e => handleSelectClass(e.target.value)}>
                            <option value="">— Select your class —</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                }
            </div>

            <div className="field-group">
                <label className="field-label">Your Name</label>
                <input className="field-input" value={name} onChange={e => handleChange('name', e.target.value, setName)} placeholder="First and last name" maxLength={LIMITS.name} />
                <div className="char-row"><span /><span className={name.length > LIMITS.name * .9 ? 'char-warn' : ''}>{name.length}/{LIMITS.name}</span></div>
            </div>
            <div className="field-group">
                <label className="field-label">Essay Title</label>
                <input className="field-input" value={title} onChange={e => handleChange('title', e.target.value, setTitle)} placeholder="Give your essay a title" maxLength={LIMITS.title} />
                <div className="char-row"><span /><span className={title.length > LIMITS.title * .9 ? 'char-warn' : ''}>{title.length}/{LIMITS.title}</span></div>
            </div>
            <div className="field-group">
                <label className="field-label">Essay</label>
                <textarea className="field-input field-textarea" value={body} onChange={e => handleChange('body', e.target.value, setBody)} placeholder="Begin writing here…" maxLength={LIMITS.body} />
                <div className="char-row"><span>{wordCount(body)} words</span><span className={body.length > LIMITS.body * .9 ? 'char-warn' : ''}>{body.length}/{LIMITS.body}</span></div>
            </div>
            {warn && <p className="warn-msg">{warn}</p>}
            {error && <p className="error-msg">{error}</p>}
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting || !classInfo}>{submitting ? 'Submitting…' : 'Submit Essay'}</button>
        </div></div>
    );
}

// ── TEACHER LOGIN PAGE ────────────────────────────────────────
function TeacherLoginPage({ onEnter }) {
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [checking, setChecking] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [createError, setCreateError] = useState('');

    useEffect(() => {
        getIndex().then(list => { setClasses(list.sort((a, b) => a.name.localeCompare(b.name))); setLoading(false); });
    }, []);

    async function handleJoin() {
        if (!selected) { setPinError('Select your class first.'); return; }
        if (!pin) { setPinError('Enter your PIN.'); return; }
        setChecking(true); setPinError('');
        const meta = await getClassMeta(selected.id);
        if (!meta) { setPinError('Class not found.'); }
        else if (meta.pin !== pin) { setPinError('Incorrect PIN.'); }
        else { onEnter({ ...selected, pin }); }
        setChecking(false);
    }

    async function handleCreate() {
        if (!newName.trim()) { setCreateError('Enter a class name.'); return; }
        if (newPin.length < 4) { setCreateError('PIN must be at least 4 characters.'); return; }
        if (newPin !== confirmPin) { setCreateError('PINs do not match.'); return; }
        setChecking(true); setCreateError('');
        const id = genId();
        const classObj = { id, name: newName.trim(), createdAt: Date.now() };
        await window.storage.set(`class-${id}`, JSON.stringify({ name: newName.trim(), pin: newPin, createdAt: Date.now() }), true);
        const index = await getIndex();
        index.push(classObj);
        await setIndex(index);
        onEnter({ ...classObj, pin: newPin });
    }

    return (
        <div className="shell">
            <div className="card">
                <div className="card-heading">Teacher Access</div>
                {!creating ? (<>
                    <div className="card-sub">Select your class and enter your PIN.</div>
                    <div className="field-group">
                        <label className="field-label">Your Class</label>
                        {loading
                            ? <div style={{ color: '#adb5bd', fontSize: '.85rem' }}>Loading…</div>
                            : classes.length === 0
                                ? <div style={{ color: '#6c757d', fontSize: '.85rem', padding: '8px 0' }}>No classes yet — create one below.</div>
                                : <div className="class-list">
                                    {classes.map(c => (
                                        <div key={c.id} className="class-item" onClick={() => { setSelected(c); setPinError(''); }}
                                            style={{ borderColor: selected?.id === c.id ? '#6c757d' : '#dee2e6', background: selected?.id === c.id ? '#e9ecef' : '#f8f9fa' }}>
                                            <div>
                                                <div className="class-item-name">{c.name}</div>
                                            </div>
                                            {selected?.id === c.id && <span style={{ color: '#6c757d', fontSize: '1.2rem' }}>✓</span>}
                                        </div>
                                    ))}
                                </div>
                        }
                    </div>
                    {selected && (
                        <div className="field-group">
                            <label className="field-label">PIN</label>
                            <input className="field-input" type="password" value={pin} onChange={e => { setPin(e.target.value); setPinError(''); }} onKeyDown={e => e.key === 'Enter' && handleJoin()} placeholder="Your class PIN" maxLength={12} autoFocus />
                        </div>
                    )}
                    {pinError && <p className="pin-error">{pinError}</p>}
                    {selected && <button className="btn-primary" onClick={handleJoin} disabled={checking}>{checking ? 'Checking…' : 'Enter Class'}</button>}
                    <div className="divider">or</div>
                    <button className="btn-secondary" onClick={() => setCreating(true)}>+ Create a New Class</button>
                    <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => navigate('/')}>← Back to Home</button>
                </>) : (<>
                    <div className="card-sub">Set up your class once — students will see it in their dropdown.</div>
                    <div className="field-group">
                        <label className="field-label">Class Name</label>
                        <input className="field-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Ms. Johnson – Period 3" maxLength={80} autoFocus />
                    </div>
                    <div className="field-group">
                        <label className="field-label">Set a PIN</label>
                        <input className="field-input" type="password" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="At least 4 characters" maxLength={12} />
                    </div>
                    <div className="field-group">
                        <label className="field-label">Confirm PIN</label>
                        <input className="field-input" type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder="Repeat your PIN" maxLength={12} />
                    </div>
                    {createError && <p className="pin-error">{createError}</p>}
                    <button className="btn-primary" onClick={handleCreate} disabled={checking}>{checking ? 'Creating…' : 'Create Class'}</button>
                    <button className="btn-secondary" onClick={() => setCreating(false)}>← Back</button>
                </>)}
            </div>
        </div>
    );
}

// ── TEACHER PAGE ──────────────────────────────────────────────
function TeacherPage() {
    const [classInfo, setClassInfo] = useState(null);
    if (!classInfo) return <TeacherLoginPage onEnter={setClassInfo} />;
    return <TeacherView classInfo={classInfo} onLeave={() => setClassInfo(null)} onClassDeleted={() => setClassInfo(null)} />;
}

// ── WHITEBOARD ────────────────────────────────────────────────
function Whiteboard({ essays, startIdx, onClose, classInfo }) {
    const [idx, setIdx] = useState(startIdx);
    const [tool, setTool] = useState('select');
    const [hlColor, setHlColor] = useState(HL_COLORS[0]);
    const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
    const [drawSize, setDrawSize] = useState(4);
    const [isEraser, setIsEraser] = useState(false);
    const isEraserRef = useRef(false);
    const [comments, setComments] = useState([]);
    const [pending, setPending] = useState(null);
    const [savedMsg, setSavedMsg] = useState('');
    const [focusMode, setFocusMode] = useState(false);
    const [fontSize, setFontSize] = useState(19);
    const essayRef = useRef(null);
    const canvasRef = useRef(null);
    const contentRef = useRef(null);
    const drawing = useRef(false);
    const lastPos = useRef(null);
    const history = useRef([]);
    const focusEssayRef = useRef(null);
    const editSnapshot = useRef('');

    const essay = essays[idx];
    if (!essay) return null;

    useEffect(() => {
        async function load() {
            const fallback = essays[idx]?.bodyHTML || escapeHTML(essays[idx]?.body || '');
            try {
                const r = await window.storage.get(`annot-${essays[idx]?.id}`, true);
                if (r?.value) { const d = JSON.parse(r.value); const html = d.bodyHTML || fallback; if (essayRef.current) essayRef.current.innerHTML = html; setComments(d.comments || []); }
                else { if (essayRef.current) essayRef.current.innerHTML = fallback; setComments([]); }
            } catch { if (essayRef.current) essayRef.current.innerHTML = fallback; setComments([]); }
            if (canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); }
            history.current = []; setPending(null);
        }
        load();
    }, [idx]);

    useEffect(() => {
        if (focusMode && focusEssayRef.current && essayRef.current)
            focusEssayRef.current.innerHTML = essayRef.current.innerHTML;
    }, [focusMode]);

    useEffect(() => {
        function resize() { const c = canvasRef.current, el = contentRef.current; if (!c || !el) return; c.width = el.scrollWidth; c.height = Math.max(el.scrollHeight, 800); }
        resize(); const ro = new ResizeObserver(resize); if (contentRef.current) ro.observe(contentRef.current); return () => ro.disconnect();
    }, [idx]);

    function saveAnnotations(cb) {
        const html = essayRef.current ? essayRef.current.innerHTML : escapeHTML(essay.body);
        window.storage.set(`annot-${essay.id}`, JSON.stringify({ bodyHTML: html, comments }), true)
            .then(() => { setSavedMsg('Saved ✓'); setTimeout(() => setSavedMsg(''), 2000); if (cb) cb(); })
            .catch(() => { setSavedMsg('Save failed'); setTimeout(() => setSavedMsg(''), 2000); if (cb) cb(); });
    }

    function removeHighlights() {
        // Called via onMouseDown+preventDefault so the text selection is still alive
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        if (!essayRef.current?.contains(range.commonAncestorContainer)) return;
        Array.from(essayRef.current.querySelectorAll('mark')).forEach(mark => {
            if (range.intersectsNode(mark)) mark.replaceWith(...Array.from(mark.childNodes));
        });
        essayRef.current.normalize();
        sel.removeAllRanges();
    }

    function handleEssayClick(e) {
        if (tool !== 'highlight') return;
        const mark = e.target.closest('mark');
        if (!mark) return;
        mark.replaceWith(...Array.from(mark.childNodes));
        essayRef.current?.normalize();
    }

    function applyHighlight() {
        const sel = window.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        const range = sel.getRangeAt(0); if (!essayRef.current?.contains(range.commonAncestorContainer)) return;
        const mark = document.createElement('mark'); mark.style.cssText = `background:${hlColor};border-radius:2px;padding:0 2px;`;
        try { range.surroundContents(mark); } catch { const f = range.extractContents(); mark.appendChild(f); range.insertNode(mark); }
        sel.removeAllRanges();
    }

    function handleMouseUp() { if (tool === 'highlight') setTimeout(applyHighlight, 10); }
    function getXY(e) { const r = canvasRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function drawStart(e) { if (tool !== 'draw') return; e.preventDefault(); drawing.current = true; const ctx = canvasRef.current.getContext('2d'); history.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)); if (history.current.length > 30) history.current.shift(); lastPos.current = getXY(e); }
    function drawMove(e) {
        if (!drawing.current || tool !== 'draw') return;
        e.preventDefault();
        const pos = getXY(e);
        const ctx = canvasRef.current.getContext('2d');
        if (isEraserRef.current) {
            const r = drawSize * 3;
            ctx.save();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.clip();
            ctx.clearRect(pos.x - r, pos.y - r, r * 2, r * 2);
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = drawColor;
            ctx.lineWidth = drawSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
        lastPos.current = pos;
    }
    function drawEnd() { drawing.current = false; }
    function undoDraw() { if (!history.current.length) return; const ctx = canvasRef.current.getContext('2d'); ctx.putImageData(history.current.pop(), 0, 0); }
    function clearAll() { if (!window.confirm('Clear all annotations?')) return; const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); history.current = []; setComments([]); if (essayRef.current) essayRef.current.innerHTML = escapeHTML(essay.body); }
    function handleContentClick(e) { if (tool !== 'comment') return; if (e.target.closest('.wb-cmt')) return; const rect = contentRef.current.getBoundingClientRect(); const y = e.clientY - rect.top + contentRef.current.scrollTop; setPending({ y, text: '' }); }
    function confirmComment() { if (!pending?.text.trim()) { setPending(null); return; } setComments(p => [...p, { id: Date.now(), y: pending.y, text: pending.text.trim() }]); setPending(null); }
    function navigate(dir) { saveAnnotations(() => { setIdx(i => i + dir); setTool('select'); }); }

    function handlePrint() {
        const content = essayRef.current?.innerHTML || escapeHTML(essay.body);
        const w = window.open('', '_blank');
        w.document.write(`<!DOCTYPE html><html><head><title>${essay.title}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap');
            *{box-sizing:border-box;margin:0;padding:0;}
            ol,ul{padding-left:28px;}
            body{font-family:'Raleway',sans-serif;color:#212529;padding:48px 64px;max-width:860px;margin:0 auto;}
            .ph{border-bottom:2px solid #212529;padding-bottom:16px;margin-bottom:32px;}
            .ph-name{font-size:1.3rem;font-weight:700;margin-bottom:4px;}
            .ph-class{font-size:.85rem;color:#6c757d;margin-bottom:8px;}
            .ph-title{font-size:1.1rem;font-weight:600;}
            .body{font-size:1rem;line-height:1.9;}
        </style></head><body>
        <div class="ph">
            <div class="ph-name">${essay.name}</div>
            <div class="ph-class">${classInfo?.name || ''}</div>
            <div class="ph-title">${essay.title}</div>
        </div>
        <div class="body">${content}</div>
        </body></html>`);
        w.document.close();
        w.focus();
        w.print();
    }

    const isDraw = tool === 'draw', isEdit = tool === 'edit';
    const btn = (active) => ({ padding: '6px 14px', borderRadius: 3, border: '1px solid', borderColor: active ? '#212529' : '#dee2e6', background: active ? '#212529' : '#ffffff', color: active ? '#f8f9fa' : '#495057', cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '0.8rem', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', transition: 'all .15s' });
    const dot = (c, sel) => ({ width: 22, height: 22, borderRadius: '50%', background: c, border: sel ? '2.5px solid #212529' : '2px solid rgba(0,0,0,0.15)', cursor: 'pointer', flexShrink: 0, boxShadow: sel ? '0 0 0 2px #f8f9fa inset' : 'none' });
    const sizeBtn = () => ({ width: 32, height: 32, borderRadius: 3, border: '1px solid #dee2e6', background: '#ffffff', color: '#212529', cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' });

    return (
        <div className="wb-root">
            {/* Focus mode overlay — sits on top of the main whiteboard without unmounting it */}
            {focusMode && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: '#ffffff', display: 'flex', flexDirection: 'column', fontFamily: "'Raleway',sans-serif" }}>
                    <div style={{ background: '#212529', padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, opacity: .9 }}>
                        <span style={{ color: '#6c757d', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{essay.name} — {essay.title}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button onClick={() => setFontSize(s => Math.max(10, s - 2))} style={{ ...sizeBtn(), border: '1px solid #6c757d', background: 'none', color: '#6c757d' }}>−</button>
                            <span style={{ color: '#6c757d', fontSize: '0.75rem', minWidth: 36, textAlign: 'center' }}>{fontSize}px</span>
                            <button onClick={() => setFontSize(s => Math.min(40, s + 2))} style={{ ...sizeBtn(), border: '1px solid #6c757d', background: 'none', color: '#6c757d' }}>+</button>
                            <button onClick={() => setFocusMode(false)} style={{ marginLeft: 8, background: 'none', border: '1px solid #6c757d', color: '#6c757d', padding: '4px 14px', borderRadius: 3, cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '0.78rem' }}>← Exit Focus</button>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '48px 80px' }}>
                        <div ref={focusEssayRef} style={{ fontFamily: "'Raleway',sans-serif", fontSize: `${fontSize}px`, lineHeight: 1.9, color: '#212529', maxWidth: 900, margin: '0 auto', pointerEvents: 'none' }} />
                    </div>
                </div>
            )}
            <div className="wb-header">
                <div><div style={{ color: '#6c757d', fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>by {essay.name}</div><div style={{ fontFamily: "'Raleway',sans-serif", fontWeight: 700, fontSize: '1.8rem', marginTop: 2 }}>{essay.title}</div></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => setFocusMode(true)} style={{ background: 'none', border: '1px solid #6c757d', color: '#6c757d', padding: '8px 18px', borderRadius: 3, cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '0.85rem' }}>⛶ Focus Mode</button>
                    <button onClick={handlePrint} style={{ background: 'none', border: '1px solid #6c757d', color: '#6c757d', padding: '8px 18px', borderRadius: 3, cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '0.85rem' }}>🖨 Print</button>
                    <button onClick={() => saveAnnotations(onClose)} style={{ background: 'none', border: '1px solid #6c757d', color: '#6c757d', padding: '8px 18px', borderRadius: 3, cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '0.85rem' }}>✕ Close</button>
                </div>
            </div>
            <div className="wb-toolbar">
                <div style={{ display: 'flex', gap: 6 }}>{[['select', '☰ Select'], ['edit', '✏️ Edit text'], ['highlight', '🖊 Highlight'], ['comment', '💬 Comment'], ['draw', '🖌️ Draw']].map(([id, label]) => <button key={id} onClick={() => { if (id === 'edit') editSnapshot.current = essayRef.current ? essayRef.current.innerHTML : ''; if (id !== 'draw') { setIsEraser(false); isEraserRef.current = false; } setTool(id); }} style={btn(tool === id)}>{label}</button>)}</div>
                {tool === 'highlight' && <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, borderLeft: '1px solid #dee2e6' }}><span style={{ fontSize: '0.7rem', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Color</span>{HL_COLORS.map(c => <button key={c} onClick={() => setHlColor(c)} style={dot(c, hlColor === c)} />)}<button onMouseDown={e => { e.preventDefault(); removeHighlights(); }} style={{ ...btn(false), marginLeft: 4 }}>✕ Remove</button><span style={{ fontSize: '0.75rem', color: '#6c757d', marginLeft: 4 }}>Select to highlight · click highlight to remove</span></div>}
                {isDraw && <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, borderLeft: '1px solid #dee2e6' }}>
                    <button onClick={() => { setIsEraser(false); isEraserRef.current = false; }} style={btn(!isEraser)}>✏ Pen</button>
                    <button onClick={() => { setIsEraser(true); isEraserRef.current = true; }} style={btn(isEraser)}>⌫ Erase</button>
                    {!isEraser && <><span style={{ fontSize: '0.7rem', color: '#6c757d', marginLeft: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Color</span>{DRAW_COLORS.map(c => <button key={c} onClick={() => setDrawColor(c)} style={dot(c, drawColor === c)} />)}</>}
                    <span style={{ fontSize: '0.7rem', color: '#6c757d', marginLeft: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Size</span>
                    <input type="range" min={1} max={14} value={drawSize} onChange={e => setDrawSize(+e.target.value)} style={{ width: 80, accentColor: '#212529' }} />
                    <button onClick={undoDraw} style={btn(false)}>↩ Undo</button>
                </div>}
                {isEdit && <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid #dee2e6' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6c757d', fontStyle: 'italic' }}>Click in the essay to edit directly</span>
                    <button onClick={() => { if (essayRef.current) essayRef.current.innerHTML = editSnapshot.current; setTool('select'); }} style={{ ...btn(false), color: '#8b2020', borderColor: '#e8c4c4' }}>✕ Cancel</button>
                </div>}
                {tool === 'comment' && <div style={{ paddingLeft: 12, borderLeft: '1px solid #dee2e6' }}><span style={{ fontSize: '0.75rem', color: '#6c757d', fontStyle: 'italic' }}>Click anywhere to place a comment</span></div>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {/* Font size controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 12, borderRight: '1px solid #dee2e6' }}>
                        <button onClick={() => setFontSize(s => Math.max(10, s - 2))} style={sizeBtn()}>−</button>
                        <span style={{ fontSize: '0.75rem', color: '#6c757d', minWidth: 36, textAlign: 'center' }}>{fontSize}px</span>
                        <button onClick={() => setFontSize(s => Math.min(40, s + 2))} style={sizeBtn()}>+</button>
                    </div>
                    {savedMsg && <span style={{ fontSize: '0.78rem', color: '#2d5a27', fontStyle: 'italic' }}>{savedMsg}</span>}
                    <button onClick={clearAll} style={{ ...btn(false), color: '#8b2020' }}>🗑 Clear all</button>
                    <button onClick={() => { saveAnnotations(); if (isEdit) setTool('select'); }} style={{ ...btn(false), background: '#2d5a27', color: '#d4edcc', borderColor: '#2d5a27' }}>💾 Save</button>
                </div>
            </div>
            <div ref={contentRef} onClick={handleContentClick} className="wb-content" style={{ cursor: isDraw || tool === 'comment' ? 'crosshair' : 'default', userSelect: isDraw ? 'none' : 'text' }}>
                <div style={{ padding: '48px 80px', position: 'relative', minHeight: '100%' }}>
                    <div ref={essayRef} contentEditable={isEdit} suppressContentEditableWarning onKeyDown={e => { if (!isEdit) e.preventDefault(); }} onPaste={e => { if (!isEdit) e.preventDefault(); }} onMouseUp={handleMouseUp} onClick={handleEssayClick} style={{ fontFamily: "'Raleway',sans-serif", fontSize: `${fontSize}px`, lineHeight: 2, color: '#212529', maxWidth: 820, margin: '0 auto', outline: isEdit ? '2px dashed #6c757d' : 'none', borderRadius: isEdit ? 4 : 0, padding: isEdit ? '8px 12px' : 0, pointerEvents: isDraw ? 'none' : 'auto', minHeight: 200 }} />
                    {comments.map(c => (
                        <div key={c.id} className="wb-cmt" style={{ position: 'absolute', top: c.y, right: 16, width: 230, background: '#f8f9fa', border: '1px solid #adb5bd', borderRadius: 4, padding: '10px 30px 10px 12px', boxShadow: '0 2px 12px rgba(0,0,0,.1)', zIndex: 5 }}>
                            <div style={{ fontSize: '0.85rem', color: '#495057', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.text}</div>
                            <button onClick={() => setComments(p => p.filter(x => x.id !== c.id))} style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#adb5bd', fontSize: '0.85rem', lineHeight: 1 }}>✕</button>
                        </div>
                    ))}
                    {pending && (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: pending.y, right: 16, width: 250, background: '#ffffff', border: '1px solid #6c757d', borderRadius: 4, padding: 12, boxShadow: '0 4px 20px rgba(0,0,0,.15)', zIndex: 10 }}>
                            <textarea autoFocus placeholder="Type a comment… (Enter to add)" value={pending.text} onChange={e => setPending(p => ({ ...p, text: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmComment(); } if (e.key === 'Escape') setPending(null); }} style={{ width: '100%', minHeight: 80, border: '1px solid #dee2e6', borderRadius: 3, padding: 8, fontFamily: "'Raleway',sans-serif", fontSize: '0.85rem', resize: 'vertical', outline: 'none' }} />
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                <button onClick={confirmComment} style={{ flex: 1, padding: 6, background: '#212529', color: '#f8f9fa', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '0.8rem' }}>Add</button>
                                <button onClick={() => setPending(null)} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #dee2e6', borderRadius: 3, cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '0.8rem' }}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
                <canvas ref={canvasRef} onMouseDown={drawStart} onMouseMove={drawMove} onMouseUp={drawEnd} onMouseLeave={drawEnd} style={{ position: 'absolute', top: 0, left: 0, width: '100%', pointerEvents: isDraw ? 'auto' : 'none', zIndex: isDraw ? 20 : 2 }} />
            </div>
            <div className="wb-footer">
                <button disabled={idx >= essays.length - 1} onClick={() => navigate(1)} style={{ padding: '8px 20px', border: '1px solid #dee2e6', borderRadius: 3, background: '#ffffff', fontFamily: "'Raleway',sans-serif", fontSize: '0.85rem', color: '#212529', opacity: idx >= essays.length - 1 ? 0.4 : 1, cursor: idx >= essays.length - 1 ? 'not-allowed' : 'pointer' }}>← Previous</button>
                <button disabled={idx <= 0} onClick={() => navigate(-1)} style={{ padding: '8px 20px', border: '1px solid #dee2e6', borderRadius: 3, background: '#ffffff', fontFamily: "'Raleway',sans-serif", fontSize: '0.85rem', color: '#212529', opacity: idx <= 0 ? 0.4 : 1, cursor: idx <= 0 ? 'not-allowed' : 'pointer' }}>Next →</button>
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#adb5bd' }}>{idx + 1} of {essays.length}</span>
            </div>
        </div>
    );
}

// ── TEACHER VIEW ──────────────────────────────────────────────
function DeleteClassModal({ classInfo, onConfirm, onCancel }) {
    const [pin1, setPin1] = useState('');
    const [pin2, setPin2] = useState('');
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        if (!pin1 || !pin2) { setError('Please enter your PIN in both fields.'); return; }
        if (pin1 !== pin2) { setError('PINs do not match.'); return; }
        if (pin1 !== classInfo.pin) { setError('Incorrect PIN.'); return; }
        setDeleting(true);
        try {
            // Remove from index
            const index = await getIndex();
            await setIndex(index.filter(c => c.id !== classInfo.id));
            // Delete class meta and essays
            await window.storage.delete(`class-${classInfo.id}`, true);
            await window.storage.delete(`essays-${classInfo.id}`, true);
            onConfirm();
        } catch { setError('Something went wrong. Please try again.'); }
        setDeleting(false);
    }

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ position: 'relative', borderTop: '4px solid #8b2020' }}>
                <h2 style={{ color: '#8b2020' }}>⚠ Delete Class</h2>
                <p style={{ fontSize: '.9rem', color: '#495057', margin: '12px 0 20px', lineHeight: 1.6 }}>
                    You are about to permanently delete <strong>"{classInfo.name}"</strong> and all its submitted essays. <strong>This cannot be undone.</strong>
                </p>
                <p style={{ fontSize: '.82rem', color: '#6c757d', marginBottom: 20 }}>Enter your PIN twice to confirm.</p>
                <div className="field-group">
                    <label className="field-label">Enter PIN</label>
                    <input className="field-input" type="password" value={pin1} onChange={e => { setPin1(e.target.value); setError(''); }} placeholder="Your class PIN" maxLength={12} autoFocus />
                </div>
                <div className="field-group">
                    <label className="field-label">Confirm PIN</label>
                    <input className="field-input" type="password" value={pin2} onChange={e => { setPin2(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleDelete()} placeholder="Enter PIN again" />
                </div>
                {error && <p className="pin-error" style={{ marginBottom: 12 }}>{error}</p>}
                <button onClick={handleDelete} disabled={deleting}
                    style={{ width: '100%', padding: 13, background: '#8b2020', color: '#fff', border: 'none', borderRadius: 3, fontFamily: "'Raleway',sans-serif", fontSize: '1rem', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? .7 : 1, marginTop: 4 }}>
                    {deleting ? 'Deleting…' : 'Yes, Delete This Class'}
                </button>
                <button onClick={onCancel} className="btn-secondary" style={{ marginTop: 8 }}>Cancel</button>
            </div>
        </div>
    );
}

function TeacherView({ classInfo, onLeave, onClassDeleted }) {
    if (!classInfo) return null;
    const [view, setView] = useState('list');
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeAssignment, setActiveAssignment] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [subLoading, setSubLoading] = useState(false);
    const [wbIdx, setWbIdx] = useState(null);
    const [showDelete, setShowDelete] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newPrompt, setNewPrompt] = useState('');
    const [newSpellCheck, setNewSpellCheck] = useState(true);
    const [qrSize, setQrSize] = useState(240);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [submissionCounts, setSubmissionCounts] = useState({});

    async function reloadList() {
        setLoading(true);
        const list = await loadAssignments(classInfo.id);
        list.sort((a, b) => b.createdAt - a.createdAt);
        setAssignments(list);
        const pairs = await Promise.all(list.map(a => loadSubmissions(a.id).then(s => [a.id, s.length])));
        setSubmissionCounts(Object.fromEntries(pairs));
        setLoading(false);
    }
    useEffect(() => { reloadList(); }, []);

    async function handleCreate() {
        if (!newTitle.trim()) { setCreateError('Enter an assignment title.'); return; }
        setCreating(true); setCreateError('');
        const id = genId();
        const a = { id, classId: classInfo.id, className: classInfo.name, title: newTitle.trim(), prompt: newPrompt.trim(), spellCheck: newSpellCheck, createdAt: Date.now() };
        await saveAssignment(a);
        const index = await loadAssignments(classInfo.id);
        index.push({ id, title: a.title, prompt: a.prompt, spellCheck: a.spellCheck, createdAt: a.createdAt });
        await saveAssignmentsIndex(classInfo.id, index);
        setCreating(false); setNewTitle(''); setNewPrompt(''); setNewSpellCheck(true);
        setActiveAssignment(a); setView('qr');
        reloadList();
    }

    async function toggleSpellCheck(a) {
        const full = await getAssignment(a.id);
        if (!full) return;
        const updated = { ...full, spellCheck: !(a.spellCheck !== false) };
        await saveAssignment(updated);
        const index = await loadAssignments(classInfo.id);
        const i = index.findIndex(x => x.id === a.id);
        if (i !== -1) { index[i] = { ...index[i], spellCheck: updated.spellCheck }; await saveAssignmentsIndex(classInfo.id, index); }
        reloadList();
    }

    async function openSubmissions(a) {
        setSubLoading(true);
        const full = await getAssignment(a.id);
        const subs = await loadSubmissions(a.id);
        subs.sort((x, y) => y.submittedAt - x.submittedAt);
        setActiveAssignment(full || a); setSubmissions(subs); setSubLoading(false); setView('submissions');
    }

    async function deleteSubmission(id) {
        const updated = submissions.filter(s => s.id !== id);
        await saveSubmissions(activeAssignment.id, updated);
        setSubmissions(updated);
        if (wbIdx !== null && wbIdx >= updated.length) setWbIdx(null);
    }

    async function handleDeleteAssignment(assignmentId) {
        if (!window.confirm('Delete this assignment and all its submissions?')) return;
        const index = await loadAssignments(classInfo.id);
        await saveAssignmentsIndex(classInfo.id, index.filter(a => a.id !== assignmentId));
        await window.storage.delete(`assignment-${assignmentId}`, true);
        await window.storage.delete(`submissions-${assignmentId}`, true);
        reloadList();
    }

    const assignmentUrl = activeAssignment ? `${window.location.origin}/writing/write/${activeAssignment.id}` : '';

    return (
        <>
            {wbIdx !== null && <Whiteboard essays={submissions} startIdx={wbIdx} onClose={() => setWbIdx(null)} classInfo={classInfo} />}
            {showDelete && <DeleteClassModal classInfo={classInfo} onConfirm={onClassDeleted} onCancel={() => setShowDelete(false)} />}
            <div className="class-banner">
                <span style={{ opacity: .7 }}>Class:</span>
                <span className="class-name">{classInfo.name}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowDelete(true)} style={{ background: 'none', border: '1px solid #c0504a', color: '#c0504a', padding: '3px 14px', borderRadius: 3, cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '0.75rem', fontWeight: 600 }}>🗑 Delete Class</button>
                    <button onClick={onLeave} style={{ background: 'none', border: '1px solid #6c757d', color: '#6c757d', padding: '3px 14px', borderRadius: 3, cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '0.75rem', fontWeight: 600 }}>Switch Class</button>
                </div>
            </div>

            <div className="teacher-shell">

                {/* ── ASSIGNMENT LIST ── */}
                {view === 'list' && <>
                    <div className="top-bar">
                        <div><div className="teacher-heading">Assignments</div><div className="teacher-meta">{assignments.length} {assignments.length === 1 ? 'assignment' : 'assignments'}</div></div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="refresh-btn" onClick={reloadList}>↻ Refresh</button>
                            <button onClick={() => setView('create')} style={{ padding: '8px 18px', background: '#212529', color: '#f8f9fa', border: 'none', borderRadius: 3, fontFamily: "'Raleway',sans-serif", fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>+ New Assignment</button>
                        </div>
                    </div>
                    {loading && <div style={{ color: '#adb5bd', fontStyle: 'italic', padding: '40px 0' }}>Loading…</div>}
                    {!loading && assignments.length === 0 && <div className="empty-state"><div className="icon">📋</div><p>No assignments yet. Create one to get started.</p></div>}
                    {!loading && assignments.length > 0 && (
                        <div className="essay-grid">
                            {assignments.map(a => (
                                <div key={a.id} className="essay-card">
                                    <div style={{ position: 'absolute', top: 14, right: 16, fontSize: '0.7rem', color: '#6c757d', fontFamily: "'Raleway',sans-serif" }}>
                                        {submissionCounts[a.id] ?? 0} {(submissionCounts[a.id] ?? 0) === 1 ? 'submission' : 'submissions'}
                                    </div>
                                    <div className="essay-author">{a.title}</div>
                                    {a.prompt && <div className="essay-preview" style={{ marginTop: 6 }}>{a.prompt}</div>}
                                    <div className="essay-footer">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div className="essay-wc">{timeAgo(a.createdAt)}</div>
                                            <button onClick={() => toggleSpellCheck(a)} title="Toggle spell check for students" style={{ fontSize: '0.65rem', padding: '2px 7px', border: `1px solid ${a.spellCheck !== false ? '#6c757d' : '#dee2e6'}`, borderRadius: 2, cursor: 'pointer', fontFamily: "'Raleway',sans-serif", background: 'none', color: a.spellCheck !== false ? '#495057' : '#adb5bd', whiteSpace: 'nowrap' }}>
                                                Spell {a.spellCheck !== false ? '✓' : '✗'}
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="delete-btn" onClick={() => handleDeleteAssignment(a.id)}>Delete</button>
                                            <button className="display-btn" style={{ background: '#495057' }} onClick={async () => { const full = await getAssignment(a.id); setActiveAssignment(full || a); setView('qr'); }}>QR ↗</button>
                                            <button className="display-btn" onClick={() => openSubmissions(a)}>View →</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>}

                {/* ── CREATE ASSIGNMENT ── */}
                {view === 'create' && (
                    <div style={{ maxWidth: 600, margin: '0 auto' }}>
                        <div className="teacher-heading" style={{ marginBottom: 4 }}>New Assignment</div>
                        <div className="teacher-meta" style={{ marginBottom: 28 }}>Students will see this title and prompt when they scan the QR code.</div>
                        <div className="field-group">
                            <label className="field-label">Assignment Title</label>
                            <input className="field-input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Compare and Contrast Essay" maxLength={200} autoFocus />
                        </div>
                        <div className="field-group">
                            <label className="field-label">Writing Prompt <span style={{ color: '#adb5bd', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                            <textarea className="field-input field-textarea" style={{ minHeight: 160 }} value={newPrompt} onChange={e => setNewPrompt(e.target.value)} placeholder="Describe the task, instructions, or requirements…" maxLength={2000} />
                        </div>
                        <div className="field-group">
                            <label className="field-label">Student Options</label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '.9rem', color: '#212529' }}>
                                <input type="checkbox" checked={newSpellCheck} onChange={e => setNewSpellCheck(e.target.checked)} />
                                Enable spell check in the writing editor
                            </label>
                        </div>
                        {createError && <p className="error-msg">{createError}</p>}
                        <button className="btn-primary" onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Create & Generate QR Code'}</button>
                        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => { setView('list'); setCreateError(''); setNewTitle(''); setNewPrompt(''); }}>← Cancel</button>
                    </div>
                )}

                {/* ── QR CODE ── */}
                {view === 'qr' && activeAssignment && (
                    <div style={{ maxWidth: 520, margin: '0 auto' }}>
                        <div className="teacher-heading" style={{ marginBottom: 4 }}>Share with Students</div>
                        <div className="teacher-meta" style={{ marginBottom: 28 }}>Project or share this QR code — students scan it to open the writing page.</div>
                        <div style={{ background: '#ffffff', border: '1px solid #dee2e6', borderRadius: 4, padding: '40px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
                                <button onClick={() => setQrSize(s => Math.max(120, s - 40))} style={{ width: 32, height: 32, border: '1px solid #dee2e6', borderRadius: 3, background: '#f8f9fa', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                                <QRCodeSVG value={assignmentUrl} size={qrSize} bgColor="#ffffff" fgColor="#212529" level="M" />
                                <button onClick={() => setQrSize(s => Math.min(480, s + 40))} style={{ width: 32, height: 32, border: '1px solid #dee2e6', borderRadius: 3, background: '#f8f9fa', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6, fontFamily: "'Raleway',sans-serif" }}>{activeAssignment.title}</div>
                                <div style={{ fontSize: '0.75rem', color: '#6c757d', wordBreak: 'break-all', fontFamily: 'monospace' }}>{assignmentUrl}</div>
                            </div>
                            <button onClick={() => navigator.clipboard?.writeText(assignmentUrl)} style={{ padding: '8px 20px', background: 'transparent', border: '1px solid #dee2e6', borderRadius: 3, fontFamily: "'Raleway',sans-serif", fontSize: '0.85rem', cursor: 'pointer', color: '#495057', transition: 'border-color .15s' }}>Copy Link</button>
                        </div>
                        <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => setView('list')}>← Back to Assignments</button>
                    </div>
                )}

                {/* ── SUBMISSIONS ── */}
                {view === 'submissions' && activeAssignment && <>
                    <div className="top-bar">
                        <div>
                            <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: '#6c757d', cursor: 'pointer', fontFamily: "'Raleway',sans-serif", fontSize: '0.85rem', padding: '0 0 6px', display: 'block' }}>← Assignments</button>
                            <div className="teacher-heading">{activeAssignment.title}</div>
                            <div className="teacher-meta">{submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingTop: 28 }}>
                            <button onClick={() => setView('qr')} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #dee2e6', borderRadius: 3, fontFamily: "'Raleway',sans-serif", fontSize: '0.8rem', cursor: 'pointer', color: '#6c757d' }}>Show QR</button>
                            <button className="refresh-btn" onClick={() => openSubmissions(activeAssignment)}>↻ Refresh</button>
                        </div>
                    </div>
                    {subLoading && <div style={{ color: '#adb5bd', fontStyle: 'italic', padding: '40px 0' }}>Loading…</div>}
                    {!subLoading && submissions.length === 0 && <div className="empty-state"><div className="icon">📄</div><p>No submissions yet for this assignment.</p></div>}
                    {!subLoading && submissions.length > 0 && (
                        <div className="essay-grid">
                            {submissions.map((sub, idx) => (
                                <div key={sub.id} className="essay-card">
                                    <div className="essay-author">{sub.name}</div>
                                    <div className="essay-preview">{sub.body}</div>
                                    <div className="essay-footer">
                                        <div className="essay-wc">{wordCount(sub.body)} words · {timeAgo(sub.submittedAt)}</div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="delete-btn" onClick={() => deleteSubmission(sub.id)}>Delete</button>
                                            <button className="display-btn" onClick={() => setWbIdx(idx)}>Display ↗</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>}

            </div>
        </>
    );
}

// ── LANDING PAGE ─────────────────────────────────────────────
function LandingPage() {
    return (
        <div className="shell" style={{ textAlign: 'center', paddingTop: 72 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: "'Raleway',sans-serif", color: '#212529', marginBottom: 12 }}>Essay Workshop</div>
            <p style={{ fontSize: '1rem', color: '#6c757d', lineHeight: 1.7 }}>Scan the QR code your teacher shared to begin your writing assignment.</p>
        </div>
    );
}

// ── ROOT ──────────────────────────────────────────────────────
function AppShell() {
    const navigate = useNavigate();
    return (
        <>
            <style>{fonts}{css}</style>
            <div className="app">
                <div className="header">
                    <div onClick={() => navigate('/')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div className="header-title">📓</div>
                        {/* <div className="header-subtitle">Writing · Essay Submission</div> */}
                    </div>
                </div>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/student" element={<StudentView />} />
                    <Route path="/teacher" element={<TeacherPage />} />
                    <Route path="/write/:assignmentId" element={<WritePage />} />
                </Routes>
            </div>
        </>
    );
}

export default function App() {
    return (
        <BrowserRouter basename="/writing">
            <AppShell />
        </BrowserRouter>
    );
}
