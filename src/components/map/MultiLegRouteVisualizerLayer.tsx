import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { PlannedLeg } from '../../algorithms/stopPlanner';
import type { MissionRouteLeg } from '../../types/logistics';

interface MultiLegRouteVisualizerLayerProps {
  legs: (PlannedLeg | MissionRouteLeg)[];
  activeLegSequence?: number;
}

const LEG_COLORS = [
  { stroke: '#06b6d4', glow: '#0891b2' }, // Cyan
  { stroke: '#f59e0b', glow: '#d97706' }, // Amber
  { stroke: '#10b981', glow: '#059669' }, // Emerald
  { stroke: '#8b5cf6', glow: '#7c3aed' }, // Purple
  { stroke: '#ec4899', glow: '#db2777' }, // Pink
];

export const MultiLegRouteVisualizerLayer: React.FC<MultiLegRouteVisualizerLayerProps> = ({
  legs,
  activeLegSequence = 1,
}) => {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current.clearLayers();
      layerGroupRef.current = null;
    }

    if (!legs || legs.length === 0) return;

    const group = L.layerGroup();
    const boundsPoints: [number, number][] = [];

    legs.forEach((leg, idx) => {
      const colorScheme = LEG_COLORS[idx % LEG_COLORS.length];
      const isActive = leg.leg_sequence === activeLegSequence;
      const geom = leg.route_geometry || [];

      if (geom.length > 0) {
        geom.forEach((pt) => boundsPoints.push(pt));

        // Outer glow
        const glow = L.polyline(geom, {
          color: colorScheme.glow,
          weight: isActive ? 8 : 5,
          opacity: isActive ? 0.6 : 0.35,
          interactive: false,
        });

        // Inner core line
        const core = L.polyline(geom, {
          color: colorScheme.stroke,
          weight: isActive ? 4 : 2.5,
          opacity: 0.95,
          dashArray: isActive ? undefined : '6, 6',
          interactive: false,
        });

        group.addLayer(glow);
        group.addLayer(core);
      }

      // Warehouse origin marker for Leg 1
      if (idx === 0 && geom.length > 0) {
        const startPt = geom[0];
        const whIcon = L.divIcon({
          className: 'warehouse-leg-marker',
          html: `
            <div style="
              background: #10b981;
              color: #ffffff;
              border: 2px solid #064e3b;
              border-radius: 50%;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'JetBrains Mono', monospace;
              font-size: 11px;
              font-weight: 800;
              box-shadow: 0 0 16px rgba(16, 185, 129, 0.9);
            ">HUB</div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        group.addLayer(
          L.marker(startPt, { icon: whIcon, zIndexOffset: 1000 }).bindTooltip(
            `Warehouse: ${leg.from_label}`,
            { permanent: false }
          )
        );
      }

      // Stop destination marker
      if (geom.length > 0) {
        const destPt = geom[geom.length - 1];
        const stopNum = leg.leg_sequence;
        const stopIcon = L.divIcon({
          className: 'stop-leg-marker',
          html: `
            <div style="
              background: ${colorScheme.stroke};
              color: #ffffff;
              border: 2px solid #0f172a;
              border-radius: 50%;
              width: 26px;
              height: 26px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'JetBrains Mono', monospace;
              font-size: 12px;
              font-weight: 800;
              box-shadow: 0 0 14px ${colorScheme.glow};
            ">${stopNum}</div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        group.addLayer(
          L.marker(destPt, { icon: stopIcon, zIndexOffset: 900 }).bindTooltip(
            `Stop ${stopNum}: ${leg.to_label} (${(leg.distance_meters / 1000).toFixed(1)} km)`,
            { permanent: false }
          )
        );
      }
    });

    if (boundsPoints.length >= 2) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    group.addTo(map);
    layerGroupRef.current = group;

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current.clearLayers();
        layerGroupRef.current = null;
      }
    };
  }, [legs, activeLegSequence, map]);

  return null;
};
