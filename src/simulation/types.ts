import type { SimulationStatus } from '../types/logistics';

export type PlaybackMultiplier = 1 | 2 | 4;

export interface GeometrySegment {
  segmentIndex: number;
  startCoord: [number, number];
  endCoord: [number, number];
  segmentDistanceMeters: number;
  cumulativeStartMeters: number;
  cumulativeEndMeters: number;
  edgeId?: string;
  fromNodeId?: string;
  toNodeId?: string;
}

export interface RouteInterpolationResult {
  latitude: number;
  longitude: number;
  currentEdgeId: string | null;
  lastReachedNodeId: string | null;
  nextNodeId: string | null;
  currentEdgeProgress: number; // 0.0 to 1.0 along current edge
  segmentIndex: number;
}

export interface SimulationSnapshot {
  missionId: string;
  status: SimulationStatus;
  traveledMeters: number;
  totalMeters: number;
  progress: number; // 0.0 to 1.0
  remainingMeters: number;
  currentLat: number;
  currentLng: number;
  currentEdgeId: string | null;
  currentEdgeProgress: number;
  lastReachedNodeId: string | null;
  nextNodeId: string | null;
  baseVehicleSpeedKmh: number;
  playbackMultiplier: PlaybackMultiplier;
  simulatedEtaSeconds: number;
  startedAt: string | null;
  updatedAt: string;
}

export interface SimulationConfig {
  missionId: string;
  routeGeometry: [number, number][];
  routeEdgeIds?: string[];
  routeNodeIds?: string[];
  baseVehicleSpeedKmh?: number; // Default: 30 km/h
  initialPlaybackMultiplier?: PlaybackMultiplier; // Default: 1x
  initialTraveledMeters?: number; // For restoring previous runtime progress
  initialStatus?: SimulationStatus;
}
