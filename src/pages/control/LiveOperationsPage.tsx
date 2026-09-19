import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { BasemapTileLayer } from '../../components/map/BasemapTileLayer';
import {
  Activity,
  Truck,
  MapPin,
  Package,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Radio,
  Clock,
  Compass,
} from 'lucide-react';
import { logisticsService } from '../../services/logisticsService';
import type { Mission, MissionRuntime } from '../../types/logistics';
import type { SimulationSnapshot } from '../../simulation/types';
import { SimulationVehicleLayer } from '../../components/map/SimulationVehicleLayer';

export const LiveOperationsPage: React.FC = () => {
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [runtime, setRuntime] = useState<MissionRuntime | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const fetchLiveState = useCallback(async () => {
    try {
      const liveData = await logisticsService.getActiveLiveMission();
      if (liveData) {
        setActiveMission(liveData.mission);
        setRuntime(liveData.runtime);
      } else {
        setActiveMission(null);
        setRuntime(null);
      }
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Error polling live mission:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const liveData = await logisticsService.getActiveLiveMission();
        if (!active) return;
        if (liveData) {
          setActiveMission(liveData.mission);
          setRuntime(liveData.runtime);
        } else {
          setActiveMission(null);
          setRuntime(null);
        }
        setLastSyncTime(new Date());
      } catch (err) {
        console.error('Error polling live mission:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    poll();
    const pollInterval = setInterval(poll, 1500);

    return () => {
      active = false;
      clearInterval(pollInterval);
    };
  }, []);

  const activeLeg = activeMission?.route_legs?.find(
    (l) => l.leg_sequence === (activeMission.current_stop_sequence || 1)
  );

  const routeGeo =
    activeLeg && activeLeg.route_geometry && activeLeg.route_geometry.length > 0
      ? activeLeg.route_geometry
      : activeMission?.route_geometry || [];

  const legDistance = activeLeg?.distance_meters || activeMission?.route_distance_meters || 0;

  // Construct read-only SimulationSnapshot directly from Supabase mission_runtime
  const snapshot: SimulationSnapshot | null = activeMission
    ? {
        missionId: activeMission.id,
        status: runtime?.simulation_status || (activeMission.status === 'IN_TRANSIT' ? 'RUNNING' : 'READY'),
        traveledMeters: runtime?.traveled_meters || 0,
        totalMeters: legDistance,
        progress: runtime?.route_progress || 0,
        remainingMeters: Math.max(0, legDistance - (runtime?.traveled_meters || 0)),
        currentLat: runtime?.current_latitude || routeGeo?.[0]?.[0] || 17.4401,
        currentLng: runtime?.current_longitude || routeGeo?.[0]?.[1] || 78.3489,
        currentEdgeId: runtime?.current_edge_id || null,
        currentEdgeProgress: 0,
        lastReachedNodeId: runtime?.last_reached_node_id || null,
        nextNodeId: runtime?.next_node_id || null,
        baseVehicleSpeedKmh: runtime?.base_speed_kmh || 30.0,
        playbackMultiplier: (runtime?.playback_multiplier as 1 | 2 | 4) || 1,
        simulatedEtaSeconds: 0,
        startedAt: runtime?.started_at || null,
        updatedAt: runtime?.updated_at || new Date().toISOString(),
      }
    : null;

  const defaultCenter = routeGeo.length > 0 ? routeGeo[0] : ([17.4401, 78.3489] as [number, number]);

  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian-950 text-slate-200 overflow-hidden">
      {/* 1. Header Bar */}
      <div className="bg-obsidian-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-950/40 border border-sky-500/40 text-sky-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-tech text-base sm:text-lg font-bold text-slate-100 uppercase tracking-wide">
                Live Operations Center
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950 border border-sky-800 text-sky-400 font-semibold flex items-center gap-1.5">
                <Radio className="w-3 h-3 animate-pulse" />
                POLLING RUNTIME
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Live vehicle telemetry synchronized from Supabase mission_runtime
            </p>
          </div>
        </div>

        {/* Polling controls & last sync */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end text-right font-mono text-[11px] text-slate-400">
            <span className="text-[10px] text-slate-500">Last Database Sync</span>
            <span className="text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {lastSyncTime.toLocaleTimeString()}
            </span>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              fetchLiveState();
            }}
            className="p-2 rounded-lg border border-slate-800 bg-obsidian-950 hover:bg-obsidian-850 text-slate-400 hover:text-slate-200 transition-colors"
            title="Force Telemetry Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Map Canvas */}
        <div className="flex-1 h-full relative z-0">
          <MapContainer
            center={defaultCenter}
            zoom={14}
            className="w-full h-full"
            zoomControl={false}
          >
            <BasemapTileLayer />
            {activeMission && (
              <SimulationVehicleLayer
                routeGeometry={routeGeo}
                snapshot={snapshot}
                startLabel={activeMission.warehouse?.name || 'Distribution Hub'}
                destinationLabel={activeMission.order?.destination_label || 'Destination Target'}
              />
            )}
          </MapContainer>

          {/* Floating single-source status pill on map */}
          <div className="absolute top-3 right-3 z-[1000] p-2.5 rounded-xl bg-obsidian-950/90 backdrop-blur border border-slate-800 shadow-xl font-mono text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">Single Source of Truth:</span>
            <code className="text-sky-400 font-bold">public.mission_runtime</code>
          </div>
        </div>

        {/* Operational Telemetry Side Panel */}
        <div className="w-full lg:w-96 bg-obsidian-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto max-h-[40vh] lg:max-h-full">
          {loading && !activeMission ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-2" />
              <span className="font-mono text-xs uppercase">Loading Telemetry...</span>
            </div>
          ) : activeMission ? (
            <div className="p-4 sm:p-5 space-y-4">
              {/* Mission Header */}
              <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <span className="tech-label text-[10px] text-sky-400">DEPLOYED MISSION</span>
                  <h2 className="font-tech text-base font-bold text-slate-100 mt-0.5">
                    <code>{activeMission.mission_code}</code>
                  </h2>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono border font-bold bg-sky-950 text-sky-300 border-sky-800 uppercase">
                    {activeMission.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    SIM: {runtime?.simulation_status || 'READY'}
                  </span>
                </div>
              </div>

              {/* Delivery Payload & Priority */}
              <div className="p-3 rounded-xl bg-obsidian-950 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-logix-amber" />
                    Payload:
                  </span>
                  <span className="text-slate-100 font-semibold">
                    {activeMission.order?.package_name || 'Delivery Package'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Priority:</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      activeMission.order?.priority === 'URGENT'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                        : 'bg-amber-950/80 text-amber-300 border-amber-800'
                    }`}
                  >
                    {activeMission.order?.priority || 'NORMAL'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-sky-400" />
                    Vehicle & Driver:
                  </span>
                  <span className="text-slate-200">
                    {activeMission.vehicle?.vehicle_code || 'VAN-01'} (
                    {activeMission.driver?.display_name || 'Assigned Driver'})
                  </span>
                </div>
              </div>

              {/* Geography & Progress Telemetry */}
              <div className="p-3 rounded-xl bg-obsidian-950 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="truncate">
                    <span className="text-[10px] text-slate-500 block uppercase">Origin</span>
                    <span className="text-slate-200 truncate">{activeMission.warehouse?.name || 'Warehouse'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1 border-t border-slate-800/80">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="truncate">
                    <span className="text-[10px] text-slate-500 block uppercase">Destination</span>
                    <span className="text-slate-200 truncate">
                      {activeMission.order?.destination_label || 'Customer'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Route Progress</span>
                    <span className="text-emerald-400 font-bold">
                      {Math.round((snapshot?.progress || 0) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-obsidian-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${Math.round((snapshot?.progress || 0) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <span>Traveled: {((snapshot?.traveledMeters || 0) / 1000).toFixed(2)} km</span>
                    <span>Total: {((snapshot?.totalMeters || 0) / 1000).toFixed(2)} km</span>
                  </div>
                </div>
              </div>

              {/* Graph Position Tracking (Phase 08 Preparation) */}
              <div className="p-3 rounded-xl bg-obsidian-950 border border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  <span className="uppercase tracking-wider">Graph Position Tracking</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                  <div className="p-2 rounded bg-obsidian-900 border border-slate-800/60">
                    <span className="text-slate-500 block">Current Edge</span>
                    <span className="text-slate-200 font-bold truncate block">
                      {snapshot?.currentEdgeId || 'Resolving...'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-obsidian-900 border border-slate-800/60">
                    <span className="text-slate-500 block">Next Node</span>
                    <span className="text-slate-200 font-bold truncate block">
                      {snapshot?.nextNodeId || 'Target Node'}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 pt-1">
                  Current Coordinates: {snapshot?.currentLat.toFixed(5)}, {snapshot?.currentLng.toFixed(5)}
                </div>
              </div>
            </div>
          ) : (
            // Empty Standby State
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-obsidian-950 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
                <Compass className="w-6 h-6 text-sky-400/60" />
              </div>
              <h3 className="font-tech text-base font-bold text-slate-200 uppercase">
                Fleet on Standby
              </h3>
              <p className="mt-1.5 text-xs text-slate-400 max-w-xs leading-relaxed font-mono">
                No active delivery missions currently deployed in transit. Dispatch missions from Mission Control to monitor live telemetry.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
