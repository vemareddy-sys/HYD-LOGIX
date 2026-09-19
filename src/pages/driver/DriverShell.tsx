import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { 
  Navigation, 
  AlertTriangle, 
  CheckCircle, 
  History, 
  LogOut, 
  ShieldCheck, 
  Compass,
  Radio
} from 'lucide-react';
import { ConfigBanner } from '../../components/common/ConfigBanner';

export const DriverShell: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'home' | 'missions' | 'incidents' | 'history'>('home');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col text-slate-100 selection:bg-amber-500/30">
      <ConfigBanner />

      {/* Driver Mobile-Optimized Top Bar */}
      <header className="h-14 border-b border-slate-800 bg-obsidian-950/95 px-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-obsidian-850 border border-slate-700/80 text-emerald-400">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-tech font-bold tracking-wider text-slate-100 text-sm">
                HYD<span className="text-emerald-400">-DRIVER</span>
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                FIELD OPS
              </span>
            </div>
          </div>
        </div>

        {/* Driver identity & sign out */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-obsidian-900 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
              {profile?.full_name || user?.email?.split('@')[0] || 'Driver'}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-lg bg-obsidian-900 hover:bg-obsidian-850 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Log Out of Driver Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Field Operations Container */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 flex flex-col gap-4 pb-20">
        {/* Driver Status Card */}
        <div className="panel-surface p-4 border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div>
              <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                Operational Terminal
              </div>
              <div className="font-tech text-base font-semibold text-slate-100">
                Field Navigator Unit
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-obsidian-950 border border-emerald-800/60 text-emerald-400">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              STANDBY
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded bg-obsidian-950 border border-slate-800/60">
              <div className="text-[10px] text-slate-500 uppercase">Sector</div>
              <div className="text-slate-200 font-medium">Hyderabad Urban</div>
            </div>
            <div className="p-2.5 rounded bg-obsidian-950 border border-slate-800/60">
              <div className="text-[10px] text-slate-500 uppercase">Clearance</div>
              <div className="text-emerald-400 font-medium">DRIVER BOUND</div>
            </div>
          </div>
        </div>

        {/* Security / Role Guard Confirmation */}
        <div className="panel-surface p-4 border-slate-800 bg-obsidian-900/40">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-tech text-xs uppercase font-semibold text-slate-200 tracking-wide">
                Role Boundary Active
              </h4>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                This account has permanent <code className="text-emerald-400 font-mono">DRIVER</code> clearance. Access to Control Center views (<code className="text-slate-300 font-mono">/control</code>) is strictly blocked by dual-layer guards.
              </p>
            </div>
          </div>
        </div>

        {/* Active Missions Area (Placeholder - Restrained, No Fake Statistics) */}
        <div className="panel-surface p-5 text-center flex flex-col items-center justify-center py-10">
          <div className="w-12 h-12 rounded-xl bg-obsidian-850 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
            <Compass className="w-6 h-6 text-emerald-500/70" />
          </div>
          <h3 className="font-tech text-sm font-semibold uppercase tracking-wider text-slate-200">
            No Active Dispatch
          </h3>
          <p className="mt-1.5 text-xs text-slate-400 max-w-xs leading-relaxed">
            Mission assignments from the Control Center will appear here once the routing engine and mission lifecycle are initiated in Phase 01.
          </p>
        </div>

        {/* Road Incident Reporting Quick Action Preview */}
        <div className="p-4 rounded-xl bg-obsidian-950 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-900/60 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-tech text-xs font-semibold text-slate-200">
                Road Incident Protocol
              </div>
              <div className="text-[11px] text-slate-500">
                Field blockage & congestion reporting
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-500 bg-obsidian-900 px-2 py-1 rounded border border-slate-800">
            Phase 03
          </span>
        </div>
      </main>

      {/* Driver Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-obsidian-950/95 border-t border-slate-800 backdrop-blur z-30">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-3">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-mono transition-colors ${
              activeTab === 'home' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>HOME</span>
          </button>

          <button
            onClick={() => setActiveTab('missions')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-mono transition-colors ${
              activeTab === 'missions' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>MISSIONS</span>
          </button>

          <button
            onClick={() => setActiveTab('incidents')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-mono transition-colors ${
              activeTab === 'incidents' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>INCIDENTS</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-mono transition-colors ${
              activeTab === 'history' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            <span>LOGS</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
