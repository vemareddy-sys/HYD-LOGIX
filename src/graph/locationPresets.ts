import type { GraphEngine } from './GraphEngine';
import type { LocationPreset } from './types';

export const RAW_LOCATION_PRESETS = [
  { id: 'preset_gachibowli', label: 'Gachibowli Hub', lat: 17.4401, lng: 78.3489 },
  { id: 'preset_kondapur', label: 'Kondapur Junction', lat: 17.4622, lng: 78.3568 },
  { id: 'preset_hitec', label: 'HITEC City Cyber Towers', lat: 17.4435, lng: 78.3772 },
  { id: 'preset_madhapur', label: 'Madhapur Tech Zone', lat: 17.4483, lng: 78.3915 },
  { id: 'preset_jubilee', label: 'Jubilee Hills Checkpost', lat: 17.4319, lng: 78.4071 },
];

export function resolveLocationPresets(graphEngine: GraphEngine): LocationPreset[] {
  return RAW_LOCATION_PRESETS.map((preset) => {
    const nearest = graphEngine.findNearestNode(preset.lat, preset.lng);
    return {
      id: preset.id,
      label: preset.label,
      lat: preset.lat,
      lng: preset.lng,
      nearestNodeId: nearest ? nearest.node.id : 'unknown',
      nearestNodeDistanceMeters: nearest ? nearest.distanceMeters : 0,
    };
  });
}
