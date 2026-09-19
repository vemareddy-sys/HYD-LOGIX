import type { GraphNode, GraphEdge, GraphMetadata } from './types';

export class GraphEngine {
  private nodeMap: Map<string, GraphNode> = new Map();
  private edgeMap: Map<string, GraphEdge> = new Map();
  private outgoingEdges: Map<string, GraphEdge[]> = new Map();
  private nodesArray: GraphNode[] = [];
  private edgesArray: GraphEdge[] = [];
  private metadata: GraphMetadata | null = null;

  constructor(nodes: GraphNode[], edges: GraphEdge[], metadata?: GraphMetadata) {
    this.nodesArray = nodes;
    this.edgesArray = edges;
    this.metadata = metadata || null;
    this.buildIndexes();
  }

  private buildIndexes(): void {
    // 1. Index Nodes
    for (let i = 0; i < this.nodesArray.length; i++) {
      const node = this.nodesArray[i];
      this.nodeMap.set(node.id, node);
      this.outgoingEdges.set(node.id, []);
    }

    // 2. Index Edges and Outgoing Adjacency
    for (let i = 0; i < this.edgesArray.length; i++) {
      const edge = this.edgesArray[i];
      this.edgeMap.set(edge.id, edge);

      const adj = this.outgoingEdges.get(edge.from);
      if (adj) {
        adj.push(edge);
      } else {
        this.outgoingEdges.set(edge.from, [edge]);
      }
    }
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodeMap.get(id);
  }

  public getEdge(id: string): GraphEdge | undefined {
    return this.edgeMap.get(id);
  }

  public getOutgoingEdges(nodeId: string): GraphEdge[] {
    return this.outgoingEdges.get(nodeId) || [];
  }

  public getNodeCount(): number {
    return this.nodeMap.size;
  }

  public getEdgeCount(): number {
    return this.edgeMap.size;
  }

  public getAllNodes(): GraphNode[] {
    return this.nodesArray;
  }

  public getAllEdges(): GraphEdge[] {
    return this.edgesArray;
  }

  public getMetadata(): GraphMetadata | null {
    return this.metadata;
  }

  /**
   * Finds the nearest valid graph node for a given (lat, lng) coordinate pair
   * Uses fast Euclidean distance approximation scaled to meters.
   */
  public findNearestNode(lat: number, lng: number): { node: GraphNode; distanceMeters: number } | null {
    if (this.nodesArray.length === 0) return null;

    let nearestNode: GraphNode | null = null;
    let minDistanceSq = Infinity;

    const radLat = (lat * Math.PI) / 180;
    const cosLat = Math.cos(radLat);
    const metersPerDegreeLat = 111000;
    const metersPerDegreeLng = 111000 * cosLat;

    for (let i = 0; i < this.nodesArray.length; i++) {
      const node = this.nodesArray[i];
      const dLat = (node.lat - lat) * metersPerDegreeLat;
      const dLng = (node.lng - lng) * metersPerDegreeLng;
      const distSq = dLat * dLat + dLng * dLng;

      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        nearestNode = node;
      }
    }

    if (!nearestNode) return null;

    return {
      node: nearestNode,
      distanceMeters: Math.round(Math.sqrt(minDistanceSq)),
    };
  }
}
