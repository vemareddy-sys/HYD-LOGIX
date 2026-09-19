import type { GraphEngine } from '../graph/GraphEngine';
import type { AlgorithmType, SearchRequest, SearchResult } from './types';
import { runBFS } from './bfs';
import { runUCS } from './ucs';
import { runGreedy } from './greedy';
import { runAStar } from './astar';

export * from './types';
export * from './utils/PriorityQueue';
export * from './utils/haversine';
export { runBFS } from './bfs';
export { runUCS } from './ucs';
export { runGreedy } from './greedy';
export { runAStar } from './astar';
export * from './stopPlanner';

export function runAlgorithm(
  type: AlgorithmType,
  graph: GraphEngine,
  request: SearchRequest
): SearchResult {
  switch (type) {
    case 'BFS':
      return runBFS(graph, request);
    case 'UCS':
      return runUCS(graph, request);
    case 'GREEDY':
      return runGreedy(graph, request);
    case 'ASTAR':
      return runAStar(graph, request);
    default:
      throw new Error(`Unsupported algorithm type: ${type}`);
  }
}

export function compareAll(
  graph: GraphEngine,
  startNodeId: string,
  goalNodeId: string
): Record<AlgorithmType, SearchResult> {
  const request: SearchRequest = {
    startNodeId,
    goalNodeId,
    traceEnabled: false,
  };

  return {
    BFS: runBFS(graph, request),
    UCS: runUCS(graph, request),
    GREEDY: runGreedy(graph, request),
    ASTAR: runAStar(graph, request),
  };
}
