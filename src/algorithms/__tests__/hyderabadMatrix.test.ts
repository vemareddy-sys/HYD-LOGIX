import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { GraphEngine } from '../../graph/GraphEngine';
import { resolveLocationPresets } from '../../graph/locationPresets';
import type { LocationPreset } from '../../graph/types';
import { runBFS } from '../bfs';
import { runUCS } from '../ucs';
import { runGreedy } from '../greedy';
import { runAStar } from '../astar';

describe('Real Hyderabad Road Network Algorithm Matrix & UCS vs A* Validation', () => {
  let graph: GraphEngine;
  let presets: LocationPreset[];
  let presetMap: Map<string, LocationPreset>;

  beforeAll(() => {
    const dataDir = path.resolve(__dirname, '../../../public/data/hyderabad');
    const nodes = JSON.parse(fs.readFileSync(path.join(dataDir, 'nodes.json'), 'utf-8'));
    const edges = JSON.parse(fs.readFileSync(path.join(dataDir, 'edges.json'), 'utf-8'));
    const metadata = JSON.parse(fs.readFileSync(path.join(dataDir, 'metadata.json'), 'utf-8'));

    graph = new GraphEngine(nodes, edges, metadata);
    presets = resolveLocationPresets(graph);
    presetMap = new Map(presets.map((p) => [p.id, p]));
  });

  const testCorridor = (startId: string, goalId: string, label: string) => {
    it(`Corridor: ${label}`, () => {
      const startPreset = presetMap.get(startId)!;
      const goalPreset = presetMap.get(goalId)!;

      const req = {
        startNodeId: startPreset.nearestNodeId,
        goalNodeId: goalPreset.nearestNodeId,
      };

      const resBFS = runBFS(graph, req);
      const resUCS = runUCS(graph, req);
      const resGreedy = runGreedy(graph, req);
      const resAStar = runAStar(graph, req);

      console.log(`\n========================================`);
      console.log(`ROUTE: ${label}`);
      console.log(`From Node: ${req.startNodeId} -> To Node: ${req.goalNodeId}`);
      console.table({
        BFS: {
          Found: resBFS.found,
          DistanceM: resBFS.distanceMeters,
          Cost: resBFS.effectiveCost,
          Hops: resBFS.hopCount,
          Explored: resBFS.exploredCount,
          TimeMs: resBFS.executionMs,
        },
        UCS: {
          Found: resUCS.found,
          DistanceM: resUCS.distanceMeters,
          Cost: resUCS.effectiveCost,
          Hops: resUCS.hopCount,
          Explored: resUCS.exploredCount,
          TimeMs: resUCS.executionMs,
        },
        GREEDY: {
          Found: resGreedy.found,
          DistanceM: resGreedy.distanceMeters,
          Cost: resGreedy.effectiveCost,
          Hops: resGreedy.hopCount,
          Explored: resGreedy.exploredCount,
          TimeMs: resGreedy.executionMs,
        },
        ASTAR: {
          Found: resAStar.found,
          DistanceM: resAStar.distanceMeters,
          Cost: resAStar.effectiveCost,
          Hops: resAStar.hopCount,
          Explored: resAStar.exploredCount,
          TimeMs: resAStar.executionMs,
        },
      });

      // Both UCS and A* must find routes
      expect(resUCS.found).toBe(true);
      expect(resAStar.found).toBe(true);

      // UCS and A* must produce the exact same optimal effectiveCost
      expect(Math.abs(resUCS.effectiveCost - resAStar.effectiveCost)).toBeLessThan(0.01);

      // A* should explore fewer or equal nodes compared to UCS
      expect(resAStar.exploredCount).toBeLessThanOrEqual(resUCS.exploredCount);
    });
  };

  testCorridor('preset_gachibowli', 'preset_hitec', 'Gachibowli Hub -> HITEC City Cyber Towers');
  testCorridor('preset_gachibowli', 'preset_jubilee', 'Gachibowli Hub -> Jubilee Hills Checkpost');
  testCorridor('preset_kondapur', 'preset_madhapur', 'Kondapur Junction -> Madhapur Tech Zone');
  testCorridor('preset_hitec', 'preset_jubilee', 'HITEC City Cyber Towers -> Jubilee Hills Checkpost');
  testCorridor('preset_jubilee', 'preset_gachibowli', 'Jubilee Hills Checkpost -> Gachibowli Hub');
});
