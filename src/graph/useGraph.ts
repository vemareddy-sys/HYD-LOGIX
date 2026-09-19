import { useState, useEffect } from 'react';
import { loadHyderabadGraph } from './graphLoader';
import type { GraphEngine } from './GraphEngine';
import type { GraphMetadata, LocationPreset } from './types';

export interface UseGraphResult {
  graphEngine: GraphEngine | null;
  metadata: GraphMetadata | null;
  locationPresets: LocationPreset[];
  loading: boolean;
  error: string | null;
  loadTimeMs: number;
}

export function useGraph(): UseGraphResult {
  const [graphEngine, setGraphEngine] = useState<GraphEngine | null>(null);
  const [metadata, setMetadata] = useState<GraphMetadata | null>(null);
  const [locationPresets, setLocationPresets] = useState<LocationPreset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadTimeMs, setLoadTimeMs] = useState<number>(0);

  useEffect(() => {
    let mounted = true;

    loadHyderabadGraph()
      .then((res) => {
        if (mounted) {
          setGraphEngine(res.graphEngine);
          setMetadata(res.metadata);
          setLocationPresets(res.locationPresets);
          setLoadTimeMs(res.loadTimeMs);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          const msg = err instanceof Error ? err.message : 'Error loading graph dataset';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return {
    graphEngine,
    metadata,
    locationPresets,
    loading,
    error,
    loadTimeMs,
  };
}
