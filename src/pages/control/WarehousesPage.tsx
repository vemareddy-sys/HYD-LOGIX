import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useGraph } from '../../graph';
import { logisticsService } from '../../services/logisticsService';
import type { Warehouse } from '../../types/logistics';

export const WarehousesPage: React.FC = () => {
  const { graphEngine, locationPresets } = useGraph();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState<string>('Gachibowli Distribution Hub');
  const [addressLabel, setAddressLabel] = useState<string>('Plot 12, Financial District, Gachibowli');
  const [coordMethod, setCoordMethod] = useState<'PRESET' | 'CUSTOM'>('PRESET');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset_gachibowli');
  const [customLat, setCustomLat] = useState<number>(17.4401);
  const [customLng, setCustomLng] = useState<number>(78.3489);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await logisticsService.getWarehouses();
      setWarehouses(list);
    } catch (err: unknown) {
      console.error('Error fetching warehouses:', err);
      const msg = err instanceof Error ? err.message : 'Failed to query warehouses';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    logisticsService
      .getWarehouses()
      .then((list) => {
        if (!active) return;
        setWarehouses(list);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        console.error('Error fetching warehouses:', err);
        const msg = err instanceof Error ? err.message : 'Failed to query warehouses';
        setError(msg);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeLat =
    coordMethod === 'PRESET'
      ? locationPresets.find((p) => p.id === selectedPresetId)?.lat ?? 17.4401
      : customLat;
  const activeLng =
    coordMethod === 'PRESET'
      ? locationPresets.find((p) => p.id === selectedPresetId)?.lng ?? 78.3489
      : customLng;

  const resolvedNode = graphEngine ? graphEngine.findNearestNode(activeLat, activeLng) : null;

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!graphEngine) return;

    setSubmitting(true);
    setError(null);

    try {
      const nearest = graphEngine.findNearestNode(activeLat, activeLng);
      if (!nearest) {
        throw new Error('Coordinates do not resolve to a valid node on the Hyderabad road graph.');
      }

      const created = await logisticsService.createWarehouse({
        name: name.trim(),
        address_label: addressLabel.trim(),
        latitude: activeLat,
        longitude: activeLng,
        nearest_graph_node_id: nearest.node.id,
      });

      setWarehouses((prev) => [created, ...prev]);
      setShowCreateModal(false);
    } catch (err: unknown) {
      console.error('Create warehouse failed:', err);
      const msg = err instanceof Error ? err.message : 'Warehouse registration failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 flex flex-col gap-6 overflow-x-hidden bg-obsidian-950 text-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-logix-amber" />
              DISTRIBUTION NETWORK
            </span>
            <span className="font-mono text-xs text-slate-500">
              {warehouses.length} {warehouses.length === 1 ? 'Hub' : 'Hubs'} Registered
            </span>
          </div>
          <h1 className="font-tech text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-100 mt-1 flex items-center gap-2.5">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-logix-amber shrink-0" />
            <span>Warehouses & Distribution Hubs</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWarehouses}
            disabled={loading}
            title="Refresh Warehouses"
            className="p-2 rounded-lg border border-slate-800 bg-obsidian-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2 text-xs font-mono py-2 px-3.5"
          >
            <Plus className="w-4 h-4" />
            <span>ADD WAREHOUSE</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-mono flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Warehouses Grid */}
      {loading ? (
        <div className="panel-surface p-12 text-center flex flex-col items-center justify-center min-h-[260px]">
          <Loader2 className="w-8 h-8 text-logix-amber animate-spin mb-3" />
          <div className="text-xs font-mono text-slate-400">Loading distribution hubs...</div>
        </div>
      ) : warehouses.length === 0 ? (
        <div className="panel-surface p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-14 h-14 rounded-2xl bg-obsidian-850 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
            <Building2 className="w-7 h-7 text-logix-amber/70" />
          </div>
          <h2 className="font-tech text-base font-semibold uppercase tracking-wider text-slate-200">
            No Warehouses Registered
          </h2>
          <p className="mt-1.5 text-xs text-slate-400 max-w-sm">
            Control Center requires at least one registered hub with resolved OpenStreetMap graph
            coordinates to dispatch delivery missions.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-5 btn-primary flex items-center gap-2 text-xs font-mono py-2 px-4"
          >
            <Plus className="w-4 h-4" />
            <span>CREATE GACHIBOWLI HUB</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              className="panel-surface p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-950/50 border border-logix-amber/40 flex items-center justify-center text-logix-amber shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-tech font-bold text-slate-100 text-sm">{wh.name}</h3>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span className="truncate">{wh.address_label}</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                    OPERATIONAL
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Coordinates:</span>
                    <span className="text-slate-300">
                      {wh.latitude.toFixed(4)}°N, {wh.longitude.toFixed(4)}°E
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">OSM Graph Node:</span>
                    <span className="text-amber-400 font-semibold truncate max-w-[160px]" title={wh.nearest_graph_node_id}>
                      {wh.nearest_graph_node_id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Registered:</span>
                    <span className="text-slate-400">
                      {new Date(wh.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Warehouse Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-obsidian-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-logix-amber" />
                <h3 className="font-tech text-lg font-bold text-slate-100">REGISTER WAREHOUSE HUB</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200 font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Hub Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Gachibowli Distribution Hub"
                  className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-logix-amber outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Address Label
                </label>
                <input
                  type="text"
                  required
                  value={addressLabel}
                  onChange={(e) => setAddressLabel(e.target.value)}
                  placeholder="Plot 12, Financial District, Gachibowli"
                  className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-logix-amber outline-none"
                />
              </div>

              {/* Coordinate Mode */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase text-slate-400">
                    Geographic Location
                  </label>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setCoordMethod('PRESET')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        coordMethod === 'PRESET'
                          ? 'bg-logix-amber text-slate-950 font-bold'
                          : 'bg-obsidian-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      Hyderabad Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoordMethod('CUSTOM')}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        coordMethod === 'CUSTOM'
                          ? 'bg-logix-amber text-slate-950 font-bold'
                          : 'bg-obsidian-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      Custom Lat/Lng
                    </button>
                  </div>
                </div>

                {coordMethod === 'PRESET' ? (
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-logix-amber outline-none"
                  >
                    {locationPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} ({p.lat.toFixed(4)}, {p.lng.toFixed(4)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block mb-1">
                        Latitude (-90 to 90)
                      </span>
                      <input
                        type="number"
                        step="0.0001"
                        required
                        value={customLat}
                        onChange={(e) => setCustomLat(parseFloat(e.target.value) || 0)}
                        className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono focus:border-logix-amber outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 block mb-1">
                        Longitude (-180 to 180)
                      </span>
                      <input
                        type="number"
                        step="0.0001"
                        required
                        value={customLng}
                        onChange={(e) => setCustomLng(parseFloat(e.target.value) || 0)}
                        className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono focus:border-logix-amber outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Resolved OSM Graph Node Preview */}
              <div className="p-3 bg-obsidian-950 rounded-xl border border-slate-800/80 font-mono text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Active Coordinates:</span>
                  <span className="text-slate-200">
                    {activeLat.toFixed(4)}°N, {activeLng.toFixed(4)}°E
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Resolved Graph Node:</span>
                  <span className="text-amber-400 font-semibold truncate max-w-[200px]">
                    {resolvedNode ? resolvedNode.node.id : 'Computing nearest node...'}
                  </span>
                </div>
                {resolvedNode && (
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span>Node Snap Distance:</span>
                    <span>{resolvedNode.distanceMeters.toFixed(1)} meters</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-400 hover:text-slate-200"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting || !resolvedNode}
                  className="btn-primary px-5 py-2 rounded-lg text-xs font-mono flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>PERSISTING...</span>
                    </>
                  ) : (
                    <span>CONFIRM & REGISTER</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
