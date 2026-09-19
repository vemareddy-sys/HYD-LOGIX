import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useGraph } from '../../graph';

interface CanvasDebugLayerProps {
  enabled: boolean;
}

export const CanvasDebugLayer: React.FC<CanvasDebugLayerProps> = ({ enabled }) => {
  const map = useMap();
  const { graphEngine } = useGraph();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);

  useEffect(() => {
    if (!graphEngine || !enabled) {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current.clearLayers();
        layerGroupRef.current = null;
      }
      return;
    }

    // Initialize Leaflet Canvas renderer
    if (!canvasRendererRef.current) {
      canvasRendererRef.current = L.canvas({ padding: 0.5 });
    }

    const canvasRenderer = canvasRendererRef.current;

    const renderCanvasGrid = () => {
      // Remove existing group if any
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current.clearLayers();
      }

      const zoom = map.getZoom();
      // LOD Level 1: Zoom < 12 — render base map & presets only
      if (zoom < 12) return;

      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      // Buffer for smooth pan rendering
      const latBuffer = (ne.lat - sw.lat) * 0.2;
      const lngBuffer = (ne.lng - sw.lng) * 0.2;

      const minLat = sw.lat - latBuffer;
      const maxLat = ne.lat + latBuffer;
      const minLng = sw.lng - lngBuffer;
      const maxLng = ne.lng + lngBuffer;

      const allEdges = graphEngine.getAllEdges();
      const newLayerGroup = L.layerGroup();

      let visibleEdgesCount = 0;

      // Draw viewport-culled polylines onto Canvas
      for (let i = 0; i < allEdges.length; i++) {
        const edge = allEdges[i];
        const geom = edge.geometry;
        if (!geom || geom.length === 0) continue;

        // Viewport intersection test: at least one point inside padded bounds
        let isVisible = false;
        for (let p = 0; p < geom.length; p++) {
          const [lat, lng] = geom[p];
          if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
            isVisible = true;
            break;
          }
        }

        if (isVisible) {
          visibleEdgesCount++;
          const polyline = L.polyline(geom, {
            color: '#f59e0b',
            weight: zoom >= 15 ? 3 : 2,
            opacity: 0.6,
            renderer: canvasRenderer,
            interactive: false, // Prevents per-polyline mouse event listener bloat
          });
          newLayerGroup.addLayer(polyline);
        }
      }

      // LOD Level 3: High Zoom >= 16 — render a sampled subset of nodes onto Canvas
      if (zoom >= 16) {
        const allNodes = graphEngine.getAllNodes();
        const sampleStep = zoom >= 17 ? 1 : 3; // Sample every node at max zoom, every 3rd node at zoom 16

        for (let i = 0; i < allNodes.length; i += sampleStep) {
          const node = allNodes[i];
          if (node.lat >= minLat && node.lat <= maxLat && node.lng >= minLng && node.lng <= maxLng) {
            const circle = L.circleMarker([node.lat, node.lng], {
              radius: 3,
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.8,
              weight: 1,
              renderer: canvasRenderer,
              interactive: false,
            });
            newLayerGroup.addLayer(circle);
          }
        }
      }

      newLayerGroup.addTo(map);
      layerGroupRef.current = newLayerGroup;
    };

    // Initial render
    renderCanvasGrid();

    // Re-render on map move / zoom
    const handleMapMove = () => {
      renderCanvasGrid();
    };

    map.on('moveend', handleMapMove);
    map.on('zoomend', handleMapMove);

    return () => {
      map.off('moveend', handleMapMove);
      map.off('zoomend', handleMapMove);
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current.clearLayers();
        layerGroupRef.current = null;
      }
    };
  }, [graphEngine, enabled, map]);

  return null;
};
