import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  MapPin,
  Building2,
  AlertCircle,
  Weight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useGraph } from '../../graph';
import type { LocationPreset } from '../../graph/types';
import { logisticsService } from '../../services/logisticsService';
import type { Order, Warehouse, OrderPriority } from '../../types/logistics';

export const OrdersPage: React.FC = () => {
  const { graphEngine, locationPresets } = useGraph();

  const [orders, setOrders] = useState<Order[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [showCreateOrderModal, setShowCreateOrderModal] = useState<boolean>(false);
  const [showCreateWarehouseModal, setShowCreateWarehouseModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // New Order Form State
  const [packageName, setPackageName] = useState<string>('');
  const [packageDesc, setPackageDesc] = useState<string>('');
  const [weightKg, setWeightKg] = useState<number>(5);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [destinationMethod, setDestinationMethod] = useState<'PRESET' | 'CUSTOM'>('PRESET');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset_jubilee');
  const [customLat, setCustomLat] = useState<number>(17.4319);
  const [customLng, setCustomLng] = useState<number>(78.4071);
  const [customLabel, setCustomLabel] = useState<string>('');
  const [orderPriority, setOrderPriority] = useState<OrderPriority>('URGENT');

  // New Warehouse Form State
  const [whName, setWhName] = useState<string>('Gachibowli Distribution Hub');
  const [whAddress, setWhAddress] = useState<string>('Plot 12, Financial District, Gachibowli');
  const [whPresetId, setWhPresetId] = useState<string>('preset_gachibowli');

  const PRIORITY_ORDER: Record<OrderPriority, number> = {
    URGENT: 4,
    HIGH: 3,
    NORMAL: 2,
    LOW: 1,
  };

  const sortOrders = (list: Order[]) => {
    return [...list].sort((a, b) => {
      const pDiff = (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
      if (pDiff !== 0) return pDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [whList, orderList] = await Promise.all([
        logisticsService.getWarehouses(),
        logisticsService.getOrders({
          priority: priorityFilter,
          status: statusFilter,
          search: searchQuery,
        }),
      ]);
      setWarehouses(whList);
      setOrders(sortOrders(orderList));

      if (whList.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(whList[0].id);
      }
    } catch (err: unknown) {
      console.error('Error loading orders page data:', err);
      const msg = err instanceof Error ? err.message : 'Database query exception';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorityFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!graphEngine) return;

    setSubmitting(true);
    setError(null);

    try {
      const preset = locationPresets.find((p) => p.id === whPresetId) || locationPresets[0];
      const lat = preset ? preset.lat : 17.4401;
      const lng = preset ? preset.lng : 78.3489;

      const nearest = graphEngine.findNearestNode(lat, lng);
      if (!nearest) {
        throw new Error('Could not resolve coordinate to a valid graph node in Hyderabad.');
      }

      const createdWh = await logisticsService.createWarehouse({
        name: whName.trim(),
        address_label: whAddress.trim(),
        latitude: lat,
        longitude: lng,
        nearest_graph_node_id: nearest.node.id,
      });

      setWarehouses((prev) => [createdWh, ...prev]);
      setSelectedWarehouseId(createdWh.id);
      setShowCreateWarehouseModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create warehouse';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!graphEngine) return;

    if (!selectedWarehouseId) {
      setError('Please select or register a warehouse first.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let destLat = customLat;
      let destLng = customLng;
      let destLabel = customLabel.trim();

      if (destinationMethod === 'PRESET') {
        const preset = locationPresets.find((p) => p.id === selectedPresetId);
        if (preset) {
          destLat = preset.lat;
          destLng = preset.lng;
          destLabel = preset.label;
        }
      }

      const nearest = graphEngine.findNearestNode(destLat, destLng);
      if (!nearest) {
        throw new Error('Destination coordinate does not resolve to a valid graph node.');
      }

      const newOrder = await logisticsService.createOrder({
        package_name: packageName.trim(),
        package_description: packageDesc.trim() || undefined,
        weight_kg: Number(weightKg) || undefined,
        warehouse_id: selectedWarehouseId,
        destination_label: destLabel || 'Hyderabad Destination',
        destination_latitude: destLat,
        destination_longitude: destLng,
        destination_graph_node_id: nearest.node.id,
        priority: orderPriority,
      });

      setOrders((prev) => sortOrders([newOrder, ...prev]));
      setShowCreateOrderModal(false);
      setPackageName('');
      setPackageDesc('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create order';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 flex flex-col gap-6 overflow-x-hidden bg-obsidian-950 text-slate-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-950/60 text-amber-300 border border-amber-800/60">
              DEMAND REGISTRY
            </span>
            <span className="font-mono text-xs text-slate-400">
              Hyderabad Operational Orders
            </span>
          </div>
          <h1 className="font-tech text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-100 mt-1 flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-logix-amber shrink-0" />
            <span>Delivery Orders Management</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowCreateWarehouseModal(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-obsidian-900 hover:bg-obsidian-850 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-all"
          >
            <Building2 className="w-4 h-4 text-logix-amber" />
            <span>+ Add Warehouse</span>
          </button>

          <button
            onClick={() => setShowCreateOrderModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-logix-amber hover:bg-amber-500 text-obsidian-950 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>CREATE ORDER</span>
          </button>

          <button
            onClick={fetchData}
            title="Refresh"
            className="p-2 rounded-lg border border-slate-800 bg-obsidian-900 text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-mono flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-obsidian-900/80 p-3.5 rounded-xl border border-slate-800">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by code, package name, or destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-obsidian-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-logix-amber"
          />
        </form>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-slate-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-obsidian-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value="ALL">ALL</option>
              <option value="URGENT">URGENT</option>
              <option value="HIGH">HIGH</option>
              <option value="NORMAL">NORMAL</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-obsidian-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value="ALL">ALL</option>
              <option value="PENDING">PENDING</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_TRANSIT">IN_TRANSIT</option>
              <option value="DELIVERED">DELIVERED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table or Empty State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
          <Loader2 className="w-8 h-8 text-logix-amber animate-spin mb-3" />
          <span className="text-xs font-mono uppercase tracking-wider">
            Loading Real Supabase Orders...
          </span>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-obsidian-900/40 border border-slate-800 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-obsidian-850 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
            <Boxes className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="font-tech text-base font-semibold uppercase text-slate-200">
            No Orders Found
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm">
            {warehouses.length === 0
              ? 'No warehouse exists yet. First register a warehouse like "Gachibowli Distribution Hub", then create a real delivery order.'
              : 'No orders match current criteria. Create your first real order using real Hyderabad geographic coordinates.'}
          </p>
          <div className="mt-4 flex gap-3">
            {warehouses.length === 0 && (
              <button
                onClick={() => setShowCreateWarehouseModal(true)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-obsidian-900 hover:bg-obsidian-850 text-slate-200 text-xs font-mono"
              >
                + Register Warehouse
              </button>
            )}
            <button
              onClick={() => setShowCreateOrderModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-logix-amber hover:bg-amber-500 text-obsidian-950 text-xs font-mono font-semibold"
            >
              + Create Delivery Order
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-obsidian-900/60 overflow-x-auto shadow-panel">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase bg-obsidian-950/60">
                <th className="py-3 px-4">Order Code</th>
                <th className="py-3 px-4">Package</th>
                <th className="py-3 px-4">Origin Warehouse</th>
                <th className="py-3 px-4">Destination Target</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {orders.map((order) => {
                const priorityColors: Record<OrderPriority, string> = {
                  URGENT: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
                  HIGH: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
                  NORMAL: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
                  LOW: 'bg-slate-900 text-slate-400 border-slate-800',
                };
                const statusColors: Record<string, string> = {
                  PENDING: 'text-amber-400 bg-amber-950/40 border-amber-800/50',
                  ASSIGNED: 'text-sky-400 bg-sky-950/40 border-sky-800/50',
                  DELIVERED: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50',
                  CANCELLED: 'text-rose-400 bg-rose-950/40 border-rose-800/50',
                };

                return (
                  <tr key={order.id} className="hover:bg-obsidian-850/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-amber-400">
                      <code>{order.order_code}</code>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">{order.package_name}</div>
                      {order.weight_kg && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Weight className="w-3 h-3 text-slate-500" />
                          <span>{order.weight_kg} kg</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {order.warehouse?.name || 'Distribution Hub'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-200 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>{order.destination_label}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Node: <code>{order.destination_graph_node_id}</code>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${priorityColors[order.priority]}`}>
                        {order.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${statusColors[order.status] || 'text-slate-400'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Order */}
      {showCreateOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-tech text-base font-bold uppercase text-slate-100 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-logix-amber" />
                Create Real Delivery Order
              </h3>
              <button
                onClick={() => setShowCreateOrderModal(false)}
                className="text-slate-400 hover:text-white text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="text-slate-300 block mb-1">PACKAGE NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Critical Medical Supplies, Industrial Tooling..."
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-300 block mb-1">WEIGHT (KG)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">PRIORITY</label>
                  <select
                    value={orderPriority}
                    onChange={(e) => setOrderPriority(e.target.value as OrderPriority)}
                    className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                  >
                    <option value="URGENT">URGENT</option>
                    <option value="HIGH">HIGH</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">ORIGIN WAREHOUSE *</label>
                {warehouses.length === 0 ? (
                  <div className="p-2.5 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px]">
                    No warehouse exists. Click &quot;Manage Warehouses&quot; to create one first.
                  </div>
                ) : (
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({wh.address_label})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">HYDERABAD DESTINATION TARGET</span>
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDestinationMethod('PRESET')}
                      className={`px-2 py-0.5 rounded border ${
                        destinationMethod === 'PRESET'
                          ? 'bg-amber-950 border-logix-amber text-amber-300'
                          : 'bg-obsidian-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Presets
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestinationMethod('CUSTOM')}
                      className={`px-2 py-0.5 rounded border ${
                        destinationMethod === 'CUSTOM'
                          ? 'bg-amber-950 border-logix-amber text-amber-300'
                          : 'bg-obsidian-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Coordinates
                    </button>
                  </div>
                </div>

                {destinationMethod === 'PRESET' ? (
                  <div>
                    <select
                      value={selectedPresetId}
                      onChange={(e) => setSelectedPresetId(e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                    >
                      {locationPresets.map((preset: LocationPreset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} (Node: {preset.nearestNodeId})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Destination Name e.g. Durgam Cheruvu Gate"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="Latitude"
                        value={customLat}
                        onChange={(e) => setCustomLat(Number(e.target.value))}
                        className="bg-obsidian-950 border border-slate-800 rounded px-2.5 py-1 text-slate-100"
                      />
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="Longitude"
                        value={customLng}
                        onChange={(e) => setCustomLng(Number(e.target.value))}
                        className="bg-obsidian-950 border border-slate-800 rounded px-2.5 py-1 text-slate-100"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateOrderModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-obsidian-950 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || warehouses.length === 0}
                  className="px-4 py-1.5 rounded-lg bg-logix-amber hover:bg-amber-500 text-obsidian-950 font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>CONFIRM ORDER</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Warehouse */}
      {showCreateWarehouseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-tech text-base font-bold uppercase text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-logix-amber" />
                Register Distribution Warehouse
              </h3>
              <button
                onClick={() => setShowCreateWarehouseModal(false)}
                className="text-slate-400 hover:text-white text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="text-slate-300 block mb-1">WAREHOUSE NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gachibowli Distribution Hub"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">STREET ADDRESS / HUB LOCATION *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Financial District Main Road"
                  value={whAddress}
                  onChange={(e) => setWhAddress(e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">GEOGRAPHIC CORRIDOR PRESET</label>
                <select
                  value={whPresetId}
                  onChange={(e) => setWhPresetId(e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                >
                  {locationPresets.map((preset: LocationPreset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label} (Lat: {preset.lat}, Lng: {preset.lng})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  System will resolve exact coordinates to the nearest graph node in the real Hyderabad topology.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateWarehouseModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-obsidian-950 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-logix-amber hover:bg-amber-500 text-obsidian-950 font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>REGISTER WAREHOUSE</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
