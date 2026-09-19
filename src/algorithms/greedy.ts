import type { GraphEngine } from '../graph/GraphEngine';
import type { SearchRequest, SearchResult, SearchEvent } from './types';
import { PriorityQueue } from './utils/PriorityQueue';
import { haversineDistanceMeters } from './utils/haversine';

export function runGreedy(graph: GraphEngine, request: SearchRequest): SearchResult {
  const startTime = performance.now();
  const { startNodeId, goalNodeId, traceEnabled = false } = request;

  const events: SearchEvent[] = [];
  const visitedOrder: string[] = [];

  const goalNode = graph.getNode(goalNodeId);
  const startNode = graph.getNode(startNodeId);

  if (!startNode || !goalNode) {
    return {
      algorithm: 'GREEDY',
      found: false,
      startNodeId,
      goalNodeId,
      pathNodeIds: [],
      pathEdgeIds: [],
      distanceMeters: 0,
      effectiveCost: 0,
      hopCount: 0,
      exploredCount: 0,
      executionMs: Math.round((performance.now() - startTime) * 100) / 100,
      visitedOrder: [],
      trace: traceEnabled ? { events, totalEvents: 0 } : undefined,
    };
  }

  // Boundary Case: Start equals Goal
  if (startNodeId === goalNodeId) {
    const execMs = performance.now() - startTime;
    if (traceEnabled) {
      events.push({
        type: 'SEARCH_STARTED',
        nodeId: startNodeId,
        heuristic: 0,
        frontierSize: 1,
        visitedSize: 0,
        message: 'Start and goal are identical.',
      });
      events.push({
        type: 'GOAL_FOUND',
        nodeId: startNodeId,
        heuristic: 0,
        frontierSize: 0,
        visitedSize: 1,
      });
      events.push({
        type: 'PATH_FINALIZED',
        nodeId: startNodeId,
        heuristic: 0,
        frontierSize: 0,
        visitedSize: 1,
      });
    }

    return {
      algorithm: 'GREEDY',
      found: true,
      startNodeId,
      goalNodeId,
      pathNodeIds: [startNodeId],
      pathEdgeIds: [],
      distanceMeters: 0,
      effectiveCost: 0,
      hopCount: 0,
      exploredCount: 1,
      executionMs: Math.round(execMs * 100) / 100,
      visitedOrder: [startNodeId],
      trace: traceEnabled ? { events, totalEvents: events.length } : undefined,
    };
  }

  const initialH = haversineDistanceMeters(startNode.lat, startNode.lng, goalNode.lat, goalNode.lng);

  // Predecessor map tracking parent node and traversing edge ID
  const predecessors = new Map<string, { fromNodeId: string; edgeId: string; h: number }>();
  const visited = new Set<string>();

  // Min-Priority Queue keyed on h(n) only
  const pq = new PriorityQueue<{ nodeId: string; h: number }>();
  pq.push({ nodeId: startNodeId, h: initialH }, initialH);

  if (traceEnabled) {
    events.push({
      type: 'SEARCH_STARTED',
      nodeId: startNodeId,
      heuristic: Math.round(initialH),
      frontierSize: pq.size(),
      visitedSize: visited.size,
      message: `Greedy Best-First started from ${startNodeId} to ${goalNodeId} (h=${Math.round(initialH)}m)`,
    });
  }

  let goalReached = false;

  while (!pq.isEmpty()) {
    const entry = pq.pop();
    if (!entry) break;

    const { nodeId: currentId, h: currentH } = entry;

    if (visited.has(currentId)) continue;

    visited.add(currentId);
    visitedOrder.push(currentId);

    const currentPred = predecessors.get(currentId);

    if (traceEnabled) {
      events.push({
        type: 'NODE_EXPANDED',
        nodeId: currentId,
        fromNodeId: currentPred?.fromNodeId,
        edgeId: currentPred?.edgeId,
        heuristic: Math.round(currentH),
        frontierSize: pq.size(),
        visitedSize: visited.size,
      });
    }

    if (currentId === goalNodeId) {
      goalReached = true;
      if (traceEnabled) {
        events.push({
          type: 'GOAL_FOUND',
          nodeId: currentId,
          heuristic: 0,
          frontierSize: pq.size(),
          visitedSize: visited.size,
          message: `Goal ${goalNodeId} reached by Greedy search`,
        });
      }
      break;
    }

    const outgoingEdges = graph.getOutgoingEdges(currentId);
    for (let i = 0; i < outgoingEdges.length; i++) {
      const edge = outgoingEdges[i];

      // Skip blocked edges
      if (edge.blocked) continue;

      const neighborId = edge.to;
      if (visited.has(neighborId)) continue;

      const neighborNode = graph.getNode(neighborId);
      if (!neighborNode) continue;

      const h = haversineDistanceMeters(neighborNode.lat, neighborNode.lng, goalNode.lat, goalNode.lng);

      // If neighbor has not been discovered or we found an edge to it
      if (!predecessors.has(neighborId)) {
        predecessors.set(neighborId, {
          fromNodeId: currentId,
          edgeId: edge.id,
          h,
        });

        pq.push({ nodeId: neighborId, h }, h);

        if (traceEnabled) {
          events.push({
            type: 'NODE_DISCOVERED',
            nodeId: neighborId,
            fromNodeId: currentId,
            edgeId: edge.id,
            heuristic: Math.round(h),
            frontierSize: pq.size(),
            visitedSize: visited.size,
          });
        }
      }
    }
  }

  const executionMs = Math.round((performance.now() - startTime) * 100) / 100;

  if (!goalReached) {
    return {
      algorithm: 'GREEDY',
      found: false,
      startNodeId,
      goalNodeId,
      pathNodeIds: [],
      pathEdgeIds: [],
      distanceMeters: 0,
      effectiveCost: 0,
      hopCount: 0,
      exploredCount: visitedOrder.length,
      executionMs,
      visitedOrder,
      trace: traceEnabled ? { events, totalEvents: events.length } : undefined,
    };
  }

  // Reconstruct Path
  const pathNodeIds: string[] = [];
  const pathEdgeIds: string[] = [];
  let curr = goalNodeId;

  while (curr !== startNodeId) {
    pathNodeIds.push(curr);
    const pred = predecessors.get(curr);
    if (!pred) break;
    pathEdgeIds.push(pred.edgeId);
    curr = pred.fromNodeId;
  }
  pathNodeIds.push(startNodeId);
  pathNodeIds.reverse();
  pathEdgeIds.reverse();

  let totalDistance = 0;
  let totalEffectiveCost = 0;

  for (let i = 0; i < pathEdgeIds.length; i++) {
    const edge = graph.getEdge(pathEdgeIds[i]);
    if (edge) {
      totalDistance += edge.lengthMeters;
      totalEffectiveCost += edge.lengthMeters * (edge.trafficFactor ?? 1.0);
    }
  }

  if (traceEnabled) {
    events.push({
      type: 'PATH_FINALIZED',
      nodeId: goalNodeId,
      heuristic: 0,
      frontierSize: pq.size(),
      visitedSize: visited.size,
      message: `Greedy Path finalized: ${pathNodeIds.length} nodes, ${pathEdgeIds.length} edges`,
    });
  }

  return {
    algorithm: 'GREEDY',
    found: true,
    startNodeId,
    goalNodeId,
    pathNodeIds,
    pathEdgeIds,
    distanceMeters: Math.round(totalDistance * 100) / 100,
    effectiveCost: Math.round(totalEffectiveCost * 100) / 100,
    hopCount: pathEdgeIds.length,
    exploredCount: visitedOrder.length,
    executionMs,
    visitedOrder,
    trace: traceEnabled ? { events, totalEvents: events.length } : undefined,
  };
}
