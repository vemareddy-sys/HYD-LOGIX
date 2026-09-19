import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { SimulationSnapshot } from '../../simulation/types';

interface SimulationVehicleLayerProps {
  routeGeometry: [number, number][];
  snapshot: SimulationSnapshot | null;
  startLabel?: string;
  destinationLabel?: string;
  autoFit?: boolean;
}

export const SimulationVehicleLayer: React.FC<SimulationVehicleLayerProps> = ({
  routeGeometry,
  snapshot,
  startLabel = 'Warehouse',
  destinationLabel = 'Destination',
  autoFit = true,
}) => {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const traveledPolylineRef = useRef<L.Polyline | null>(null);
  const hasFittedRef = useRef<boolean>(false);

  // 1. Static Layer: Route corridor, Origin marker, Destination marker
  useEffect(() => {
    if (!map || routeGeometry.length < 2) return;

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current.clearLayers();
    }

    const group = L.layerGroup();

    // Subtle outer glow
    const outerGlow = L.polyline(routeGeometry, {
      color: '#0284c7', // Sky blue glow
      weight: 8,
      opacity: 0.35,
      interactive: false,
    });
    group.addLayer(outerGlow);

    // Primary route line
    const coreLine = L.polyline(routeGeometry, {
      color: '#38bdf8', // Bright cyan-sky line
      weight: 3.5,
      opacity: 0.85,
      interactive: false,
    });
    group.addLayer(coreLine);

    // Traveled line (initialized empty)
    const traveledLine = L.polyline([], {
      color: '#10b981', // Emerald green for traveled road
      weight: 4.5,
      opacity: 0.95,
      interactive: false,
    });
    group.addLayer(traveledLine);
    traveledPolylineRef.current = traveledLine;

    // Origin Marker (A)
    const startCoord = routeGeometry[0];
    const startIcon = L.divIcon({
      className: 'start-node-marker',
      html: `
        <div style="
          background: #10b981;
          color: white;
          font-family: monospace;
          font-size: 10px;
          font-weight: bold;
          border-radius: 9999px;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.8);
          border: 2px solid #ffffff;
        ">
          A
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    const startMarker = L.marker(startCoord, { icon: startIcon, interactive: true });
    startMarker.bindTooltip(`<b>${startLabel}</b> (Origin)`, { direction: 'top', offset: [0, -14] });
    group.addLayer(startMarker);

    // Destination Marker (B)
    const goalCoord = routeGeometry[routeGeometry.length - 1];
    const goalIcon = L.divIcon({
      className: 'goal-node-marker',
      html: `
        <div style="
          background: #f43f5e;
          color: white;
          font-family: monospace;
          font-size: 10px;
          font-weight: bold;
          border-radius: 9999px;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 14px rgba(244, 63, 94, 0.8);
          border: 2px solid #ffffff;
        ">
          B
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    const goalMarker = L.marker(goalCoord, { icon: goalIcon, interactive: true });
    goalMarker.bindTooltip(`<b>${destinationLabel}</b> (Goal)`, { direction: 'top', offset: [0, -14] });
    group.addLayer(goalMarker);

    // Vehicle Marker (Pulsing Radar + Truck Glyph)
    const initialPos = startCoord;

    const vehicleIcon = L.divIcon({
      className: 'simulation-vehicle-marker',
      html: `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
          <!-- Pulsing radar ring -->
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 9999px;
            background: rgba(245, 158, 11, 0.25);
            border: 1.5px solid rgba(245, 158, 11, 0.8);
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <!-- Vehicle Core Badge -->
          <div style="
            position: relative;
            background: #0f172a;
            border: 2px solid #f59e0b;
            color: #fbbf24;
            border-radius: 9999px;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 16px rgba(245, 158, 11, 0.7);
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
              <path d="M15 18H9"/>
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
              <circle cx="17" cy="18" r="2"/>
              <circle cx="7" cy="18" r="2"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const vehicleMarker = L.marker(initialPos as L.LatLngExpression, {
      icon: vehicleIcon,
      zIndexOffset: 1000,
    });
    group.addLayer(vehicleMarker);
    vehicleMarkerRef.current = vehicleMarker;

    group.addTo(map);
    layerGroupRef.current = group;

    // Initial Bounds Fitting
    if (autoFit && !hasFittedRef.current && routeGeometry.length > 0) {
      const bounds = L.latLngBounds(routeGeometry);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      hasFittedRef.current = true;
    }

    return () => {
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
      vehicleMarkerRef.current = null;
      traveledPolylineRef.current = null;
    };
  }, [map, routeGeometry, startLabel, destinationLabel, autoFit]);

  // 2. Dynamic Frame Update: Vehicle Position & Traveled Path Polyline
  useEffect(() => {
    if (!snapshot || !vehicleMarkerRef.current) return;

    const lat = snapshot.currentLat;
    const lng = snapshot.currentLng;

    // Update vehicle marker coordinates
    vehicleMarkerRef.current.setLatLng([lat, lng]);

    // Update traveled polyline
    if (traveledPolylineRef.current && routeGeometry.length > 0) {
      // Find all points up to current position
      const traveledPoints: [number, number][] = [];
      const totalPoints = routeGeometry.length;
      const pointsToInclude = Math.min(
        totalPoints,
        Math.floor(snapshot.progress * totalPoints) + 1
      );

      for (let i = 0; i < pointsToInclude; i++) {
        traveledPoints.push(routeGeometry[i]);
      }
      traveledPoints.push([lat, lng]);

      traveledPolylineRef.current.setLatLngs(traveledPoints);
    }
  }, [snapshot, routeGeometry]);

  return null;
};
