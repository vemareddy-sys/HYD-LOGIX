import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured } from '../../config/supabase';

export const ConfigBanner: React.FC = () => {
  if (isSupabaseConfigured) return null;

  return (
    <div className="bg-amber-950/60 border-b border-amber-800/60 px-4 py-2 text-xs font-mono text-amber-300 flex items-center justify-between">
      <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
        <AlertTriangle className="w-4 h-4 text-logix-amber flex-shrink-0" />
        <span>
          <strong className="text-amber-200">Supabase Config Pending:</strong> Using local preview auth mode. Add real Supabase keys to <code className="bg-obsidian-950 px-1 py-0.5 rounded text-amber-200">.env</code> and run migrations from <code className="bg-obsidian-950 px-1 py-0.5 rounded text-amber-200">supabase/migrations/</code> for live cloud authentication.
        </span>
      </div>
    </div>
  );
};
