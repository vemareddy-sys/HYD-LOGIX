export type AlgorithmType = 'BFS' | 'UCS' | 'GREEDY' | 'ASTAR';

export interface SearchRequest {
  startNodeId: string;
  goalNodeId: string;
  traceEnabled?: boolean;
}

export type SearchEventType =
  | 'SEARCH_STARTED'
  | 'NODE_DISCOVERED'
  | 'NODE_EXPANDED'
  | 'NODE_VISITED'
  | 'FRONTIER_UPDATED'
  | 'GOAL_FOUND'
  | 'PATH_FINALIZED';

export interface SearchEvent {
  type: SearchEventType;
  nodeId: string;
  fromNodeId?: string;
  edgeId?: string;
  depth?: number;
  cost?: number; // g(n) accumulated effectiveCost
  heuristic?: number; // h(n) Haversine distance
  fCost?: number; // f(n) = g(n) + h(n)
  frontierSize: number;
  visitedSize: number;
  message?: string;
}

export interface SearchTrace {
  events: SearchEvent[];
  totalEvents: number;
}

export interface SearchResult {
  algorithm: AlgorithmType;
  found: boolean;
  startNodeId: string;
  goalNodeId: string;
  pathNodeIds: string[];
  pathEdgeIds: string[];
  distanceMeters: number;
  effectiveCost: number;
  hopCount: number;
  exploredCount: number;
  executionMs: number;
  visitedOrder: string[];
  trace?: SearchTrace;
}
