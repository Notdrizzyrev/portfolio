import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Copy, Check, LogOut, Edit3, Save, X, Plus, Trash2, Lock, Eye, EyeOff, ChevronDown, Settings, Loader2 } from 'lucide-react';

const API_BASE = 'https://sword-x-staff-backend-production.up.railway.app';

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

const SectionNote = ({ 
  sectionId, 
  isAdmin, 
  editingNoteSection, 
  setEditingNoteSection, 
  sectionNotes, 
  setSectionNotes, 
  inputCls, 
  saveCodesNote 
}) => (
  <div className="bg-blue-950/30 border border-blue-700/30 rounded-xl p-5 mb-6">
    {editingNoteSection === sectionId && isAdmin ? (
      <div className="space-y-3">
        <textarea 
          className={inputCls} 
          value={sectionNotes[sectionId] || ''}
          onChange={(e) => setSectionNotes({ ...sectionNotes, [sectionId]: e.target.value })}
          rows="3"
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={() => saveCodesNote(sectionId)} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold text-sm flex items-center gap-2">
            <Save size={16} /> Save
          </button>
          <button onClick={() => setEditingNoteSection(null)} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm">
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div className="flex items-start justify-between gap-2">
        <p className="text-blue-200 text-sm flex items-start gap-2 flex-1">
          <span className="flex-shrink-0 mt-0.5">[INFO]</span>
          <span>{sectionNotes[sectionId]}</span>
        </p>
        {isAdmin && (
          <button onClick={() => setEditingNoteSection(sectionId)} className="px-3 py-1 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center gap-1 flex-shrink-0">
            <Edit3 size={14} /> Edit
          </button>
        )}
      </div>
    )}
  </div>
);

export default function SwordXStaffCommunity() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('classes');
  const [copiedCode, setCopiedCode] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [adminLogs, setAdminLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sectionNotes, setSectionNotes] = useState({
    codes: 'Redeem codes in-game at: Home -> Main Menu -> User Center -> Gift Code',
    classes: 'Learn about our different classes and their abilities',
    events: 'Check out upcoming events and special occasions',
    guide: 'Read our guides to get started',
  });
  const [editingNoteSection, setEditingNoteSection] = useState(null);
  const [announcement, setAnnouncement] = useState(null);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementColor, setAnnouncementColor] = useState('amber');
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);

  const editFormRef = useRef(null);

  const [codes, setCodes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [guides, setGuides] = useState([]);
  const [customSectionItems, setCustomSectionItems] = useState({});
  const [sections, setSections] = useState([
    { id: 'classes', name: 'Classes', visible: true },
    { id: 'events', name: 'Events', visible: true },
    { id: 'codes', name: 'Codes', visible: true },
    { id: 'guide', name: 'Guide', visible: true },
  ]);

  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(null);
  const [formData, setFormData] = useState({});
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [sectionFormData, setSectionFormData] = useState({});
  const [addingNewSection, setAddingNewSection] = useState(false);

  const ADMIN_PASSWORD = 'SxSSwordXStaffAdminYoutubeKingAuraFarmingWebsiteWeOwnOnlyAdminsDONTLETPEOPLEUSETHISATALLLEAKTHISUWILLGETPERMBANND';
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 300;

  // Load lockout status from sessionStorage on mount
  useEffect(() => {
    const storedLockout = sessionStorage.getItem('lockoutTime');
    const storedAttempts = sessionStorage.getItem('failedAttempts');
    if (storedLockout) {
      const remainingTime = parseInt(storedLockout) - Date.now();
      if (remainingTime > 0) {
        setLockoutTime(Math.ceil(remainingTime / 1000));
        setFailedAttempts(parseInt(storedAttempts) || 0);
      }
    }
  }, []);

  // Manage lockout countdown
  useEffect(() => {
    if (lockoutTime > 0) {
      const interval = setInterval(() => {
        setLockoutTime(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            clearInterval(interval);
            sessionStorage.removeItem('lockoutTime');
            sessionStorage.removeItem('failedAttempts');
            return 0;
          }
          return newTime;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutTime]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [c, cl, ev, g, ann, notes, logs, custom, secs] = await Promise.all([
          api('/api/codes').catch(() => []),
          api('/api/classes').catch(() => []),
          api('/api/events').catch(() => []),
          api('/api/guides').catch(() => []),
          api('/api/announcements').catch(() => ({ text: '', color: 'amber' })),
          api('/api/section-notes').catch(() => ({})),
          api('/api/logs').catch(() => []),
          api('/api/custom-items').catch(() => ({})),
          api('/api/sections').catch(() => []),
        ]);
        setCodes(c || []);
        setClasses(cl || []);
        setEvents(ev || []);
        setGuides(g || []);
        if (ann?.text) {
          setAnnouncement(ann.text);
          setAnnouncementColor(ann.color || 'amber');
        }
        if (notes && Object.keys(notes).length > 0) setSectionNotes(notes);
        if (logs && logs.length > 0) setAdminLogs(logs);
        if (custom && Object.keys(custom).length > 0) setCustomSectionItems(custom);
        if (secs && secs.length > 0) setSections(secs);
      } catch (err) {
        console.error('Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const savedAdmin = localStorage.getItem('isAdmin') === 'true';
    if (savedAdmin) setIsAdmin(true);
    const savedCustomItems = localStorage.getItem('customSectionItems');
    if (savedCustomItems) {
      try {
        setCustomSectionItems(JSON.parse(savedCustomItems));
      } catch (e) {
        console.error('Failed to restore custom items:', e);
      }
    }
  }, []);

  useEffect(() => {
    if ((editingId || addingNew) && editFormRef.current) {
      setTimeout(() => {
        editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [editingId, addingNew]);

  const handleFormDataChange = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSectionFormChange = useCallback((key, value) => {
    setSectionFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const logAction = useCallback((actionType, category, itemName, details = '') => {
    const timestamp = new Date();
    const newLog = {
      id: adminLogs.length + 1,
      action_type: actionType,
      category: category,
      item_name: itemName,
      details: details,
      timestamp: timestamp.toISOString()
    };
    setAdminLogs([newLog, ...adminLogs]);
  }, [adminLogs.length]);

  const handleLogin = useCallback(() => {
    if (lockoutTime > 0) { 
      alert(`Try again in ${lockoutTime}s`); 
      return; 
    }
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      localStorage.setItem('isAdmin', 'true');
      setShowLogin(false); 
      setPassword('');
      setFailedAttempts(0); 
      setLockoutTime(0);
      sessionStorage.removeItem('lockoutTime');
      sessionStorage.removeItem('failedAttempts');
    } else {
      const n = failedAttempts + 1;
      setFailedAttempts(n); 
      setPassword('');
      if (n >= MAX_ATTEMPTS) {
        const lockoutEndTime = Date.now() + (LOCKOUT_DURATION * 1000);
        setLockoutTime(LOCKOUT_DURATION);
        sessionStorage.setItem('lockoutTime', lockoutEndTime);
        sessionStorage.setItem('failedAttempts', n);
        alert(`LOCKED OUT! Try again in ${LOCKOUT_DURATION} seconds.`);
      } else {
        alert(`Incorrect. Attempts remaining: ${MAX_ATTEMPTS - n}`);
      }
    }
  }, [password, failedAttempts, lockoutTime]);

  const handleLogout = useCallback(() => {
    setIsAdmin(false);
    localStorage.removeItem('isAdmin');
    setPassword('');
    setEditingId(null); 
    setAddingNew(null); 
    setFormData({});
  }, []);

  const cancelEdit = useCallback(() => { 
    setEditingId(null); 
    setAddingNew(null); 
    setFormData({}); 
  }, []);
  
  const toggleExpanded = useCallback((id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] })), []);
  
  const copyToClipboard = useCallback((code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  // CODES
  const startEditCode = useCallback((code) => {
    setAddingNew(null);
    setEditingId(`code-${code.id}`);
    setFormData({ ...code });
  }, []);

  const startAddCode = useCallback(() => {
    setEditingId(null);
    setAddingNew('code');
    setFormData({ code: '', reward: '', location: 'In-Game' });
  }, []);

  const saveCode = useCallback(async () => {
    setSaving(true);
    try {
      if (editingId?.startsWith('code-')) {
        const id = editingId.split('-')[1];
        const updated = await api(`/api/codes/${id}`, { method: 'PUT', body: JSON.stringify(formData) });
        setCodes(codes.map(c => c.id === updated.id ? updated : c));
        logAction('EDIT', 'CODE', formData.code, `Updated code: ${formData.code}`);
      } else {
        const created = await api('/api/codes', { method: 'POST', body: JSON.stringify(formData) });
        setCodes([...codes, created]);
        logAction('ADD', 'CODE', formData.code, `Created code: ${formData.code}`);
      }
      cancelEdit();
    } catch (err) { alert('Save failed: ' + err.message); }
    setSaving(false);
  }, [editingId, formData, codes, cancelEdit, logAction]);

  const deleteCode = useCallback(async (id) => {
    const item = codes.find(c => c.id === id);
    if (!confirm(`Delete code "${item?.code}"?`)) return;
    try {
      await api(`/api/codes/${id}`, { method: 'DELETE' });
      setCodes(codes.filter(c => c.id !== id));
      logAction('DELETE', 'CODE', item?.code, `Deleted code: ${item?.code}`);
    } catch (err) { alert('Delete failed: ' + err.message); }
  }, [codes, logAction]);

  // CLASSES
  const startEditClass = useCallback((cls) => {
    setAddingNew(null);
    setEditingId(`class-${cls.id}`);
    setFormData({ ...cls });
  }, []);

  const startAddClass = useCallback(() => {
    setEditingId(null);
    setAddingNew('class');
    setFormData({ name: '', role: '', description: '', details: '', image: '' });
  }, []);

  const saveClass = useCallback(async () => {
    setSaving(true);
    try {
      if (editingId?.startsWith('class-')) {
        const id = editingId.split('-')[1];
        const updated = await api(`/api/classes/${id}`, { method: 'PUT', body: JSON.stringify(formData) });
        setClasses(classes.map(c => c.id === updated.id ? updated : c));
        logAction('EDIT', 'CLASS', formData.name, `Updated class: ${formData.name}`);
      } else {
        const created = await api('/api/classes', { method: 'POST', body: JSON.stringify(formData) });
        setClasses([...classes, created]);
        logAction('ADD', 'CLASS', formData.name, `Created class: ${formData.name}`);
      }
      cancelEdit();
    } catch (err) { alert('Save failed: ' + err.message); }
    setSaving(false);
  }, [editingId, formData, classes, cancelEdit, logAction]);

  const deleteClass = useCallback(async (id) => {
    const item = classes.find(c => c.id === id);
    if (!confirm(`Delete class "${item?.name}"?`)) return;
    try {
      await api(`/api/classes/${id}`, { method: 'DELETE' });
      setClasses(classes.filter(c => c.id !== id));
      logAction('DELETE', 'CLASS', item?.name, `Deleted class: ${item?.name}`);
    } catch (err) { alert('Delete failed: ' + err.message); }
  }, [classes, logAction]);

  // EVENTS
  const startEditEvent = useCallback((event) => {
    setAddingNew(null);
    setEditingId(`event-${event.id}`);
    setFormData({ ...event });
  }, []);

  const startAddEvent = useCallback(() => {
    setEditingId(null);
    setAddingNew('event');
    setFormData({ title: '', description: '', details: '', image: '', status: 'UPCOMING' });
  }, []);

  const saveEvent = useCallback(async () => {
    setSaving(true);
    try {
      if (editingId?.startsWith('event-')) {
        const id = editingId.split('-')[1];
        const updated = await api(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(formData) });
        setEvents(events.map(e => e.id === updated.id ? updated : e));
        logAction('EDIT', 'EVENT', formData.title, `Updated event: ${formData.title}`);
      } else {
        const created = await api('/api/events', { method: 'POST', body: JSON.stringify(formData) });
        setEvents([...events, created]);
        logAction('ADD', 'EVENT', formData.title, `Created event: ${formData.title}`);
      }
      cancelEdit();
    } catch (err) { alert('Save failed: ' + err.message); }
    setSaving(false);
  }, [editingId, formData, events, cancelEdit, logAction]);

  const deleteEvent = useCallback(async (id) => {
    const item = events.find(e => e.id === id);
    if (!confirm(`Delete event "${item?.title}"?`)) return;
    try {
      await api(`/api/events/${id}`, { method: 'DELETE' });
      setEvents(events.filter(e => e.id !== id));
      logAction('DELETE', 'EVENT', item?.title, `Deleted event: ${item?.title}`);
    } catch (err) { alert('Delete failed: ' + err.message); }
  }, [events, logAction]);

  // GUIDES
  const startEditGuide = useCallback((guide) => {
    setAddingNew(null);
    setEditingId(`guide-${guide.id}`);
    setFormData({ ...guide });
  }, []);

  const startAddGuide = useCallback(() => {
    setEditingId(null);
    setAddingNew('guide');
    setFormData({ title: '', content: '' });
  }, []);

  const saveGuide = useCallback(async () => {
    setSaving(true);
    try {
      if (editingId?.startsWith('guide-')) {
        const id = editingId.split('-')[1];
        const updated = await api(`/api/guides/${id}`, { method: 'PUT', body: JSON.stringify(formData) });
        setGuides(guides.map(g => g.id === updated.id ? updated : g));
        logAction('EDIT', 'GUIDE', formData.title, `Updated guide: ${formData.title}`);
      } else {
        const created = await api('/api/guides', { method: 'POST', body: JSON.stringify(formData) });
        setGuides([...guides, created]);
        logAction('ADD', 'GUIDE', formData.title, `Created guide: ${formData.title}`);
      }
      cancelEdit();
    } catch (err) { alert('Save failed: ' + err.message); }
    setSaving(false);
  }, [editingId, formData, guides, cancelEdit, logAction]);

  const deleteGuide = useCallback(async (id) => {
    const item = guides.find(g => g.id === id);
    if (!confirm(`Delete guide "${item?.title}"?`)) return;
    try {
      await api(`/api/guides/${id}`, { method: 'DELETE' });
      setGuides(guides.filter(g => g.id !== id));
      logAction('DELETE', 'GUIDE', item?.title, `Deleted guide: ${item?.title}`);
    } catch (err) { alert('Delete failed: ' + err.message); }
  }, [guides, logAction]);

  // SECTIONS
  const addSection = useCallback(() => {
    setAddingNewSection(true);
    setSectionFormData({ name: '', visible: true });
  }, []);

  const saveSection = useCallback(async () => {
    if (!sectionFormData.name.trim()) { alert('Section name cannot be empty'); return; }
    if (editingSectionId) {
      try {
        await api('/api/sections', { method: 'POST', body: JSON.stringify({ sectionId: editingSectionId, name: sectionFormData.name, visible: sectionFormData.visible }) });
        setSections(sections.map(s => s.id === editingSectionId ? { ...s, name: sectionFormData.name, visible: sectionFormData.visible } : s));
        logAction('EDIT', 'SECTION', sectionFormData.name, `Updated section: ${sectionFormData.name}`);
      } catch (err) { alert('Save failed: ' + err.message); }
    } else {
      const newId = sectionFormData.name.toLowerCase().replace(/\s+/g, '-');
      try {
        await api('/api/sections', { method: 'POST', body: JSON.stringify({ sectionId: newId, name: sectionFormData.name, visible: sectionFormData.visible }) });
        const newSection = { id: newId, name: sectionFormData.name, visible: sectionFormData.visible };
        setSections([...sections, newSection]);
        logAction('ADD', 'SECTION', sectionFormData.name, `Created section: ${sectionFormData.name}`);
      } catch (err) { alert('Save failed: ' + err.message); }
    }
    cancelSectionEdit();
  }, [editingSectionId, sectionFormData, sections, logAction]);

  const cancelSectionEdit = useCallback(() => {
    setEditingSectionId(null);
    setAddingNewSection(false);
    setSectionFormData({});
  }, []);

  const editSection = useCallback((section) => {
    setEditingSectionId(section.id);
    setAddingNewSection(false);
    setSectionFormData({ ...section });
  }, []);

  const deleteSection = useCallback(async (id) => {
    const section = sections.find(s => s.id === id);
    if (!confirm(`Delete section "${section?.name}"?`)) return;
    try {
      await api(`/api/sections/${id}`, { method: 'DELETE' });
      setSections(sections.filter(s => s.id !== id));
      logAction('DELETE', 'SECTION', section?.name, `Deleted section: ${section?.name}`);
    } catch (err) { alert('Delete failed: ' + err.message); }
  }, [sections, logAction]);

  const toggleSectionVisibility = useCallback((id) => {
    setSections(sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  }, [sections]);

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      handleFormDataChange('image', base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const saveCodesNote = useCallback(async (sectionId) => {
    const noteText = sectionNotes[sectionId];
    try {
      await api('/api/section-notes', { method: 'POST', body: JSON.stringify({ sectionId, note: noteText }) });
    } catch (err) {
      console.error('Failed to save section note:', err.message);
      alert('Failed to save section note: ' + err.message);
    }
    setEditingNoteSection(null);
    logAction('EDIT', 'SECTION_NOTE', sectionId, 'Updated section note');
  }, [sectionNotes, logAction]);

  const saveAnnouncement = useCallback(async () => {
    if (announcementText.trim()) {
      const announcementData = { text: announcementText, color: announcementColor };
      try {
        await api('/api/announcements', { method: 'POST', body: JSON.stringify(announcementData) });
      } catch (err) {
        console.error('Backend announcement save failed:', err.message);
      }
      localStorage.setItem('announcement', JSON.stringify(announcementData));
      setAnnouncement(announcementText);
      setEditingAnnouncement(false);
      logAction('EDIT', 'ANNOUNCEMENT', announcementText.substring(0, 30), 'Updated announcement');
    }
  }, [announcementText, announcementColor, logAction]);

  const deleteAnnouncement = useCallback(async () => {
    if (confirm('Delete this announcement?')) {
      try {
        await api('/api/announcements', { method: 'DELETE' });
      } catch (err) {
        console.warn('Backend announcement delete failed:', err);
      }
      localStorage.removeItem('announcement');
      setAnnouncement(null);
      setAnnouncementText('');
      setEditingAnnouncement(false);
      logAction('DELETE', 'ANNOUNCEMENT', 'Announcement', 'Deleted announcement');
    }
  }, [logAction]);

  const inputCls = 'px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full';

  const EditForm = useCallback(({ title, children, onSave }) => (
    <div ref={editFormRef} className="bg-slate-800/50 border border-amber-600/30 rounded-xl p-6 mb-6 scroll-mt-24">
      <h3 className="font-bold text-lg mb-4 text-amber-300">{title}</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">{children}</div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 rounded-lg font-semibold flex items-center gap-2">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={cancelEdit} className="px-6 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg">Cancel</button>
      </div>
    </div>
  ), [saving, cancelEdit]);

  const displaySections = useMemo(() => {
    return isAdmin ? sections : sections.filter(s => s.visible);
  }, [sections, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-amber-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading Sword X Staff...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <header className="relative border-b border-amber-900/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <h1 className="text-4xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">Sword X Staff</h1>
          {!isAdmin ? (
            <button onClick={() => setShowLogin(!showLogin)} className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 hover:bg-amber-800/40 border border-amber-600/50 rounded-lg transition-all">
              <Lock size={18} /> Admin
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setShowLogs(!showLogs)} className="flex items-center gap-2 px-4 py-2 bg-blue-600/30 hover:bg-blue-600/40 border border-blue-600/50 rounded-lg transition-all">
                [LOG] Logs ({adminLogs.length})
              </button>
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-600/30 hover:bg-red-700/40 border border-red-600/50 rounded-lg transition-all">
                <LogOut size={18} /> Logout
              </button>
            </div>
          )}
        </div>

        {showLogin && !isAdmin && (
          <div className="border-t border-amber-900/20 bg-slate-900/50 backdrop-blur p-6">
            <div className="max-w-7xl mx-auto">
              {lockoutTime > 0 ? (
                <div className="bg-red-900/40 border border-red-600/60 rounded-lg p-4 text-center">
                  <p className="text-red-200 font-bold text-lg mb-2">[LOCK] ACCOUNT LOCKED</p>
                  <p className="text-red-400 text-sm font-mono">Retry in: {lockoutTime}s</p>
                </div>
              ) : (
                <div className="flex gap-4 flex-wrap">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="Enter admin password" className="px-4 py-2 bg-slate-800 border border-amber-600/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
                  <button onClick={() => setShowPassword(!showPassword)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                  <button onClick={handleLogin} className="px-6 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-semibold transition-all">Login</button>
                  {failedAttempts > 0 && (<div className="px-4 py-2 bg-red-900/40 border border-red-600/50 rounded-lg flex items-center gap-2"><span className="text-red-300 text-sm font-bold">{failedAttempts}/{MAX_ATTEMPTS} Failed</span></div>)}
                </div>
              )}
            </div>
          </div>
        )}

        {isAdmin && showLogs && (
          <div className="border-t border-blue-900/20 bg-slate-900/50 backdrop-blur p-6">
            <div className="max-w-7xl mx-auto">
              <h3 className="font-bold text-lg text-blue-300 mb-4">[LOG] Admin Action Logs</h3>
              {adminLogs.length === 0 ? (<p className="text-slate-400">No admin actions yet.</p>) : (
                <div className="bg-slate-800/40 border border-blue-600/30 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  {adminLogs.map((log) => (<div key={log.id} className="border-b border-blue-600/20 p-4 flex justify-between items-start hover:bg-slate-700/30 transition-all">
                    <div className="flex-1"><div className="flex items-center gap-3 mb-2"><span className={`px-2 py-1 rounded text-xs font-bold ${log.action_type === 'ADD' ? 'bg-green-600/40 text-green-300' : log.action_type === 'EDIT' ? 'bg-blue-600/40 text-blue-300' : 'bg-red-600/40 text-red-300'}`}>{log.action_type}</span><span className="px-2 py-1 bg-amber-600/30 text-amber-300 rounded text-xs font-bold">{log.category}</span><span className="text-slate-300 font-semibold">{log.item_name}</span></div><p className="text-slate-400 text-sm">{log.details}</p></div>
                    <p className="text-slate-500 text-xs ml-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</p>
                  </div>))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {announcement && (
        <div style={{ background: announcementColor === 'red' ? 'rgba(220, 38, 38, 0.3)' : announcementColor === 'blue' ? 'rgba(37, 99, 235, 0.3)' : announcementColor === 'green' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(180, 83, 9, 0.3)', borderBottom: `3px solid ${announcementColor === 'red' ? 'rgb(220, 38, 38)' : announcementColor === 'blue' ? 'rgb(37, 99, 235)' : announcementColor === 'green' ? 'rgb(34, 197, 94)' : 'rgb(180, 83, 9)'}` }} className="backdrop-blur px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1"><span className="text-2xl">!</span><p className="text-white font-semibold">{announcement}</p></div>
            {isAdmin && (<button onClick={() => setEditingAnnouncement(true)} className="px-3 py-1 text-xs bg-slate-600/60 hover:bg-slate-600/80 rounded flex items-center gap-1 whitespace-nowrap text-slate-200"><Edit3 size={12} /> Edit</button>)}
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-40 border-b border-amber-900/20 backdrop-blur-sm bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto">
            {displaySections.map(section => (<button key={section.id} onClick={() => { setActiveTab(section.id); cancelEdit(); }} className={`px-6 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${activeTab === section.id ? 'text-amber-300 border-amber-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>{section.name}{isAdmin && !section.visible && <span className="px-2 py-0.5 bg-red-600/40 text-red-300 text-xs rounded border border-red-600/50">hidden</span>}</button>))}
            {isAdmin && (<button onClick={() => setActiveTab('settings')} className={`px-6 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'text-purple-300 border-purple-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}><Settings size={16} /> Settings</button>)}
          </div>
        </div>
      </nav>

      <main className="relative max-w-7xl mx-auto px-6 py-12">
        {/* CODES */}
        {activeTab === 'codes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">Codes</h2>
              {isAdmin && (<button onClick={startAddCode} className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all"><Plus size={18} /> Add</button>)}
            </div>
            <SectionNote sectionId="codes" isAdmin={isAdmin} editingNoteSection={editingNoteSection} setEditingNoteSection={setEditingNoteSection} sectionNotes={sectionNotes} setSectionNotes={setSectionNotes} inputCls={inputCls} saveCodesNote={saveCodesNote} />
            {isAdmin && (addingNew === 'code' || editingId?.startsWith('code-')) && (
              <EditForm title={editingId ? 'Edit Code' : 'Add New Code'} onSave={saveCode}>
                <input className={`col-span-2 ${inputCls}`} placeholder="Code" value={formData.code || ''} onChange={e => handleFormDataChange('code', e.target.value)} />
                <input className={inputCls} placeholder="Reward" value={formData.reward || ''} onChange={e => handleFormDataChange('reward', e.target.value)} />
                <input className={inputCls} placeholder="Location" value={formData.location || ''} onChange={e => handleFormDataChange('location', e.target.value)} />
              </EditForm>
            )}
            {codes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">No codes yet.{isAdmin && ' Click "Add" to get started!'}</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {codes.map((code) => (
                  <div key={code.id} className="bg-slate-800/40 border border-amber-900/30 rounded-xl p-4 hover:border-amber-600/50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-amber-300 font-mono">{code.code}</h3>
                        <p className="text-sm text-slate-300 mt-1">{code.reward}</p>
                        <p className="text-xs text-slate-400 mt-1">{code.location}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => copyToClipboard(code.code)} className="px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center gap-1">
                          {copiedCode === code.code ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        {isAdmin && (
                          <>
                            <button onClick={() => startEditCode(code)} className="px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center gap-1"><Edit3 size={14} /> Edit</button>
                            <button onClick={() => deleteCode(code.id)} className="px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CLASSES */}
        {activeTab === 'classes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">Classes</h2>
              {isAdmin && (<button onClick={startAddClass} className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all"><Plus size={18} /> Add</button>)}
            </div>
            <SectionNote sectionId="classes" isAdmin={isAdmin} editingNoteSection={editingNoteSection} setEditingNoteSection={setEditingNoteSection} sectionNotes={sectionNotes} setSectionNotes={setSectionNotes} inputCls={inputCls} saveCodesNote={saveCodesNote} />
            {isAdmin && (addingNew === 'class' || editingId?.startsWith('class-')) && (
              <EditForm title={editingId ? 'Edit Class' : 'Add New Class'} onSave={saveClass}>
                <input className={`col-span-2 ${inputCls}`} placeholder="Class Name" value={formData.name || ''} onChange={e => handleFormDataChange('name', e.target.value)} />
                <input className={inputCls} placeholder="Role" value={formData.role || ''} onChange={e => handleFormDataChange('role', e.target.value)} />
                <input className={inputCls} placeholder="Image URL" value={formData.image || ''} onChange={e => handleFormDataChange('image', e.target.value)} />
                <div className="col-span-2 flex items-center gap-2">
                  <label className="flex-1 px-4 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded-lg font-semibold text-sm cursor-pointer border border-blue-600/50 flex items-center justify-center gap-2">
                    [UPLOAD] Upload Image
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {formData.image && formData.image.startsWith('data:') && <span className="text-green-400 text-sm">[OK] Image selected</span>}
                </div>
                <textarea className={`col-span-2 ${inputCls} h-20`} placeholder="Description" value={formData.description || ''} onChange={e => handleFormDataChange('description', e.target.value)} />
                <textarea className={`col-span-2 ${inputCls} h-24`} placeholder="Details" value={formData.details || ''} onChange={e => handleFormDataChange('details', e.target.value)} />
              </EditForm>
            )}
            {classes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">No classes yet.{isAdmin && ' Click "Add" to get started!'}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {classes.map((cls) => (
                  <div key={cls.id} onClick={() => toggleExpanded(`class-${cls.id}`)} className="cursor-pointer bg-gradient-to-br from-slate-800/40 to-slate-800/20 border border-amber-900/30 rounded-xl overflow-hidden hover:border-amber-600/50 transition-all">
                    <div className="relative h-48 bg-gradient-to-b from-slate-700 to-slate-800 overflow-hidden">
                      {cls.image && <img src={cls.image} alt={cls.name} className="w-full h-full object-cover" />}
                      <div className="absolute top-3 right-3 px-3 py-1 bg-blue-600/80 rounded-full text-xs font-bold">{cls.role}</div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-lg text-amber-300">{cls.name}</h3>
                        <ChevronDown size={20} className={`transition-transform ${expandedItems[`class-${cls.id}`] ? 'rotate-180' : ''}`} />
                      </div>
                      <p className="text-sm text-slate-300 mb-3">{cls.description}</p>
                      {expandedItems[`class-${cls.id}`] && (
                        <div className="border-t border-amber-900/30 pt-4 mt-4">
                          <p className="text-sm text-slate-200 mb-4">{cls.details}</p>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <button onClick={e => { e.stopPropagation(); startEditClass(cls); }} className="flex-1 px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center justify-center gap-1"><Edit3 size={14} /> Edit</button>
                              <button onClick={e => { e.stopPropagation(); deleteClass(cls.id); }} className="flex-1 px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center justify-center gap-1"><Trash2 size={14} /> Delete</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EVENTS */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">Events</h2>
              {isAdmin && (<button onClick={startAddEvent} className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all"><Plus size={18} /> Add</button>)}
            </div>
            <SectionNote sectionId="events" isAdmin={isAdmin} editingNoteSection={editingNoteSection} setEditingNoteSection={setEditingNoteSection} sectionNotes={sectionNotes} setSectionNotes={setSectionNotes} inputCls={inputCls} saveCodesNote={saveCodesNote} />
            {isAdmin && (addingNew === 'event' || editingId?.startsWith('event-')) && (
              <EditForm title={editingId ? 'Edit Event' : 'Add New Event'} onSave={saveEvent}>
                <input className={`col-span-2 ${inputCls}`} placeholder="Event Title" value={formData.title || ''} onChange={e => handleFormDataChange('title', e.target.value)} />
                <input className={inputCls} placeholder="Status" value={formData.status || 'UPCOMING'} onChange={e => handleFormDataChange('status', e.target.value)} />
                <input className={inputCls} placeholder="Image URL" value={formData.image || ''} onChange={e => handleFormDataChange('image', e.target.value)} />
                <textarea className={`col-span-2 ${inputCls} h-20`} placeholder="Description" value={formData.description || ''} onChange={e => handleFormDataChange('description', e.target.value)} />
                <textarea className={`col-span-2 ${inputCls} h-24`} placeholder="Details" value={formData.details || ''} onChange={e => handleFormDataChange('details', e.target.value)} />
              </EditForm>
            )}
            {events.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">No events yet.{isAdmin && ' Click "Add" to get started!'}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
                {events.map((event) => (
                  <div key={event.id} onClick={() => toggleExpanded(`event-${event.id}`)} className="cursor-pointer bg-gradient-to-br from-slate-800/40 to-slate-800/20 border border-amber-900/30 rounded-xl overflow-hidden hover:border-amber-600/50 transition-all">
                    <div className="relative h-40 bg-gradient-to-b from-slate-700 to-slate-800 overflow-hidden">
                      {event.image && <img src={event.image} alt={event.title} className="w-full h-full object-cover" />}
                      <div className="absolute top-3 right-3 px-3 py-1 bg-blue-600/80 rounded-full text-xs font-bold">{event.status}</div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-lg text-amber-300 mb-2">{event.title}</h3>
                      <p className="text-sm text-slate-300 mb-3">{event.description}</p>
                      {expandedItems[`event-${event.id}`] && (
                        <div className="border-t border-amber-900/30 pt-4 mt-4">
                          <p className="text-sm text-slate-200 mb-4">{event.details}</p>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <button onClick={e => { e.stopPropagation(); startEditEvent(event); }} className="flex-1 px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center justify-center gap-1"><Edit3 size={14} /> Edit</button>
                              <button onClick={e => { e.stopPropagation(); deleteEvent(event.id); }} className="flex-1 px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center justify-center gap-1"><Trash2 size={14} /> Delete</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GUIDES */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">Guides</h2>
              {isAdmin && (<button onClick={startAddGuide} className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all"><Plus size={18} /> Add</button>)}
            </div>
            <SectionNote sectionId="guide" isAdmin={isAdmin} editingNoteSection={editingNoteSection} setEditingNoteSection={setEditingNoteSection} sectionNotes={sectionNotes} setSectionNotes={setSectionNotes} inputCls={inputCls} saveCodesNote={saveCodesNote} />
            {isAdmin && (addingNew === 'guide' || editingId?.startsWith('guide-')) && (
              <EditForm title={editingId ? 'Edit Guide' : 'Add New Guide'} onSave={saveGuide}>
                <input className={`col-span-2 ${inputCls}`} placeholder="Guide Title" value={formData.title || ''} onChange={e => handleFormDataChange('title', e.target.value)} />
                <textarea className={`col-span-2 ${inputCls} h-32`} placeholder="Content" value={formData.content || ''} onChange={e => handleFormDataChange('content', e.target.value)} />
              </EditForm>
            )}
            {guides.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">No guides yet.{isAdmin && ' Click "Add" to get started!'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {guides.map((guide) => (
                  <div key={guide.id} className="bg-slate-800/40 border border-amber-900/30 rounded-xl p-6 hover:border-amber-600/50 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-lg text-amber-300">{guide.title}</h3>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button onClick={() => startEditGuide(guide)} className="px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center gap-1"><Edit3 size={14} /> Edit</button>
                          <button onClick={() => deleteGuide(guide.id)} className="px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{guide.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && isAdmin && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black bg-gradient-to-r from-purple-300 to-pink-500 bg-clip-text text-transparent">Admin Settings</h2>

            {/* Announcements */}
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-6">
              <h3 className="font-bold text-lg text-slate-300 mb-4">Announcements</h3>
              {editingAnnouncement ? (
                <div className="space-y-4 bg-slate-700/30 p-4 rounded-lg">
                  <textarea className={`${inputCls} h-20`} placeholder='e.g., "Check the new YouTube video!"' value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} autoFocus />
                  <div className="flex gap-2">
                    <select value={announcementColor} onChange={(e) => setAnnouncementColor(e.target.value)} className={`${inputCls} flex-1`}>
                      <option value="amber">Amber</option>
                      <option value="red">Red</option>
                      <option value="blue">Blue</option>
                      <option value="green">Green</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveAnnouncement} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold flex items-center justify-center gap-2 text-white"><Save size={16} /> Save</button>
                    <button onClick={() => { setEditingAnnouncement(false); setAnnouncementText(announcement || ''); }} className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-white">Cancel</button>
                  </div>
                </div>
              ) : announcement ? (
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <p className="text-slate-300 mb-3 font-semibold">Current:</p>
                  <p className="text-slate-200 mb-4">{announcement}</p>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingAnnouncement(true); setAnnouncementText(announcement); }} className="px-4 py-2 bg-amber-600/40 hover:bg-amber-600/60 rounded-lg text-sm font-semibold flex items-center gap-2 text-amber-300"><Edit3 size={14} /> Edit</button>
                    <button onClick={deleteAnnouncement} className="px-4 py-2 bg-red-600/40 hover:bg-red-600/60 rounded-lg text-sm font-semibold flex items-center gap-2 text-red-300"><Trash2 size={14} /> Delete</button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                  <p className="text-slate-400 text-sm mb-3">No announcement active</p>
                  <button onClick={() => setEditingAnnouncement(true)} className="px-4 py-2 bg-amber-600/40 hover:bg-amber-600/60 rounded-lg text-sm font-semibold text-amber-300">Create Announcement</button>
                </div>
              )}
            </div>

            {/* Manage Sections */}
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-6">
              <h3 className="font-bold text-lg text-slate-300 mb-4">Manage Sections</h3>
              <div className="space-y-3 mb-4">
                {sections.map((section) => (
                  <div key={section.id} className="bg-slate-700/30 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-200">{section.name}</h4>
                      <p className="text-xs text-slate-400">ID: {section.id}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleSectionVisibility(section.id)} className={`px-3 py-2 rounded text-sm ${section.visible ? 'bg-green-600/40 text-green-300' : 'bg-red-600/40 text-red-300'}`}>
                        {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button onClick={() => editSection(section)} className="px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm"><Edit3 size={14} /></button>
                      <button onClick={() => deleteSection(section.id)} className="px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
              {(editingSectionId || addingNewSection) && (
                <div className="bg-slate-600/30 rounded-lg p-4 space-y-3">
                  <input className={inputCls} placeholder="Section Name" value={sectionFormData.name || ''} onChange={e => handleSectionFormChange('name', e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={saveSection} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"><Save size={14} /> Save</button>
                    <button onClick={cancelSectionEdit} className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              )}
              <button onClick={addSection} className="w-full mt-4 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"><Plus size={16} /> Add New Section</button>
            </div>
          </div>
        )}
      </main>

      <footer className="relative border-t border-amber-900/20 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-sm">Made by <span className="text-amber-300 font-semibold">realdrizzyrev</span>, <span className="text-amber-300 font-semibold">qy_maple</span></p>
          <a href="https://discord.gg/QYmQKxVW3K" target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-sm transition-all flex items-center gap-2">[HEART] Join Discord Server</a>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        h1, h2, h3, h4, h5, h6 { font-family: 'Orbitron', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}
