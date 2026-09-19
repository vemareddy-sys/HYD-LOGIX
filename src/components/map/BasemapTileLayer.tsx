import React from 'react';
import { TileLayer } from 'react-leaflet';
import { BASEMAP_CONFIG } from '../../config/mapConfig';

/**
 * Centralized Basemap TileLayer Component
 *
 * Ensures all maps across HYD-LOGIX (Control Center, AI Lab, Mission Control, Driver Navigation)
 * utilize the single approved OpenStreetMap raster tile configuration with required attribution.
 */
export const BasemapTileLayer: React.FC = () => {
  return (
    <TileLayer
      url={BASEMAP_CONFIG.url}
      attribution={BASEMAP_CONFIG.attribution}
      maxZoom={BASEMAP_CONFIG.maxZoom}
    />
  );
};
