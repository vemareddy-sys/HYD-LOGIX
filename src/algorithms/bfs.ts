import type { GraphEngine } from '../graph/GraphEngine';
import type { SearchRequest, SearchResult, SearchEvent } from './types';

export function runBFS(graph: GraphEngine, request: SearchRequest): SearchResult {
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
        depth: 0,
        frontierSize: 1,
        visitedSize: 0,
        message: 'Start and goal are identical.',
      });
      events.push({
        type: 'GOAL_FOUND',
        nodeId: startNodeId,
        depth: 0,
        frontierSize: 0,
        visitedSize: 1,
      });
      events.push({
        type: 'PATH_FINALIZED',
        nodeId: startNodeId,
        depth: 0,
        frontierSize: 0,
        visitedSize: 1,
      });
    }

    return {
      algorithm: 'BFS',
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

  // Predecessor map tracking parent node, traversing edge ID, and hop depth
  const predecessors = new Map<string, { fromNodeId: string; edgeId: string; depth: number }>();
  const visited = new Set<string>();
  
  // FIFO Queue with head pointer to maintain O(1) dequeue
  const queue: string[] = [startNodeId];
  let queueHead = 0;
  visited.add(startNodeId);

  if (traceEnabled) {
    events.push({
      type: 'SEARCH_STARTED',
      nodeId: startNodeId,
      depth: 0,
      frontierSize: 1,
      visitedSize: 1,
      message: `BFS search started from ${startNodeId} to ${goalNodeId}`,
    });
  }

  let goalReached = false;

  while (queueHead < queue.length) {
    const currentId = queue[queueHead++];
    visitedOrder.push(currentId);

    const currentPredecessor = predecessors.get(currentId);
    const currentDepth = currentPredecessor ? currentPredecessor.depth : 0;

    if (traceEnabled) {
      events.push({
        type: 'NODE_EXPANDED',
        nodeId: currentId,
        fromNodeId: currentPredecessor?.fromNodeId,
        edgeId: currentPredecessor?.edgeId,
        depth: currentDepth,
        frontierSize: queue.length - queueHead,
        visitedSize: visited.size,
      });
    }

    if (currentId === goalNodeId) {
      goalReached = true;
      if (traceEnabled) {
        events.push({
          type: 'GOAL_FOUND',
          nodeId: currentId,
          depth: currentDepth,
          frontierSize: queue.length - queueHead,
          visitedSize: visited.size,
          message: `Goal ${goalNodeId} reached at depth ${currentDepth}`,
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

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        predecessors.set(neighborId, {
          fromNodeId: currentId,
          edgeId: edge.id,
          depth: currentDepth + 1,
        });

        queue.push(neighborId);

        if (traceEnabled) {
          events.push({
            type: 'NODE_DISCOVERED',
            nodeId: neighborId,
            fromNodeId: currentId,
            edgeId: edge.id,
            depth: currentDepth + 1,
            frontierSize: queue.length - queueHead,
            visitedSize: visited.size,
          });
        }
      }
    }
  }

  const executionMs = Math.round((performance.now() - startTime) * 100) / 100;

  if (!goalReached) {
    return {
      algorithm: 'BFS',
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
      depth: pathEdgeIds.length,
      frontierSize: queue.length - queueHead,
      visitedSize: visited.size,
      message: `Path finalized: ${pathNodeIds.length} nodes, ${pathEdgeIds.length} edges`,
    });
  }

  return {
    algorithm: 'BFS',
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
