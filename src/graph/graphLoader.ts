import { GraphEngine } from './GraphEngine';
import { resolveLocationPresets } from './locationPresets';
import type { GraphNode, GraphEdge, GraphMetadata, LocationPreset } from './types';

let cachedGraphResult: {
  graphEngine: GraphEngine;
  metadata: GraphMetadata;
  locationPresets: LocationPreset[];
  loadTimeMs: number;
} | null = null;

export async function loadHyderabadGraph(): Promise<{
  graphEngine: GraphEngine;
  metadata: GraphMetadata;
  locationPresets: LocationPreset[];
  loadTimeMs: number;
}> {
  if (cachedGraphResult) {
    return cachedGraphResult;
  }

  const startTime = performance.now();

  try {
    const [metaRes, nodesRes, edgesRes] = await Promise.all([
      fetch('/data/hyderabad/metadata.json'),
      fetch('/data/hyderabad/nodes.json'),
      fetch('/data/hyderabad/edges.json'),
    ]);

    if (!metaRes.ok || !nodesRes.ok || !edgesRes.ok) {
      throw new Error('Failed to fetch Hyderabad road network dataset files.');
    }

    const metadata: GraphMetadata = await metaRes.json();
    const nodes: GraphNode[] = await nodesRes.json();
    const edges: GraphEdge[] = await edgesRes.json();

    const graphEngine = new GraphEngine(nodes, edges, metadata);
    const locationPresets = resolveLocationPresets(graphEngine);

    const loadTimeMs = Math.round(performance.now() - startTime);

    cachedGraphResult = {
      graphEngine,
      metadata,
      locationPresets,
      loadTimeMs,
    };

    return cachedGraphResult;
  } catch (err) {
    console.error('[HYD-LOGIX] Graph loading exception:', err);
    throw err;
  }
}
