import type { GraphEngine } from '../graph/GraphEngine';
import type { SearchRequest, SearchResult, SearchEvent } from './types';
import { PriorityQueue } from './utils/PriorityQueue';

export function runUCS(graph: GraphEngine, request: SearchRequest): SearchResult {
  const startTime = performance.now();
  const { startNodeId, goalNodeId, traceEnabled = false } = request;

  const events: SearchEvent[] = [];
  const visitedOrder: string[] = [];

  // Boundary Case: Start equals Goal
  if (startNodeId === goalNodeId) {
    const execMs = performance.now() - startTime;
    if (traceEnabled) {
      events.push({
        type: 'SEARCH_STARTED',
        nodeId: startNodeId,
        cost: 0,
        frontierSize: 1,
        visitedSize: 0,
        message: 'Start and goal are identical.',
      });
      events.push({
        type: 'GOAL_FOUND',
        nodeId: startNodeId,
        cost: 0,
        frontierSize: 0,
        visitedSize: 1,
      });
      events.push({
        type: 'PATH_FINALIZED',
        nodeId: startNodeId,
        cost: 0,
        frontierSize: 0,
        visitedSize: 1,
      });
    }

    return {
      algorithm: 'UCS',
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

  // Min cost g(n) known so far
  const distMap = new Map<string, number>();
  // Predecessor tracking for path reconstruction
  const predecessors = new Map<string, { fromNodeId: string; edgeId: string; cost: number }>();
  // Closed set / finalized nodes
  const settled = new Set<string>();

  // Min-Priority Queue keyed on accumulated g(n)
  const pq = new PriorityQueue<{ nodeId: string; cost: number }>();

  distMap.set(startNodeId, 0);
  pq.push({ nodeId: startNodeId, cost: 0 }, 0);

  if (traceEnabled) {
    events.push({
      type: 'SEARCH_STARTED',
      nodeId: startNodeId,
      cost: 0,
      frontierSize: pq.size(),
      visitedSize: settled.size,
      message: `UCS started from ${startNodeId} to ${goalNodeId}`,
    });
  }

  let goalReached = false;

  while (!pq.isEmpty()) {
    const entry = pq.pop();
    if (!entry) break;

    const { nodeId: currentId, cost: currentCost } = entry;

    // Discard stale entries
    if (settled.has(currentId)) continue;
    if (currentCost > (distMap.get(currentId) ?? Infinity)) continue;

    settled.add(currentId);
    visitedOrder.push(currentId);

    const currentPred = predecessors.get(currentId);

    if (traceEnabled) {
      events.push({
        type: 'NODE_EXPANDED',
        nodeId: currentId,
        fromNodeId: currentPred?.fromNodeId,
        edgeId: currentPred?.edgeId,
        cost: currentCost,
        frontierSize: pq.size(),
        visitedSize: settled.size,
      });
    }

    // Goal Check on Dequeue (guarantees minimum cost)
    if (currentId === goalNodeId) {
      goalReached = true;
      if (traceEnabled) {
        events.push({
          type: 'GOAL_FOUND',
          nodeId: currentId,
          cost: currentCost,
          frontierSize: pq.size(),
          visitedSize: settled.size,
          message: `Goal ${goalNodeId} reached with cost ${Math.round(currentCost)}`,
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
      if (settled.has(neighborId)) continue;

      const edgeCost = edge.lengthMeters * (edge.trafficFactor ?? 1.0);
      const newCost = currentCost + edgeCost;
      const existingCost = distMap.get(neighborId) ?? Infinity;

      if (newCost < existingCost) {
        distMap.set(neighborId, newCost);
        predecessors.set(neighborId, {
          fromNodeId: currentId,
          edgeId: edge.id,
          cost: newCost,
        });

        pq.push({ nodeId: neighborId, cost: newCost }, newCost);

        if (traceEnabled) {
          events.push({
            type: existingCost === Infinity ? 'NODE_DISCOVERED' : 'FRONTIER_UPDATED',
            nodeId: neighborId,
            fromNodeId: currentId,
            edgeId: edge.id,
            cost: newCost,
            frontierSize: pq.size(),
            visitedSize: settled.size,
          });
        }
      }
    }
  }

  const executionMs = Math.round((performance.now() - startTime) * 100) / 100;

  if (!goalReached) {
    return {
      algorithm: 'UCS',
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
      cost: totalEffectiveCost,
      frontierSize: pq.size(),
      visitedSize: settled.size,
      message: `UCS Path finalized: ${pathNodeIds.length} nodes, ${pathEdgeIds.length} edges`,
    });
  }

  return {
    algorithm: 'UCS',
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
