import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Radio,
  Compass,
  ShieldCheck,
  Truck,
  MapPin,
  Package,
  RefreshCw,
  Loader2,
  Navigation,
} from 'lucide-react';
import { useAuth } from '../../context';
import { supabase } from '../../config/supabase';
import { logisticsService } from '../../services/logisticsService';
import type { Mission, Driver } from '../../types/logistics';

export const DriverHomePage: React.FC = () => {
  const { user, profile } = useAuth();

  const [driverRecord, setDriverRecord] = useState<Driver | null>(null);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDriverState = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Fetch current driver operational record via shared service
      const dData = await logisticsService.getDriverProfile(profile.id);
      if (dData) {
        setDriverRecord(dData);
      }

      // 2. Fetch active assigned mission
      const mission = await logisticsService.getDriverActiveMission(profile.id);
      setActiveMission(mission);
    } catch (err) {
      console.error('Error fetching driver home state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverState();

    // Setup Realtime subscription scoped to missions
    const channel = supabase
      .channel('driver-missions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'missions' },
        () => {
          fetchDriverState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  return (
    <div className="max-w-xl w-full mx-auto p-4 flex flex-col gap-4 text-slate-200">
      {/* Driver Identity Card */}
      <div className="panel-surface p-4 border-slate-800 bg-obsidian-900 shadow-panel">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div>
            <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
              Operational Terminal // Field Navigator
            </div>
            <div className="font-tech text-base font-bold text-slate-100 mt-0.5">
              {profile?.full_name || user?.email}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDriverState}
              className="p-1.5 rounded-lg border border-slate-800 bg-obsidian-950 text-slate-400 hover:text-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
                driverRecord?.status === 'AVAILABLE'
                  ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                  : driverRecord?.status === 'ASSIGNED'
                  ? 'bg-sky-950/60 border-sky-800/60 text-sky-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <Radio className="w-3 h-3 animate-pulse" />
              {driverRecord?.status || 'STANDBY'}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-obsidian-950 border border-slate-800/60">
            <div className="text-[10px] text-slate-500 uppercase">Assigned Vehicle</div>
            <div className="text-slate-200 font-semibold flex items-center gap-1.5 mt-0.5">
              <Truck className="w-3.5 h-3.5 text-logix-amber" />
              <span>{driverRecord?.vehicle?.vehicle_code || 'None Assigned'}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-obsidian-950 border border-slate-800/60">
            <div className="text-[10px] text-slate-500 uppercase">Field Status</div>
            <div className="text-slate-200 font-semibold flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  driverRecord?.status === 'AVAILABLE'
                    ? 'bg-emerald-400'
                    : driverRecord?.status === 'ASSIGNED'
                    ? 'bg-sky-400'
                    : 'bg-amber-400'
                }`}
              />
              <span>{driverRecord?.status || 'STANDBY'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Mission Dispatch Card */}
      {loading ? (
        <div className="panel-surface p-8 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
          <span className="font-mono text-xs text-slate-400">Loading Active Delivery Run...</span>
        </div>
      ) : activeMission ? (
        <div className="panel-surface p-5 border-slate-800 bg-obsidian-900/90 shadow-panel space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="tech-label text-[10px] text-emerald-400">
                CURRENT RUN // OPERATIONAL DISPATCH
              </span>
              <h2 className="font-tech text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                <code>{activeMission.mission_code}</code>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-sky-950/60 text-sky-400 border border-sky-800/60 font-semibold">
                {activeMission.status}
              </span>
            </div>
          </div>

          {/* Run Overview Metrics */}
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-obsidian-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Vehicle</span>
              <span className="font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                <Truck className="w-3.5 h-3.5" />
                {activeMission.vehicle?.vehicle_code || driverRecord?.vehicle?.vehicle_code || 'VAN-01'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-obsidian-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Total Stops</span>
              <span className="font-bold text-cyan-400 text-sm mt-0.5 block">
                {activeMission.total_stops || activeMission.mission_orders?.length || 1} Stops
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-obsidian-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Current Stop</span>
              <span className="font-bold text-emerald-400 text-sm mt-0.5 block">
                Stop {activeMission.current_stop_sequence || 1}
              </span>
            </div>
          </div>

          {/* NEXT STOP HIGHLIGHT */}
          {(() => {
            const currentSeq = activeMission.current_stop_sequence || 1;
            const currentOrderEntry =
              activeMission.mission_orders?.find((mo) => mo.stop_sequence === currentSeq) ||
              (activeMission.order ? { order: activeMission.order, stop_sequence: 1, status: 'NEXT' } : null);

            const nextOrder = currentOrderEntry?.order || activeMission.order;
            const totalStops = activeMission.total_stops || activeMission.mission_orders?.length || 1;
            const remainingCount = Math.max(0, totalStops - currentSeq);

            return (
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/60 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5" />
                    NEXT STOP TARGET
                  </span>
                  <span className="text-slate-400 font-normal">
                    {remainingCount > 0 ? `${remainingCount} more stops remaining` : 'Final Stop of Run'}
                  </span>
                </div>

                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                      {nextOrder?.destination_label || 'Destination Stop'}
                    </div>
                    <div className="text-slate-300 mt-0.5 flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-amber-400" />
                      <span>{nextOrder?.package_name || 'Package'}</span>
                      {nextOrder?.weight_kg && (
                        <span className="text-slate-500">({nextOrder.weight_kg} kg)</span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] border font-bold ${
                      nextOrder?.priority === 'URGENT'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                        : nextOrder?.priority === 'HIGH'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                        : 'bg-sky-950/80 text-sky-300 border-sky-800'
                    }`}
                  >
                    {nextOrder?.priority || 'NORMAL'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* SEQUENTIAL STOP LIST */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold px-1">
              Delivery Run Stops
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {(activeMission.mission_orders && activeMission.mission_orders.length > 0
                ? activeMission.mission_orders
                : activeMission.order
                ? [{ id: 'single', stop_sequence: 1, status: 'NEXT', order: activeMission.order }]
                : []
              ).map((mo) => {
                const isCurrent = mo.stop_sequence === (activeMission.current_stop_sequence || 1);
                const isDelivered = mo.status === 'DELIVERED';
                return (
                  <div
                    key={mo.id || mo.stop_sequence}
                    className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between ${
                      isDelivered
                        ? 'bg-obsidian-950/40 border-slate-800/40 text-slate-500'
                        : isCurrent
                        ? 'bg-obsidian-900 border-emerald-500/80 text-slate-200 shadow-sm'
                        : 'bg-obsidian-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isDelivered
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : isCurrent
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-500 animate-pulse'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {mo.stop_sequence}
                      </div>
                      <div className="truncate">
                        <div className={`font-bold truncate ${isDelivered ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {mo.order?.destination_label || 'Destination'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {mo.order?.package_name} • {mo.order?.priority}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono border shrink-0 ${
                        isDelivered
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                          : isCurrent
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-700 font-bold'
                          : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                    >
                      {isDelivered ? 'DELIVERED' : isCurrent ? 'NEXT' : 'PENDING'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <Link
            to="/driver/navigation"
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-tech font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all text-xs"
          >
            <Navigation className="w-4 h-4 fill-current" />
            <span>OPEN ACTIVE NAVIGATION</span>
          </Link>
        </div>
      ) : (
        // Empty State: No Active Delivery
        <div className="panel-surface p-8 text-center flex flex-col items-center justify-center py-12 bg-obsidian-900/60 border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-obsidian-850 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
            <Compass className="w-6 h-6 text-emerald-500/70" />
          </div>
          <h3 className="font-tech text-base font-semibold uppercase tracking-wider text-slate-200">
            No Active Delivery
          </h3>
          <p className="mt-1.5 text-xs text-slate-400 max-w-xs leading-relaxed">
            You currently have no active delivery assignments. Standby for dispatch assignments from the Control Center.
          </p>
        </div>
      )}

      {/* Security Clearance Note */}
      <div className="panel-surface p-3.5 border-slate-800 bg-obsidian-900/40 text-xs font-mono text-slate-400 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Driver scope strictly isolated. You only receive missions assigned directly to your clearance.</span>
      </div>
    </div>
  );
};
