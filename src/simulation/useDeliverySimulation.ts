import { useEffect, useRef, useState, useCallback } from 'react';
import type { Mission, MissionRuntime } from '../types/logistics';
import { DeliverySimulationEngine } from './DeliverySimulationEngine';
import type { PlaybackMultiplier, SimulationSnapshot } from './types';
import { logisticsService } from '../services/logisticsService';

interface UseDeliverySimulationOptions {
  mission: Mission | null;
  runtime?: MissionRuntime | null;
  baseVehicleSpeedKmh?: number;
  autoPersistIntervalMs?: number; // default: 1500 ms (1.5s)
  onArrival?: (snapshot: SimulationSnapshot) => void;
}

export function useDeliverySimulation({
  mission,
  runtime,
  baseVehicleSpeedKmh = 30.0,
  autoPersistIntervalMs = 1500,
  onArrival,
}: UseDeliverySimulationOptions) {
  const engineRef = useRef<DeliverySimulationEngine | null>(null);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // RAF loop references
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef<number>(0);
  const lastPersistRef = useRef<number>(0);

  // Initialize or re-create simulation engine when mission changes
  useEffect(() => {
    if (!mission) {
      engineRef.current = null;
      setSnapshot(null);
      return;
    }

    const activeSeq = mission.current_stop_sequence || 1;
    const activeLeg = mission.route_legs?.find((l) => l.leg_sequence === activeSeq);

    const routeGeometry =
      activeLeg && activeLeg.route_geometry && activeLeg.route_geometry.length > 0
        ? activeLeg.route_geometry
        : mission.route_geometry || [];

    const routeEdgeIds =
      activeLeg && activeLeg.route_edge_ids && activeLeg.route_edge_ids.length > 0
        ? activeLeg.route_edge_ids
        : mission.route_edge_ids || [];

    const routeNodeIds =
      activeLeg && activeLeg.route_node_ids && activeLeg.route_node_ids.length > 0
        ? activeLeg.route_node_ids
        : mission.route_node_ids || [];

    const initialMeters = runtime?.traveled_meters ?? 0;
    const initialMultiplier = (runtime?.playback_multiplier as PlaybackMultiplier) || 1;
    const initialStatus =
      runtime?.simulation_status || (mission.status === 'IN_TRANSIT' ? 'RUNNING' : 'READY');

    const engine = new DeliverySimulationEngine({
      missionId: mission.id,
      routeGeometry,
      routeEdgeIds,
      routeNodeIds,
      baseVehicleSpeedKmh,
      initialPlaybackMultiplier: initialMultiplier,
      initialTraveledMeters: initialMeters,
      initialStatus,
    });

    engineRef.current = engine;
    const initialSnap = engine.getSnapshot();
    setSnapshot(initialSnap);

    const unsubArrival = engine.onArrival((snap) => {
      setSnapshot({ ...snap });
      // Throttled / Arrival persist
      logisticsService.updateMissionRuntimeProgress({
        mission_id: mission.id,
        latitude: snap.currentLat,
        longitude: snap.currentLng,
        current_edge_id: snap.currentEdgeId,
        last_reached_node_id: snap.lastReachedNodeId,
        next_node_id: snap.nextNodeId,
        traveled_meters: snap.traveledMeters,
        route_progress: snap.progress,
        simulation_status: 'ARRIVED',
      });
      if (onArrival) {
        onArrival(snap);
      }
    });

    return () => {
      unsubArrival();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission?.id, mission?.current_stop_sequence]);

  // RequestAnimationFrame Animation Loop (decouples visual interpolation from excessive React re-renders)
  useEffect(() => {
    if (!engineRef.current || !mission) return;

    let active = true;

    const frameTick = (time: number) => {
      if (!active || !engineRef.current) return;

      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = time;
      }

      const deltaMs = Math.min(time - lastFrameTimeRef.current, 250); // clamp delta to 250ms for background tab switches
      lastFrameTimeRef.current = time;
      const deltaSeconds = deltaMs / 1000;

      const engine = engineRef.current;
      if (engine.getStatus() === 'RUNNING') {
        const snap = engine.tick(deltaSeconds);

        // Throttle React State updates to ~60ms (approx 16 fps state updates, smooth visual canvas)
        if (time - lastUiUpdateRef.current >= 60) {
          lastUiUpdateRef.current = time;
          setSnapshot({ ...snap });
        }

        // Database persistence throttle (~1.5s)
        if (time - lastPersistRef.current >= autoPersistIntervalMs) {
          lastPersistRef.current = time;
          logisticsService.updateMissionRuntimeProgress({
            mission_id: mission.id,
            latitude: snap.currentLat,
            longitude: snap.currentLng,
            current_edge_id: snap.currentEdgeId,
            last_reached_node_id: snap.lastReachedNodeId,
            next_node_id: snap.nextNodeId,
            traveled_meters: snap.traveledMeters,
            route_progress: snap.progress,
            simulation_status: 'RUNNING',
          });
        }
      }

      rafIdRef.current = requestAnimationFrame(frameTick);
    };

    rafIdRef.current = requestAnimationFrame(frameTick);

    return () => {
      active = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      lastFrameTimeRef.current = null;
    };
  }, [mission, autoPersistIntervalMs]);

  // ==========================================
  // Action Handlers (Calling Secure RPCs)
  // ==========================================

  const startDelivery = useCallback(async () => {
    if (!mission || !engineRef.current) return;

    setIsStarting(true);
    setError(null);
    try {
      // 1. Call secure RPC start_delivery_mission
      await logisticsService.startDeliveryMission(mission.id);

      // 2. Start simulation engine
      engineRef.current.start();
      setSnapshot(engineRef.current.getSnapshot());
    } catch (err: unknown) {
      console.error('Failed to start delivery:', err);
      const msg = err instanceof Error ? err.message : 'Failed to start delivery';
      setError(msg);
    } finally {
      setIsStarting(false);
    }
  }, [mission]);

  const pauseDelivery = useCallback(async () => {
    if (!mission || !engineRef.current) return;

    try {
      engineRef.current.pause();
      const snap = engineRef.current.getSnapshot();
      setSnapshot({ ...snap });

      // Immediate state sync
      await logisticsService.pauseDeliverySimulation(mission.id);
    } catch (err: unknown) {
      console.warn('Failed to pause delivery:', err);
    }
  }, [mission]);

  const resumeDelivery = useCallback(async () => {
    if (!mission || !engineRef.current) return;

    try {
      engineRef.current.resume();
      const snap = engineRef.current.getSnapshot();
      setSnapshot({ ...snap });

      // Immediate state sync
      await logisticsService.resumeDeliverySimulation(mission.id);
    } catch (err: unknown) {
      console.warn('Failed to resume delivery:', err);
    }
  }, [mission]);

  const completeDelivery = useCallback(async () => {
    if (!mission || !engineRef.current) return;

    setIsCompleting(true);
    setError(null);
    try {
      // 1. Call secure RPC complete_delivery_mission
      await logisticsService.completeDeliveryMission(mission.id);

      // 2. Complete engine
      engineRef.current.complete();
      setSnapshot(engineRef.current.getSnapshot());
    } catch (err: unknown) {
      console.error('Failed to complete delivery:', err);
      const msg = err instanceof Error ? err.message : 'Failed to confirm delivery';
      setError(msg);
    } finally {
      setIsCompleting(false);
    }
  }, [mission]);

  const completeCurrentStop = useCallback(
    async (orderId?: string) => {
      if (!mission) return;

      setIsCompleting(true);
      setError(null);
      try {
        const activeSeq = mission.current_stop_sequence || 1;
        const targetOrderId =
          orderId ||
          mission.mission_orders?.find((mo) => mo.stop_sequence === activeSeq)?.order_id ||
          mission.order_id;

        if (!targetOrderId) {
          throw new Error('No target order found for current stop');
        }

        const res = await logisticsService.completeMissionStop(mission.id, targetOrderId);
        if (res.complete && engineRef.current) {
          engineRef.current.complete();
          setSnapshot(engineRef.current.getSnapshot());
        }
        return res;
      } catch (err: unknown) {
        console.error('Failed to complete stop:', err);
        const msg = err instanceof Error ? err.message : 'Failed to confirm stop delivery';
        setError(msg);
        throw err;
      } finally {
        setIsCompleting(false);
      }
    },
    [mission]
  );

  const setPlaybackMultiplier = useCallback((multiplier: PlaybackMultiplier) => {
    if (!engineRef.current) return;
    engineRef.current.setPlaybackMultiplier(multiplier);
    setSnapshot(engineRef.current.getSnapshot());
  }, []);

  return {
    engine: engineRef.current,
    snapshot,
    isStarting,
    isCompleting,
    error,
    startDelivery,
    pauseDelivery,
    resumeDelivery,
    completeDelivery,
    completeCurrentStop,
    setPlaybackMultiplier,
  };
}

