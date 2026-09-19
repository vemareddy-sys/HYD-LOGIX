import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context';

export const PublicOnlyRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-2 border-logix-amber/20 border-t-logix-amber rounded-full animate-spin mb-4" />
        <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
          Checking Authentication Status...
        </span>
      </div>
    );
  }

  if (user && role) {
    if (role === 'CONTROL_CENTER') {
      return <Navigate to="/control" replace />;
    }
    if (role === 'DRIVER') {
      return <Navigate to="/driver" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
