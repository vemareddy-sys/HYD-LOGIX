import type { GraphEngine } from '../graph/GraphEngine';
import type { SearchRequest, SearchResult, SearchEvent } from './types';
import { PriorityQueue } from './utils/PriorityQueue';
import { haversineDistanceMeters } from './utils/haversine';

export function runAStar(graph: GraphEngine, request: SearchRequest): SearchResult {
  const startTime = performance.now();
  const { startNodeId, goalNodeId, traceEnabled = false } = request;

  const events: SearchEvent[] = [];
  const visitedOrder: string[] = [];

  const startNode = graph.getNode(startNodeId);
  const goalNode = graph.getNode(goalNodeId);

  if (!startNode || !goalNode) {
    return {
      algorithm: 'ASTAR',
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
        cost: 0,
        heuristic: 0,
        fCost: 0,
        frontierSize: 1,
        visitedSize: 0,
        message: 'Start and goal are identical.',
      });
      events.push({
        type: 'GOAL_FOUND',
        nodeId: startNodeId,
        cost: 0,
        heuristic: 0,
        fCost: 0,
        frontierSize: 0,
        visitedSize: 1,
      });
      events.push({
        type: 'PATH_FINALIZED',
        nodeId: startNodeId,
        cost: 0,
        heuristic: 0,
        fCost: 0,
        frontierSize: 0,
        visitedSize: 1,
      });
    }

    return {
      algorithm: 'ASTAR',
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

  // Accumulated road cost g(n)
  const gScoreMap = new Map<string, number>();
  // Predecessors map for path reconstruction
  const predecessors = new Map<
    string,
    { fromNodeId: string; edgeId: string; g: number; h: number; f: number }
  >();
  // Closed set of finalized nodes
  const closedSet = new Set<string>();

  // Priority Queue sorted by f(n) = g(n) + h(n)
  const pq = new PriorityQueue<{ nodeId: string; g: number; h: number; f: number }>();

  const initialH = haversineDistanceMeters(startNode.lat, startNode.lng, goalNode.lat, goalNode.lng);
  gScoreMap.set(startNodeId, 0);
  pq.push({ nodeId: startNodeId, g: 0, h: initialH, f: initialH }, initialH);

  if (traceEnabled) {
    events.push({
      type: 'SEARCH_STARTED',
      nodeId: startNodeId,
      cost: 0,
      heuristic: Math.round(initialH),
      fCost: Math.round(initialH),
      frontierSize: pq.size(),
      visitedSize: closedSet.size,
      message: `A* search started from ${startNodeId} to ${goalNodeId} (h=${Math.round(initialH)}m)`,
    });
  }

  let goalReached = false;

  while (!pq.isEmpty()) {
    const entry = pq.pop();
    if (!entry) break;

    const { nodeId: currentId, g: currentG, h: currentH, f: currentF } = entry;

    // Discard stale entries or closed nodes
    if (closedSet.has(currentId)) continue;
    if (currentG > (gScoreMap.get(currentId) ?? Infinity)) continue;

    closedSet.add(currentId);
    visitedOrder.push(currentId);

    const currentPred = predecessors.get(currentId);

    if (traceEnabled) {
      events.push({
        type: 'NODE_EXPANDED',
        nodeId: currentId,
        fromNodeId: currentPred?.fromNodeId,
        edgeId: currentPred?.edgeId,
        cost: Math.round(currentG),
        heuristic: Math.round(currentH),
        fCost: Math.round(currentF),
        frontierSize: pq.size(),
        visitedSize: closedSet.size,
      });
    }

    // Goal reached upon dequeue
    if (currentId === goalNodeId) {
      goalReached = true;
      if (traceEnabled) {
        events.push({
          type: 'GOAL_FOUND',
          nodeId: currentId,
          cost: Math.round(currentG),
          heuristic: 0,
          fCost: Math.round(currentG),
          frontierSize: pq.size(),
          visitedSize: closedSet.size,
          message: `Goal ${goalNodeId} reached with cost ${Math.round(currentG)}`,
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
      if (closedSet.has(neighborId)) continue;

      const neighborNode = graph.getNode(neighborId);
      if (!neighborNode) continue;

      const edgeCost = edge.lengthMeters * (edge.trafficFactor ?? 1.0);
      const tentativeG = currentG + edgeCost;
      const existingG = gScoreMap.get(neighborId) ?? Infinity;

      if (tentativeG < existingG) {
        const neighborH = haversineDistanceMeters(
          neighborNode.lat,
          neighborNode.lng,
          goalNode.lat,
          goalNode.lng
        );
        const neighborF = tentativeG + neighborH;

        gScoreMap.set(neighborId, tentativeG);
        predecessors.set(neighborId, {
          fromNodeId: currentId,
          edgeId: edge.id,
          g: tentativeG,
          h: neighborH,
          f: neighborF,
        });

        pq.push(
          { nodeId: neighborId, g: tentativeG, h: neighborH, f: neighborF },
          neighborF
        );

        if (traceEnabled) {
          events.push({
            type: existingG === Infinity ? 'NODE_DISCOVERED' : 'FRONTIER_UPDATED',
            nodeId: neighborId,
            fromNodeId: currentId,
            edgeId: edge.id,
            cost: Math.round(tentativeG),
            heuristic: Math.round(neighborH),
            fCost: Math.round(neighborF),
            frontierSize: pq.size(),
            visitedSize: closedSet.size,
          });
        }
      }
    }
  }

  const executionMs = Math.round((performance.now() - startTime) * 100) / 100;

  if (!goalReached) {
    return {
      algorithm: 'ASTAR',
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
      cost: Math.round(totalEffectiveCost),
      heuristic: 0,
      fCost: Math.round(totalEffectiveCost),
      frontierSize: pq.size(),
      visitedSize: closedSet.size,
      message: `A* Path finalized: ${pathNodeIds.length} nodes, ${pathEdgeIds.length} edges`,
    });
  }

  return {
    algorithm: 'ASTAR',
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
