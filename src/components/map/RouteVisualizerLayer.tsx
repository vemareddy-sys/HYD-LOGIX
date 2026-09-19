import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { GraphEngine } from '../../graph/GraphEngine';
import type { SearchResult, SearchEvent } from '../../algorithms/types';

interface RouteVisualizerLayerProps {
  graph: GraphEngine | null;
  searchResult: SearchResult | null;
  traceEvents: SearchEvent[];
  currentStepIndex: number;
  enableXRay: boolean;
  startNodeId: string;
  goalNodeId: string;
}

export const RouteVisualizerLayer: React.FC<RouteVisualizerLayerProps> = ({
  graph,
  searchResult,
  traceEvents,
  currentStepIndex,
  enableXRay,
  startNodeId,
  goalNodeId,
}) => {
  const map = useMap();
  const staticLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const dynamicLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);

  // Initialize Leaflet Canvas renderer once
  useEffect(() => {
    if (!canvasRendererRef.current) {
      canvasRendererRef.current = L.canvas({ padding: 0.5 });
    }
  }, []);

  // 1. Static Markers: Source (A) and Destination (B) + Corridor Initial Framing
  useEffect(() => {
    if (!graph) return;

    if (staticLayerGroupRef.current) {
      map.removeLayer(staticLayerGroupRef.current);
      staticLayerGroupRef.current.clearLayers();
      staticLayerGroupRef.current = null;
    }

    const staticGroup = L.layerGroup();
    const startNode = graph.getNode(startNodeId);
    const goalNode = graph.getNode(goalNodeId);

    const boundsPoints: [number, number][] = [];

    if (startNode) {
      boundsPoints.push([startNode.lat, startNode.lng]);
      const startIcon = L.divIcon({
        className: 'origin-marker',
        html: `
          <div style="
            background: #10b981;
            color: #ffffff;
            border: 2px solid #064e3b;
            border-radius: 50%;
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            font-weight: 800;
            box-shadow: 0 0 14px rgba(16, 185, 129, 0.9);
          ">A</div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      staticGroup.addLayer(L.marker([startNode.lat, startNode.lng], { icon: startIcon, zIndexOffset: 1000 }));
    }

    if (goalNode) {
      boundsPoints.push([goalNode.lat, goalNode.lng]);
      const goalIcon = L.divIcon({
        className: 'destination-marker',
        html: `
          <div style="
            background: #f43f5e;
            color: #ffffff;
            border: 2px solid #881337;
            border-radius: 50%;
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            font-weight: 800;
            box-shadow: 0 0 14px rgba(244, 63, 94, 0.9);
          ">B</div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      staticGroup.addLayer(L.marker([goalNode.lat, goalNode.lng], { icon: goalIcon, zIndexOffset: 1000 }));
    }

    // Frame the corridor
    if (boundsPoints.length >= 2) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }

    staticGroup.addTo(map);
    staticLayerGroupRef.current = staticGroup;

    return () => {
      if (staticLayerGroupRef.current) {
        map.removeLayer(staticLayerGroupRef.current);
        staticLayerGroupRef.current.clearLayers();
        staticLayerGroupRef.current = null;
      }
    };
  }, [graph, startNodeId, goalNodeId, map]);

  // 2. Dynamic Search X-Ray Exploration & Final Path Rendering
  useEffect(() => {
    if (!graph) return;

    if (dynamicLayerGroupRef.current) {
      map.removeLayer(dynamicLayerGroupRef.current);
      dynamicLayerGroupRef.current.clearLayers();
      dynamicLayerGroupRef.current = null;
    }

    const dynamicGroup = L.layerGroup();
    const canvasRenderer = canvasRendererRef.current || L.canvas({ padding: 0.5 });

    // Helper to draw finalized route on canvas
    const drawFinalRoute = () => {
      if (!searchResult || !searchResult.found || searchResult.pathEdgeIds.length === 0) return;

      for (let i = 0; i < searchResult.pathEdgeIds.length; i++) {
        const edge = graph.getEdge(searchResult.pathEdgeIds[i]);
        if (edge && edge.geometry && edge.geometry.length > 0) {
          // Amber outer glow
          const glow = L.polyline(edge.geometry, {
            color: '#f59e0b',
            weight: 7,
            opacity: 0.45,
            renderer: canvasRenderer,
            interactive: false,
          });

          // Bright amber core line
          const core = L.polyline(edge.geometry, {
            color: '#fbbf24',
            weight: 3.5,
            opacity: 0.95,
            renderer: canvasRenderer,
            interactive: false,
          });

          dynamicGroup.addLayer(glow);
          dynamicGroup.addLayer(core);
        }
      }
    };

    // Case A: Search X-Ray is OFF -> Display final route immediately
    if (!enableXRay || traceEvents.length === 0) {
      drawFinalRoute();
      dynamicGroup.addTo(map);
      dynamicLayerGroupRef.current = dynamicGroup;
      return;
    }

    // Case B: Search X-Ray is ON -> Reconstruct exploration state up to currentStepIndex
    const safeIndex = Math.min(currentStepIndex, traceEvents.length - 1);
    const activeEvent: SearchEvent | undefined = traceEvents[safeIndex];

    const visitedSet = new Set<string>();
    const frontierSet = new Set<string>();
    const traversedEdges = new Set<string>();

    for (let i = 0; i <= safeIndex; i++) {
      const ev = traceEvents[i];
      if (ev.edgeId) traversedEdges.add(ev.edgeId);

      if (ev.type === 'NODE_DISCOVERED') {
        frontierSet.add(ev.nodeId);
      } else if (ev.type === 'NODE_EXPANDED' || ev.type === 'NODE_VISITED') {
        frontierSet.delete(ev.nodeId);
        visitedSet.add(ev.nodeId);
      }
    }

    // 1. Draw traversed road segments on Canvas (subtle cyan lines)
    traversedEdges.forEach((edgeId) => {
      const edge = graph.getEdge(edgeId);
      if (edge && edge.geometry) {
        const line = L.polyline(edge.geometry, {
          color: '#0284c7',
          weight: 2,
          opacity: 0.6,
          renderer: canvasRenderer,
          interactive: false,
        });
        dynamicGroup.addLayer(line);
      }
    });

    // 2. Draw Visited/Settled Nodes on Canvas (sky blue points)
    visitedSet.forEach((nodeId) => {
      const node = graph.getNode(nodeId);
      if (node) {
        const dot = L.circleMarker([node.lat, node.lng], {
          radius: 2.5,
          color: '#38bdf8',
          fillColor: '#38bdf8',
          fillOpacity: 0.7,
          weight: 1,
          renderer: canvasRenderer,
          interactive: false,
        });
        dynamicGroup.addLayer(dot);
      }
    });

    // 3. Draw Frontier Nodes on Canvas (amber glow dots)
    frontierSet.forEach((nodeId) => {
      const node = graph.getNode(nodeId);
      if (node) {
        const dot = L.circleMarker([node.lat, node.lng], {
          radius: 3.5,
          color: '#f59e0b',
          fillColor: '#fbbf24',
          fillOpacity: 0.85,
          weight: 1,
          renderer: canvasRenderer,
          interactive: false,
        });
        dynamicGroup.addLayer(dot);
      }
    });

    // 4. Highlight Current Node being inspected
    if (activeEvent) {
      const currNode = graph.getNode(activeEvent.nodeId);
      if (currNode) {
        const currentPulse = L.circleMarker([currNode.lat, currNode.lng], {
          radius: 7,
          color: '#22d3ee',
          fillColor: '#06b6d4',
          fillOpacity: 0.95,
          weight: 2.5,
        });
        dynamicGroup.addLayer(currentPulse);
      }

      // Active expanding edge highlight
      if (activeEvent.edgeId) {
        const edge = graph.getEdge(activeEvent.edgeId);
        if (edge && edge.geometry) {
          const activeEdge = L.polyline(edge.geometry, {
            color: '#22d3ee',
            weight: 4,
            opacity: 0.95,
          });
          dynamicGroup.addLayer(activeEdge);
        }
      }
    }

    // 5. Final Route: ONLY draw at or after PATH_FINALIZED
    const isAtFinalPath =
      safeIndex === traceEvents.length - 1 ||
      activeEvent?.type === 'PATH_FINALIZED';

    if (isAtFinalPath) {
      drawFinalRoute();
    }

    dynamicGroup.addTo(map);
    dynamicLayerGroupRef.current = dynamicGroup;

    return () => {
      if (dynamicLayerGroupRef.current) {
        map.removeLayer(dynamicLayerGroupRef.current);
        dynamicLayerGroupRef.current.clearLayers();
        dynamicLayerGroupRef.current = null;
      }
    };
  }, [graph, searchResult, traceEvents, currentStepIndex, enableXRay, map]);

  return null;
};
