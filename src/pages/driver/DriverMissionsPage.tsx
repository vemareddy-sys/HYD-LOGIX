import React, { useState, useEffect } from 'react';
import {
  Activity,
  Package,
  MapPin,
  Clock,
  Truck,
  ShieldCheck,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context';
import { logisticsService } from '../../services/logisticsService';
import type { Mission } from '../../types/logistics';

export const DriverMissionsPage: React.FC = () => {
  const { profile } = useAuth();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMissions = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const list = await logisticsService.getDriverMissions(profile.id);
      setMissions(list);
    } catch (err) {
      console.error('Error fetching driver missions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  return (
    <div className="max-w-xl w-full mx-auto p-4 flex flex-col gap-4 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
            Field Dispatch Roster
          </div>
          <h1 className="font-tech text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>Assigned Delivery Missions</span>
          </h1>
        </div>

        <button
          onClick={fetchMissions}
          className="p-1.5 rounded-lg border border-slate-800 bg-obsidian-900 text-slate-400 hover:text-slate-200"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="panel-surface p-12 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-logix-amber animate-spin mb-3" />
          <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">
            Querying Authorized Field Missions...
          </span>
        </div>
      ) : missions.length === 0 ? (
        <div className="panel-surface p-8 text-center flex flex-col items-center justify-center py-12 bg-obsidian-900/60 border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-obsidian-850 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
            <Package className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="font-tech text-base font-semibold uppercase tracking-wider text-slate-200">
            No Assigned Missions
          </h3>
          <p className="mt-1.5 text-xs text-slate-400 max-w-xs leading-relaxed">
            You do not have any past or active missions assigned to your account.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map((m) => (
            <div
              key={m.id}
              className="panel-surface p-4 border-slate-800 bg-obsidian-900 flex flex-col gap-3 shadow-panel"
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-400 font-mono text-xs">
                    <code>{m.mission_code}</code>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({m.routing_algorithm})
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950/60 text-sky-400 border border-sky-800/60 font-semibold">
                  {m.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-logix-amber" />
                    Payload:
                  </span>
                  <strong className="text-slate-200">{m.order?.package_name || 'Delivery'}</strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    Target:
                  </span>
                  <span className="text-slate-200">{m.order?.destination_label || 'Destination'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    Vehicle:
                  </span>
                  <span className="text-slate-300">{m.vehicle?.vehicle_code || 'Assigned'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-center">
                  <div className="p-1.5 rounded bg-obsidian-950">
                    <span className="text-[9px] text-slate-500 block">DISTANCE</span>
                    <span className="text-emerald-400 font-bold">
                      {(m.route_distance_meters / 1000).toFixed(2)} km
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-obsidian-950">
                    <span className="text-[9px] text-slate-500 block">ROAD HOPS</span>
                    <span className="text-slate-200 font-bold">
                      {m.route_hop_count}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Assigned: {new Date(m.created_at).toLocaleDateString()}
                </span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Authorized
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
