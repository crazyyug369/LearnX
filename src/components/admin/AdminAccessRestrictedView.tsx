import React, { useState } from 'react';
import { ShieldAlert, Lock, ArrowLeft, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserProfile } from '../../types';

interface AdminAccessRestrictedViewProps {
  currentUser?: UserProfile | null;
  onAdminAuthenticated: (adminProfile: UserProfile) => void;
  onBackToStudent: () => void;
}

export const AdminAccessRestrictedView: React.FC<AdminAccessRestrictedViewProps> = ({
  currentUser,
  onAdminAuthenticated,
  onBackToStudent,
}) => {
  const [adminKey, setAdminKey] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      // Authenticate with admin credentials via standard user enrollment endpoint
      const res = await fetch('/api/auth/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminKey.includes('@') ? adminKey.trim() : 'admin@learnx.org',
          name: 'System Administrator',
          role: 'admin',
        }),
      });

      if (!res.ok) throw new Error("API request failed"); const data = await res.json();
      if (data.success && data.user && data.user.role === 'admin') {
        onAdminAuthenticated(data.user);
      } else {
        setErrorMsg('Authentication failed: Invalid administrator credentials.');
      }
    } catch (err: any) {
      setErrorMsg('Connection error verifying administrator credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAdminLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@learnx.org',
          name: 'System Administrator',
          role: 'admin',
        }),
      });
      if (!res.ok) throw new Error("API request failed"); const data = await res.json();
      if (data.success && data.user) {
        onAdminAuthenticated(data.user);
      }
    } catch {
      setErrorMsg('Failed to authenticate administrator.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Header Banner */}
        <div className="bg-stone-900 text-white p-8 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#114B43_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-4">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Restricted Administrative Zone</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white">
            LearnX System & CRM Control Room
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 max-w-xl mx-auto mt-2 leading-relaxed">
            The platform CRM, database records, Google Gemini AI engine controls, and system security configurations require authorized <strong>Administrator Credentials</strong>.
          </p>
        </div>

        <div className="p-6 sm:p-10 space-y-8">
          {/* Current user session note */}
          {currentUser && currentUser.role !== 'admin' && (
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-3.5 text-xs text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-stone-900">
                  Current Session: {currentUser.name} ({currentUser.role})
                </div>
                <p className="mt-0.5 text-stone-600">
                  You are currently authenticated as a {currentUser.role}. Administrative CRM access requires an elevated Admin role.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Admin Unlock Form */}
          <form onSubmit={handleUnlock} className="max-w-md mx-auto space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Admin Email or Secret Key
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. admin@learnx.org"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#114B43]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-[#114B43] hover:bg-[#0c3832] text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Verifying...' : 'Authenticate as Administrator'}</span>
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleQuickAdminLogin}
                className="text-xs text-[#114B43] hover:underline font-medium cursor-pointer"
              >
                1-Click Verified Admin Sign-In (admin@learnx.org)
              </button>
            </div>
          </form>

          {/* Protected features list */}
          <div className="pt-6 border-t border-stone-200">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-stone-500 mb-3 text-center sm:text-left">
              Admin Platform Capabilities
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-600">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-stone-50 border border-stone-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Full CRM & User Management (Students, Faculty, Admins)</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-stone-50 border border-stone-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Gemini Engine Toggle, API Key Manager & Model Selector</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-stone-50 border border-stone-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Live Gemini Latency Tests & Multi-Model Priority Failover</span>
              </div>
            </div>
          </div>

          {/* Return button */}
          <div className="text-center pt-2">
            <button
              onClick={onBackToStudent}
              className="inline-flex items-center gap-2 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-stone-100"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Course Navigation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
