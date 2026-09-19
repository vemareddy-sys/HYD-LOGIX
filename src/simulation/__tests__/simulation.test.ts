import { describe, it, expect, vi } from 'vitest';
import { RoutePreprocessor } from '../RoutePreprocessor';
import { DeliverySimulationEngine } from '../DeliverySimulationEngine';
import { haversineDistanceMeters } from '../../algorithms/utils/haversine';

describe('Phase 06 — Delivery Simulation Engine Unit Test Suite', () => {
  // Simple 3-point corridor in Hyderabad
  // Point A: Gachibowli Hub (17.4401, 78.3489)
  // Point B: Intermediate Junction (17.4435, 78.3772)
  // Point C: Jubilee Hills (17.4319, 78.4071)
  const sampleGeometry: [number, number][] = [
    [17.4401, 78.3489],
    [17.4435, 78.3772],
    [17.4319, 78.4071],
  ];

  const sampleEdgeIds = ['edge_gachibowli_hitec', 'edge_hitec_jubilee'];
  const sampleNodeIds = ['node_gachibowli', 'node_hitec', 'node_jubilee'];

  // ==========================================
  // 1. Cumulative Geometry Distances
  // ==========================================
  describe('1. Cumulative Geometry Distances', () => {
    it('accurately computes segment lengths and monotonic cumulative distance', () => {
      const preprocessor = new RoutePreprocessor(sampleGeometry, sampleEdgeIds, sampleNodeIds);

      const d1 = haversineDistanceMeters(
        sampleGeometry[0][0],
        sampleGeometry[0][1],
        sampleGeometry[1][0],
        sampleGeometry[1][1]
      );
      const d2 = haversineDistanceMeters(
        sampleGeometry[1][0],
        sampleGeometry[1][1],
        sampleGeometry[2][0],
        sampleGeometry[2][1]
      );
      const expectedTotal = d1 + d2;

      expect(preprocessor.getSegmentCount()).toBe(2);
      expect(preprocessor.getTotalDistance()).toBeCloseTo(expectedTotal, 1);

      const segments = preprocessor.getSegments();
      expect(segments[0].cumulativeStartMeters).toBe(0);
      expect(segments[0].cumulativeEndMeters).toBeCloseTo(d1, 1);
      expect(segments[1].cumulativeStartMeters).toBeCloseTo(d1, 1);
      expect(segments[1].cumulativeEndMeters).toBeCloseTo(expectedTotal, 1);
    });
  });

  // ==========================================
  // 2. Distance-Based Interpolation
  // ==========================================
  describe('2. Distance-Based Interpolation', () => {
    it('linearly interpolates lat/lng at fractional distance along a segment', () => {
      const preprocessor = new RoutePreprocessor(sampleGeometry, sampleEdgeIds, sampleNodeIds);
      const halfFirstSegment = preprocessor.getSegments()[0].segmentDistanceMeters / 2;

      const res = preprocessor.interpolateAtDistance(halfFirstSegment);

      // Midpoint of segment 0
      const expectedLat = (sampleGeometry[0][0] + sampleGeometry[1][0]) / 2;
      const expectedLng = (sampleGeometry[0][1] + sampleGeometry[1][1]) / 2;

      expect(res.latitude).toBeCloseTo(expectedLat, 4);
      expect(res.longitude).toBeCloseTo(expectedLng, 4);
      expect(res.currentEdgeId).toBe('edge_gachibowli_hitec');
      expect(res.segmentIndex).toBe(0);
    });
  });

  // ==========================================
  // 3. Progress Calculation
  // ==========================================
  describe('3. Progress Calculation', () => {
    it('calculates exact progress fraction and remaining meters', () => {
      const engine = new DeliverySimulationEngine({
        missionId: 'msn-test-01',
        routeGeometry: sampleGeometry,
        routeEdgeIds: sampleEdgeIds,
        routeNodeIds: sampleNodeIds,
        baseVehicleSpeedKmh: 30,
      });

      const total = engine.getTotalMeters();
      engine.seekToDistance(total * 0.4);

      const snap = engine.getSnapshot();
      expect(snap.traveledMeters).toBeCloseTo(total * 0.4, 1);
      expect(snap.progress).toBeCloseTo(0.4, 2);
      expect(snap.remainingMeters).toBeCloseTo(total * 0.6, 1);
      expect(snap.status).toBe('READY');
    });
  });

  // ==========================================
  // 4. Segment Transition & Graph Tracking
  // ==========================================
  describe('4. Segment Transition & Graph Tracking', () => {
    it('advances currentEdgeId and node references as distance crosses segment boundary', () => {
      const preprocessor = new RoutePreprocessor(sampleGeometry, sampleEdgeIds, sampleNodeIds);
      const seg0 = preprocessor.getSegments()[0];

      // Just before crossing into segment 1
      const beforeBoundary = preprocessor.interpolateAtDistance(seg0.segmentDistanceMeters - 10);
      expect(beforeBoundary.segmentIndex).toBe(0);
      expect(beforeBoundary.currentEdgeId).toBe('edge_gachibowli_hitec');
      expect(beforeBoundary.lastReachedNodeId).toBe('node_gachibowli');
      expect(beforeBoundary.nextNodeId).toBe('node_hitec');

      // Just after crossing into segment 1
      const afterBoundary = preprocessor.interpolateAtDistance(seg0.segmentDistanceMeters + 10);
      expect(afterBoundary.segmentIndex).toBe(1);
      expect(afterBoundary.currentEdgeId).toBe('edge_hitec_jubilee');
      expect(afterBoundary.lastReachedNodeId).toBe('node_hitec');
      expect(afterBoundary.nextNodeId).toBe('node_jubilee');
    });
  });

  // ==========================================
  // 5. Pause and Resume Behavior
  // ==========================================
  describe('5. Pause and Resume Behavior', () => {
    it('freezes position when paused and resumes seamlessly from same distance', () => {
      const engine = new DeliverySimulationEngine({
        missionId: 'msn-test-02',
        routeGeometry: sampleGeometry,
        baseVehicleSpeedKmh: 36, // 10 m/s
      });

      engine.start();
      expect(engine.getStatus()).toBe('RUNNING');

      // Tick 5 real seconds at 10 m/s -> 50 meters
      engine.tick(5.0);
      expect(engine.getTraveledMeters()).toBeCloseTo(50, 1);

      // Pause
      engine.pause();
      expect(engine.getStatus()).toBe('PAUSED');

      // Tick while paused -> distance should NOT advance
      engine.tick(10.0);
      expect(engine.getTraveledMeters()).toBeCloseTo(50, 1);

      // Resume
      engine.resume();
      expect(engine.getStatus()).toBe('RUNNING');

      // Tick 2 more seconds -> advances to 70 meters
      engine.tick(2.0);
      expect(engine.getTraveledMeters()).toBeCloseTo(70, 1);
    });
  });

  // ==========================================
  // 6. Playback Multiplier
  // ==========================================
  describe('6. Playback Multiplier (1x, 2x, 4x)', () => {
    it('accelerates distance progression proportionally without changing physical vehicle speed', () => {
      const baseSpeedKmh = 36; // 10 m/s
      const engine1x = new DeliverySimulationEngine({
        missionId: 'msn-1x',
        routeGeometry: sampleGeometry,
        baseVehicleSpeedKmh: baseSpeedKmh,
        initialPlaybackMultiplier: 1,
      });

      const engine4x = new DeliverySimulationEngine({
        missionId: 'msn-4x',
        routeGeometry: sampleGeometry,
        baseVehicleSpeedKmh: baseSpeedKmh,
        initialPlaybackMultiplier: 4,
      });

      engine1x.start();
      engine4x.start();

      // Tick 1 real second
      engine1x.tick(1.0);
      engine4x.tick(1.0);

      // 1x moves 10m; 4x moves 40m
      expect(engine1x.getTraveledMeters()).toBeCloseTo(10, 1);
      expect(engine4x.getTraveledMeters()).toBeCloseTo(40, 1);

      // Physical speed setting remains identical (36 km/h)
      expect(engine1x.getSnapshot().baseVehicleSpeedKmh).toBe(36);
      expect(engine4x.getSnapshot().baseVehicleSpeedKmh).toBe(36);
    });
  });

  // ==========================================
  // 7. Arrival Detection
  // ==========================================
  describe('7. Arrival Detection', () => {
    it('transitions to ARRIVED and fires onArrival when traveled distance reaches 100%', () => {
      const arrivalCallback = vi.fn();

      const engine = new DeliverySimulationEngine({
        missionId: 'msn-test-03',
        routeGeometry: sampleGeometry,
        routeNodeIds: sampleNodeIds,
        baseVehicleSpeedKmh: 100,
      });

      engine.onArrival(arrivalCallback);
      engine.start();

      const totalDist = engine.getTotalMeters();
      // Tick large enough to exceed entire route
      engine.tick(totalDist);

      expect(engine.getStatus()).toBe('ARRIVED');
      expect(engine.getTraveledMeters()).toBe(totalDist);
      expect(arrivalCallback).toHaveBeenCalledTimes(1);

      const snap = engine.getSnapshot();
      expect(snap.status).toBe('ARRIVED');
      expect(snap.progress).toBe(1.0);
      expect(snap.remainingMeters).toBe(0);
      expect(snap.currentLat).toBe(sampleGeometry[2][0]);
      expect(snap.currentLng).toBe(sampleGeometry[2][1]);
      expect(snap.lastReachedNodeId).toBe('node_jubilee');
      expect(snap.nextNodeId).toBeNull();
    });
  });

  // ==========================================
  // 8. Zero and Invalid Route Handling
  // ==========================================
  describe('8. Zero and Invalid Route Handling', () => {
    it('handles empty route geometry safely without crashing', () => {
      const preprocessor = new RoutePreprocessor([]);
      expect(preprocessor.getTotalDistance()).toBe(0);
      expect(preprocessor.getSegmentCount()).toBe(0);

      const res = preprocessor.interpolateAtDistance(100);
      expect(res.latitude).toBe(0);
      expect(res.longitude).toBe(0);
      expect(res.currentEdgeId).toBeNull();
    });

    it('handles single-point route geometry safely', () => {
      const preprocessor = new RoutePreprocessor([[17.44, 78.34]]);
      expect(preprocessor.getTotalDistance()).toBe(0);

      const res = preprocessor.interpolateAtDistance(50);
      expect(res.latitude).toBe(17.44);
      expect(res.longitude).toBe(78.34);
      expect(res.currentEdgeProgress).toBe(1.0);
    });

    it('handles negative or oversized seek distance with proper clamping', () => {
      const engine = new DeliverySimulationEngine({
        missionId: 'msn-test-04',
        routeGeometry: sampleGeometry,
      });

      engine.seekToDistance(-500);
      expect(engine.getTraveledMeters()).toBe(0);

      engine.seekToDistance(99999999);
      expect(engine.getTraveledMeters()).toBe(engine.getTotalMeters());
      expect(engine.getStatus()).toBe('ARRIVED');
    });
  });
});
