import React from 'react';
import { AlertTriangle, Lock, Clock } from 'lucide-react';

export const DriverIncidentsPage: React.FC = () => {
  return (
    <div className="max-w-lg w-full mx-auto p-4 flex flex-col gap-4">
      <div className="panel-surface p-6 text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 rounded-xl bg-obsidian-850 border border-slate-800 flex items-center justify-center text-amber-400 mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-obsidian-950 border border-slate-800 text-xs font-mono text-slate-400 mb-3">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>SYSTEM STANDBY</span>
        </div>

        <h3 className="font-tech text-base font-semibold uppercase tracking-wider text-slate-200">
          Road Incident Reporting
        </h3>

        <p className="mt-2 text-xs text-slate-400 max-w-xs leading-relaxed">
          Feature in standby. Drivers will use this terminal to broadcast road blockages, accidents, and congestion in Hyderabad, triggering dynamic A* rerouting.
        </p>

        <div className="mt-5 p-3 rounded-lg bg-obsidian-950 border border-slate-800/80 w-full text-left font-mono text-[11px] text-slate-400 flex items-center justify-between">
          <span>TERMINAL: INCIDENTS</span>
          <span className="text-amber-400 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            STANDBY
          </span>
        </div>
      </div>
    </div>
  );
};
