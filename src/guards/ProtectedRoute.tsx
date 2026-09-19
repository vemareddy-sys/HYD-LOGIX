import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-2 border-logix-amber/20 border-t-logix-amber rounded-full animate-spin mb-4" />
        <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
          HYD-LOGIX Security Verification
        </span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
