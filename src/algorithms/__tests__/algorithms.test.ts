import { describe, it, expect } from 'vitest';
import { GraphEngine } from '../../graph/GraphEngine';
import type { GraphNode, GraphEdge } from '../../graph/types';
import { runBFS } from '../bfs';
import { runUCS } from '../ucs';
import { runGreedy } from '../greedy';
import { runAStar } from '../astar';
import { haversineDistanceMeters } from '../utils/haversine';
import { PriorityQueue } from '../utils/PriorityQueue';

describe('Heuristic Module & Priority Queue', () => {
  it('PriorityQueue correctly handles min-heap ordering and extract-min', () => {
    const pq = new PriorityQueue<string>();
    pq.push('task_medium', 50);
    pq.push('task_low', 100);
    pq.push('task_urgent', 10);
    pq.push('task_instant', 2);

    expect(pq.size()).toBe(4);
    expect(pq.pop()).toBe('task_instant');
    expect(pq.pop()).toBe('task_urgent');
    expect(pq.pop()).toBe('task_medium');
    expect(pq.pop()).toBe('task_low');
    expect(pq.isEmpty()).toBe(true);
  });

  it('Haversine distance returns 0 for identical points', () => {
    const d = haversineDistanceMeters(17.4435, 78.3772, 17.4435, 78.3772);
    expect(d).toBe(0);
  });

  it('Haversine distance matches known geographic distance between Hyderabad hubs', () => {
    // Cyber Towers (17.4504, 78.3808) to Gachibowli Hub (17.4401, 78.3489)
    const dist = haversineDistanceMeters(17.4504, 78.3808, 17.4401, 78.3489);
    // Great-circle distance is roughly 3.5 km (3,300 to 3,600m)
    expect(dist).toBeGreaterThan(3300);
    expect(dist).toBeLessThan(3600);
  });
});

describe('Core Search Algorithms Correctness Suite', () => {
  /**
   * Diamond Graph with differing hop counts and weights:
   * S -> X -> G: 2 hops, length 30 + 30 = 60m
   * S -> A -> B -> G: 3 hops, length 15 + 15 + 15 = 45m
   *
   * Coordinates chosen such that Haversine distance is strictly admissible:
   * S: (17.44000, 78.34000)
   * G: (17.44000, 78.34030) -> Haversine dist ~ 31.8m <= 45m
   */
  const nodes: GraphNode[] = [
    { id: 'S', lat: 17.44000, lng: 78.34000 },
    { id: 'X', lat: 17.44015, lng: 78.34015 },
    { id: 'A', lat: 17.43985, lng: 78.34010 },
    { id: 'B', lat: 17.43985, lng: 78.34020 },
    { id: 'G', lat: 17.44000, lng: 78.34030 },
  ];

  const edges: GraphEdge[] = [
    // 2-hop path through X (longer distance = 60m)
    {
      id: 'e_sx',
      from: 'S',
      to: 'X',
      key: '0',
      lengthMeters: 30,
      geometry: [[17.44000, 78.34000], [17.44015, 78.34015]],
      roadName: 'Road SX',
      roadType: 'primary',
      oneWay: true,
      maxSpeed: 50,
      trafficFactor: 1.0,
      blocked: false,
    },
    {
      id: 'e_xg',
      from: 'X',
      to: 'G',
      key: '0',
      lengthMeters: 30,
      geometry: [[17.44015, 78.34015], [17.44000, 78.34030]],
      roadName: 'Road XG',
      roadType: 'primary',
      oneWay: true,
      maxSpeed: 50,
      trafficFactor: 1.0,
      blocked: false,
    },
    // 3-hop path through A and B (cheaper total cost = 45m)
    {
      id: 'e_sa',
      from: 'S',
      to: 'A',
      key: '0',
      lengthMeters: 15,
      geometry: [[17.44000, 78.34000], [17.43985, 78.34010]],
      roadName: 'Road SA',
      roadType: 'secondary',
      oneWay: true,
      maxSpeed: 40,
      trafficFactor: 1.0,
      blocked: false,
    },
    {
      id: 'e_ab',
      from: 'A',
      to: 'B',
      key: '0',
      lengthMeters: 15,
      geometry: [[17.43985, 78.34010], [17.43985, 78.34020]],
      roadName: 'Road AB',
      roadType: 'secondary',
      oneWay: true,
      maxSpeed: 40,
      trafficFactor: 1.0,
      blocked: false,
    },
    {
      id: 'e_bg',
      from: 'B',
      to: 'G',
      key: '0',
      lengthMeters: 15,
      geometry: [[17.43985, 78.34020], [17.44000, 78.34030]],
      roadName: 'Road BG',
      roadType: 'secondary',
      oneWay: true,
      maxSpeed: 40,
      trafficFactor: 1.0,
      blocked: false,
    },
  ];

  const graph = new GraphEngine(nodes, edges);

  // TEST 1: BFS minimum-hop path
  it('TEST 1: BFS chooses minimum-hop path regardless of distance', () => {
    const res = runBFS(graph, { startNodeId: 'S', goalNodeId: 'G' });
    expect(res.found).toBe(true);
    expect(res.hopCount).toBe(2);
    expect(res.pathNodeIds).toEqual(['S', 'X', 'G']);
    expect(res.pathEdgeIds).toEqual(['e_sx', 'e_xg']);
    expect(res.distanceMeters).toBe(60);
  });

  // TEST 2: UCS weighted-cost path
  it('TEST 2: UCS chooses lowest accumulated effective cost', () => {
    const res = runUCS(graph, { startNodeId: 'S', goalNodeId: 'G' });
    expect(res.found).toBe(true);
    expect(res.effectiveCost).toBe(45);
    expect(res.hopCount).toBe(3);
    expect(res.pathNodeIds).toEqual(['S', 'A', 'B', 'G']);
    expect(res.pathEdgeIds).toEqual(['e_sa', 'e_ab', 'e_bg']);
  });

  // TEST 3: Greedy heuristic behavior
  it('TEST 3: Greedy prioritizes heuristic distance to destination', () => {
    const res = runGreedy(graph, { startNodeId: 'S', goalNodeId: 'G', traceEnabled: true });
    expect(res.found).toBe(true);
    expect(res.pathNodeIds[0]).toBe('S');
    expect(res.pathNodeIds[res.pathNodeIds.length - 1]).toBe('G');
    expect(res.trace?.events.length).toBeGreaterThan(0);
  });

  // TEST 4: A* expected optimal route
  it('TEST 4: A* finds optimal route matching UCS effective cost', () => {
    const resAStar = runAStar(graph, { startNodeId: 'S', goalNodeId: 'G' });
    const resUCS = runUCS(graph, { startNodeId: 'S', goalNodeId: 'G' });

    expect(resAStar.found).toBe(true);
    expect(resAStar.effectiveCost).toBe(resUCS.effectiveCost);
    expect(resAStar.pathNodeIds).toEqual(['S', 'A', 'B', 'G']);
  });

  // TEST 5: Blocked edge ignored
  it('TEST 5: Blocked edge is skipped by search algorithms', () => {
    const edgesWithBlock = edges.map((e) =>
      e.id === 'e_sa' ? { ...e, blocked: true } : e
    );
    const blockedGraph = new GraphEngine(nodes, edgesWithBlock);

    const ucsRes = runUCS(blockedGraph, { startNodeId: 'S', goalNodeId: 'G' });
    expect(ucsRes.found).toBe(true);
    // Since e_sa is blocked, it must route through X
    expect(ucsRes.pathNodeIds).toEqual(['S', 'X', 'G']);
    expect(ucsRes.effectiveCost).toBe(60);
  });

  // TEST 6: Parallel edges with different costs
  it('TEST 6: Parallel edges - UCS and A* choose the cheaper edge', () => {
    const parallelEdges: GraphEdge[] = [
      {
        id: 'e_p_slow',
        from: 'N1',
        to: 'N2',
        key: '0',
        lengthMeters: 100,
        geometry: [[17.4, 78.3], [17.4, 78.31]],
        roadName: 'Express Toll Slow',
        roadType: 'primary',
        oneWay: true,
        maxSpeed: 40,
        trafficFactor: 1.0,
        blocked: false,
      },
      {
        id: 'e_p_fast',
        from: 'N1',
        to: 'N2',
        key: '1',
        lengthMeters: 40,
        geometry: [[17.4, 78.3], [17.4, 78.31]],
        roadName: 'Express Flyover Fast',
        roadType: 'trunk',
        oneWay: true,
        maxSpeed: 80,
        trafficFactor: 1.0,
        blocked: false,
      },
    ];
    const parallelNodes: GraphNode[] = [
      { id: 'N1', lat: 17.4, lng: 78.3 },
      { id: 'N2', lat: 17.4, lng: 78.31 },
    ];
    const pGraph = new GraphEngine(parallelNodes, parallelEdges);

    const ucsRes = runUCS(pGraph, { startNodeId: 'N1', goalNodeId: 'N2' });
    const astarRes = runAStar(pGraph, { startNodeId: 'N1', goalNodeId: 'N2' });

    expect(ucsRes.found).toBe(true);
    expect(ucsRes.pathEdgeIds).toEqual(['e_p_fast']);
    expect(ucsRes.effectiveCost).toBe(40);

    expect(astarRes.found).toBe(true);
    expect(astarRes.pathEdgeIds).toEqual(['e_p_fast']);
    expect(astarRes.effectiveCost).toBe(40);
  });

  // TEST 7: One-way edge: reverse traversal unavailable
  it('TEST 7: One-way edge cannot be traversed in reverse', () => {
    // In our diamond graph, e_sx is from S to X (oneWay: true). There is no edge from G to S.
    const res = runUCS(graph, { startNodeId: 'G', goalNodeId: 'S' });
    expect(res.found).toBe(false);
    expect(res.pathNodeIds).toEqual([]);
    expect(res.pathEdgeIds).toEqual([]);
  });

  // TEST 8: Disconnected destination: found = false
  it('TEST 8: Disconnected destination returns found = false', () => {
    const disconnectedNodes: GraphNode[] = [
      ...nodes,
      { id: 'ISLAND', lat: 17.5, lng: 78.5 },
    ];
    const discGraph = new GraphEngine(disconnectedNodes, edges);

    const resBFS = runBFS(discGraph, { startNodeId: 'S', goalNodeId: 'ISLAND' });
    const resUCS = runUCS(discGraph, { startNodeId: 'S', goalNodeId: 'ISLAND' });
    const resAStar = runAStar(discGraph, { startNodeId: 'S', goalNodeId: 'ISLAND' });

    expect(resBFS.found).toBe(false);
    expect(resUCS.found).toBe(false);
    expect(resAStar.found).toBe(false);
  });

  // TEST 9: Start = goal: return valid zero-length result
  it('TEST 9: Start equals goal returns valid zero-length result', () => {
    const resBFS = runBFS(graph, { startNodeId: 'S', goalNodeId: 'S' });
    const resUCS = runUCS(graph, { startNodeId: 'S', goalNodeId: 'S' });
    const resGreedy = runGreedy(graph, { startNodeId: 'S', goalNodeId: 'S' });
    const resAStar = runAStar(graph, { startNodeId: 'S', goalNodeId: 'S' });

    for (const res of [resBFS, resUCS, resGreedy, resAStar]) {
      expect(res.found).toBe(true);
      expect(res.distanceMeters).toBe(0);
      expect(res.effectiveCost).toBe(0);
      expect(res.hopCount).toBe(0);
      expect(res.pathNodeIds).toEqual(['S']);
      expect(res.pathEdgeIds).toEqual([]);
    }
  });
});
