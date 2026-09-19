export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  key: string;
  lengthMeters: number;
  geometry: [number, number][]; // [lat, lng] pairs
  roadName: string;
  roadType: string;
  oneWay: boolean;
  maxSpeed: number | null;
  trafficFactor: number;
  blocked: boolean;
}

export interface GraphMetadata {
  regionName: string;
  source: string;
  generatedAt: string;
  nodeCount: number;
  directedEdgeCount: number;
  parallelEdgeCount: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  fileSizes: {
    nodesKb: number;
    edgesKb: number;
    totalMb: number;
  };
  processingTimeSeconds?: number;
  preprocessingVersion: string;
  geometryRetained: boolean;
}

export interface LocationPreset {
  id: string;
  label: string;
  lat: number;
  lng: number;
  nearestNodeId: string;
  nearestNodeDistanceMeters: number;
}
