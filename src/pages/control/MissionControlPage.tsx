import React, { useState, useEffect } from 'react';
import { MapContainer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { BasemapTileLayer } from '../../components/map/BasemapTileLayer';
import {
  Activity,
  Boxes,
  Users,
  Truck,
  CheckCircle2,
  AlertCircle,
  Zap,
  RefreshCw,
  Loader2,
  Building2,
  ArrowRight,
  CheckSquare,
  Square,
  Scale,
  Navigation,
} from 'lucide-react';
import { useGraph } from '../../graph';
import { MultiLegRouteVisualizerLayer } from '../../components/map/MultiLegRouteVisualizerLayer';
import { planDeliveryRun, type StopPlanResult } from '../../algorithms/stopPlanner';
import { logisticsService } from '../../services/logisticsService';
import type { Order, Driver, Vehicle, Mission, Warehouse } from '../../types/logistics';

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

const sortPendingOrders = (list: Order[]): Order[] => {
  return [...list].sort((a, b) => {
    const pDiff = (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
    if (pDiff !== 0) return pDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
};

export const MissionControlPage: React.FC = () => {
  const { graphEngine } = useGraph();

  // Logistics Entities from Supabase
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  // Multi-Order Dispatch Selections
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Route Planning State (A* Multi-Leg Calculation)
  const [stopPlan, setStopPlan] = useState<StopPlanResult | null>(null);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);

  const fetchOperationalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [orderList, driverList, vehicleList, missionList, whList] = await Promise.all([
        logisticsService.getPendingOrders(),
        logisticsService.getAllDrivers(),
        logisticsService.getAllVehicles(),
        logisticsService.getAllMissions(),
        logisticsService.getWarehouses(),
      ]);

      const sortedOrders = sortPendingOrders(orderList);
      setOrders(sortedOrders);
      setDrivers(driverList);
      setVehicles(vehicleList);
      setMissions(missionList);
      setWarehouses(whList);

      // Auto-select first warehouse if none selected
      if (!selectedWarehouseId && whList.length > 0) {
        setSelectedWarehouseId(whList[0].id);
      }
    } catch (err: unknown) {
      console.error('Error fetching mission control data:', err);
      const msg = err instanceof Error ? err.message : 'Database query exception';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperationalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter orders by selected warehouse
  const availableOrders = orders.filter(
    (o) => !selectedWarehouseId || o.warehouse_id === selectedWarehouseId
  );

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setStopPlan(null);
    setDispatchSuccess(null);
  };

  const selectAllOrders = () => {
    if (selectedOrderIds.length === availableOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(availableOrders.map((o) => o.id));
    }
    setStopPlan(null);
    setDispatchSuccess(null);
  };

  const selectDriver = (id: string) => {
    const d = drivers.find((item) => item.id === id);
    if (!d || d.status !== 'AVAILABLE') return;
    setSelectedDriverId(id);
    setStopPlan(null);
    setDispatchSuccess(null);
  };

  const selectVehicle = (id: string) => {
    const v = vehicles.find((item) => item.id === id);
    if (!v || v.status !== 'AVAILABLE') return;
    setSelectedVehicleId(id);
    setStopPlan(null);
    setDispatchSuccess(null);
  };

  // Selected Entities
  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId) || null;
  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
  const selectedDriver = drivers.find((d) => d.id === selectedDriverId && d.status === 'AVAILABLE') || null;
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId && v.status === 'AVAILABLE') || null;

  // Aggregate metrics
  const totalSelectedWeight = selectedOrders.reduce((sum, o) => sum + (o.weight_kg || 0), 0);
  const vehicleCapacity = selectedVehicle?.capacity_kg || 0;
  const remainingCapacity = Math.max(0, vehicleCapacity - totalSelectedWeight);
  const isOverweight = vehicleCapacity > 0 && totalSelectedWeight > vehicleCapacity;
  const capacityPercent = vehicleCapacity > 0 ? Math.min(100, Math.round((totalSelectedWeight / vehicleCapacity) * 100)) : 0;

  // Priority composition count
  const priorityCount: Record<string, number> = {};
  selectedOrders.forEach((o) => {
    priorityCount[o.priority] = (priorityCount[o.priority] || 0) + 1;
  });

  const registeredDriversCount = drivers.length;
  const availableDriversCount = drivers.filter((d) => d.status === 'AVAILABLE').length;
  const registeredVehiclesCount = vehicles.length;
  const availableVehiclesCount = vehicles.filter((v) => v.status === 'AVAILABLE').length;

  // Plan Multi-Order Delivery Run Route
  const handlePlanDeliveryRun = () => {
    if (!graphEngine || !selectedWarehouse) {
      setError('Please select an active distribution warehouse.');
      return;
    }

    if (selectedOrders.length === 0) {
      setError('Please select at least one order to plan a delivery run.');
      return;
    }

    if (!selectedVehicle) {
      setError('Please select an available vehicle for capacity validation.');
      return;
    }

    setIsPlanning(true);
    setError(null);

    try {
      const plan = planDeliveryRun(graphEngine, selectedWarehouse, selectedOrders, selectedVehicle);
      if (!plan.success) {
        setError(plan.error || 'Failed to plan delivery run route.');
        setStopPlan(null);
        return;
      }
      setStopPlan(plan);
    } catch (err: unknown) {
      console.error('Delivery run planning failed:', err);
      const msg = err instanceof Error ? err.message : 'Stop planning exception';
      setError(msg);
    } finally {
      setIsPlanning(false);
    }
  };

  // Transactional Dispatch via Supabase create_delivery_run RPC
  const handleDispatchRun = async () => {
    if (
      !graphEngine ||
      !selectedWarehouse ||
      selectedOrders.length === 0 ||
      !selectedDriver ||
      !selectedVehicle ||
      !stopPlan
    ) {
      return;
    }

    setIsDispatching(true);
    setError(null);
    setDispatchSuccess(null);

    try {
      const createdMission = await logisticsService.createDeliveryRun({
        warehouse_id: selectedWarehouse.id,
        driver_id: selectedDriver.id,
        vehicle_id: selectedVehicle.id,
        order_ids: stopPlan.orderedStops.map((o) => o.id),
        legs: stopPlan.legs,
        total_distance_meters: stopPlan.totalDistanceMeters,
        total_effective_cost: stopPlan.totalEffectiveCost,
      });

      setDispatchSuccess(
        `Delivery Run ${createdMission.mission_code} successfully dispatched with ${stopPlan.orderedStops.length} stops!`
      );

      // Reset selection state
      setSelectedOrderIds([]);
      setSelectedDriverId(null);
      setSelectedVehicleId(null);
      setStopPlan(null);

      // Refresh database records
      await fetchOperationalData();
    } catch (err: unknown) {
      console.error('Dispatch failed:', err);
      const msg = err instanceof Error ? err.message : 'Dispatch transactional exception';
      setError(msg);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-obsidian-950 text-slate-100 overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-obsidian-900/80 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-tech text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              Mission Control // Multi-Order Delivery Runs
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                PHASE 05/06 ARCHITECTURE
              </span>
            </h1>
            <p className="text-xs font-mono text-slate-400">
              1 Run = 1 Driver + 1 Vehicle + 1 Warehouse + Multiple Orders + Sequential A* Legs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchOperationalData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-obsidian-950 hover:bg-slate-900 text-xs font-mono text-slate-300 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>SYNC DB</span>
          </button>
        </div>
      </div>

      {/* Main Operational Canvas */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Sidebar: 5-Step Mission Planning Workspace */}
        <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col border-r border-slate-800 bg-obsidian-900/60 z-20 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Status / Feedback Banners */}
            {error && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs font-mono text-rose-300 flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">Execution Error</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            {dispatchSuccess && (
              <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-xs font-mono text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">Run Dispatched</div>
                  <div>{dispatchSuccess}</div>
                </div>
              </div>
            )}

            {/* STEP 1: Select Warehouse */}
            <div className="bg-obsidian-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-sky-400" />
                  1. Origin Warehouse
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {warehouses.length} available
                </span>
              </div>

              {warehouses.length === 0 ? (
                <div className="p-2 text-center text-xs font-mono text-slate-500">
                  No registered warehouses found.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {warehouses.map((wh) => {
                    const isSelected = selectedWarehouseId === wh.id;
                    return (
                      <div
                        key={wh.id}
                        onClick={() => {
                          setSelectedWarehouseId(wh.id);
                          setSelectedOrderIds([]);
                          setStopPlan(null);
                        }}
                        className={`p-2.5 rounded-lg border text-xs font-mono cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-sky-950/50 border-sky-500 text-sky-200 font-semibold shadow-sm'
                            : 'bg-obsidian-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">{wh.name}</span>
                          <span className="text-[10px] text-slate-400">{wh.address_label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* STEP 2: Multi-Select Orders */}
            <div className="bg-obsidian-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                  2. Select Orders (Multi-Select)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllOrders}
                    disabled={availableOrders.length === 0}
                    className="text-[10px] font-mono text-cyan-400 hover:underline disabled:opacity-40"
                  >
                    {selectedOrderIds.length === availableOrders.length && availableOrders.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                  <span className="text-[10px] font-mono text-slate-400">
                    {availableOrders.length} pending
                  </span>
                </div>
              </div>

              {/* Selected Composition Summary Banner */}
              {selectedOrders.length > 0 && (
                <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-xs font-mono flex items-center justify-between">
                  <div className="text-cyan-300 font-bold">
                    {selectedOrders.length} packages • {totalSelectedWeight} kg
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {Object.entries(priorityCount).map(([p, count]) => (
                      <span
                        key={p}
                        className={`px-1.5 py-0.5 rounded border ${
                          p === 'URGENT'
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : p === 'HIGH'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        {count} {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {availableOrders.length === 0 ? (
                <div className="p-3 text-center text-xs font-mono text-slate-500">
                  No pending delivery orders for this warehouse.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {availableOrders.map((o) => {
                    const isSelected = selectedOrderIds.includes(o.id);
                    return (
                      <div
                        key={o.id}
                        onClick={() => toggleOrderSelection(o.id)}
                        className={`p-2.5 rounded-lg border text-xs font-mono cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200'
                            : 'bg-obsidian-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <div className="truncate">
                            <div className="font-bold text-slate-200 flex items-center gap-2">
                              <span>{o.package_name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({o.weight_kg || 0} kg)
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              → {o.destination_label}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 ml-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                              o.priority === 'URGENT'
                                ? 'bg-rose-950/80 border-rose-800 text-rose-300 font-bold'
                                : o.priority === 'HIGH'
                                ? 'bg-amber-950/80 border-amber-800 text-amber-300 font-medium'
                                : o.priority === 'NORMAL'
                                ? 'bg-sky-950/60 border-sky-800 text-sky-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            {o.priority}
                          </span>
                          <span className="text-[9px] text-slate-500 mt-0.5">{o.order_code}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* STEP 3 & 4: Driver and Vehicle Selection (2-Column Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Driver Selection */}
              <div className="bg-obsidian-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    3. Driver
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    <span className="text-emerald-400 font-semibold">{availableDriversCount}</span>/{registeredDriversCount} available
                  </span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {drivers.map((d) => {
                    const isAvailable = d.status === 'AVAILABLE';
                    const isSelected = selectedDriverId === d.id && isAvailable;
                    return (
                      <div
                        key={d.id}
                        onClick={() => isAvailable && selectDriver(d.id)}
                        className={`p-2 rounded-lg border text-xs font-mono transition-all ${
                          isSelected
                            ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 font-semibold cursor-pointer'
                            : isAvailable
                            ? 'bg-obsidian-900 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer'
                            : 'bg-obsidian-950/60 border-slate-800/50 text-slate-500 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold truncate">{d.display_name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] border ${
                              isAvailable
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vehicle Selection */}
              <div className="bg-obsidian-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                    4. Vehicle
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    <span className="text-amber-400 font-semibold">{availableVehiclesCount}</span>/{registeredVehiclesCount} available
                  </span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {vehicles.map((v) => {
                    const isAvailable = v.status === 'AVAILABLE';
                    const isSelected = selectedVehicleId === v.id && isAvailable;
                    return (
                      <div
                        key={v.id}
                        onClick={() => isAvailable && selectVehicle(v.id)}
                        className={`p-2 rounded-lg border text-xs font-mono transition-all ${
                          isSelected
                            ? 'bg-amber-950/50 border-amber-500 text-amber-300 font-semibold cursor-pointer'
                            : isAvailable
                            ? 'bg-obsidian-900 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer'
                            : 'bg-obsidian-950/60 border-slate-800/50 text-slate-500 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{v.vehicle_code}</span>
                          <span className="text-[10px] text-slate-400">
                            Cap: {v.capacity_kg ? `${v.capacity_kg} kg` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Vehicle Capacity Meter */}
            {selectedVehicle && (
              <div className="bg-obsidian-950/90 border border-slate-800 rounded-xl p-3 font-mono space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Scale className="w-4 h-4 text-amber-400" />
                    Vehicle Load Status:
                  </span>
                  <span className={`font-bold ${isOverweight ? 'text-rose-400' : 'text-slate-200'}`}>
                    {totalSelectedWeight} kg / {vehicleCapacity} kg ({capacityPercent}%)
                  </span>
                </div>

                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isOverweight
                        ? 'bg-rose-500'
                        : capacityPercent > 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, capacityPercent)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Unit: {selectedVehicle.vehicle_code}</span>
                  <span>Remaining: {remainingCapacity} kg</span>
                </div>

                {isOverweight && (
                  <div className="p-2 rounded bg-rose-950/40 border border-rose-800 text-[10px] text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Payload exceeds vehicle capacity limit! Reduce selected orders.</span>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: Planned Stop Sequence Display */}
            {stopPlan && (
              <div className="bg-obsidian-950/90 border border-emerald-800/60 rounded-xl p-3.5 space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
                    <Navigation className="w-4 h-4" />
                    Planned Stop Sequence ({stopPlan.legs.length} Stops)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Total: {(stopPlan.totalDistanceMeters / 1000).toFixed(1)} km
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Warehouse Origin */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                      HUB
                    </div>
                    <span className="font-bold text-slate-200">{selectedWarehouse?.name}</span>
                  </div>

                  {/* Stops Stepper */}
                  {stopPlan.orderedStops.map((order, idx) => {
                    const leg = stopPlan.legs[idx];
                    return (
                      <div key={order.id} className="pl-2 border-l-2 border-slate-800 ml-2.5 py-1 space-y-1">
                        <div className="text-[10px] text-cyan-400 flex items-center gap-1">
                          ↓ Leg {idx + 1}: {(leg.distance_meters / 1000).toFixed(2)} km ({leg.hop_count} road hops)
                        </div>
                        <div className="flex items-center justify-between text-xs bg-obsidian-900/60 p-2 rounded border border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-600 text-cyan-300 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-bold text-slate-200">{order.destination_label}</div>
                              <div className="text-[10px] text-slate-400">
                                {order.package_name} ({order.weight_kg} kg)
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] border ${
                              order.priority === 'URGENT'
                                ? 'bg-rose-950 text-rose-300 border-rose-800'
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}
                          >
                            {order.priority}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {!stopPlan ? (
                <button
                  onClick={handlePlanDeliveryRun}
                  disabled={
                    selectedOrders.length === 0 ||
                    !selectedDriver ||
                    !selectedVehicle ||
                    isOverweight ||
                    isPlanning
                  }
                  className="w-full py-2.5 rounded-lg bg-obsidian-850 hover:bg-obsidian-800 border border-slate-700 text-slate-200 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                >
                  {isPlanning ? (
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  ) : (
                    <Zap className="w-4 h-4 text-cyan-400" />
                  )}
                  <span>PLAN DELIVERY RUN</span>
                </button>
              ) : (
                <button
                  onClick={handleDispatchRun}
                  disabled={isDispatching}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
                >
                  {isDispatching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  <span>DISPATCH DELIVERY RUN ({stopPlan.legs.length} STOPS)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Leaflet Operational Map & Active Dispatches Table */}
        <div className="flex-1 flex flex-col relative h-full min-h-[500px]">
          {loading && (
            <div className="absolute inset-0 z-30 bg-obsidian-950/90 flex flex-col items-center justify-center text-slate-300">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
              <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
                Loading Operational Logistics State...
              </span>
            </div>
          )}

          {/* Leaflet Map Preview */}
          <div className="flex-1 relative w-full h-full">
            <MapContainer
              center={[17.4435, 78.3772]}
              zoom={13}
              scrollWheelZoom={true}
              className="w-full h-full z-10"
              style={{ background: '#070b12' }}
            >
              <BasemapTileLayer />

              {stopPlan && stopPlan.legs.length > 0 && (
                <MultiLegRouteVisualizerLayer legs={stopPlan.legs} activeLegSequence={1} />
              )}
            </MapContainer>
          </div>

          {/* Active Missions Table */}
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-obsidian-950/95 border border-slate-800 rounded-xl p-4 shadow-2xl backdrop-blur max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <span className="font-tech font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                Active Dispatches & Persistent Delivery Runs ({missions.length})
              </span>
              <span className="font-mono text-[10px] text-slate-400">Real Supabase Records</span>
            </div>

            {missions.length === 0 ? (
              <div className="text-center py-4 text-xs font-mono text-slate-500">
                No active delivery missions currently deployed.
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                    <th className="py-2 px-3">Run Code</th>
                    <th className="py-2 px-3">Driver</th>
                    <th className="py-2 px-3">Vehicle</th>
                    <th className="py-2 px-3">Stops</th>
                    <th className="py-2 px-3">Distance</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {missions.map((m) => (
                    <tr key={m.id} className="hover:bg-obsidian-900/50">
                      <td className="py-2 px-3 font-bold text-amber-400">
                        <code>{m.mission_code}</code>
                      </td>
                      <td className="py-2 px-3 text-emerald-400">
                        {m.driver?.display_name || 'Assigned Driver'}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {m.vehicle?.vehicle_code || 'Assigned Vehicle'}
                      </td>
                      <td className="py-2 px-3 text-cyan-300">
                        {m.total_stops || 1} {m.total_stops === 1 ? 'stop' : 'stops'} (Current: {m.current_stop_sequence || 1})
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {((m.total_route_distance_meters || m.route_distance_meters) / 1000).toFixed(2)} km
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] border ${
                            m.status === 'IN_TRANSIT'
                              ? 'bg-amber-950 text-amber-400 border-amber-800'
                              : m.status === 'COMPLETED' || m.status === 'DELIVERED'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : 'bg-sky-950 text-sky-400 border-sky-800'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
