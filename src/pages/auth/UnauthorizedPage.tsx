import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context';
import { ShieldX, ArrowRight, LogOut, Lock } from 'lucide-react';
import { BrandHeader } from '../../components/common/BrandHeader';

export const UnauthorizedPage: React.FC = () => {
  const { role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as {
    attemptedPath?: string;
    userRole?: string;
    requiredRoles?: string[];
  } | null;

  const targetTerminal = role === 'CONTROL_CENTER' ? '/control' : '/driver';
  const roleTitle = role === 'CONTROL_CENTER' ? 'Control Center' : 'Driver Terminal';

  const handleReturnToTerminal = () => {
    navigate(targetTerminal, { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#070b12] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle structural grid lines */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ 
          backgroundImage: 'linear-gradient(#ef4444 1px, transparent 1px), linear-gradient(90deg, #ef4444 1px, transparent 1px)', 
          backgroundSize: '48px 48px' 
        }} 
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        <BrandHeader size="md" />
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg relative z-10 px-4">
        <div className="panel-surface p-8 border-rose-900/60 shadow-[0_0_30px_rgba(244,63,94,0.05)]">
          <div className="flex items-center gap-3 pb-5 border-b border-slate-800">
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-400">
              <ShieldX className="w-6 h-6" />
            </div>
            <div>
              <div className="font-mono text-xs text-rose-400 tracking-widest uppercase">
                Protocol Violation · Code 403
              </div>
              <h2 className="font-tech text-lg font-bold text-slate-100 uppercase tracking-wide">
                Role Clearance Denied
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Your account is authenticated under role <strong className="text-amber-400 font-mono">{role || 'UNKNOWN'}</strong>. 
              Access to this operational interface is strictly isolated and reserved exclusively for authorized terminal personnel.
            </p>

            <div className="p-4 rounded-lg bg-obsidian-950 border border-slate-800 font-mono text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Attempted Route:</span>
                <span className="text-rose-400 font-semibold">{state?.attemptedPath || location.pathname}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Your Active Role:</span>
                <span className="text-amber-400 font-semibold">{role || 'None'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Required Clearance:</span>
                <span className="text-slate-300 font-semibold">
                  {state?.requiredRoles?.join(', ') || 'Restricted Role'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-obsidian-850/60 border border-slate-800/80 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] font-mono text-slate-400 leading-normal">
                HYD-LOGIX strictly prohibits manual URL parameter bypassing and maintains strict dual-layer authorization across both client routes and Supabase database RLS.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleReturnToTerminal}
              className="flex-1 btn-primary py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <span>Return to {roleTitle}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleSignOut}
              className="btn-secondary py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch Account</span>
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] font-mono text-slate-500">
          HYD-LOGIX SECURITY PERIMETER · AUDIT TRAIL ACTIVE
        </div>
      </div>
    </div>
  );
};
