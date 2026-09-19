import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { BasemapTileLayer } from '../../components/map/BasemapTileLayer';
import {
  Navigation,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  MapPin,
  ArrowLeft,
  Loader2,
  Gauge,
  Compass,
} from 'lucide-react';
import { useAuth } from '../../context';
import { logisticsService } from '../../services/logisticsService';
import type { Mission, MissionRuntime } from '../../types/logistics';
import { useDeliverySimulation } from '../../simulation/useDeliverySimulation';
import { SimulationVehicleLayer } from '../../components/map/SimulationVehicleLayer';
import type { PlaybackMultiplier } from '../../simulation/types';

export const DriverNavigationPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [mission, setMission] = useState<Mission | null>(null);
  const [runtime, setRuntime] = useState<MissionRuntime | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Load active assigned mission for the authenticated driver
  useEffect(() => {
    let active = true;

    async function loadActiveMission() {
      if (!profile) return;
      setLoading(true);
      setFetchError(null);

      try {
        const activeM = await logisticsService.getDriverActiveMission(profile.id);
        if (!active) return;

        if (!activeM) {
          setMission(null);
          setLoading(false);
          return;
        }

        setMission(activeM);

        // Fetch runtime state if exists
        const rt = await logisticsService.getMissionRuntime(activeM.id);
        if (active) {
          setRuntime(rt);
        }
      } catch (err: unknown) {
        if (!active) return;
        console.error('Error fetching driver mission:', err);
        const msg = err instanceof Error ? err.message : 'Failed to query active mission';
        setFetchError(msg);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadActiveMission();

    return () => {
      active = false;
    };
  }, [profile]);
  const [stopNotification, setStopNotification] = useState<string | null>(null);

  const {
    snapshot,
    isStarting,
    isCompleting,
    error: simError,
    startDelivery,
    pauseDelivery,
    resumeDelivery,
    completeCurrentStop,
    setPlaybackMultiplier,
  } = useDeliverySimulation({
    mission,
    runtime,
    baseVehicleSpeedKmh: 30.0,
    autoPersistIntervalMs: 1500,
  });

  const currentSeq = mission?.current_stop_sequence || 1;
  const activeLeg = mission?.route_legs?.find((l) => l.leg_sequence === currentSeq);
  const currentOrderEntry =
    mission?.mission_orders?.find((mo) => mo.stop_sequence === currentSeq) ||
    (mission?.order ? { order: mission.order, stop_sequence: 1, status: 'NEXT' } : null);
  const currentOrder = currentOrderEntry?.order || mission?.order;
  const totalStops = mission?.total_stops || mission?.mission_orders?.length || 1;

  const handleStopDelivery = async () => {
    try {
      const res = await completeCurrentStop();
      if (res?.complete) {
        setStopNotification('All delivery stops completed! Vehicle released. Returning to terminal...');
        setTimeout(() => {
          navigate('/driver');
        }, 1800);
      } else {
        setStopNotification(
          `Stop ${currentSeq} (${currentOrder?.destination_label || 'Stop'}) delivered! Advancing to Stop ${res?.next_stop_sequence || currentSeq + 1}...`
        );
        if (profile) {
          const updated = await logisticsService.getDriverActiveMission(profile.id);
          if (updated) {
            setMission(updated);
          }
        }
        setTimeout(() => setStopNotification(null), 3500);
      }
    } catch (err) {
      console.error('Stop delivery confirmation failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] bg-obsidian-950 text-slate-200">
        <Loader2 className="w-10 h-10 text-sky-400 animate-spin mb-3" />
        <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
          Initializing Navigation Telemetry...
        </span>
      </div>
    );
  }

  if (fetchError || !mission) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-obsidian-950 text-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-obsidian-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
          <Compass className="w-7 h-7 text-sky-500/60" />
        </div>
        <h2 className="font-tech text-lg font-bold text-slate-100 uppercase tracking-wide">
          No Active Mission Clearance
        </h2>
        <p className="mt-2 text-xs text-slate-400 max-w-sm">
          {fetchError || 'You do not currently have an active delivery mission in transit. Please check your assigned dispatch queue on the terminal home.'}
        </p>
        <Link
          to="/driver"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-obsidian-900 hover:bg-obsidian-850 border border-slate-700 text-slate-200 text-xs font-mono font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Driver Home
        </Link>
      </div>
    );
  }

  const routeGeo =
    activeLeg && activeLeg.route_geometry && activeLeg.route_geometry.length > 0
      ? activeLeg.route_geometry
      : mission.route_geometry || [];

  const defaultCenter = routeGeo.length > 0 ? routeGeo[0] : ([17.4401, 78.3489] as [number, number]);
  const currentSpeedMult = snapshot?.playbackMultiplier || 1;
  const isRunning = snapshot?.status === 'RUNNING';
  const isPaused = snapshot?.status === 'PAUSED';
  const isArrived = snapshot?.status === 'ARRIVED';
  const isCompleted = snapshot?.status === 'COMPLETED';

  return (
    <div className="relative flex-1 flex flex-col h-full w-full bg-obsidian-950 text-slate-200 overflow-hidden select-none">
      {/* 1. Top HUD: Mission Header Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-obsidian-950/90 backdrop-blur-md border border-slate-800/90 shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              to="/driver"
              className="p-2 rounded-xl bg-obsidian-900 border border-slate-800 text-slate-400 hover:text-slate-100 transition-colors shrink-0"
              title="Return to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
                  {mission.mission_code}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold uppercase">
                  Stop {currentSeq} of {totalStops}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono border font-bold uppercase ${
                    currentOrder?.priority === 'URGENT'
                      ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                      : currentOrder?.priority === 'HIGH'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                      : 'bg-sky-950/80 text-sky-300 border-sky-800/80'
                  }`}
                >
                  {currentOrder?.priority || 'NORMAL'}
                </span>
              </div>
              <div className="font-tech text-sm sm:text-base font-bold text-slate-100 truncate flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">{currentOrder?.destination_label || 'Destination Stop'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex flex-col items-end text-right font-mono">
              <span className="text-[10px] text-slate-500 uppercase">Unit</span>
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                {mission.vehicle?.vehicle_code || 'VAN-01'}
              </span>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-mono border font-bold uppercase flex items-center gap-1.5 ${
                isCompleted
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                  : isArrived
                  ? 'bg-amber-950/80 border-amber-800 text-amber-300 animate-pulse'
                  : isRunning
                  ? 'bg-sky-950/80 border-sky-800 text-sky-400'
                  : isPaused
                  ? 'bg-amber-950/60 border-amber-800/60 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isCompleted
                    ? 'bg-emerald-400'
                    : isArrived
                    ? 'bg-amber-400'
                    : isRunning
                    ? 'bg-sky-400 animate-ping'
                    : 'bg-slate-500'
                }`}
              />
              {snapshot?.status || 'STANDBY'}
            </span>
          </div>
        </div>

        {/* Stop Progression Notification Banner */}
        {stopNotification && (
          <div className="p-3 rounded-xl bg-cyan-950/95 border border-cyan-700 text-cyan-200 text-xs font-mono flex items-center gap-2 shadow-2xl pointer-events-auto animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-semibold">{stopNotification}</span>
          </div>
        )}

        {/* Error notification banner if any */}
        {simError && (
          <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-800 text-rose-200 text-xs font-mono flex items-center gap-2 shadow-lg pointer-events-auto">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{simError}</span>
          </div>
        )}
      </div>

      {/* 2. Map-Dominated Canvas */}
      <div className="flex-1 w-full h-full relative z-0">
        <MapContainer
          center={defaultCenter}
          zoom={14}
          className="w-full h-full"
          zoomControl={false}
        >
          <BasemapTileLayer />
          <SimulationVehicleLayer
            routeGeometry={routeGeo}
            snapshot={snapshot}
            startLabel={activeLeg?.from_label || mission.warehouse?.name || 'Hub'}
            destinationLabel={activeLeg?.to_label || currentOrder?.destination_label || 'Stop'}
          />
        </MapContainer>
      </div>

      {/* 3. Bottom Floating Control Dock */}
      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex flex-col gap-2 max-w-xl mx-auto pointer-events-none">
        <div className="p-3 sm:p-4 rounded-2xl bg-obsidian-950/95 backdrop-blur-md border border-slate-800/90 shadow-2xl flex flex-col gap-3 pointer-events-auto">
          {/* Progress Bar & Distance Telemetry */}
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {currentOrder?.package_name || 'Payload'} ({currentOrder?.weight_kg || 0} kg)
                </span>
              </span>
              <span className="text-slate-200 font-semibold">
                {snapshot ? (snapshot.remainingMeters / 1000).toFixed(2) : ((activeLeg?.distance_meters || mission.route_distance_meters) / 1000).toFixed(2)} km to Stop {currentSeq}
              </span>
            </div>

            {/* Visual Route Progress Track */}
            <div className="w-full h-2 bg-obsidian-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${Math.round((snapshot?.progress || 0) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Leg Progress: {Math.round((snapshot?.progress || 0) * 100)}%</span>
              <span>Leg Length: {((activeLeg?.distance_meters || mission.route_distance_meters) / 1000).toFixed(2)} km</span>
            </div>
          </div>

          {/* Controls Bar: Multipliers & Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            {/* Speed Multipliers */}
            <div className="flex items-center gap-1 bg-obsidian-900 p-1 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 px-1.5 flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                Speed:
              </span>
              {([1, 2, 4] as PlaybackMultiplier[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPlaybackMultiplier(m)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                    currentSpeedMult === m
                      ? 'bg-sky-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {m}x
                </button>
              ))}
            </div>

            {/* Primary Action Button */}
            <div className="flex items-center gap-2">
              {isCompleted ? (
                <div className="px-4 py-2 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  RUN COMPLETED
                </div>
              ) : isArrived ? (
                <button
                  onClick={handleStopDelivery}
                  disabled={isCompleting}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-tech font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
                >
                  {isCompleting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  )}
                  <span>CONFIRM DELIVERY AT STOP {currentSeq}</span>
                </button>
              ) : isRunning ? (
                <button
                  onClick={pauseDelivery}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-tech font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-950/50 transition-all"
                >
                  <Pause className="w-4 h-4 text-slate-950" />
                  <span>PAUSE</span>
                </button>
              ) : isPaused ? (
                <button
                  onClick={resumeDelivery}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-tech font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-sky-950/50 transition-all"
                >
                  <Play className="w-4 h-4 text-slate-950 fill-current" />
                  <span>RESUME</span>
                </button>
              ) : (
                <button
                  onClick={startDelivery}
                  disabled={isStarting}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-tech font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
                >
                  {isStarting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <Navigation className="w-4 h-4 text-slate-950 fill-current" />
                  )}
                  <span>START LEG {currentSeq}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
