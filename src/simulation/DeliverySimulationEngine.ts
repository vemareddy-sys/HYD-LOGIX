import type { SimulationStatus } from '../types/logistics';
import { RoutePreprocessor } from './RoutePreprocessor';
import type {
  PlaybackMultiplier,
  RouteInterpolationResult,
  SimulationConfig,
  SimulationSnapshot,
} from './types';

export class DeliverySimulationEngine {
  private readonly missionId: string;
  private readonly preprocessor: RoutePreprocessor;
  private readonly totalDistanceMeters: number;

  private status: SimulationStatus;
  private traveledMeters: number;
  private baseVehicleSpeedKmh: number;
  private playbackMultiplier: PlaybackMultiplier;

  private startedAt: string | null = null;
  private updatedAt: string;

  // Listeners
  private onProgressCallbacks: Set<(snapshot: SimulationSnapshot) => void> = new Set();
  private onStateChangeCallbacks: Set<(status: SimulationStatus, snapshot: SimulationSnapshot) => void> =
    new Set();
  private onArrivalCallbacks: Set<(snapshot: SimulationSnapshot) => void> = new Set();

  constructor(config: SimulationConfig) {
    this.missionId = config.missionId;
    this.preprocessor = new RoutePreprocessor(
      config.routeGeometry,
      config.routeEdgeIds,
      config.routeNodeIds
    );
    this.totalDistanceMeters = this.preprocessor.getTotalDistance();

    this.baseVehicleSpeedKmh = Math.max(1, config.baseVehicleSpeedKmh || 30.0);
    this.playbackMultiplier = config.initialPlaybackMultiplier || 1;

    const initialMeters = Math.max(0, config.initialTraveledMeters || 0);
    this.traveledMeters = Math.min(this.totalDistanceMeters, initialMeters);

    if (config.initialStatus) {
      this.status = config.initialStatus;
    } else if (this.totalDistanceMeters > 0 && this.traveledMeters >= this.totalDistanceMeters) {
      this.status = 'ARRIVED';
    } else {
      this.status = 'READY';
    }

    const now = new Date().toISOString();
    if (this.status === 'RUNNING' || this.traveledMeters > 0) {
      this.startedAt = now;
    }
    this.updatedAt = now;
  }

  // ==========================================
  // Lifecycle Controls
  // ==========================================

  public start(): void {
    if (this.status === 'COMPLETED') return;
    if (this.status === 'ARRIVED') return;

    this.status = 'RUNNING';
    if (!this.startedAt) {
      this.startedAt = new Date().toISOString();
    }
    this.updatedAt = new Date().toISOString();
    this.emitStateChange();
  }

  public pause(): void {
    if (this.status !== 'RUNNING') return;

    this.status = 'PAUSED';
    this.updatedAt = new Date().toISOString();
    this.emitStateChange();
  }

  public resume(): void {
    if (this.status !== 'PAUSED') return;

    this.status = 'RUNNING';
    this.updatedAt = new Date().toISOString();
    this.emitStateChange();
  }

  public complete(): void {
    this.status = 'COMPLETED';
    this.traveledMeters = this.totalDistanceMeters;
    this.updatedAt = new Date().toISOString();
    this.emitStateChange();
  }

  public seekToDistance(meters: number): void {
    this.traveledMeters = Math.max(0, Math.min(this.totalDistanceMeters, meters));
    if (this.totalDistanceMeters > 0 && this.traveledMeters >= this.totalDistanceMeters) {
      if (this.status !== 'COMPLETED') {
        this.status = 'ARRIVED';
        this.emitArrival();
      }
    }
    this.updatedAt = new Date().toISOString();
    this.emitProgress();
  }

  public setPlaybackMultiplier(multiplier: PlaybackMultiplier): void {
    this.playbackMultiplier = multiplier;
    this.updatedAt = new Date().toISOString();
    this.emitProgress();
  }

  public setBaseSpeedKmh(speedKmh: number): void {
    this.baseVehicleSpeedKmh = Math.max(1, speedKmh);
    this.updatedAt = new Date().toISOString();
    this.emitProgress();
  }

  // ==========================================
  // Simulation Clock Tick
  // ==========================================

  /**
   * Advances simulation time by real-world delta seconds.
   * Traveled distance is derived from:
   * deltaSimSeconds = deltaRealSeconds * playbackMultiplier
   * speedMetersPerSecond = (baseVehicleSpeedKmh * 1000) / 3600
   * distanceIncrement = deltaSimSeconds * speedMetersPerSecond
   */
  public tick(deltaRealSeconds: number): SimulationSnapshot {
    if (this.status !== 'RUNNING' || deltaRealSeconds <= 0) {
      return this.getSnapshot();
    }

    const simDeltaSeconds = deltaRealSeconds * this.playbackMultiplier;
    const speedMps = (this.baseVehicleSpeedKmh * 1000) / 3600;
    const distanceDelta = simDeltaSeconds * speedMps;

    const previousDistance = this.traveledMeters;
    this.traveledMeters = Math.min(this.totalDistanceMeters, previousDistance + distanceDelta);
    this.updatedAt = new Date().toISOString();

    // Check for Arrival
    if (this.traveledMeters >= this.totalDistanceMeters && this.status === 'RUNNING') {
      this.status = 'ARRIVED';
      this.emitArrival();
      this.emitStateChange();
    } else {
      this.emitProgress();
    }

    return this.getSnapshot();
  }

  // ==========================================
  // Snapshots & Metrics
  // ==========================================

  public getSnapshot(): SimulationSnapshot {
    const interpolation: RouteInterpolationResult =
      this.preprocessor.interpolateAtDistance(this.traveledMeters);

    const progress =
      this.totalDistanceMeters > 0 ? this.traveledMeters / this.totalDistanceMeters : 0;
    const remainingMeters = Math.max(0, this.totalDistanceMeters - this.traveledMeters);

    // Derived simulated ETA (in presentation seconds remaining)
    const effectiveSpeedMps =
      ((this.baseVehicleSpeedKmh * 1000) / 3600) * this.playbackMultiplier;
    const simulatedEtaSeconds =
      effectiveSpeedMps > 0 ? Math.round(remainingMeters / effectiveSpeedMps) : 0;

    return {
      missionId: this.missionId,
      status: this.status,
      traveledMeters: Math.round(this.traveledMeters * 10) / 10,
      totalMeters: Math.round(this.totalDistanceMeters * 10) / 10,
      progress: Math.min(1.0, Math.max(0.0, progress)),
      remainingMeters: Math.round(remainingMeters * 10) / 10,
      currentLat: interpolation.latitude,
      currentLng: interpolation.longitude,
      currentEdgeId: interpolation.currentEdgeId,
      currentEdgeProgress: interpolation.currentEdgeProgress,
      lastReachedNodeId: interpolation.lastReachedNodeId,
      nextNodeId: interpolation.nextNodeId,
      baseVehicleSpeedKmh: this.baseVehicleSpeedKmh,
      playbackMultiplier: this.playbackMultiplier,
      simulatedEtaSeconds,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt,
    };
  }

  public getPreprocessor(): RoutePreprocessor {
    return this.preprocessor;
  }

  public getStatus(): SimulationStatus {
    return this.status;
  }

  public getTraveledMeters(): number {
    return this.traveledMeters;
  }

  public getTotalMeters(): number {
    return this.totalDistanceMeters;
  }

  // ==========================================
  // Event Subscriptions
  // ==========================================

  public onProgress(cb: (snapshot: SimulationSnapshot) => void): () => void {
    this.onProgressCallbacks.add(cb);
    return () => this.onProgressCallbacks.delete(cb);
  }

  public onStateChange(
    cb: (status: SimulationStatus, snapshot: SimulationSnapshot) => void
  ): () => void {
    this.onStateChangeCallbacks.add(cb);
    return () => this.onStateChangeCallbacks.delete(cb);
  }

  public onArrival(cb: (snapshot: SimulationSnapshot) => void): () => void {
    this.onArrivalCallbacks.add(cb);
    return () => this.onArrivalCallbacks.delete(cb);
  }

  private emitProgress(): void {
    const snapshot = this.getSnapshot();
    for (const cb of this.onProgressCallbacks) {
      cb(snapshot);
    }
  }

  private emitStateChange(): void {
    const snapshot = this.getSnapshot();
    for (const cb of this.onStateChangeCallbacks) {
      cb(this.status, snapshot);
    }
  }

  private emitArrival(): void {
    const snapshot = this.getSnapshot();
    for (const cb of this.onArrivalCallbacks) {
      cb(snapshot);
    }
  }
}
