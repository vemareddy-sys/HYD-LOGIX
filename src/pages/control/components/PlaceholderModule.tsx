import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Lock, Clock, ShieldCheck } from 'lucide-react';

interface PlaceholderModuleProps {
  title: string;
  moduleCode: string;
  icon: LucideIcon;
  description: string;
}

export const PlaceholderModule: React.FC<PlaceholderModuleProps> = ({
  title,
  moduleCode,
  icon: Icon,
  description,
}) => {
  return (
    <div className="flex-1 p-4 sm:p-6 flex flex-col gap-6 overflow-x-hidden">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-obsidian-900 text-slate-400 border border-slate-800 flex items-center gap-1">
              <Clock className="w-3 h-3 text-logix-amber" />
              INTEGRATION STANDBY
            </span>
            <span className="font-mono text-xs text-slate-500">
              {moduleCode}
            </span>
          </div>
          <h1 className="font-tech text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-100 mt-1 flex items-center gap-2.5">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-logix-amber shrink-0" />
            <span>{title}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-obsidian-900 border border-slate-800 text-xs font-mono text-slate-400">
            STATUS: <span className="text-amber-400">STANDBY</span>
          </span>
        </div>
      </div>

      {/* Notice Card */}
      <div className="panel-surface p-5 sm:p-8 text-center flex flex-col items-center justify-center min-h-[280px] sm:min-h-[360px]">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-obsidian-850 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
          <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-logix-amber/70" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-obsidian-950 border border-slate-800 text-xs font-mono text-slate-400 mb-3">
          <Lock className="w-3.5 h-3.5 text-amber-500" />
          <span>MODULE STANDBY</span>
        </div>

        <h2 className="font-tech text-lg sm:text-xl font-semibold uppercase tracking-wider text-slate-200">
          {title}
        </h2>

        <p className="mt-2 text-xs text-slate-400 max-w-md leading-relaxed">
          {description}
        </p>

        <div className="mt-6 p-3.5 sm:p-4 rounded-xl bg-obsidian-950 border border-slate-800/80 max-w-md w-full text-left font-mono text-[11px] text-slate-400 space-y-1.5">
          <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
            <span className="text-slate-500">SYSTEM ID:</span>
            <span className="text-amber-400 font-semibold">{moduleCode}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
            <span className="text-slate-500">OPERATIONAL STATUS:</span>
            <span className="text-slate-200">Awaiting Fleet Dispatch Schedule</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">ACCESS LEVEL:</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Authorized Control Center
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
