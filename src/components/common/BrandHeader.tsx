import React from 'react';
import { Compass } from 'lucide-react';

interface BrandHeaderProps {
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({ 
  subtitle = 'Smart Delivery & Logistics Optimizer',
  size = 'md' 
}) => {
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className="flex flex-col items-center select-none text-center">
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="flex items-center justify-center p-2 rounded-lg bg-obsidian-850 border border-slate-700/80 shadow-sm text-logix-amber">
          <Compass className={`${iconSizes[size]} animate-[pulse_4s_ease-in-out_infinite]`} />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className={`font-tech font-bold tracking-wider text-slate-100 ${titleSizes[size]}`}>
              HYD<span className="text-logix-amber">-LOGIX</span>
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-obsidian-800 text-slate-400 border border-slate-700">
              HYD · 2026
            </span>
          </div>
        </div>
      </div>
      {subtitle && (
        <p className="font-mono text-xs text-slate-400 tracking-wider">
          {subtitle}
        </p>
      )}
    </div>
  );
};
