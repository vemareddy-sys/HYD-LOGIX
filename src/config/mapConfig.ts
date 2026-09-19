/**
 * HYD-LOGIX Centralized Map Configuration
 *
 * Single source of truth for background raster basemap imagery.
 * All Leaflet map views must consume this configuration.
 *
 * NOTE: The local OSMnx Hyderabad road network graph (nodes.json, edges.json, GraphEngine)
 * operates completely independently on top of this basemap imagery layer.
 */

export interface BasemapConfig {
  url: string;
  attribution: string;
  maxZoom: number;
}

export const BASEMAP_CONFIG: BasemapConfig = {
  // Approved standard OpenStreetMap raster tiles (no API key required, zero CARTO watermarks)
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  // Visible attribution compliant with OpenStreetMap guidelines
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  maxZoom: 19,
};
