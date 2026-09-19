import React, { useState } from 'react';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BasemapTileLayer } from './BasemapTileLayer';
import { useGraph } from '../../graph';
import type { LocationPreset } from '../../graph';
import { CanvasDebugLayer } from './CanvasDebugLayer';
import { 
  MapPin, 
  Database, 
  Compass, 
  CheckCircle2, 
  Sliders,
  AlertCircle
} from 'lucide-react';

// Custom Leaflet marker icons using inline SVG data URIs
const createPresetIcon = (label: string) => {
  return L.divIcon({
    className: 'custom-preset-marker',
    html: `
      <div style="
        background-color: #0c121d;
        border: 2px solid #f59e0b;
        color: #f1f5f9;
        padding: 4px 8px;
        border-radius: 6px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #f59e0b;"></span>
        ${label}
      </div>
    `,
    iconSize: [140, 30],
    iconAnchor: [70, 15],
  });
};

// Helper component to programmatically fly to location
const MapFlyTo: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
};

export const OperationalMap: React.FC = () => {
  const { metadata, locationPresets, loading, error, loadTimeMs } = useGraph();
  const [showDebugLayer, setShowDebugLayer] = useState<boolean>(false);
  const [showTelemetryOverlay, setShowTelemetryOverlay] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<LocationPreset | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([17.4435, 78.3772]);
  const [mapZoom, setMapZoom] = useState<number>(13);

  const handleSelectPreset = (preset: LocationPreset) => {
    setSelectedPreset(preset);
    setMapCenter([preset.lat, preset.lng]);
    setMapZoom(15);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-[500px] relative select-none overflow-x-hidden">
      {/* Map Control Header Bar */}
      <div className="bg-obsidian-950 border-b border-slate-800 px-3 py-2.5 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-obsidian-850 border border-slate-700 text-logix-amber shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-tech text-sm sm:text-base font-bold text-slate-100 uppercase tracking-wide">
                Hyderabad Operational Vector Grid
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                OSM REAL TOPOLOGY
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] font-mono text-slate-400">
              Corridor: Gachibowli · Kondapur · HITEC City · Madhapur · Jubilee Hills
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Telemetry Mobile Toggle */}
          <button
            onClick={() => setShowTelemetryOverlay(!showTelemetryOverlay)}
            className="md:hidden px-2.5 py-1.5 rounded-lg font-mono text-xs border bg-obsidian-900 border-slate-800 text-slate-300 flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5 text-logix-amber" />
            <span>Telemetry</span>
          </button>

          {/* Debug Layer Toggle */}
          <button
            onClick={() => setShowDebugLayer(!showDebugLayer)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-mono text-xs border transition-all flex items-center gap-1.5 ${
              showDebugLayer
                ? 'bg-amber-950/40 text-amber-300 border-logix-amber shadow-sm'
                : 'bg-obsidian-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Vector Grid: {showDebugLayer ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="flex-1 relative w-full h-full min-h-[400px] sm:min-h-[500px] bg-obsidian-950">
        {loading && (
          <div className="absolute inset-0 z-30 bg-obsidian-950/90 flex flex-col items-center justify-center text-slate-300 p-4">
            <div className="w-10 h-10 border-2 border-logix-amber/20 border-t-logix-amber rounded-full animate-spin mb-4" />
            <span className="font-mono text-xs uppercase tracking-widest text-slate-400 text-center">
              Loading OpenStreetMap Hyderabad Topology (9,693 nodes, 23,529 edges)...
            </span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-30 bg-obsidian-950/95 flex flex-col items-center justify-center text-rose-300 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
            <h3 className="font-tech text-base font-bold uppercase text-slate-100">Dataset Load Exception</h3>
            <p className="text-xs font-mono text-slate-400 mt-1">{error}</p>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={true}
          className="w-full h-full min-h-[400px] sm:min-h-[500px] z-10"
          style={{ background: '#070b12' }}
        >
          <MapFlyTo center={mapCenter} zoom={mapZoom} />

          <BasemapTileLayer />

          <CanvasDebugLayer enabled={showDebugLayer} />

          {locationPresets.map((preset) => (
            <Marker
              key={preset.id}
              position={[preset.lat, preset.lng]}
              icon={createPresetIcon(preset.label)}
              eventHandlers={{
                click: () => handleSelectPreset(preset),
              }}
            >
              <Popup className="font-mono text-xs">
                <div className="p-1">
                  <div className="font-bold text-amber-500">{preset.label}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Lat: {preset.lat}, Lng: {preset.lng}
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-slate-700 text-[10px]">
                    <strong>Nearest Graph Node:</strong><br />
                    <code className="text-emerald-400">{preset.nearestNodeId}</code> ({preset.nearestNodeDistanceMeters}m away)
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Location Presets Bar */}
        <div className="absolute bottom-4 left-4 z-20 bg-obsidian-950/90 border border-slate-800 rounded-xl p-3 shadow-panel backdrop-blur max-w-[calc(100vw-2rem)] sm:max-w-sm w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="tech-label flex items-center gap-1.5 text-[10px] sm:text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-logix-amber" />
              Real Hyderabad Presets
            </span>
            <span className="text-[10px] font-mono text-slate-400">Click to Inspect</span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {locationPresets.map((preset) => {
              const isSelected = selectedPreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-all text-left border ${
                    isSelected
                      ? 'bg-amber-950/50 border-logix-amber text-amber-300 font-semibold shadow-sm'
                      : 'bg-obsidian-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-obsidian-850'
                  }`}
                >
                  {preset.label.split(' ')[0]}
                </button>
              );
            })}
          </div>

          {selectedPreset && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 font-mono text-[11px] text-slate-300 flex justify-between items-center">
              <span>Node: <strong className="text-emerald-400">{selectedPreset.nearestNodeId}</strong></span>
              <span className="text-slate-400">{selectedPreset.nearestNodeDistanceMeters}m offset</span>
            </div>
          )}
        </div>

        {/* Floating Telemetry Overlay (Desktop persistent, Mobile toggleable) */}
        {metadata && (
          <div className={`absolute top-4 right-4 z-20 bg-obsidian-950/90 border border-slate-800 rounded-xl p-3 shadow-panel backdrop-blur text-xs font-mono space-y-1.5 max-w-[calc(100vw-2rem)] sm:w-56 ${
            showTelemetryOverlay ? 'block' : 'hidden md:block'
          }`}>
            <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800/80 pb-1.5 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-logix-amber" />
                <span>OSM Graph Telemetry</span>
              </span>
              <button
                onClick={() => setShowTelemetryOverlay(false)}
                className="md:hidden text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Nodes:</span>
              <strong className="text-slate-200">{metadata.nodeCount.toLocaleString()}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Directed Edges:</span>
              <strong className="text-slate-200">{metadata.directedEdgeCount.toLocaleString()}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Parallel Edges:</span>
              <strong className="text-amber-400">{metadata.parallelEdgeCount}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Parse & Index:</span>
              <strong className="text-emerald-400">{loadTimeMs} ms</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Dataset Size:</span>
              <strong className="text-slate-200">{metadata.fileSizes.totalMb} MB</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
