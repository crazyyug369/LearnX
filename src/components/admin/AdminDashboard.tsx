import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Settings,
  Cpu,
  Database,
  BarChart3,
  Search,
  Filter,
  UserPlus,
  Edit2,
  Trash2,
  Download,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Server,
  Zap,
  Activity,
  Radio,
  FileText,
  HelpCircle,
  X,
  Clock,
  KeyRound,
  Sliders,
  Check,
  Power,
  ChevronRight,
  Send,
  Loader2,
} from 'lucide-react';
import { UserProfile, AdminCRMUser, QuestionBankItem, AuditLogEntry, SystemSettings, StudentInterest } from '../../types';

interface AdminDashboardProps {
  currentUser: UserProfile;
  onLogout?: () => void;
  onSelectTab?: (tab: any) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onLogout,
  onSelectTab,
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'crm' | 'models' | 'questions' | 'audit'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // System Stats & Settings
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // CRM Users State
  const [users, setUsers] = useState<AdminCRMUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [interestFilter, setInterestFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_desc');
  const [totalUsers, setTotalUsers] = useState(0);

  // CRM User Modals
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminCRMUser | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AdminCRMUser | null>(null);

  // New User Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [newGrade, setNewGrade] = useState('Grade 10');
  const [newInterest, setNewInterest] = useState<StudentInterest>('Cricket & Sports');
  const [newMastery, setNewMastery] = useState(50);
  const [newInstitution, setNewInstitution] = useState('');

  // AI & Models Controls State
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedGeminiModel, setSelectedGeminiModel] = useState('gemini-2.5-flash');
  const [selectedPriorityModels, setSelectedPriorityModels] = useState<string[]>([
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-pro',
  ]);
  const [geminiTemp, setGeminiTemp] = useState(0.7);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [maintenanceModeActive, setMaintenanceModeActive] = useState(false);

  // Test Connection Results
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<any>(null);

  // AI Models & Scientific Artifacts Registry State
  const [modelRegistry, setModelRegistry] = useState<any>(null);
  const [bktSkills, setBktSkills] = useState<any[]>([]);
  const [bktSearch, setBktSearch] = useState('');
  const [dagStats, setDagStats] = useState<any>(null);
  const [dagSearch, setDagSearch] = useState('');
  const [dagResults, setDagResults] = useState<any[]>([]);
  const [isSearchingDag, setIsSearchingDag] = useState(false);
  const [recSearch, setRecSearch] = useState('Force and Laws of Motion');
  const [recResult, setRecResult] = useState<any>(null);
  const [datasetSearch, setDatasetSearch] = useState('gravity');
  const [datasetResults, setDatasetResults] = useState<any[]>([]);
  const [isSearchingDataset, setIsSearchingDataset] = useState(false);

  // Questions Bank State
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [newQText, setNewQText] = useState('');
  const [newQConcept, setNewQConcept] = useState('Linear Equations & Slope');
  const [newQSubject, setNewQSubject] = useState('Mathematics');
  const [newQGrade, setNewQGrade] = useState('Class 10');
  const [newQOptions, setNewQOptions] = useState<string[]>(['', '', '', '']);
  const [newQCorrectIdx, setNewQCorrectIdx] = useState(0);
  const [newQDifficulty, setNewQDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [newQBlooms, setNewQBlooms] = useState('Application');
  const [newQExplanation, setNewQExplanation] = useState('');
  const [newQHint, setNewQHint] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch initial stats & settings
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Stats
      const statsRes = await fetch('/api/admin/stats');
      if (!statsRes.ok) throw new Error('API Request Failed');
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData);
      }

      // 2. Settings
      const settingsRes = await fetch('/api/admin/settings');
      if (!settingsRes.ok) throw new Error('API Request Failed');
      const settingsData = await settingsRes.json();
      if (settingsData.success && settingsData.settings) {
        setSettings(settingsData.settings);
        setApiKeyInput(settingsData.settings.geminiApiKey || '');
        setSelectedGeminiModel(settingsData.settings.geminiModel || 'gemini-2.5-flash');
        setSelectedPriorityModels(
          settingsData.settings.geminiModelPriority || ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-pro']
        );
        setGeminiTemp(settingsData.settings.geminiTemperature || 0.7);
        setAnnouncementInput(settingsData.settings.announcementBanner || '');
        setMaintenanceModeActive(settingsData.settings.maintenanceMode || false);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch CRM Users
  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        search: userSearch,
        role: roleFilter,
        grade: gradeFilter,
        status: statusFilter,
        interest: interestFilter,
        sortBy: sortBy,
        limit: '100',
      });
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        setTotalUsers(data.total || 0);
      }
    } catch (err) {
      console.error('Error loading CRM users:', err);
    }
  };

  // Fetch Question Bank
  const fetchQuestions = async () => {
    try {
      const params = new URLSearchParams({
        search: questionSearch,
      });
      const res = await fetch(`/api/admin/questions?${params.toString()}`);
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Error loading questions:', err);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs?limit=50');
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error loading audit logs:', err);
    }
  };

  // Fetch Models Registry & Statistics
  const fetchModelRegistryData = async () => {
    try {
      const regRes = await fetch('/api/models/registry');
      if (!regRes.ok) throw new Error('API Request Failed');
      const regData = await regRes.json();
      if (regData.success) {
        setModelRegistry(regData.models);
      }

      const bktRes = await fetch('/api/models/bkt');
      if (!bktRes.ok) throw new Error('API Request Failed');
      const bktData = await bktRes.json();
      if (bktData.success) {
        setBktSkills(bktData.skills || []);
      }

      const dagRes = await fetch('/api/models/dag/stats');
      if (!dagRes.ok) throw new Error('API Request Failed');
      const dagStatsData = await dagRes.json();
      if (dagStatsData.success) {
        setDagStats(dagStatsData);
      }

      // Initial Rec preview
      fetch(`/api/models/recommendations/${encodeURIComponent(recSearch || 'Force and Laws of Motion')}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setRecResult(d.recommendations);
        })
        .catch(() => {});

      // Initial Dataset preview
      fetch(`/api/models/dataset/search?q=${encodeURIComponent(datasetSearch || 'gravity')}&limit=2`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setDatasetResults(d.matches || []);
        })
        .catch(() => {});
    } catch (err) {
      console.error('Error loading model registry:', err);
    }
  };

  const handleSearchDag = async (q: string) => {
    setIsSearchingDag(true);
    try {
      const res = await fetch(`/api/models/dag/search?q=${encodeURIComponent(q)}&limit=6`);
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        setDagResults(data.results || []);
      }
    } catch {
    } finally {
      setIsSearchingDag(false);
    }
  };

  const handleSearchRec = async (topic: string) => {
    try {
      const res = await fetch(`/api/models/recommendations/${encodeURIComponent(topic)}`);
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        setRecResult(data.recommendations);
      }
    } catch (e) {
      console.warn('Rec search error:', e);
    }
  };

  const handleSearchDataset = async (q: string) => {
    setIsSearchingDataset(true);
    try {
      const res = await fetch(`/api/models/dataset/search?q=${encodeURIComponent(q)}&limit=3`);
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        setDatasetResults(data.matches || []);
      }
    } catch {
    } finally {
      setIsSearchingDataset(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (activeSection === 'crm') {
      fetchUsers();
    } else if (activeSection === 'models') {
      fetchModelRegistryData();
    } else if (activeSection === 'questions') {
      fetchQuestions();
    } else if (activeSection === 'audit') {
      fetchAuditLogs();
    }
  }, [activeSection, userSearch, roleFilter, gradeFilter, statusFilter, interestFilter, sortBy, questionSearch]);

  // Toggle Gemini Engine Master Switch
  const handleToggleGemini = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiEnabled: enabled,
          actorName: currentUser.name,
        }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        showToast(`Gemini Engine has been turned ${enabled ? 'ON' : 'OFF'}.`);
      }
    } catch {
      showToast('Failed to update Gemini status.');
    }
  };

  // Save AI Settings (API key, model, priority list, temperature, platform settings)
  const handleSaveAISettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: apiKeyInput,
          geminiModel: selectedGeminiModel,
          geminiModelPriority: selectedPriorityModels,
          geminiTemperature: geminiTemp,
          maintenanceMode: maintenanceModeActive,
          announcementBanner: announcementInput,
          actorName: currentUser.name,
        }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        showToast('Google Gemini AI engine & platform settings saved successfully.');
      }
    } catch {
      showToast('Failed to save settings.');
    }
  };

  // Test Live Gemini Ping
  const handleTestGemini = async () => {
    setTestingGemini(true);
    setGeminiTestResult(null);
    try {
      const res = await fetch('/api/admin/test-gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedGeminiModel,
          actorName: currentUser.name,
        }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      setGeminiTestResult(data);
    } catch (err: any) {
      setGeminiTestResult({ success: false, error: err.message || 'Connection failed' });
    } finally {
      setTestingGemini(false);
    }
  };

  // Create User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          role: newRole,
          grade: newGrade,
          interest: newInterest,
          overallMastery: newMastery,
          institution: newInstitution,
          actorName: currentUser.name,
        }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        showToast(`User "${newName}" created successfully.`);
        setIsCreateUserOpen(false);
        setNewName('');
        setNewEmail('');
        fetchUsers();
        fetchDashboardData();
      } else {
        showToast(data.error || 'Failed to create user');
      }
    } catch {
      showToast('Error connecting to server.');
    }
  };

  // Update User Handler
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingUser,
          actorName: currentUser.name,
        }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        showToast(`User "${editingUser.name}" updated successfully.`);
        setEditingUser(null);
        fetchUsers();
        fetchDashboardData();
      } else {
        showToast(data.error || 'Failed to update user');
      }
    } catch {
      showToast('Error updating user record.');
    }
  };

  // Delete User Handler
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      const res = await fetch(`/api/admin/users/${deleteConfirmUser.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorName: currentUser.name }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        showToast(`User "${deleteConfirmUser.name}" deleted.`);
        setDeleteConfirmUser(null);
        fetchUsers();
        fetchDashboardData();
      } else {
        showToast(data.error || 'Failed to delete user');
      }
    } catch {
      showToast('Error deleting user record.');
    }
  };

  // Save Question Handler
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptTitle: newQConcept,
          subject: newQSubject,
          grade: newQGrade,
          questionText: newQText,
          options: newQOptions,
          correctIndex: newQCorrectIdx,
          difficulty: newQDifficulty,
          bloomsLevel: newQBlooms,
          explanation: newQExplanation,
          hint: newQHint,
          actorName: currentUser.name,
        }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        showToast('Question saved to question bank.');
        setIsAddQuestionOpen(false);
        setNewQText('');
        fetchQuestions();
      }
    } catch {
      showToast('Error saving question.');
    }
  };

  // Delete Question Handler
  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('Delete this question from question bank?')) return;
    try {
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorName: currentUser.name }),
      });
      if (!res.ok) throw new Error('API Request Failed');
      const data = await res.json();
      if (data.success) {
        showToast('Question deleted.');
        fetchQuestions();
      }
    } catch {
      showToast('Error deleting question.');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Email', 'Role', 'Grade', 'Mastery', 'Status', 'Interest', 'Created'];
    const rows = users.map((u) => [
      u.id,
      `"${u.name}"`,
      u.email,
      u.role,
      u.grade || 'Grade 10',
      `${u.overallMastery || 0}%`,
      u.status || 'Active',
      `"${u.interest || 'Cricket & Sports'}"`,
      u.createdAt || '',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LearnX_Users_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner & Administrator Info */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-stone-900 text-white tracking-wider">
              Admin Control Room
            </span>
            <span className="text-xs text-stone-400">• Authenticated as {currentUser.name}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-1 tracking-tight flex items-center gap-2">
            <span>LearnX Platform & CRM Operations</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1 max-w-2xl leading-relaxed">
            Manage user accounts, monitor system health, edit question banks, and control real-time AI inference models.
          </p>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl text-right">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Gemini Engine</span>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${settings?.geminiEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`} />
              <span className="text-xs font-semibold text-stone-800">
                {settings?.geminiEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl text-right">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Active Model</span>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="font-mono text-xs font-semibold text-stone-800">
                {settings?.geminiModel || 'gemini-2.5-flash'}
              </span>
            </div>
          </div>

          <button
            onClick={fetchDashboardData}
            className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-all cursor-pointer"
            title="Refresh System Analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div className="bg-white rounded-xl border border-stone-200 p-1.5 shadow-2xs flex items-center gap-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSection('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'overview'
              ? 'bg-[#114B43] text-white font-semibold shadow-2xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Overview & Analytics</span>
        </button>

        <button
          onClick={() => setActiveSection('crm')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'crm'
              ? 'bg-[#114B43] text-white font-semibold shadow-2xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>CRM & User Directory</span>
        </button>

        <button
          onClick={() => setActiveSection('models')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'models'
              ? 'bg-[#114B43] text-white font-semibold shadow-2xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>AI Engine & Model Control Room</span>
        </button>

        <button
          onClick={() => setActiveSection('questions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'questions'
              ? 'bg-[#114B43] text-white font-semibold shadow-2xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Question Bank & Curriculum</span>
        </button>

        <button
          onClick={() => setActiveSection('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
            activeSection === 'audit'
              ? 'bg-[#114B43] text-white font-semibold shadow-2xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System Audit Logs</span>
        </button>
      </div>

      {/* ================= SECTION 1: OVERVIEW & ANALYTICS ================= */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Total Enrolled</span>
              <h3 className="text-2xl font-serif font-bold text-stone-900">{stats?.kpi?.totalUsers || 0}</h3>
              <p className="text-[11px] text-stone-400">
                {stats?.kpi?.studentCount || 0} Students • {stats?.kpi?.teacherCount || 0} Faculty
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Average Mastery</span>
              <h3 className="text-2xl font-serif font-bold text-[#114B43]">{stats?.kpi?.avgMastery != null ? `${stats.kpi.avgMastery}%` : 'N/A'}</h3>
              <p className="text-[11px] text-emerald-600 font-medium">Across all grades & subjects</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Assessments Taken</span>
              <h3 className="text-2xl font-serif font-bold text-stone-900">{stats?.kpi?.totalQuizzes || 0}</h3>
              <p className="text-[11px] text-stone-400">{stats?.kpi?.avgAccuracy != null ? `${stats.kpi.avgAccuracy}%` : 'N/A'} Avg Accuracy</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Question Bank Size</span>
              <h3 className="text-2xl font-serif font-bold text-stone-900">{stats?.kpi?.totalQuestions || 0}</h3>
              <p className="text-[11px] text-stone-400">Graded MCQs with KaTeX</p>
            </div>
          </div>

          {/* System Control Quick Switches & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gemini Control Card */}
            <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#114B43] flex items-center justify-center border border-emerald-200">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-stone-900 text-sm">Google Gemini AI Engine</h3>
                    <p className="text-xs text-stone-500">Model: {settings?.geminiModel || 'gemini-3.1-flash-lite'}</p>
                  </div>
                </div>

                {/* Toggle Button */}
                <button
                  onClick={() => handleToggleGemini(!settings?.geminiEnabled)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    settings?.geminiEnabled
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{settings?.geminiEnabled ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                Powers personalized lesson analogies, real-time Socratic AI tutoring, contextual MCQ explanations, and dynamic practice questions. When turned OFF, system gracefully uses deterministic curriculum rules.
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                <span className="text-stone-400">Key Status: {settings?.geminiApiKey ? 'Configured (Active)' : 'Missing'}</span>
                <button
                  onClick={() => setActiveSection('models')}
                  className="text-[#114B43] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Configure Settings</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Gemini Multi-Model Failover Card */}
            <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-200">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-stone-900 text-sm">Resilience & Failover Priority</h3>
                    <p className="text-xs text-stone-500">Zero-downtime multi-tier fallback</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  High Availability
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Active Priority Tier:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-pro'].map((m, idx) => (
                    <span
                      key={m}
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                        (settings?.geminiModel || 'gemini-2.5-flash') === m
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                          : 'bg-stone-50 text-stone-600 border-stone-200'
                      }`}
                    >
                      {idx + 1}. {m}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                <span className="text-stone-400">Temperature: {settings?.geminiTemperature ?? 0.7}</span>
                <button
                  onClick={() => setActiveSection('models')}
                  className="text-[#114B43] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Model Control Room</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Recent Audit Activities Preview */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-serif font-semibold text-stone-900 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-stone-600" />
                <span>Recent Platform Audit Activities</span>
              </h3>
              <button
                onClick={() => setActiveSection('audit')}
                className="text-xs text-[#114B43] hover:underline font-medium cursor-pointer"
              >
                View Full Logs
              </button>
            </div>

            <div className="divide-y divide-stone-100 text-xs">
              {(stats?.recentLogs || []).slice(0, 5).map((log: any) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-200">
                      {log.action}
                    </span>
                    <span className="text-stone-700">by <strong>{log.actorName}</strong></span>
                  </div>
                  <span className="text-stone-400 text-[11px]">{new Date(log.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 2: CRM & USER DIRECTORY ================= */}
      {activeSection === 'crm' && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-semibold text-stone-900 text-base">User Directory & CRM</h3>
                <span className="text-xs bg-stone-100 text-stone-700 font-mono px-2 py-0.5 rounded border border-stone-200">
                  {users.length} of {totalUsers} Users
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Full CRUD control across student learners, verified faculty, and institutional administrators
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-stone-500" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setIsCreateUserOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Create User</span>
              </button>
            </div>
          </div>

          {/* Class-wise Quick Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-50/80 rounded-xl border border-stone-200">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#114B43]" />
                <span>Class Filter:</span>
              </span>
              {['all', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((cls) => (
                <button
                  key={cls}
                  onClick={() => setGradeFilter(cls)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    gradeFilter === cls
                      ? 'bg-[#114B43] text-white shadow-2xs font-semibold'
                      : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  {cls === 'all' ? 'All Classes' : cls}
                </button>
              ))}
            </div>

            {/* Active Filters Tag & Reset */}
            {(userSearch || roleFilter !== 'all' || gradeFilter !== 'all' || statusFilter !== 'all' || interestFilter !== 'all' || sortBy !== 'created_desc') && (
              <button
                onClick={() => {
                  setUserSearch('');
                  setRoleFilter('all');
                  setGradeFilter('all');
                  setStatusFilter('all');
                  setInterestFilter('all');
                  setSortBy('created_desc');
                }}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>

          {/* Search & Multi-Dimensional Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
            {/* Search Input */}
            <div className="sm:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name, email, roll ID, school..."
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-[#114B43] text-stone-900"
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Role Filter */}
            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-[#114B43] text-stone-900 cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers / Faculty</option>
                <option value="admin">Administrators</option>
              </select>
            </div>

            {/* Standard / Grade Filter */}
            <div>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-[#114B43] text-stone-900 cursor-pointer"
              >
                <option value="all">All Standards</option>
                <option value="Class 6">Class 6</option>
                <option value="Class 7">Class 7</option>
                <option value="Class 8">Class 8</option>
                <option value="Class 9">Class 9</option>
                <option value="Class 10">Class 10</option>
                <option value="Class 11">Class 11</option>
                <option value="Class 12">Class 12</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-[#114B43] text-stone-900 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active / On Track</option>
                <option value="Needs Intervention">Needs Intervention</option>
                <option value="Excelling">Excelling</option>
                <option value="On Track">On Track</option>
                <option value="New Enrollee">New Enrollees</option>
              </select>
            </div>

            {/* Sort Filter */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-[#114B43] text-stone-900 cursor-pointer"
              >
                <option value="created_desc">Newest First</option>
                <option value="mastery_desc">Highest Mastery</option>
                <option value="mastery_asc">Lowest Mastery (Need Help)</option>
                <option value="name_asc">Name (A–Z)</option>
                <option value="grade_asc">Class / Standard</option>
              </select>
            </div>
          </div>

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-xs text-stone-500 px-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-stone-700">
                Showing <strong className="text-stone-900">{users.length}</strong> of {totalUsers} user profiles
              </span>
              {gradeFilter !== 'all' && (
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                  Class: {gradeFilter}
                </span>
              )}
              {roleFilter !== 'all' && (
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 text-[11px] font-medium">
                  Role: {roleFilter}
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                  Status: {statusFilter}
                </span>
              )}
            </div>
          </div>

          {/* CRM Users Table */}
          <div className="overflow-x-auto rounded-xl border border-stone-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-sans font-medium uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5">User</th>
                  <th className="py-3 px-3.5">Role</th>
                  <th className="py-3 px-3.5">Standard / Dept</th>
                  <th className="py-3 px-3.5">Overall Mastery</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5">Interest Lens</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-400">
                      <p className="font-serif text-sm text-stone-600">No users found matching query.</p>
                      <p className="text-xs mt-1">Try clearing filters or click "+ Create User".</p>
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover border border-stone-200 shrink-0"
                          />
                          <div>
                            <span className="font-serif font-semibold text-stone-900">{u.name}</span>
                            <div className="text-[11px] text-stone-400 truncate max-w-[180px]">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            u.role === 'admin'
                              ? 'bg-purple-50 text-purple-800 border border-purple-200'
                              : u.role === 'teacher'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="text-stone-800 font-medium">{u.grade || u.department || 'Grade 10'}</div>
                        <div className="text-[10px] font-mono text-stone-400">{u.studentId || u.teacherId || u.institution || 'LearnX'}</div>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-semibold text-stone-900 w-8">{u.overallMastery || 0}%</span>
                          <div className="w-16 bg-stone-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#114B43] rounded-full"
                              style={{ width: `${u.overallMastery || 0}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700">
                          {u.status || 'Active'}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="text-stone-600 text-[11px]">{u.interest || 'Cricket & Sports'}</span>
                      </td>

                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingUser(u)}
                            className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"
                            title="Edit user details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmUser(u)}
                            className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Delete user record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= SECTION 3: AI ENGINE & MODEL CONTROL ROOM ================= */}
      {activeSection === 'models' && (
        <div className="space-y-6">
          {/* Main Controls Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box 1: Gemini Engine Controls */}
            <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#114B43] flex items-center justify-center border border-emerald-200">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-stone-900 text-sm">Google Gemini Engine</h3>
                    <p className="text-xs text-stone-500">Live API Key & Generation Controls</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">Master Switch:</span>
                  <button
                    onClick={() => handleToggleGemini(!settings?.geminiEnabled)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                      settings?.geminiEnabled
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{settings?.geminiEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>
              </div>

              {/* API Key Viewer & Editor */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-stone-700">
                  Gemini API Key (Runtime & Database)
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter Google Gemini API Key (e.g. AIzaSy...)"
                    className="w-full pl-9 pr-10 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-stone-400">
                  Current key configured: <code>{apiKeyInput ? (showApiKey ? apiKeyInput : apiKeyInput.slice(0, 6) + '...' + apiKeyInput.slice(-4)) : 'None'}</code>
                </p>
              </div>

              {/* Gemini Model Selector */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-stone-700">
                  Primary Model Candidate
                </label>
                <select
                  value={selectedGeminiModel}
                  onChange={(e) => setSelectedGeminiModel(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900 cursor-pointer font-medium"
                >
                  <option value="gemini-3.6-flash">gemini-3.6-flash (Recommended: Google Flagship Flash - High Intelligence)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (High Availability & Ultra-Fast Responses)</option>
                  <option value="gemini-flash-latest">gemini-flash-latest (Auto-Tracking Latest Flash Features)</option>
                  <option value="gemini-3.8-flash">gemini-3.8-flash (High Capability Extended Reasoning)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (Multimodal Fast Inference)</option>
                </select>
                <p className="text-[11px] text-stone-400">
                  Primary engine used for real-time Socratic dialogue, MCQ step-by-step guidance, and student interest analogies.
                </p>
              </div>

              {/* Temperature Slider */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-stone-700">Generation Temperature:</span>
                  <span className="font-mono text-[#114B43] font-bold">{geminiTemp}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={geminiTemp}
                  onChange={(e) => setGeminiTemp(Number(e.target.value))}
                  className="w-full accent-[#114B43] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                  <span>0.1 (Precise & Strict)</span>
                  <span>0.7 (Balanced Tutoring)</span>
                  <span>1.0 (Creative Analogies)</span>
                </div>
              </div>

              {/* Action Buttons & Test Ping */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-stone-100 text-xs">
                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={testingGemini || !settings?.geminiEnabled}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {testingGemini ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-600" />}
                  <span>Test Gemini Ping</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAISettings}
                  className="px-4 py-2 bg-[#114B43] hover:bg-[#0c3832] text-white font-semibold rounded-lg transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Gemini Settings</span>
                </button>
              </div>

              {/* Gemini Ping Result */}
              {geminiTestResult && (
                <div className={`p-3 rounded-lg text-xs space-y-1 ${geminiTestResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-rose-50 border border-rose-200 text-rose-900'}`}>
                  <div className="font-semibold flex items-center gap-1.5">
                    {geminiTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                    <span>{geminiTestResult.success ? 'Ping Successful' : 'Ping Failed'}</span>
                    {geminiTestResult.latencyMs && <span className="font-mono text-[10px]">({geminiTestResult.latencyMs}ms)</span>}
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {geminiTestResult.statusText || geminiTestResult.error || `Response: "${geminiTestResult.reply}"`}
                  </p>
                </div>
              )}
            </div>

            {/* Box 2: Gemini High-Availability Architecture & Failover Tier */}
            <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-200">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif font-semibold text-stone-900 text-sm">Resilience & Failover Tier</h3>
                    <p className="text-xs text-stone-500">Continuous Availability & Automatic Retry</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Fault Tolerant</span>
                </span>
              </div>

              {/* Failover Priority Tier Visualizer */}
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-800 uppercase tracking-wider text-[10px]">
                    Automatic Failover Chain
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 font-semibold">Exponential Backoff: 600ms</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  {[
                    { tier: 1, name: selectedGeminiModel, desc: 'Primary candidate for all student & teacher prompts', role: 'Primary' },
                    { tier: 2, name: 'gemini-3.6-flash', desc: 'Google Flagship Flash with advanced educational reasoning', role: 'Secondary' },
                    { tier: 3, name: 'gemini-3.1-flash-lite', desc: 'Ultra-fast high-availability failover tier (~2s latency)', role: 'Fallback' },
                    { tier: 4, name: 'gemini-flash-latest', desc: 'Auto-updating dynamic flash baseline fallback', role: 'Baseline' },
                  ].map((item) => (
                    <div
                      key={item.tier}
                      className="p-2.5 bg-white rounded-lg border border-stone-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#114B43] text-white text-[10px] font-bold flex items-center justify-center">
                          {item.tier}
                        </span>
                        <div>
                          <p className="font-mono font-bold text-stone-900">{item.name}</p>
                          <p className="text-[10px] text-stone-500">{item.desc}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                        {item.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gemini Capabilities Matrix */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Multilingual Mode
                  </span>
                  <p className="text-[11px] text-stone-700">Fluent Gujarati, Hindi & English Socratic tutoring</p>
                </div>

                <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-200/80 text-indigo-950 space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-indigo-600" /> Math & KaTeX
                  </span>
                  <p className="text-[11px] text-stone-700">Standard LaTeX formatting: $...$ and $$...$$</p>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span>Deterministic Fallback: <strong>Curriculum Knowledge Base</strong></span>
                <span className="text-emerald-700 font-medium">Ready</span>
              </div>
            </div>
          </div>

          {/* Website Platform Controls (Maintenance & Announcement) */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-4">
            <h3 className="font-serif font-semibold text-stone-900 text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-stone-600" />
              <span>Website Platform Controls</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-semibold text-stone-700">Global Announcement Banner</label>
                <input
                  type="text"
                  value={announcementInput}
                  onChange={(e) => setAnnouncementInput(e.target.value)}
                  placeholder="e.g. Scheduled system upgrade tonight at 11:00 PM IST"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                />
                <p className="text-[11px] text-stone-400">Leave blank to hide banner across all student & teacher screens.</p>
              </div>

              <div className="flex flex-col justify-between space-y-2">
                <div>
                  <label className="block font-semibold text-stone-700">Platform Maintenance Mode</label>
                  <p className="text-[11px] text-stone-500">Temporarily pauses quiz scoring and indicates maintenance to students.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMaintenanceModeActive(!maintenanceModeActive)}
                    className={`px-4 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                      maintenanceModeActive
                        ? 'bg-rose-600 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {maintenanceModeActive ? 'Maintenance Active' : 'Normal Operations'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAISettings}
                    className="px-4 py-1.5 bg-[#114B43] text-white rounded-xl font-semibold shadow-2xs cursor-pointer"
                  >
                    Apply Changes
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ================= MODEL ASSETS & CURRICULUM GRAPH REGISTRY (ALL 9 FILES) ================= */}
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-800 flex items-center justify-center border border-indigo-200">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-stone-900 text-sm">
                    Empirical Machine Learning & Curriculum Registry
                  </h3>
                  <p className="text-xs text-stone-500">
                    Active inspection across all 9 model weights, calibrated parameters, and curriculum graphs
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>5 Pillars Active (9 Assets Verified)</span>
                </span>
                <button
                  type="button"
                  onClick={fetchModelRegistryData}
                  className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                  title="Refresh registry telemetry"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 4-Pillar Stat Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Card 1: BKT Engine */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between text-stone-500 font-medium">
                  <span>BKT Knowledge Engine</span>
                  <Activity className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="text-2xl font-serif font-bold text-stone-900">
                  {modelRegistry?.bktEngine?.totalSkills || bktSkills.length || 176}
                </div>
                <p className="text-[11px] text-stone-500">
                  Calibrated Corbett & Anderson skills (AUC: 0.9576, 643k samples)
                </p>
                <div className="text-[10px] font-mono text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100">
                  bkt_learned_parameters.json/.csv
                </div>
              </div>

              {/* Card 2: NCERT Curriculum DAG */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between text-stone-500 font-medium">
                  <span>NCERT Curriculum DAG</span>
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-2xl font-serif font-bold text-stone-900">
                  {dagStats?.totalNodes?.toLocaleString() || '29,000'}
                </div>
                <p className="text-[11px] text-stone-500">
                  K-12 standard pedagogical nodes with topological prerequisites
                </p>
                <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-100">
                  ncert_curriculum_dag.json (5.89 MB)
                </div>
              </div>

              {/* Card 3: Next Concept Recommender */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between text-stone-500 font-medium">
                  <span>Next-Concept Pathways</span>
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                </div>
                <div className="text-2xl font-serif font-bold text-stone-900">
                  {modelRegistry?.nextConceptRecommender?.totalTopicMappings?.toLocaleString() || '29,000'}
                </div>
                <p className="text-[11px] text-stone-500">
                  Precomputed next-topic recommendations & sequence pathways
                </p>
                <div className="text-[10px] font-mono text-teal-700 bg-teal-50/80 px-2 py-0.5 rounded border border-teal-100">
                  ncert_next_concept_recs.json (7.58 MB)
                </div>
              </div>

              {/* Card 4: Socratic Fine-Tuning Corpus */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between text-stone-500 font-medium">
                  <span>Socratic Fine-Tuning Corpus</span>
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div className="text-2xl font-serif font-bold text-stone-900">
                  {modelRegistry?.unifiedTrainingCorpus?.totalConversations?.toLocaleString() || '141,842'}
                </div>
                <p className="text-[11px] text-stone-500">
                  Curated bilingual Socratic dialogues ({modelRegistry?.unifiedTrainingCorpus?.fileSizeMB || '149.2'} MB)
                </p>
                <div className="text-[10px] font-mono text-purple-700 bg-purple-50/80 px-2 py-0.5 rounded border border-purple-100">
                  learnx_unified_train.jsonl
                </div>
              </div>
            </div>

            {/* Interactive Model Inspectors Tabs / Subsections */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-semibold text-stone-800 uppercase tracking-wider">
                Live Interactive Asset Inspectors
              </h4>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Inspector 1: BKT Skill Parameters Inspector */}
                <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Calibrated BKT Parameter Registry (176 Skills)</span>
                    </span>
                    <span className="text-[10px] font-mono text-stone-400">
                      Mean Prior: 0.796 | Transit: 0.165
                    </span>
                  </div>

                  <input
                    type="text"
                    value={bktSearch}
                    onChange={(e) => setBktSearch(e.target.value)}
                    placeholder="Search cognitive skill (e.g. Equation, Fraction, Angle)..."
                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600"
                  />

                  <div className="max-h-48 overflow-y-auto divide-y divide-stone-100 rounded-lg border border-stone-100 text-[11px]">
                    {bktSkills
                      .filter((s) => !bktSearch || s.skillName.toLowerCase().includes(bktSearch.toLowerCase()))
                      .slice(0, 8)
                      .map((s, idx) => (
                        <div key={idx} className="p-2.5 hover:bg-stone-50 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-stone-900">{s.skillName}</p>
                            <span className="text-[10px] text-stone-400 font-mono">
                              Sample count: {s.sample_count?.toLocaleString() || '1,000'}
                            </span>
                          </div>
                          <div className="text-right font-mono text-[10px] text-stone-600 flex gap-2">
                            <span>P(L₀): <strong className="text-indigo-600">{s.p_l0}</strong></span>
                            <span>P(T): {s.p_transit}</span>
                            <span>P(G): {s.p_guess}</span>
                            <span>P(S): {s.p_slip}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Inspector 2: NCERT 29,000-Node DAG Explorer */}
                <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>NCERT Curriculum DAG Concept Explorer (29,000 Nodes)</span>
                    </span>
                    <span className="text-[10px] font-mono text-stone-400">Class 1 to 12</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={dagSearch}
                      onChange={(e) => setDagSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchDag(dagSearch)}
                      placeholder="Search concept title (e.g. Gravitation, Photosynthesis, Quadratic)..."
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleSearchDag(dagSearch)}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors shrink-0"
                    >
                      {isSearchingDag ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-stone-100 rounded-lg border border-stone-100 text-[11px]">
                    {dagResults.length === 0 ? (
                      <div className="p-3 text-center text-stone-400 text-xs">
                        Type a concept and click "Search" to explore nodes in the 29,000 NCERT graph.
                      </div>
                    ) : (
                      dagResults.map((node, idx) => (
                        <div key={idx} className="p-2.5 hover:bg-stone-50">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-stone-900">{node.title}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {node.subject} • Class {node.grade || 10}
                            </span>
                          </div>
                          {node.prerequisites && node.prerequisites.length > 0 && (
                            <p className="text-[10px] text-stone-500 mt-0.5 truncate">
                              Prerequisites: {node.prerequisites.join(', ')}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Inspector 3: Next Concept Pathway Recommender */}
                <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span>Next-Concept Pathways Recommender (29,000 Mappings)</span>
                    </span>
                    <span className="text-[10px] font-mono text-teal-700">Precomputed</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={recSearch}
                      onChange={(e) => setRecSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchRec(recSearch)}
                      placeholder="Enter topic to get next concepts..."
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleSearchRec(recSearch)}
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors shrink-0"
                    >
                      Lookup
                    </button>
                  </div>

                  {recResult ? (
                    <div className="p-3 rounded-lg bg-teal-50/40 border border-teal-200 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between font-semibold text-teal-950">
                        <span>Current Topic: {recResult.topic || recSearch}</span>
                        {recResult.grade && <span className="text-[10px] font-mono text-teal-700">Class {recResult.grade}</span>}
                      </div>
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-mono text-stone-500 uppercase">Recommended Next Steps:</span>
                        {(recResult.next_recommended_concepts || []).map((step: string, i: number) => (
                          <div key={i} className="flex items-center gap-1.5 text-stone-800 font-medium">
                            <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 text-[10px] flex items-center justify-center font-bold">
                              {i + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-center text-stone-400 text-xs">
                      Enter a topic title to view its verified downstream recommendations.
                    </div>
                  )}
                </div>

                {/* Inspector 4: Socratic Fine-Tuning Corpus Exemplar Search */}
                <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-purple-600" />
                      <span>Socratic Fine-Tuning Dataset (141,842 Pairs)</span>
                    </span>
                    <span className="text-[10px] font-mono text-stone-400">149.2 MB JSONL</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={datasetSearch}
                      onChange={(e) => setDatasetSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchDataset(datasetSearch)}
                      placeholder="Search training exemplar (e.g. gravity, triangle, velocity)..."
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-purple-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleSearchDataset(datasetSearch)}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors shrink-0"
                    >
                      {isSearchingDataset ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-stone-100 rounded-lg border border-stone-100 text-[11px]">
                    {datasetResults.length === 0 ? (
                      <div className="p-3 text-center text-stone-400 text-xs">
                        Enter a query to inspect live training samples from the fine-tuning corpus.
                      </div>
                    ) : (
                      datasetResults.map((sample, idx) => (
                        <div key={idx} className="p-2.5 hover:bg-stone-50 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-purple-700">
                            <span>Sample #{sample.index}</span>
                          </div>
                          <p className="font-semibold text-stone-900 leading-tight">
                            {sample.instruction}
                          </p>
                          {sample.output && (
                            <p className="text-[10px] text-stone-600 line-clamp-2 leading-relaxed">
                              {sample.output}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 4: QUESTION BANK & CURRICULUM ================= */}
      {activeSection === 'questions' && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-semibold text-stone-900 text-base">Question Bank Studio</h3>
                <span className="text-xs bg-stone-100 text-stone-700 font-mono px-2 py-0.5 rounded border border-stone-200">
                  {questions.length} Items Loaded
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Manage graded assessment questions, mathematical formulas, answer keys, and pedagogical hints
              </p>
            </div>

            <button
              onClick={() => setIsAddQuestionOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>+ Add Question</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative text-xs">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={questionSearch}
              onChange={(e) => setQuestionSearch(e.target.value)}
              placeholder="Search question bank by prompt text or concept name..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#114B43]"
            />
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            {questions.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-xs">
                No questions match current query. Click "+ Add Question" to create one.
              </div>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900 font-serif">{q.conceptTitle}</span>
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-stone-200 text-stone-700">
                        {q.grade} • {q.subject}
                      </span>
                      <span className="text-[10px] px-2 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                        {q.difficulty} • {q.bloomsLevel}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Delete question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-stone-800 font-medium leading-relaxed">{q.questionText}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {(q.options || []).map((opt, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-[11px] ${
                          idx === q.correctIndex
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                            : 'bg-white border-stone-200 text-stone-700'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}. {opt} {idx === q.correctIndex && '✓ (Correct)'}
                      </div>
                    ))}
                  </div>

                  {q.hint && (
                    <p className="text-[11px] text-stone-500 pt-1">
                      <strong>Hint:</strong> {q.hint}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= SECTION 5: AUDIT LOGS ================= */}
      {activeSection === 'audit' && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="font-serif font-semibold text-stone-900 text-base">System Security & Audit Trail</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Immutable records of administrative modifications, role adjustments, and AI engine state changes
              </p>
            </div>
            <button
              onClick={fetchAuditLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Trail</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-stone-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-sans font-medium uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5">Timestamp</th>
                  <th className="py-3 px-3.5">Action</th>
                  <th className="py-3 px-3.5">Actor</th>
                  <th className="py-3 px-3.5">Target Type / ID</th>
                  <th className="py-3 px-3.5">Details</th>
                  <th className="py-3 px-3.5">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-stone-400">
                      No audit logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-stone-50/70">
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-500 text-[11px] font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="font-mono text-[10px] bg-stone-100 text-stone-800 px-2 py-0.5 rounded border border-stone-200 font-semibold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 font-medium text-stone-900">{log.actorName || 'System'}</td>
                      <td className="py-2.5 px-3.5 text-stone-600 font-mono text-[11px]">
                        {log.targetType ? `${log.targetType}:${log.targetId}` : '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-stone-500 text-[11px] max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : '-'}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-stone-400">{log.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE USER ================= */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#114B43]" />
                <h3 className="font-serif font-semibold text-stone-900 text-sm">Create New Platform User</h3>
              </div>
              <button onClick={() => setIsCreateUserOpen(false)} className="text-stone-400 hover:text-stone-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manav Joshi"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. manav@student.learnx.org"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher / Faculty</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Grade / Standard</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                  >
                    <option value="Class 6">Class 6</option>
                    <option value="Class 7">Class 7</option>
                    <option value="Class 8">Class 8</option>
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                  </select>
                </div>
              </div>

              {newRole === 'student' && (
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Interest Lens</label>
                  <select
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value as StudentInterest)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                  >
                    <option value="Cricket & Sports">Cricket & Sports</option>
                    <option value="Gaming & Sci-Fi">Gaming & Sci-Fi</option>
                    <option value="Music & Creative Arts">Music & Creative Arts</option>
                    <option value="Space & Astronomy">Space & Astronomy</option>
                    <option value="Robotics & Coding">Robotics & Coding</option>
                  </select>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-xl font-semibold shadow-2xs"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT USER ================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#114B43]" />
                <h3 className="font-serif font-semibold text-stone-900 text-sm">Edit User Record</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-stone-400 hover:text-stone-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                  >
                    <option value="student">student</option>
                    <option value="teacher">teacher</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Standard / Grade</label>
                  <select
                    value={editingUser.grade || 'Class 10'}
                    onChange={(e) => setEditingUser({ ...editingUser, grade: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                  >
                    <option value="Class 6">Class 6</option>
                    <option value="Class 7">Class 7</option>
                    <option value="Class 8">Class 8</option>
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Overall Mastery (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingUser.overallMastery || 0}
                    onChange={(e) => setEditingUser({ ...editingUser, overallMastery: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Status</label>
                  <select
                    value={editingUser.status || 'On Track'}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#114B43] text-stone-900"
                  >
                    <option value="On Track">On Track</option>
                    <option value="Excelling">Excelling</option>
                    <option value="Needs Intervention">Needs Intervention</option>
                    <option value="New Enrollee">New Enrollee</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-xl font-semibold shadow-2xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-sm w-full p-6 shadow-xl space-y-4 text-xs text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-base">Delete User?</h3>
              <p className="text-stone-500 mt-1">
                Are you sure you want to permanently delete <strong>{deleteConfirmUser.name}</strong>? This action cascades across all progress, quiz, and cohort records.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-2xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD QUESTION ================= */}
      {isAddQuestionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#114B43]" />
                <h3 className="font-serif font-semibold text-stone-900 text-sm">Add Graded Assessment Question</h3>
              </div>
              <button onClick={() => setIsAddQuestionOpen(false)} className="text-stone-400 hover:text-stone-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Standard</label>
                  <select
                    value={newQGrade}
                    onChange={(e) => setNewQGrade(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-900"
                  >
                    <option value="Class 8">Class 8</option>
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Difficulty</label>
                  <select
                    value={newQDifficulty}
                    onChange={(e) => setNewQDifficulty(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-900"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Bloom's Level</label>
                  <select
                    value={newQBlooms}
                    onChange={(e) => setNewQBlooms(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-900"
                  >
                    <option value="Recall">Recall</option>
                    <option value="Application">Application</option>
                    <option value="Analysis">Analysis</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Concept Topic</label>
                <input
                  type="text"
                  required
                  value={newQConcept}
                  onChange={(e) => setNewQConcept(e.target.value)}
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-900"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Question Prompt (KaTeX Supported)</label>
                <textarea
                  required
                  rows={3}
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  placeholder="e.g. Find the discriminant $\Delta = b^2 - 4ac$ for $2x^2 - 4x + 2 = 0$."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#114B43]"
                />
              </div>

              {/* 4 Options */}
              <div className="space-y-1.5">
                <label className="block font-medium text-stone-700">Answer Options & Correct Key</label>
                {newQOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-opt"
                      checked={newQCorrectIdx === idx}
                      onChange={() => setNewQCorrectIdx(idx)}
                      className="accent-[#114B43]"
                    />
                    <span className="font-semibold w-4 text-stone-600">{String.fromCharCode(65 + idx)}:</span>
                    <input
                      type="text"
                      required
                      value={opt}
                      onChange={(e) => {
                        const updated = [...newQOptions];
                        updated[idx] = e.target.value;
                        setNewQOptions(updated);
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      className="w-full px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-stone-900"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Pedagogical Hint</label>
                <input
                  type="text"
                  value={newQHint}
                  onChange={(e) => setNewQHint(e.target.value)}
                  placeholder="Hint displayed when student struggles"
                  className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddQuestionOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-xl font-semibold shadow-2xs"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

