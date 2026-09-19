import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context';
import type { UserRole } from '../types/auth';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-2 border-logix-amber/20 border-t-logix-amber rounded-full animate-spin mb-4" />
        <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
          Validating Role Clearance...
        </span>
      </div>
    );
  }

  // If not logged in, route to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role does not match allowed roles, strictly redirect to unauthorized access page
  if (!role || !allowedRoles.includes(role)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{
          attemptedPath: location.pathname,
          userRole: role,
          requiredRoles: allowedRoles,
        }}
        replace
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
};
