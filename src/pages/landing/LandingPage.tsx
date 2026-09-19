import React from 'react';
import { Link } from 'react-router-dom';
import { BrandHeader } from '../../components/common/BrandHeader';
import { 
  Building2, 
  Navigation, 
  ArrowRight, 
  Cpu, 
  MapPin, 
  Lock 
} from 'lucide-react';
import { ConfigBanner } from '../../components/common/ConfigBanner';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 selection:bg-amber-500/30 flex flex-col justify-between relative overflow-hidden">
      <ConfigBanner />

      {/* Subtle background technical grid */}
      <div 
        className="absolute inset-0 opacity-[0.025] pointer-events-none" 
        style={{ 
          backgroundImage: 'linear-gradient(#f59e0b 1px, transparent 1px), linear-gradient(90deg, #f59e0b 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} 
      />

      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-obsidian-950/70 backdrop-blur px-6 py-4 flex items-center justify-between relative z-10">
        <BrandHeader size="sm" subtitle="" />
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 rounded-lg text-xs font-mono text-slate-300 hover:text-white hover:bg-obsidian-850 transition-colors"
          >
            System Login
          </Link>
          <Link
            to="/signup"
            className="btn-primary text-xs font-semibold uppercase tracking-wider py-2 px-4"
          >
            Register Terminal
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-4 py-16 text-center relative z-10 flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-obsidian-900 border border-slate-700 text-xs font-mono text-slate-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>HYDERABAD ROAD GRAPH & LOGISTICS INTELLIGENCE</span>
        </div>

        <h1 className="font-tech text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight uppercase text-slate-100 max-w-3xl leading-[1.1]">
          Autonomous Delivery & <span className="text-logix-amber">Route Optimization</span>
        </h1>

        <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
          A high-precision urban logistics platform built on real Hyderabad OpenStreetMap road graph data, multi-paradigm AI search algorithms, dynamic rerouting, and strict operational role isolation.
        </p>

        {/* Two Discrete Role Portals */}
        <div className="mt-12 w-full grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* Terminal 1: Control Center */}
          <div className="panel-surface p-6 border-slate-800 hover:border-amber-500/40 transition-all duration-200 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-obsidian-850 border border-slate-700 text-logix-amber group-hover:bg-amber-950/40 transition-colors">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-obsidian-950 text-amber-400 border border-amber-900/50">
                ROLE: CONTROL_CENTER
              </span>
            </div>

            <h2 className="font-tech text-xl font-bold uppercase tracking-wide text-slate-100">
              Warehouse & Control Center
            </h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed min-h-[48px]">
              Full operational command over dispatch, fleet status, AI algorithm benchmarking (BFS, UCS, Greedy, A*), road incident analysis, and 3D digital twin synchronization.
            </p>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">Route: /control</span>
              <Link 
                to="/signup" 
                className="inline-flex items-center gap-1.5 text-xs font-mono text-logix-amber hover:text-amber-300 font-semibold"
              >
                <span>Initialize Operator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Terminal 2: Driver */}
          <div className="panel-surface p-6 border-slate-800 hover:border-emerald-500/40 transition-all duration-200 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-obsidian-850 border border-slate-700 text-emerald-400 group-hover:bg-emerald-950/40 transition-colors">
                <Navigation className="w-6 h-6" />
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-obsidian-950 text-emerald-400 border border-emerald-900/50">
                ROLE: DRIVER
              </span>
            </div>

            <h2 className="font-tech text-xl font-bold uppercase tracking-wide text-slate-100">
              Driver Mobile Terminal
            </h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed min-h-[48px]">
              Mobile-optimized field navigation, turn-by-turn routing, real-time incident broadcast, delivery checkpoint confirmations, and dynamic obstacle rerouting.
            </p>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-500">Route: /driver</span>
              <Link 
                to="/signup" 
                className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                <span>Register Driver</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Security & System Features */}
        <div className="mt-14 w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="p-4 rounded-xl bg-obsidian-950 border border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 mb-1">
              <Lock className="w-3.5 h-3.5 text-logix-amber" />
              <span>PERMANENT ROLES</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Strict role locking prevents accidental cross-boundary navigation and unauthorized operational commands.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-obsidian-950 border border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 mb-1">
              <Cpu className="w-3.5 h-3.5 text-logix-amber" />
              <span>SEARCH X-RAY</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Side-by-side graph inspection visualizing frontier expansion, heuristic evaluation, and memory metrics.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-obsidian-950 border border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 mb-1">
              <MapPin className="w-3.5 h-3.5 text-logix-amber" />
              <span>HYDERABAD TWIN</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Accurate OpenStreetMap coordinates with synchronized 2D tactical maps and 3D digital simulation.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-obsidian-950 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500 gap-2 relative z-10">
        <div>HYD-LOGIX PLATFORM · HYDERABAD LOGISTICS ARCHITECTURE 2026–2027</div>
        <div>AUTONOMOUS URBAN DISPATCH & ROUTE OPTIMIZATION</div>
      </footer>
    </div>
  );
};
