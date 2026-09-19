import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { 
  Compass, 
  Building2, 
  Layers, 
  Truck, 
  Navigation, 
  Activity, 
  Cpu, 
  BarChart3, 
  Boxes, 
  LogOut, 
  ShieldCheck, 
  MapPin,
  Clock
} from 'lucide-react';
import { ConfigBanner } from '../../components/common/ConfigBanner';

export const ControlCenterShell: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('overview');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Layers, status: 'Active (Phase 00 Shell)' },
    { id: 'orders', label: 'Orders', icon: Boxes, status: 'Upcoming Phase' },
    { id: 'missions', label: 'Mission Control', icon: Activity, status: 'Upcoming Phase' },
    { id: 'live-ops', label: 'Live Operations', icon: Navigation, status: 'Upcoming Phase' },
    { id: 'fleet', label: 'Fleet Registry', icon: Truck, status: 'Upcoming Phase' },
    { id: 'road-intel', label: 'Road Intelligence', icon: MapPin, status: 'Upcoming Phase' },
    { id: 'algo-lab', label: 'AI Algorithm Lab', icon: Cpu, status: 'Upcoming Phase' },
    { id: 'analytics', label: 'Analytics & Events', icon: BarChart3, status: 'Upcoming Phase' },
    { id: 'digital-twin', label: '3D Digital Twin', icon: Compass, status: 'Upcoming Phase' },
  ];

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col text-slate-100 selection:bg-amber-500/30">
      <ConfigBanner />

      {/* Top Operational Bar */}
      <header className="h-14 border-b border-slate-800 bg-obsidian-950/90 backdrop-blur px-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-obsidian-850 border border-slate-700/80 text-logix-amber">
            <Compass className="w-5 h-5 animate-[pulse_4s_ease-in-out_infinite]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-tech font-bold tracking-wider text-slate-100 text-lg">
              HYD<span className="text-logix-amber">-LOGIX</span>
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400 hidden sm:inline">
              Control Center Core
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 ml-4 px-2.5 py-1 rounded bg-obsidian-900 border border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>GRID: 17.3850° N, 78.4867° E (HYDERABAD)</span>
          </div>
        </div>

        {/* Right Operator Identity & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-obsidian-900 border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <div className="flex flex-col text-left">
              <span className="text-xs font-medium text-slate-200 leading-tight">
                {profile?.full_name || user?.email?.split('@')[0] || 'Operator'}
              </span>
              <span className="text-[10px] font-mono text-amber-400/90 uppercase tracking-wider leading-tight flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                CONTROL_CENTER
              </span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 rounded-lg bg-obsidian-900 hover:bg-obsidian-850 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
            title="Terminate Operational Session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        </div>
      </header>

      {/* Main Container with Sidebar and Canvas Area */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Navigation Sidebar */}
        <aside className="w-full md:w-64 border-r border-slate-800/80 bg-obsidian-950/70 p-4 flex flex-col justify-between shrink-0">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-slate-400 mb-3 px-2">
              Command Modules
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-amber-950/30 text-amber-300 border border-amber-800/60 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-logix-amber' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 px-2 font-mono text-[10px] text-slate-400 space-y-1">
            <div>ARCHITECTURE: LEVEL 00</div>
            <div>ROLE BOUND: CONTROL_CENTER</div>
            <div>STATUS: INITIALIZED</div>
          </div>
        </aside>

        {/* Operational Workspace Viewport */}
        <main className="flex-1 p-6 flex flex-col gap-6">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-950/60 text-amber-300 border border-amber-800/60">
                  Phase 00 Foundation
                </span>
                <span className="font-mono text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Realtime Session Active
                </span>
              </div>
              <h1 className="font-tech text-2xl font-bold uppercase tracking-wide text-slate-100 mt-1">
                Central Operations Terminal
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-obsidian-900 border border-slate-800 text-xs font-mono text-slate-300">
                AUTH: <span className="text-emerald-400">SUPABASE AUTHENTICATED</span>
              </div>
            </div>
          </div>

          {/* Clean architectural placeholder grid — strictly avoiding fake operational data/stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="panel-surface p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="tech-label">Access Boundary</span>
                  <Building2 className="w-4 h-4 text-logix-amber" />
                </div>
                <h3 className="font-tech text-base font-semibold text-slate-100">
                  Control Center Perimeter
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Strictly guarded by <code className="text-amber-400 font-mono">RoleGuard(['CONTROL_CENTER'])</code> and Supabase Row Level Security. Driver accounts are forbidden from entering or executing actions in this scope.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 font-mono text-[11px] text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Route Enforcement Active
              </div>
            </div>

            <div className="panel-surface p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="tech-label">Role Immutability</span>
                  <ShieldCheck className="w-4 h-4 text-logix-amber" />
                </div>
                <h3 className="font-tech text-base font-semibold text-slate-100">
                  Permanent Association
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Assigned at signup and locked via PostgreSQL trigger <code className="text-amber-400 font-mono">handle_profile_updates</code>. No manual role tampering is permitted.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 font-mono text-[11px] text-slate-400">
                USER ID: <span className="text-slate-300">{user?.id?.slice(0, 12)}...</span>
              </div>
            </div>

            <div className="panel-surface p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="tech-label">Road Network Scope</span>
                  <MapPin className="w-4 h-4 text-logix-amber" />
                </div>
                <h3 className="font-tech text-base font-semibold text-slate-100">
                  Hyderabad Urban Core
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Prepared for OpenStreetMap graph ingestion, A* search, uniform cost search, and live mission coordination in subsequent phases.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 font-mono text-[11px] text-amber-400/90">
                ROAD GRAPH: Pending Phase 01
              </div>
            </div>
          </div>

          {/* Module Architecture View */}
          <div className="panel-surface p-6">
            <h3 className="font-tech text-sm uppercase tracking-wider text-slate-300 mb-2">
              Platform Modules Specification
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              The HYD-LOGIX architecture separates data access, graph intelligence, and visualization engines.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { title: 'OSM Hyderabad Graph', desc: 'Real graph topology, node indexing, and edge weights.' },
                { title: 'Search Algorithm Lab', desc: 'BFS, Uniform Cost, Greedy Best-First, A* and Search X-Ray.' },
                { title: 'Mission & Fleet Engine', desc: 'Driver dispatch, mission lifecycle, and dynamic rerouting.' },
                { title: '2D & 3D Digital Twin', desc: 'Synchronized operational state across 2D map and 3D simulation.' },
              ].map((mod, i) => (
                <div key={i} className="p-3.5 rounded-lg bg-obsidian-950 border border-slate-800/80">
                  <div className="font-mono text-[11px] text-amber-500 font-semibold mb-1">
                    0{i + 1} // MODULE
                  </div>
                  <div className="font-tech text-xs font-semibold text-slate-200 mb-1">
                    {mod.title}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    {mod.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
