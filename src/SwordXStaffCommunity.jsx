import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Copy, Check, LogOut, Edit3, Save, X, Plus, Trash2, Lock, Eye, EyeOff, ChevronDown, Settings, Loader2 } from 'lucide-react';

// ─── Backend API URL ─────────────────────────────────────────────────────────
const API_BASE = 'https://sword-x-staff-backend-production.up.railway.app';

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

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

  // ── Edit form scroll ref (fixes the "edit button does nothing" bug) ─────────
  const editFormRef = useRef(null);

  // ── Data ──────────────────────────────────────────────────────────────────
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

  // ── Admin State ────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(null);
  const [formData, setFormData] = useState({});
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [sectionFormData, setSectionFormData] = useState({});
  const [addingNewSection, setAddingNewSection] = useState(false);

  const ADMIN_PASSWORD = 'SxSSwordXStaffAdminYoutubeKingAuraFarmingWebsiteWeOwnOnlyAdminsDONTLETPEOPLEUSETHISATALLLEAKTHISUWILLGETPERMBANND';
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 300;

  // ── Load all data on mount with proper dependency array ────────────────────
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [c, cl, ev, g] = await Promise.all([
          api('/api/codes'),
          api('/api/classes'),
          api('/api/events'),
          api('/api/guides'),
        ]);
        setCodes(c);
        setClasses(cl);
        setEvents(ev);
        setGuides(g);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();

    // Load sections from localStorage (CRITICAL: must persist custom sections)
    const savedSections = localStorage.getItem('sections');
    if (savedSections) {
      try {
        setSections(JSON.parse(savedSections));
      } catch (e) {
        console.error('Failed to restore sections:', e);
      }
    }
  }, []);

  // ── Restore admin session on mount ONLY ────────────────────────────────────
  useEffect(() => {
    const savedAdmin = localStorage.getItem('isAdmin') === 'true';
    if (savedAdmin) {
      setIsAdmin(true);
    }

    const savedLogs = localStorage.getItem('adminLogs');
    if (savedLogs) {
      try {
        setAdminLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error('Failed to restore logs:', e);
      }
    }

    // Restore custom section items from localStorage
    const savedCustomItems = localStorage.getItem('customSectionItems');
    if (savedCustomItems) {
      try {
        setCustomSectionItems(JSON.parse(savedCustomItems));
      } catch (e) {
        console.error('Failed to restore custom items:', e);
      }
    }
  }, []);

  // ── SAVE SECTIONS TO LOCALSTORAGE WHENEVER THEY CHANGE ──────────────────────
  useEffect(() => {
    localStorage.setItem('sections', JSON.stringify(sections));
  }, [sections]);

  // ── Scroll edit form into view whenever it opens ───────────────────────────
  useEffect(() => {
    if ((editingId || addingNew) && editFormRef.current) {
      setTimeout(() => {
        editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [editingId, addingNew]);

  // ── Memoized callback for form data updates ────────────────────────────────
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
      actionType, category, itemName, details,
      timestamp: timestamp.toLocaleString(),
      time: timestamp.toLocaleTimeString()
    };
    const updatedLogs = [newLog, ...adminLogs];
    setAdminLogs(updatedLogs);
    localStorage.setItem('adminLogs', JSON.stringify(updatedLogs));
  }, [adminLogs.length]);

  const handleLogin = useCallback(() => {
    if (lockoutTime > 0) { alert(`Try again in ${lockoutTime}s`); return; }
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      localStorage.setItem('isAdmin', 'true');
      setShowLogin(false); setPassword('');
      setFailedAttempts(0); setLockoutTime(0);
    } else {
      const n = failedAttempts + 1;
      setFailedAttempts(n); setPassword('');
      if (n >= MAX_ATTEMPTS) {
        setLockoutTime(LOCKOUT_DURATION);
        alert(`❌ LOCKED OUT! Try again in ${LOCKOUT_DURATION} seconds.`);
        const interval = setInterval(() => {
          setLockoutTime(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
        }, 1000);
      } else {
        alert(`❌ Incorrect. Attempts remaining: ${MAX_ATTEMPTS - n}`);
      }
    }
  }, [password, failedAttempts, lockoutTime]);

  const handleLogout = useCallback(() => {
    setIsAdmin(false);
    localStorage.removeItem('isAdmin');
    setPassword('');
    setEditingId(null); setAddingNew(null); setFormData({});
  }, []);

  const cancelEdit = useCallback(() => { setEditingId(null); setAddingNew(null); setFormData({}); }, []);

  const toggleExpanded = useCallback((id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] })), []);

  const copyToClipboard = useCallback((code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  // ── CODE CRUD ──────────────────────────────────────────────────────────────
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
    await api(`/api/codes/${id}`, { method: 'DELETE' });
    setCodes(codes.filter(c => c.id !== id));
    logAction('DELETE', 'CODE', item?.code, `Deleted code: ${item?.code}`);
  }, [codes, logAction]);

  // ── CLASS CRUD ─────────────────────────────────────────────────────────────
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
    await api(`/api/classes/${id}`, { method: 'DELETE' });
    setClasses(classes.filter(c => c.id !== id));
    logAction('DELETE', 'CLASS', item?.name, `Deleted class: ${item?.name}`);
  }, [classes, logAction]);

  // ── EVENT CRUD ─────────────────────────────────────────────────────────────
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
    await api(`/api/events/${id}`, { method: 'DELETE' });
    setEvents(events.filter(e => e.id !== id));
    logAction('DELETE', 'EVENT', item?.title, `Deleted event: ${item?.title}`);
  }, [events, logAction]);

  // ── GUIDE CRUD ─────────────────────────────────────────────────────────────
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
    await api(`/api/guides/${id}`, { method: 'DELETE' });
    setGuides(guides.filter(g => g.id !== id));
    logAction('DELETE', 'GUIDE', item?.title, `Deleted guide: ${item?.title}`);
  }, [guides, logAction]);

  // ── CUSTOM SECTION ITEM CRUD ──────────────────────────────────────────────
  const startAddCustomItem = useCallback((sectionId) => {
    setEditingId(null);
    setAddingNew(`custom-${sectionId}`);
    setFormData({ title: '', content: '' });
  }, []);

  const startEditCustomItem = useCallback((sectionId, itemId) => {
    const items = customSectionItems[sectionId] || [];
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    setAddingNew(null);
    setEditingId(`custom-item-${sectionId}-${itemId}`);
    setFormData({ ...item });
  }, [customSectionItems]);

  const saveCustomItem = useCallback(() => {
    const match = editingId?.match(/custom-item-(.+)-(\d+)/) || addingNew?.match(/custom-(.+)/) && [null, addingNew.replace('custom-', '')];
    
    if (editingId?.startsWith('custom-item-')) {
      const [, sectionId, itemId] = editingId.match(/custom-item-(.+)-(\d+)/);
      const items = customSectionItems[sectionId] || [];
      const updated = items.map(i => i.id === parseInt(itemId) ? { ...formData, id: i.id } : i);
      const newItems = { ...customSectionItems, [sectionId]: updated };
      setCustomSectionItems(newItems);
      localStorage.setItem('customSectionItems', JSON.stringify(newItems));
      logAction('EDIT', 'CUSTOM_ITEM', formData.title, `Updated item in ${sectionId}`);
    } else if (addingNew?.startsWith('custom-')) {
      const sectionId = addingNew.replace('custom-', '');
      const items = customSectionItems[sectionId] || [];
      const newId = Math.max(...items.map(i => i.id || 0), 0) + 1;
      const newItems = { ...customSectionItems, [sectionId]: [...items, { ...formData, id: newId }] };
      setCustomSectionItems(newItems);
      localStorage.setItem('customSectionItems', JSON.stringify(newItems));
      logAction('ADD', 'CUSTOM_ITEM', formData.title, `Added item to ${sectionId}`);
    }
    cancelEdit();
  }, [editingId, addingNew, formData, customSectionItems, cancelEdit, logAction]);

  const deleteCustomItem = useCallback((sectionId, itemId) => {
    const items = customSectionItems[sectionId] || [];
    const item = items.find(i => i.id === itemId);
    if (!confirm(`Delete item "${item?.title}"?`)) return;
    const updated = items.filter(i => i.id !== itemId);
    const newItems = updated.length === 0 ? { ...customSectionItems, [sectionId]: undefined } : { ...customSectionItems, [sectionId]: updated };
    setCustomSectionItems(newItems);
    localStorage.setItem('customSectionItems', JSON.stringify(newItems));
    logAction('DELETE', 'CUSTOM_ITEM', item?.title, `Deleted item from ${sectionId}`);
  }, [customSectionItems, logAction]);

  // ── SECTION CRUD ──────────────────────────────────────────────────────────
  const addSection = useCallback(() => {
    setAddingNewSection(true);
    setSectionFormData({ name: '', visible: true });
  }, []);

  const saveSection = useCallback(() => {
    if (!sectionFormData.name.trim()) {
      alert('Section name cannot be empty');
      return;
    }

    if (editingSectionId) {
      setSections(sections.map(s =>
        s.id === editingSectionId
          ? { ...s, name: sectionFormData.name, visible: sectionFormData.visible }
          : s
      ));
      logAction('EDIT', 'SECTION', sectionFormData.name, `Updated section: ${sectionFormData.name}`);
    } else {
      const newId = sectionFormData.name.toLowerCase().replace(/\s+/g, '-');
      const newSection = { id: newId, name: sectionFormData.name, visible: sectionFormData.visible };
      setSections([...sections, newSection]);
      logAction('ADD', 'SECTION', sectionFormData.name, `Created section: ${sectionFormData.name}`);
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

  const deleteSection = useCallback((id) => {
    const section = sections.find(s => s.id === id);
    if (!confirm(`Delete section "${section?.name}"?`)) return;
    setSections(sections.filter(s => s.id !== id));
    logAction('DELETE', 'SECTION', section?.name, `Deleted section: ${section?.name}`);
  }, [sections, logAction]);

  const toggleSectionVisibility = useCallback((id) => {
    setSections(sections.map(s =>
      s.id === id ? { ...s, visible: !s.visible } : s
    ));
  }, [sections]);

  // ── IMAGE FILE UPLOAD HANDLER ─────────────────────────────────────────────
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

  // ── Shared form styles ─────────────────────────────────────────────────────
  const inputCls = 'px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full';

  const EditForm = useCallback(({ title, children, onSave }) => (
    <div ref={editFormRef} className="bg-slate-800/50 border border-amber-600/30 rounded-xl p-6 mb-6 scroll-mt-24">
      <h3 className="font-bold text-lg mb-4 text-amber-300">{title}</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">{children}</div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 rounded-lg font-semibold flex items-center gap-2"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={cancelEdit} className="px-6 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  ), [saving, cancelEdit]);

  // ── SECTIONS VISIBILITY LOGIC ────────────────────────────────────────────
  const displaySections = useMemo(() => {
    // Admins see ALL sections (including hidden) for editing
    // Non-admins only see visible sections
    return isAdmin ? sections : sections.filter(s => s.visible);
  }, [sections, isAdmin]);

  const visibleSections = useMemo(() => sections.filter(s => s.visible), [sections]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-amber-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading Sword X Staff…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <header className="relative border-b border-amber-900/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <h1 className="text-4xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
            Sword X Staff
          </h1>
          {!isAdmin ? (
            <button
              onClick={() => setShowLogin(!showLogin)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 hover:bg-amber-800/40 border border-amber-600/50 rounded-lg transition-all"
            >
              <Lock size={18} /> Admin
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/30 hover:bg-blue-600/40 border border-blue-600/50 rounded-lg transition-all"
              >
                📋 Logs ({adminLogs.length})
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/30 hover:bg-red-700/40 border border-red-600/50 rounded-lg transition-all"
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          )}
        </div>

        {/* Login Panel */}
        {showLogin && !isAdmin && (
          <div className="border-t border-amber-900/20 bg-slate-900/50 backdrop-blur p-6">
            <div className="max-w-7xl mx-auto">
              {lockoutTime > 0 ? (
                <div className="bg-red-900/40 border border-red-600/60 rounded-lg p-4 text-center">
                  <p className="text-red-200 font-bold text-lg mb-2">🔒 ACCOUNT LOCKED</p>
                  <p className="text-red-400 text-sm font-mono">Retry in: {lockoutTime}s</p>
                </div>
              ) : (
                <div className="flex gap-4 flex-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="Enter admin password"
                    className="px-4 py-2 bg-slate-800 border border-amber-600/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <button onClick={handleLogin} className="px-6 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-semibold transition-all">
                    Login
                  </button>
                  {failedAttempts > 0 && (
                    <div className="px-4 py-2 bg-red-900/40 border border-red-600/50 rounded-lg flex items-center gap-2">
                      <span className="text-red-300 text-sm font-bold">⚠️ {failedAttempts}/{MAX_ATTEMPTS} Failed</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin Logs */}
        {isAdmin && showLogs && (
          <div className="border-t border-blue-900/20 bg-slate-900/50 backdrop-blur p-6">
            <div className="max-w-7xl mx-auto">
              <h3 className="font-bold text-lg text-blue-300 mb-4">📋 Admin Action Logs</h3>
              {adminLogs.length === 0 ? (
                <p className="text-slate-400">No admin actions yet.</p>
              ) : (
                <div className="bg-slate-800/40 border border-blue-600/30 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  {adminLogs.map((log) => (
                    <div key={log.id} className="border-b border-blue-600/20 p-4 flex justify-between items-start hover:bg-slate-700/30 transition-all">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${log.actionType === 'ADD' ? 'bg-green-600/40 text-green-300' : log.actionType === 'EDIT' ? 'bg-blue-600/40 text-blue-300' : 'bg-red-600/40 text-red-300'}`}>{log.actionType}</span>
                          <span className="px-2 py-1 bg-amber-600/30 text-amber-300 rounded text-xs font-bold">{log.category}</span>
                          <span className="text-slate-300 font-semibold">{log.itemName}</span>
                        </div>
                        <p className="text-slate-400 text-sm">{log.details}</p>
                      </div>
                      <p className="text-slate-500 text-xs ml-4 whitespace-nowrap">{log.time}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-amber-900/20 backdrop-blur-sm bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto">
            {displaySections.map(section => (
              <button
                key={section.id}
                onClick={() => { setActiveTab(section.id); cancelEdit(); }}
                className={`px-6 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${activeTab === section.id ? 'text-amber-300 border-amber-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
              >
                {section.name}
                {isAdmin && !section.visible && <span className="px-2 py-0.5 bg-red-600/40 text-red-300 text-xs rounded border border-red-600/50">hidden</span>}
              </button>
            ))}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'text-purple-300 border-purple-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
              >
                <Settings size={16} /> Settings
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="relative max-w-7xl mx-auto px-6 py-12">

        {/* ── CLASSES ── */}
        {activeTab === 'classes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">Classes</h2>
              {isAdmin && (
                <button onClick={startAddClass} className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all">
                  <Plus size={18} /> Add
                </button>
              )}
            </div>

            {isAdmin && (addingNew === 'class' || editingId?.startsWith('class-')) && (
              <EditForm title={editingId ? 'Edit Class' : 'Add New Class'} onSave={saveClass}>
                <input className={`col-span-2 ${inputCls}`} placeholder="Class Name" value={formData.name || ''} onChange={e => handleFormDataChange('name', e.target.value)} />
                <input className={inputCls} placeholder="Role" value={formData.role || ''} onChange={e => handleFormDataChange('role', e.target.value)} />
                <input className={inputCls} placeholder="Image URL" value={formData.image || ''} onChange={e => handleFormDataChange('image', e.target.value)} />
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
                  <div
                    key={cls.id}
                    onClick={() => toggleExpanded(`class-${cls.id}`)}
                    className="cursor-pointer bg-gradient-to-br from-slate-800/40 to-slate-800/20 border border-amber-900/30 rounded-xl overflow-hidden hover:border-amber-600/50 transition-all"
                  >
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
                              <button onClick={e => { e.stopPropagation(); startEditClass(cls); }} className="flex-1 px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center justify-center gap-1">
                                <Edit3 size={14} /> Edit
                              </button>
                              <button onClick={e => { e.stopPropagation(); deleteClass(cls.id); }} className="flex-1 px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center justify-center gap-1">
                                <Trash2 size={14} /> Delete
                              </button>
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

        {/* ── EVENTS ── */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">Events</h2>
              {isAdmin && (
                <button onClick={startAddEvent} className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all">
                  <Plus size={18} /> Add
                </button>
              )}
            </div>

            {isAdmin && (addingNew === 'event' || editingId?.startsWith('event-')) && (
              <EditForm title={editingId ? 'Edit Event' : 'Add New Event'} onSave={saveEvent}>
                <input className={`col-span-2 ${inputCls}`} placeholder="Title" value={formData.title || ''} onChange={e => handleFormDataChange('title', e.target.value)} />
                <input className={`col-span-2 ${inputCls}`} placeholder="Image URL" value={formData.image || ''} onChange={e => handleFormDataChange('image', e.target.value)} />
                <select className={`col-span-2 ${inputCls}`} value={formData.status || 'UPCOMING'} onChange={e => handleFormDataChange('status', e.target.value)}>
                  <option>LIVE</option>
                  <option>UPCOMING</option>
                  <option>ENDING SOON</option>
                </select>
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
                  <div
                    key={event.id}
                    onClick={() => toggleExpanded(`event-${event.id}`)}
                    className="cursor-pointer bg-gradient-to-br from-slate-800/40 to-slate-800/20 border border-amber-900/30 rounded-xl overflow-hidden hover:border-amber-600/50 transition-all"
                  >
                    <div className="relative h-48 bg-gradient-to-b from-slate-700 to-slate-800 overflow-hidden">
                      {event.image && <img src={event.image} alt={event.title} className="w-full h-full object-cover" />}
                      <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold ${event.status === 'LIVE' ? 'bg-green-600/80' : 'bg-blue-600/80'}`}>{event.status}</div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-lg text-amber-300">{event.title}</h3>
                        <ChevronDown size={20} className={`transition-transform ${expandedItems[`event-${event.id}`] ? 'rotate-180' : ''}`} />
                      </div>
                      <p className="text-sm text-slate-300 mb-3">{event.description}</p>
                      {expandedItems[`event-${event.id}`] && (
                        <div className="border-t border-amber-900/30 pt-4 mt-4">
                          <p className="text-sm text-slate-200 mb-4">{event.details}</p>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <button onClick={e => { e.stopPropagation(); startEditEvent(event); }} className="flex-1 px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center justify-center gap-1">
                                <Edit3 size={14} /> Edit
                              </button>
                              <button onClick={e => { e.stopPropagation(); deleteEvent(event.id); }} className="flex-1 px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center justify-center gap-1">
                                <Trash2 size={14} /> Delete
                              </button>
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

        {/* ── CODES ── */}
        {activeTab === 'codes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">Codes</h2>
              {isAdmin && (
                <button onClick={startAddCode} className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all">
                  <Plus size={18} /> Add
                </button>
              )}
            </div>

            {isAdmin && (addingNew === 'code' || editingId?.startsWith('code-')) && (
              <EditForm title={editingId ? 'Edit Code' : 'Add New Code'} onSave={saveCode}>
                <input className={`col-span-2 ${inputCls} font-mono`} placeholder="Code (e.g., SXSPARTNER)" value={formData.code || ''} onChange={e => handleFormDataChange('code', e.target.value.toUpperCase())} />
                <input className={`col-span-2 ${inputCls}`} placeholder="Reward description" value={formData.reward || ''} onChange={e => handleFormDataChange('reward', e.target.value)} />
                <input className={`col-span-2 ${inputCls}`} placeholder="Location (e.g., In-Game)" value={formData.location || ''} onChange={e => handleFormDataChange('location', e.target.value)} />
              </EditForm>
            )}

            <div className="bg-blue-950/30 border border-blue-700/30 rounded-xl p-5 mb-6">
              <p className="text-blue-200 text-sm flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">ℹ️</span>
                <span>Redeem codes in-game at: <strong>Home → Main Menu → User Center → Gift Code</strong></span>
              </p>
            </div>

            <div className="grid gap-4">
              {codes.map((code) => (
                <div key={code.id} className="bg-gradient-to-r from-slate-800/40 to-slate-800/20 border border-amber-900/30 rounded-xl p-5 hover:border-amber-600/50 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-lg font-bold text-amber-300 font-mono tracking-wider bg-slate-900/50 px-3 py-2 rounded border border-amber-600/30">
                          {code.code}
                        </code>
                        <span className="px-2 py-1 bg-green-600/30 text-green-300 text-xs font-bold rounded border border-green-600/50">{code.location}</span>
                      </div>
                      <p className="text-slate-300 text-sm">{code.reward}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all whitespace-nowrap"
                      >
                        {copiedCode === code.code ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy</>}
                      </button>
                      {isAdmin && (
                        <>
                          <button onClick={() => startEditCode(code)} className="px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center gap-1">
                            <Edit3 size={14} /> Edit
                          </button>
                          <button onClick={() => deleteCode(code.id)} className="px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center gap-1">
                            <Trash2 size={14} /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GUIDE ── */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">Guide</h2>
              {isAdmin && (
                <button onClick={startAddGuide} className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all">
                  <Plus size={18} /> Add
                </button>
              )}
            </div>

            {isAdmin && (addingNew === 'guide' || editingId?.startsWith('guide-')) && (
              <EditForm title={editingId ? 'Edit Guide' : 'Add New Guide'} onSave={saveGuide}>
                <input className={`col-span-2 ${inputCls}`} placeholder="Title" value={formData.title || ''} onChange={e => handleFormDataChange('title', e.target.value)} />
                <textarea className={`col-span-2 ${inputCls} h-32`} placeholder="Content" value={formData.content || ''} onChange={e => handleFormDataChange('content', e.target.value)} />
              </EditForm>
            )}

            {guides.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">No guides yet.{isAdmin && ' Click "Add" to get started!'}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {guides.map((guide) => (
                  <div key={guide.id} className="bg-gradient-to-br from-slate-800/40 to-slate-800/20 border border-amber-900/30 rounded-xl p-6 hover:border-amber-600/50 transition-all">
                    <h3 className="font-bold text-lg text-amber-300 mb-3">{guide.title}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed mb-4">{guide.content}</p>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button onClick={() => startEditGuide(guide)} className="flex-1 px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center justify-center gap-1">
                          <Edit3 size={14} /> Edit
                        </button>
                        <button onClick={() => deleteGuide(guide.id)} className="flex-1 px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center justify-center gap-1">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CUSTOM SECTIONS ── */}
        {!['classes', 'events', 'codes', 'guide', 'settings'].includes(activeTab) && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
                {sections.find(s => s.id === activeTab)?.name || 'Section'}
              </h2>
              {isAdmin && (
                <button onClick={() => startAddCustomItem(activeTab)} className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all">
                  <Plus size={18} /> Add
                </button>
              )}
            </div>

            {isAdmin && (addingNew?.startsWith('custom-') || editingId?.startsWith('custom-item-')) && (
              <EditForm title={editingId ? 'Edit Item' : 'Add New Item'} onSave={saveCustomItem}>
                <input className={`col-span-2 ${inputCls}`} placeholder="Title" value={formData.title || ''} onChange={e => handleFormDataChange('title', e.target.value)} />
                <input className={inputCls} placeholder="Role/Type (optional)" value={formData.role || ''} onChange={e => handleFormDataChange('role', e.target.value)} />
                <input className={inputCls} placeholder="Image URL (optional)" value={formData.image || ''} onChange={e => handleFormDataChange('image', e.target.value)} />
                <div className="col-span-2 flex items-center gap-2">
                  <label className="flex-1 px-4 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded-lg font-semibold text-sm cursor-pointer border border-blue-600/50 flex items-center justify-center gap-2">
                    📁 Upload Image
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {formData.image && formData.image.startsWith('data:') && <span className="text-green-400 text-sm">✓ Image selected</span>}
                </div>
                <textarea className={`col-span-2 ${inputCls} h-20`} placeholder="Description" value={formData.description || ''} onChange={e => handleFormDataChange('description', e.target.value)} />
                <textarea className={`col-span-2 ${inputCls} h-24`} placeholder="Details/Content" value={formData.content || ''} onChange={e => handleFormDataChange('content', e.target.value)} />
              </EditForm>
            )}

            {(!customSectionItems[activeTab] || customSectionItems[activeTab].length === 0) ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">No items yet.{isAdmin && ' Click "Add" to get started!'}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {customSectionItems[activeTab].map((item) => (
                  <div key={item.id} className="cursor-pointer bg-gradient-to-br from-slate-800/40 to-slate-800/20 border border-amber-900/30 rounded-xl overflow-hidden hover:border-amber-600/50 transition-all">
                    {item.image && (
                      <div className="relative h-48 bg-gradient-to-b from-slate-700 to-slate-800 overflow-hidden">
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                        {item.role && <div className="absolute top-3 right-3 px-3 py-1 bg-blue-600/80 rounded-full text-xs font-bold">{item.role}</div>}
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="font-bold text-lg text-amber-300 mb-2">{item.title}</h3>
                      {item.description && <p className="text-sm text-slate-300 mb-3">{item.description}</p>}
                      {item.content && <p className="text-sm text-slate-400 leading-relaxed mb-4">{item.content}</p>}
                      {isAdmin && (
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => startEditCustomItem(activeTab, item.id)} className="flex-1 px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center justify-center gap-1">
                            <Edit3 size={14} /> Edit
                          </button>
                          <button onClick={() => deleteCustomItem(activeTab, item.id)} className="flex-1 px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center justify-center gap-1">
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {activeTab === 'settings' && isAdmin && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black bg-gradient-to-r from-purple-300 to-pink-500 bg-clip-text text-transparent">Admin Settings</h2>

            {/* Stats */}
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-6">
              <h3 className="font-bold text-lg text-slate-300 mb-4">Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Classes', count: classes.length },
                  { label: 'Events', count: events.length },
                  { label: 'Codes', count: codes.length },
                  { label: 'Guides', count: guides.length },
                ].map(({ label, count }) => (
                  <div key={label} className="bg-slate-700/30 rounded p-4">
                    <p className="text-slate-500 text-sm">Total {label}</p>
                    <p className="text-2xl font-bold text-amber-300">{count}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Manage Sections */}
            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-300">Manage Sections</h3>
                {!addingNewSection && !editingSectionId && (
                  <button onClick={addSection} className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all">
                    <Plus size={18} /> Add Section
                  </button>
                )}
              </div>

              {/* Add/Edit Section Form */}
              {(addingNewSection || editingSectionId) && (
                <div className="bg-slate-800/50 border border-green-600/30 rounded-lg p-4 mb-6">
                  <h4 className="font-bold text-green-300 mb-4">{editingSectionId ? 'Edit Section' : 'Add New Section'}</h4>
                  <div className="space-y-4">
                    <input
                      className={inputCls}
                      placeholder="Section Name (e.g., Shop, Events, Patch Notes)"
                      value={sectionFormData.name || ''}
                      onChange={e => handleSectionFormChange('name', e.target.value)}
                    />
                    <div className="flex items-center gap-3 bg-slate-700/30 p-3 rounded-lg">
                      <input
                        type="checkbox"
                        checked={sectionFormData.visible !== false}
                        onChange={e => handleSectionFormChange('visible', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label className="text-slate-300 text-sm">Visible in Navigation</label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveSection}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold flex items-center justify-center gap-2"
                      >
                        <Save size={16} /> Save
                      </button>
                      <button
                        onClick={cancelSectionEdit}
                        className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sections List */}
              <div className="space-y-2">
                {sections.length === 0 ? (
                  <p className="text-slate-400 text-sm">No sections. Add one to get started!</p>
                ) : (
                  sections.map(section => (
                    <div key={section.id} className="bg-slate-700/30 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => toggleSectionVisibility(section.id)}
                          className={`px-3 py-1 rounded text-xs font-bold ${section.visible ? 'bg-green-600/40 text-green-300' : 'bg-slate-600/40 text-slate-400'}`}
                        >
                          {section.visible ? '👁️ Visible' : '👁️‍🗨️ Hidden'}
                        </button>
                        <span className="text-white font-semibold">{section.name}</span>
                        <code className="text-slate-400 text-xs bg-slate-900/50 px-2 py-1 rounded">{section.id}</code>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => editSection(section)}
                          className="px-3 py-1 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center gap-1"
                        >
                          <Edit3 size={14} /> Edit
                        </button>
                        <button
                          onClick={() => deleteSection(section.id)}
                          className="px-3 py-1 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center gap-1"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-amber-900/20 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-sm">
            Made by <span className="text-amber-300 font-semibold">realdrizzyrev</span>, <span className="text-amber-300 font-semibold">qy_maple</span>
          </p>
          <a
            href="https://discord.gg/QYmQKxVW3K"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
          >
            💜 Join Discord Server
          </a>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        h1, h2, h3, h4, h5, h6 { font-family: 'Orbitron', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}
