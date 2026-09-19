import { haversineDistanceMeters } from '../algorithms/utils/haversine';
import type { GeometrySegment, RouteInterpolationResult } from './types';

export class RoutePreprocessor {
  private readonly geometry: [number, number][];
  private readonly segments: GeometrySegment[] = [];
  private readonly totalDistanceMeters: number = 0;
  private readonly edgeIds: string[];
  private readonly nodeIds: string[];

  constructor(
    geometry: [number, number][],
    edgeIds: string[] = [],
    nodeIds: string[] = []
  ) {
    this.geometry = geometry || [];
    this.edgeIds = edgeIds || [];
    this.nodeIds = nodeIds || [];

    if (this.geometry.length < 2) {
      this.totalDistanceMeters = 0;
      return;
    }

    let cumMeters = 0;
    const numPoints = this.geometry.length;
    const numSegments = numPoints - 1;

    for (let i = 0; i < numSegments; i++) {
      const startCoord = this.geometry[i];
      const endCoord = this.geometry[i + 1];
      const dist = haversineDistanceMeters(
        startCoord[0],
        startCoord[1],
        endCoord[0],
        endCoord[1]
      );

      const cumStart = cumMeters;
      cumMeters += dist;
      const cumEnd = cumMeters;

      this.segments.push({
        segmentIndex: i,
        startCoord,
        endCoord,
        segmentDistanceMeters: dist,
        cumulativeStartMeters: cumStart,
        cumulativeEndMeters: cumEnd,
      });
    }

    this.totalDistanceMeters = cumMeters;
    this.assignGraphContext();
  }

  /**
   * Correlates geometry segments with graph edges and nodes based on cumulative distance.
   */
  private assignGraphContext(): void {
    if (this.segments.length === 0 || this.edgeIds.length === 0) return;

    const numEdges = this.edgeIds.length;
    const totalDist = this.totalDistanceMeters;

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      // Approximate edge index based on normalized cumulative position
      const midDist = (seg.cumulativeStartMeters + seg.cumulativeEndMeters) / 2;
      const fraction = totalDist > 0 ? midDist / totalDist : 0;
      const edgeIndex = Math.min(numEdges - 1, Math.floor(fraction * numEdges));

      seg.edgeId = this.edgeIds[edgeIndex];

      if (this.nodeIds.length > 0) {
        const fromNodeIdx = Math.min(this.nodeIds.length - 1, edgeIndex);
        const toNodeIdx = Math.min(this.nodeIds.length - 1, edgeIndex + 1);
        seg.fromNodeId = this.nodeIds[fromNodeIdx];
        seg.toNodeId = this.nodeIds[toNodeIdx];
      }
    }
  }

  public getTotalDistance(): number {
    return this.totalDistanceMeters;
  }

  public getGeometry(): [number, number][] {
    return this.geometry;
  }

  public getSegmentCount(): number {
    return this.segments.length;
  }

  public getSegments(): GeometrySegment[] {
    return this.segments;
  }

  /**
   * Given traveled distance in meters, finds the exact road geometry segment
   * via binary search and returns interpolated geographic coordinates and graph position.
   */
  public interpolateAtDistance(traveledMeters: number): RouteInterpolationResult {
    // 1. Boundary: Empty or degenerate geometry
    if (this.geometry.length === 0) {
      return {
        latitude: 0,
        longitude: 0,
        currentEdgeId: null,
        lastReachedNodeId: null,
        nextNodeId: null,
        currentEdgeProgress: 0,
        segmentIndex: -1,
      };
    }

    if (this.geometry.length === 1 || this.segments.length === 0 || this.totalDistanceMeters === 0) {
      return {
        latitude: this.geometry[0][0],
        longitude: this.geometry[0][1],
        currentEdgeId: this.edgeIds[0] || null,
        lastReachedNodeId: this.nodeIds[0] || null,
        nextNodeId: this.nodeIds[1] || null,
        currentEdgeProgress: 1.0,
        segmentIndex: 0,
      };
    }

    // 2. Boundary: At or before route start
    if (traveledMeters <= 0) {
      const firstSeg = this.segments[0];
      return {
        latitude: firstSeg.startCoord[0],
        longitude: firstSeg.startCoord[1],
        currentEdgeId: firstSeg.edgeId || (this.edgeIds[0] || null),
        lastReachedNodeId: firstSeg.fromNodeId || (this.nodeIds[0] || null),
        nextNodeId: firstSeg.toNodeId || (this.nodeIds[1] || null),
        currentEdgeProgress: 0.0,
        segmentIndex: 0,
      };
    }

    // 3. Boundary: At or past route end (Arrival)
    if (traveledMeters >= this.totalDistanceMeters) {
      const lastSeg = this.segments[this.segments.length - 1];
      const lastNode = this.nodeIds.length > 0 ? this.nodeIds[this.nodeIds.length - 1] : null;
      return {
        latitude: lastSeg.endCoord[0],
        longitude: lastSeg.endCoord[1],
        currentEdgeId: lastSeg.edgeId || (this.edgeIds[this.edgeIds.length - 1] || null),
        lastReachedNodeId: lastNode || lastSeg.toNodeId || null,
        nextNodeId: null,
        currentEdgeProgress: 1.0,
        segmentIndex: this.segments.length - 1,
      };
    }

    // 4. Binary search for segment containing traveledMeters
    let low = 0;
    let high = this.segments.length - 1;
    let matchedSegIndex = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const seg = this.segments[mid];

      if (traveledMeters >= seg.cumulativeStartMeters && traveledMeters <= seg.cumulativeEndMeters) {
        matchedSegIndex = mid;
        break;
      } else if (traveledMeters < seg.cumulativeStartMeters) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    matchedSegIndex = Math.max(0, Math.min(this.segments.length - 1, matchedSegIndex));
    const targetSeg = this.segments[matchedSegIndex];

    // 5. Linear interpolation along the matched segment
    const segmentLength = targetSeg.segmentDistanceMeters;
    let t = 0;
    if (segmentLength > 0.0001) {
      t = (traveledMeters - targetSeg.cumulativeStartMeters) / segmentLength;
      t = Math.max(0, Math.min(1, t));
    }

    const lat = targetSeg.startCoord[0] + t * (targetSeg.endCoord[0] - targetSeg.startCoord[0]);
    const lng = targetSeg.startCoord[1] + t * (targetSeg.endCoord[1] - targetSeg.startCoord[1]);

    // 6. Compute edge-level progress
    const edgeProgress = t;

    return {
      latitude: lat,
      longitude: lng,
      currentEdgeId: targetSeg.edgeId || null,
      lastReachedNodeId: targetSeg.fromNodeId || null,
      nextNodeId: targetSeg.toNodeId || null,
      currentEdgeProgress: edgeProgress,
      segmentIndex: matchedSegIndex,
    };
  }
}
