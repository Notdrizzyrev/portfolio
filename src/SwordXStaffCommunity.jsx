import React, { useState } from 'react';
import { Copy, Check, LogOut, Edit3, Save, X, Plus, Trash2, Lock, Eye, EyeOff, ChevronDown, Settings } from 'lucide-react';

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

  // Section Management
  const [sections, setSections] = useState([
    { id: 'classes', name: 'Classes', visible: true },
    { id: 'events', name: 'Events', visible: true },
    { id: 'codes', name: 'Codes', visible: true },
    { id: 'guide', name: 'Guide', visible: true },
  ]);

  const [codes, setCodes] = useState([
    { id: 1, code: 'SXSPARTNER', reward: 'Partner Rewards', location: 'In-Game' },
    { id: 2, code: 'CARBOTANIMATIONS', reward: 'Creator Rewards', location: 'In-Game' },
    { id: 3, code: 'SXSAMBASSADOR', reward: 'Ambassador Rewards', location: 'In-Game' },
    { id: 4, code: 'SXSCREATOR', reward: 'Creator Rewards', location: 'In-Game' },
    { id: 5, code: 'SXSREDDIT', reward: 'Community Rewards', location: 'In-Game' },
    { id: 6, code: 'SS000', reward: 'In-Game Rewards', location: 'In-Game' },
    { id: 7, code: 'SS888', reward: 'In-Game Rewards', location: 'In-Game' },
    { id: 8, code: 'ZJ888', reward: 'In-Game Rewards', location: 'In-Game' },
    { id: 9, code: 'ZJ999', reward: 'In-Game Rewards', location: 'In-Game' },
    { id: 10, code: 'SS999', reward: 'In-Game Rewards', location: 'In-Game' },
    { id: 11, code: 'ZJ777', reward: 'In-Game Rewards', location: 'In-Game' },
    { id: 12, code: 'SS777', reward: 'In-Game Rewards', location: 'In-Game' },
  ]);

  const [classes, setClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [guides, setGuides] = useState([]);

  // Admin State
  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(null);
  const [formData, setFormData] = useState({});

  const ADMIN_PASSWORD = 'SxSSwordXStaffAdminYoutubeKingAuraFarmingWebsiteWeOwnOnlyAdminsDONTLETPEOPLEUSETHISATALLLEAKTHISUWILLGETPERMBANND';
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 300;

  const logAction = (actionType, category, itemName, details = '') => {
    const timestamp = new Date();
    const logEntry = {
      id: adminLogs.length + 1,
      actionType,
      category,
      itemName,
      details,
      timestamp: timestamp.toLocaleString(),
      time: timestamp.toLocaleTimeString()
    };
    setAdminLogs(prev => [logEntry, ...prev]);
  };

  const handleLogin = () => {
    if (lockoutTime > 0) {
      alert(`Too many failed attempts. Try again in ${lockoutTime} seconds.`);
      return;
    }

    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowLogin(false);
      setPassword('');
      setFailedAttempts(0);
      setLockoutTime(0);
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setPassword('');
      
      if (newAttempts >= MAX_ATTEMPTS) {
        setLockoutTime(LOCKOUT_DURATION);
        alert(`❌ LOCKED OUT! Too many failed attempts. Try again in ${LOCKOUT_DURATION} seconds.`);
        
        const interval = setInterval(() => {
          setLockoutTime(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        alert(`❌ Incorrect password. Attempts remaining: ${MAX_ATTEMPTS - newAttempts}`);
      }
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setPassword('');
    setEditingId(null);
    setAddingNew(null);
    setFormData({});
  };

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ===== SECTION MANAGEMENT =====
  const deleteSection = (sectionId) => {
    if (confirm(`Are you sure you want to DELETE the "${sections.find(s => s.id === sectionId)?.name}" section and ALL its data?`)) {
      setSections(sections.filter(s => s.id !== sectionId));
      
      // Delete all data in that section
      if (sectionId === 'classes') setClasses([]);
      if (sectionId === 'events') setEvents([]);
      if (sectionId === 'codes') setCodes([]);
      if (sectionId === 'guide') setGuides([]);
      
      logAction('DELETE', 'SECTION', sections.find(s => s.id === sectionId)?.name, `Deleted entire section`);
      
      // Switch to a different tab if current is deleted
      if (activeTab === sectionId) {
        const remaining = sections.filter(s => s.id !== sectionId)[0];
        setActiveTab(remaining?.id || 'classes');
      }
    }
  };

  const toggleSectionVisibility = (sectionId) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, visible: !s.visible } : s
    ));
  };

  const renameSectionInit = (section) => {
    setEditingId(`section-${section.id}`);
    setFormData({ sectionName: section.name });
  };

  const renameSection = () => {
    const sectionId = editingId.split('-')[1];
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, name: formData.sectionName } : s
    ));
    logAction('EDIT', 'SECTION', formData.sectionName, `Renamed section to: ${formData.sectionName}`);
    setEditingId(null);
    setFormData({});
  };

  // ===== CODE MANAGEMENT =====
  const startEditCode = (code) => {
    setEditingId(`code-${code.id}`);
    setFormData({...code});
  };

  const startAddCode = () => {
    setAddingNew('code');
    setFormData({ code: '', reward: '', location: 'In-Game' });
  };

  const saveCode = () => {
    if (editingId && editingId.startsWith('code-')) {
      const id = parseInt(editingId.split('-')[1]);
      setCodes(codes.map(c => c.id === id ? formData : c));
      logAction('EDIT', 'CODE', formData.code, `Updated code: ${formData.code}`);
    } else if (addingNew === 'code') {
      const newId = codes.length > 0 ? Math.max(...codes.map(c => c.id)) + 1 : 1;
      setCodes([...codes, { ...formData, id: newId }]);
      logAction('ADD', 'CODE', formData.code, `Created new code: ${formData.code}`);
    }
    setEditingId(null);
    setAddingNew(null);
    setFormData({});
  };

  const deleteCode = (id) => {
    const codeToDelete = codes.find(c => c.id === id);
    setCodes(codes.filter(c => c.id !== id));
    logAction('DELETE', 'CODE', codeToDelete?.code, `Deleted code: ${codeToDelete?.code}`);
  };

  // ===== CLASS MANAGEMENT =====
  const startEditClass = (classItem) => {
    setEditingId(`class-${classItem.id}`);
    setFormData({...classItem});
  };

  const startAddClass = () => {
    setAddingNew('class');
    setFormData({ name: '', role: '', description: '', details: '', image: '' });
  };

  const saveClass = () => {
    if (editingId && editingId.startsWith('class-')) {
      const id = parseInt(editingId.split('-')[1]);
      setClasses(classes.map(c => c.id === id ? formData : c));
      logAction('EDIT', 'CLASS', formData.name, `Updated class: ${formData.name}`);
    } else if (addingNew === 'class') {
      const newId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 1;
      setClasses([...classes, { ...formData, id: newId }]);
      logAction('ADD', 'CLASS', formData.name, `Created new class: ${formData.name}`);
    }
    setEditingId(null);
    setAddingNew(null);
    setFormData({});
  };

  const deleteClass = (id) => {
    const classToDelete = classes.find(c => c.id === id);
    setClasses(classes.filter(c => c.id !== id));
    logAction('DELETE', 'CLASS', classToDelete?.name, `Deleted class: ${classToDelete?.name}`);
  };

  // ===== EVENT MANAGEMENT =====
  const startEditEvent = (event) => {
    setEditingId(`event-${event.id}`);
    setFormData({...event});
  };

  const startAddEvent = () => {
    setAddingNew('event');
    setFormData({ title: '', description: '', details: '', image: '', status: 'UPCOMING' });
  };

  const saveEvent = () => {
    if (editingId && editingId.startsWith('event-')) {
      const id = parseInt(editingId.split('-')[1]);
      setEvents(events.map(e => e.id === id ? formData : e));
      logAction('EDIT', 'EVENT', formData.title, `Updated event: ${formData.title}`);
    } else if (addingNew === 'event') {
      const newId = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;
      setEvents([...events, { ...formData, id: newId }]);
      logAction('ADD', 'EVENT', formData.title, `Created new event: ${formData.title}`);
    }
    setEditingId(null);
    setAddingNew(null);
    setFormData({});
  };

  const deleteEvent = (id) => {
    const eventToDelete = events.find(e => e.id === id);
    setEvents(events.filter(e => e.id !== id));
    logAction('DELETE', 'EVENT', eventToDelete?.title, `Deleted event: ${eventToDelete?.title}`);
  };

  // ===== GUIDE MANAGEMENT =====
  const startEditGuide = (guide) => {
    setEditingId(`guide-${guide.id}`);
    setFormData({...guide});
  };

  const startAddGuide = () => {
    setAddingNew('guide');
    setFormData({ title: '', content: '' });
  };

  const saveGuide = () => {
    if (editingId && editingId.startsWith('guide-')) {
      const id = parseInt(editingId.split('-')[1]);
      setGuides(guides.map(g => g.id === id ? formData : g));
      logAction('EDIT', 'GUIDE', formData.title, `Updated guide: ${formData.title}`);
    } else if (addingNew === 'guide') {
      const newId = guides.length > 0 ? Math.max(...guides.map(g => g.id)) + 1 : 1;
      setGuides([...guides, { ...formData, id: newId }]);
      logAction('ADD', 'GUIDE', formData.title, `Created new guide: ${formData.title}`);
    }
    setEditingId(null);
    setAddingNew(null);
    setFormData({});
  };

  const deleteGuide = (id) => {
    const guideToDelete = guides.find(g => g.id === id);
    setGuides(guides.filter(g => g.id !== id));
    logAction('DELETE', 'GUIDE', guideToDelete?.title, `Deleted guide: ${guideToDelete?.title}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Header */}
      <header className="relative border-b border-amber-900/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
              Sword X Staff
            </h1>
          </div>
          
          {!isAdmin ? (
            <button
              onClick={() => setShowLogin(!showLogin)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 hover:bg-amber-800/40 border border-amber-600/50 rounded-lg transition-all"
            >
              <Lock size={18} />
              Admin
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
                <LogOut size={18} />
                Logout
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
                  <p className="text-red-300 mb-2">Too many failed attempts</p>
                  <p className="text-red-400 text-sm font-mono">Retry in: {lockoutTime} seconds</p>
                </div>
              ) : (
                <div className="flex gap-4">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="Enter admin password"
                    className="px-4 py-2 bg-slate-800 border border-amber-600/30 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  <button
                    onClick={handleLogin}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg font-semibold transition-all"
                  >
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

        {/* Admin Logs Panel */}
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
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            log.actionType === 'ADD' ? 'bg-green-600/40 text-green-300' :
                            log.actionType === 'EDIT' ? 'bg-blue-600/40 text-blue-300' :
                            'bg-red-600/40 text-red-300'
                          }`}>
                            {log.actionType}
                          </span>
                          <span className="px-2 py-1 bg-amber-600/30 text-amber-300 rounded text-xs font-bold">
                            {log.category}
                          </span>
                          <span className="text-slate-300 font-semibold">{log.itemName}</span>
                        </div>
                        <p className="text-slate-400 text-sm">{log.details}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-slate-500 text-xs whitespace-nowrap">{log.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Navigation */}
      <nav className="relative sticky top-0 z-40 border-b border-amber-900/20 backdrop-blur-sm bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto">
            {sections.filter(s => s.visible).map(section => (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={`px-6 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-all ${
                  activeTab === section.id
                    ? 'text-amber-300 border-amber-400'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                {section.name}
              </button>
            ))}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-3 font-semibold text-sm whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'settings'
                    ? 'text-purple-300 border-purple-400'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <Settings size={16} />
                Settings
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-6 py-12">

        {/* CLASSES */}
        {activeTab === 'classes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
                Classes
              </h2>
              {isAdmin && (
                <button
                  onClick={startAddClass}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all"
                >
                  <Plus size={18} />
                  Add
                </button>
              )}
            </div>

            {isAdmin && (addingNew === 'class' || (editingId && editingId.startsWith('class-'))) && (
              <div className="bg-slate-800/50 border border-amber-600/30 rounded-xl p-6 mb-6">
                <h3 className="font-bold text-lg mb-4">{editingId ? 'Edit Class' : 'Add New Class'}</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Class Name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white"
                  />
                  <input
                    type="text"
                    placeholder="Role"
                    value={formData.role || ''}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white"
                  />
                  <input
                    type="text"
                    placeholder="Image URL"
                    value={formData.image || ''}
                    onChange={(e) => setFormData({...formData, image: e.target.value})}
                    className="px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white"
                  />
                  <textarea
                    placeholder="Description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white h-20"
                  />
                  <textarea
                    placeholder="Details"
                    value={formData.details || ''}
                    onChange={(e) => setFormData({...formData, details: e.target.value})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white h-24"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveClass}
                    className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold flex items-center gap-2"
                  >
                    <Save size={18} />
                    Save
                  </button>
                  <button
                    onClick={() => {setEditingId(null); setAddingNew(null); setFormData({});}}
                    className="px-6 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {classes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">No classes yet. {isAdmin && 'Click "Add" to get started!'}</p>
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
                      <img
                        src={cls.image}
                        alt={cls.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3 px-3 py-1 bg-blue-600/80 rounded-full text-xs font-bold">
                        {cls.role}
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-lg text-amber-300">{cls.name}</h3>
                        <ChevronDown
                          size={20}
                          className={`transition-transform ${expandedItems[`class-${cls.id}`] ? 'rotate-180' : ''}`}
                        />
                      </div>

                      <p className="text-sm text-slate-300 mb-3">{cls.description}</p>

                      {expandedItems[`class-${cls.id}`] && (
                        <div className="border-t border-amber-900/30 pt-4 mt-4">
                          <p className="text-sm text-slate-200 mb-4">{cls.details}</p>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {e.stopPropagation(); startEditClass(cls);}}
                                className="flex-1 px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center justify-center gap-1"
                              >
                                <Edit3 size={14} />
                                Edit
                              </button>
                              <button
                                onClick={(e) => {e.stopPropagation(); deleteClass(cls.id);}}
                                className="flex-1 px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center justify-center gap-1"
                              >
                                <Trash2 size={14} />
                                Delete
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

        {/* EVENTS */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
                Events
              </h2>
              {isAdmin && (
                <button
                  onClick={startAddEvent}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all"
                >
                  <Plus size={18} />
                  Add
                </button>
              )}
            </div>

            {isAdmin && (addingNew === 'event' || (editingId && editingId.startsWith('event-'))) && (
              <div className="bg-slate-800/50 border border-amber-600/30 rounded-xl p-6 mb-6">
                <h3 className="font-bold text-lg mb-4">{editingId ? 'Edit Event' : 'Add New Event'}</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Title"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white"
                  />
                  <input
                    type="text"
                    placeholder="Image URL"
                    value={formData.image || ''}
                    onChange={(e) => setFormData({...formData, image: e.target.value})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white"
                  />
                  <select
                    value={formData.status || 'UPCOMING'}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white"
                  >
                    <option>LIVE</option>
                    <option>UPCOMING</option>
                    <option>ENDING SOON</option>
                  </select>
                  <textarea
                    placeholder="Description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white h-20"
                  />
                  <textarea
                    placeholder="Details"
                    value={formData.details || ''}
                    onChange={(e) => setFormData({...formData, details: e.target.value})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white h-24"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveEvent}
                    className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold flex items-center gap-2"
                  >
                    <Save size={18} />
                    Save
                  </button>
                  <button
                    onClick={() => {setEditingId(null); setAddingNew(null); setFormData({});}}
                    className="px-6 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {events.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">No events yet. {isAdmin && 'Click "Add" to get started!'}</p>
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
                      <img
                        src={event.image}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                      <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold ${event.status === 'LIVE' ? 'bg-green-600/80' : 'bg-blue-600/80'}`}>
                        {event.status}
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-lg text-amber-300">{event.title}</h3>
                        <ChevronDown
                          size={20}
                          className={`transition-transform ${expandedItems[`event-${event.id}`] ? 'rotate-180' : ''}`}
                        />
                      </div>

                      <p className="text-sm text-slate-300 mb-3">{event.description}</p>

                      {expandedItems[`event-${event.id}`] && (
                        <div className="border-t border-amber-900/30 pt-4 mt-4">
                          <p className="text-sm text-slate-200 mb-4">{event.details}</p>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {e.stopPropagation(); startEditEvent(event);}}
                                className="flex-1 px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center justify-center gap-1"
                              >
                                <Edit3 size={14} />
                                Edit
                              </button>
                              <button
                                onClick={(e) => {e.stopPropagation(); deleteEvent(event.id);}}
                                className="flex-1 px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center justify-center gap-1"
                              >
                                <Trash2 size={14} />
                                Delete
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

        {/* CODES */}
        {activeTab === 'codes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
                Codes
              </h2>
              {isAdmin && (
                <button
                  onClick={startAddCode}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all"
                >
                  <Plus size={18} />
                  Add
                </button>
              )}
            </div>

            {isAdmin && (addingNew === 'code' || (editingId && editingId.startsWith('code-'))) && (
              <div className="bg-slate-800/50 border border-amber-600/30 rounded-xl p-6 mb-6">
                <h3 className="font-bold text-lg mb-4">{editingId ? 'Edit Code' : 'Add New Code'}</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Code (e.g., SXSPARTNER)"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Reward"
                    value={formData.reward || ''}
                    onChange={(e) => setFormData({...formData, reward: e.target.value})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white"
                  />
                  <input
                    type="text"
                    placeholder="Location"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="col-span-2 px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveCode}
                    className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold flex items-center gap-2"
                  >
                    <Save size={18} />
                    Save
                  </button>
                  <button
                    onClick={() => {setEditingId(null); setAddingNew(null); setFormData({});}}
                    className="px-6 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="bg-blue-950/30 border border-blue-700/30 rounded-xl p-5 mb-6">
              <p className="text-blue-200 text-sm flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">ℹ️</span>
                <span>Redeem codes in-game at: <strong>Home > Main Menu > User Center > Gift Code</strong></span>
              </p>
            </div>

            <div className="grid gap-4">
              {codes.map((code) => (
                <div
                  key={code.id}
                  className="bg-gradient-to-r from-slate-800/40 to-slate-800/20 border border-amber-900/30 rounded-xl p-5 hover:border-amber-600/50 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-lg font-bold text-amber-300 font-mono tracking-wider bg-slate-900/50 px-3 py-2 rounded border border-amber-600/30">
                          {code.code}
                        </code>
                        <span className="px-2 py-1 bg-green-600/30 text-green-300 text-xs font-bold rounded border border-green-600/50">
                          {code.location}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm">{code.reward}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all whitespace-nowrap"
                      >
                        {copiedCode === code.code ? (
                          <>
                            <Check size={16} />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            Copy
                          </>
                        )}
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => startEditCode(code)}
                            className="px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center gap-1"
                          >
                            <Edit3 size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCode(code.id)}
                            className="px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center gap-1"
                          >
                            <Trash2 size={14} />
                            Delete
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

        {/* GUIDE */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">
                Guide
              </h2>
              {isAdmin && (
                <button
                  onClick={startAddGuide}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600/40 hover:bg-green-600/60 border border-green-600 rounded-lg transition-all"
                >
                  <Plus size={18} />
                  Add
                </button>
              )}
            </div>

            {isAdmin && (addingNew === 'guide' || (editingId && editingId.startsWith('guide-'))) && (
              <div className="bg-slate-800/50 border border-amber-600/30 rounded-xl p-6 mb-6">
                <h3 className="font-bold text-lg mb-4">{editingId ? 'Edit Guide' : 'Add New Guide'}</h3>
                <div className="space-y-4 mb-4">
                  <input
                    type="text"
                    placeholder="Title"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white"
                  />
                  <textarea
                    placeholder="Content"
                    value={formData.content || ''}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-amber-600/30 rounded-lg text-white h-32"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveGuide}
                    className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold flex items-center gap-2"
                  >
                    <Save size={18} />
                    Save
                  </button>
                  <button
                    onClick={() => {setEditingId(null); setAddingNew(null); setFormData({});}}
                    className="px-6 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {guides.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">No guides yet. {isAdmin && 'Click "Add" to get started!'}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {guides.map((guide) => (
                  <div key={guide.id} className="bg-gradient-to-br from-slate-800/40 to-slate-800/20 border border-amber-900/30 rounded-xl p-6 hover:border-amber-600/50 transition-all">
                    <h3 className="font-bold text-lg text-amber-300 mb-3">{guide.title}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed mb-4">{guide.content}</p>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditGuide(guide)}
                          className="flex-1 px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center justify-center gap-1"
                        >
                          <Edit3 size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteGuide(guide.id)}
                          className="flex-1 px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center justify-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && isAdmin && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black bg-gradient-to-r from-purple-300 to-pink-500 bg-clip-text text-transparent">
              Admin Settings
            </h2>

            <div className="bg-purple-950/30 border border-purple-700/30 rounded-xl p-6">
              <h3 className="font-bold text-lg text-purple-300 mb-4">Manage Sections</h3>
              <p className="text-slate-400 text-sm mb-6">Add, edit, rename, or delete entire sections. Deleting a section will remove ALL its data.</p>

              <div className="space-y-3">
                {sections.map((section) => (
                  <div key={section.id} className="bg-slate-800/40 border border-purple-600/30 rounded-lg p-4 flex items-center justify-between gap-4">
                    {editingId === `section-${section.id}` ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={formData.sectionName || ''}
                          onChange={(e) => setFormData({...formData, sectionName: e.target.value})}
                          className="flex-1 px-3 py-2 bg-slate-700 border border-purple-600/30 rounded-lg text-white"
                          autoFocus
                        />
                        <button
                          onClick={renameSection}
                          className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {setEditingId(null); setFormData({});}}
                          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-200">{section.name}</h4>
                          <p className="text-slate-500 text-sm">ID: {section.id}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => renameSectionInit(section)}
                            className="px-3 py-2 bg-blue-600/40 hover:bg-blue-600/60 rounded text-sm flex items-center gap-1"
                          >
                            <Edit3 size={14} />
                            Rename
                          </button>
                          <button
                            onClick={() => deleteSection(section.id)}
                            className="px-3 py-2 bg-red-600/40 hover:bg-red-600/60 rounded text-sm flex items-center gap-1"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-6">
              <h3 className="font-bold text-lg text-slate-300 mb-4">Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                {sections.map((section) => {
                  let count = 0;
                  if (section.id === 'classes') count = classes.length;
                  if (section.id === 'events') count = events.length;
                  if (section.id === 'codes') count = codes.length;
                  if (section.id === 'guide') count = guides.length;
                  
                  return (
                    <div key={section.id} className="bg-slate-700/30 rounded p-4">
                      <p className="text-slate-500 text-sm">Total {section.name}</p>
                      <p className="text-2xl font-bold text-amber-300">{count}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-amber-900/20 backdrop-blur-sm mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <p className="text-slate-400 text-sm">Made by <span className="text-amber-300 font-semibold">realdrizzyrev</span>, <span className="text-amber-300 font-semibold">qy_maple</span></p>
            </div>
            <a
              href="https://discord.gg/QYmQKxVW3K"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
            >
              💜 Join Discord Server
            </a>
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Orbitron', system-ui, -apple-system, sans-serif;
        }
      `}</style>
    </div>
  );
}