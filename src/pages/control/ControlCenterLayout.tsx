import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { 
  Compass, 
  Layers, 
  Truck, 
  Navigation, 
  Activity, 
  Cpu, 
  BarChart3, 
  Boxes, 
  LogOut, 
  ShieldCheck, 
  Building2,
  MapPin,
  Menu,
  X
} from 'lucide-react';
import { ConfigBanner } from '../../components/common/ConfigBanner';

export const ControlCenterLayout: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);


  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { to: '/control', end: true, label: 'Overview', icon: Layers },
    { to: '/control/orders', end: false, label: 'Orders', icon: Boxes },
    { to: '/control/warehouses', end: false, label: 'Warehouses', icon: Building2 },
    { to: '/control/missions', end: false, label: 'Mission Control', icon: Activity },
    { to: '/control/live', end: false, label: 'Live Operations', icon: Navigation },
    { to: '/control/fleet', end: false, label: 'Fleet Registry', icon: Truck },
    { to: '/control/intelligence', end: false, label: 'Road Intelligence', icon: MapPin },
    { to: '/control/lab', end: false, label: 'AI Algorithm Lab', icon: Cpu },
    { to: '/control/analytics', end: false, label: 'Analytics & Events', icon: BarChart3 },
    { to: '/control/twin', end: false, label: '3D Digital Twin', icon: Compass },
  ];

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col text-slate-100 selection:bg-amber-500/30 overflow-x-hidden">
      <ConfigBanner />

      {/* Top Operational Bar */}
      <header className="h-14 border-b border-slate-800 bg-obsidian-950/90 backdrop-blur px-3 sm:px-4 flex items-center justify-between sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Mobile Drawer Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 rounded-lg bg-obsidian-900 border border-slate-800 text-slate-300 hover:text-white lg:hidden"
            aria-label="Toggle Navigation Drawer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-obsidian-850 border border-slate-700/80 text-logix-amber shrink-0">
            <Compass className="w-5 h-5 animate-[pulse_4s_ease-in-out_infinite]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-tech font-bold tracking-wider text-slate-100 text-base sm:text-lg">
              HYD<span className="text-logix-amber">-LOGIX</span>
            </span>
            <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-slate-400 hidden md:inline">
              Control Center
            </span>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 ml-4 px-2.5 py-1 rounded bg-obsidian-900 border border-slate-800 text-[11px] font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>GRID: 17.3850° N, 78.4867° E (HYDERABAD)</span>
          </div>
        </div>

        {/* Right Operator Identity & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-lg bg-obsidian-900 border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-xs font-medium text-slate-200 leading-tight truncate max-w-[100px] sm:max-w-[160px]">
                {profile?.full_name || user?.email?.split('@')[0] || 'Operator'}
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono text-amber-400/90 uppercase tracking-wider leading-tight flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                CONTROL_CENTER
              </span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-obsidian-900 hover:bg-obsidian-850 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 shrink-0"
            title="Terminate Operational Session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        </div>
      </header>

      {/* Main Container with Sidebar and Outlet */}
      <div className="flex-1 flex min-w-0">
        {/* Desktop Navigation Sidebar (lg+) */}
        <aside className="hidden lg:flex w-60 xl:w-64 border-r border-slate-800/80 bg-obsidian-950/70 p-4 flex-col justify-between shrink-0">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-slate-400 mb-3 px-2">
              Command Modules
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-amber-950/30 text-amber-300 border border-amber-800/60 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900 border border-transparent'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-logix-amber' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 px-2 font-mono text-[10px] text-slate-400 space-y-1">
            <div>ARCHITECTURE: RESPONSIVE CONTROL</div>
            <div>ROLE BOUND: CONTROL_CENTER</div>
            <div>STATUS: INITIALIZED</div>
          </div>
        </aside>

        {/* Mobile / Tablet Navigation Drawer (< lg) */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Mobile Drawer Container */}
            <aside className="relative z-50 w-72 max-w-[85vw] bg-obsidian-950 border-r border-slate-800 p-4 flex flex-col justify-between shadow-2xl h-full">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 font-tech font-bold text-slate-100 text-sm">
                    <Compass className="w-4 h-4 text-logix-amber" />
                    <span>COMMAND MODULES</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 rounded text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-amber-950/40 text-amber-300 border border-amber-800/60 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900 border border-transparent'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-logix-amber' : 'text-slate-500'}`} />
                            <span>{item.label}</span>
                          </div>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-800 font-mono text-[10px] text-slate-400 space-y-1">
                <div>HYD-LOGIX CONTROL CENTER</div>
                <div className="text-amber-400">MOBILE DRAWER ACTIVE</div>
              </div>
            </aside>
          </div>
        )}

        {/* Operational Workspace Viewport */}
        <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
