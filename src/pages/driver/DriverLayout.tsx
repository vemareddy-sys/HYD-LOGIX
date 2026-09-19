import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context';
import { 
  Navigation, 
  AlertTriangle, 
  CheckCircle, 
  History, 
  LogOut 
} from 'lucide-react';
import { ConfigBanner } from '../../components/common/ConfigBanner';

export const DriverLayout: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isNavigating = location.pathname.startsWith('/driver/navigation');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { to: '/driver', end: true, label: 'HOME', icon: Navigation },
    { to: '/driver/missions', end: false, label: 'MISSIONS', icon: CheckCircle },
    { to: '/driver/incidents', end: false, label: 'INCIDENTS', icon: AlertTriangle },
    { to: '/driver/logs', end: false, label: 'LOGS', icon: History },
  ];

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

      {/* Main Field Operations Content Viewport */}
      <main className={`flex-1 flex flex-col ${isNavigating ? 'h-[calc(100vh-3.5rem)] overflow-hidden' : 'pb-20'}`}>
        <Outlet />
      </main>

      {/* Driver Mobile Bottom Navigation Bar using NavLink (hidden during active navigation) */}
      {!isNavigating && (
        <nav className="fixed bottom-0 inset-x-0 bg-obsidian-950/95 border-t border-slate-800 backdrop-blur z-30">
          <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-mono transition-colors ${
                      isActive ? 'text-emerald-400 font-semibold' : 'text-slate-500 hover:text-slate-300'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};
