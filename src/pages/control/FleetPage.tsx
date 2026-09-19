import React, { useState, useEffect } from 'react';
import {
  Truck,
  Users,
  Plus,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Loader2,
  UserCheck,
} from 'lucide-react';
import { logisticsService } from '../../services/logisticsService';
import type { Vehicle, Driver, VehicleType, DriverStatus } from '../../types/logistics';

export const FleetPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'VEHICLES' | 'DRIVERS'>('VEHICLES');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Vehicle Registration Modal
  const [showVehicleModal, setShowVehicleModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [vehicleCode, setVehicleCode] = useState<string>('VAN-01');
  const [vehicleType, setVehicleType] = useState<VehicleType>('VAN');
  const [capacityKg, setCapacityKg] = useState<number>(500);

  const fetchFleet = async () => {
    setLoading(true);
    setError(null);
    try {
      const [vList, dList] = await Promise.all([
        logisticsService.getAllVehicles(),
        logisticsService.getAllDrivers(),
      ]);
      setVehicles(vList);
      setDrivers(dList);
    } catch (err: unknown) {
      console.error('Error fetching fleet data:', err);
      const msg = err instanceof Error ? err.message : 'Database query exception';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      logisticsService.getAllVehicles(),
      logisticsService.getAllDrivers(),
    ])
      .then(([vList, dList]) => {
        if (!active) return;
        setVehicles(vList);
        setDrivers(dList);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        console.error('Error fetching fleet data:', err);
        const msg = err instanceof Error ? err.message : 'Database query exception';
        setError(msg);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const newVehicle = await logisticsService.createVehicle({
        vehicle_code: vehicleCode.trim().toUpperCase(),
        type: vehicleType,
        capacity_kg: Number(capacityKg) || undefined,
      });

      setVehicles((prev) => [newVehicle, ...prev]);
      setShowVehicleModal(false);
      setVehicleCode('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register vehicle';
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
              FLEET & FIELD LOGISTICS
            </span>
            <span className="font-mono text-xs text-slate-400">
              Operational Fleet & Driver Registry
            </span>
          </div>
          <h1 className="font-tech text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-100 mt-1 flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-logix-amber shrink-0" />
            <span>Fleet Inventory & Driver Roster</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowVehicleModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-logix-amber hover:bg-amber-500 text-obsidian-950 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>REGISTER VEHICLE</span>
          </button>

          <button
            onClick={fetchFleet}
            title="Refresh"
            className="p-2 rounded-lg border border-slate-800 bg-obsidian-900 text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-mono flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Segmented Section Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setActiveTab('VEHICLES')}
            className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 border transition-all ${
              activeTab === 'VEHICLES'
                ? 'bg-amber-950/50 border-logix-amber text-amber-300 shadow-sm'
                : 'bg-obsidian-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>VEHICLES ({vehicles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('DRIVERS')}
            className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 border transition-all ${
              activeTab === 'DRIVERS'
                ? 'bg-amber-950/50 border-logix-amber text-amber-300 shadow-sm'
                : 'bg-obsidian-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>DRIVERS ({drivers.length})</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
          Live Database Connection
        </span>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
          <Loader2 className="w-8 h-8 text-logix-amber animate-spin mb-3" />
          <span className="text-xs font-mono uppercase tracking-wider">
            Loading Real Fleet & Driver Records...
          </span>
        </div>
      ) : activeTab === 'VEHICLES' ? (
        // Vehicles Section
        vehicles.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-obsidian-900/40 border border-slate-800 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-obsidian-850 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
              <Truck className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-tech text-base font-semibold uppercase text-slate-200">
              No Vehicles Registered
            </h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              The vehicle registry is currently empty. Register your first operational vehicle (e.g. VAN-01) to begin dispatching delivery missions.
            </p>
            <button
              onClick={() => setShowVehicleModal(true)}
              className="mt-4 px-3.5 py-1.5 rounded-lg bg-logix-amber hover:bg-amber-500 text-obsidian-950 text-xs font-mono font-semibold"
            >
              + Register Vehicle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => {
              const statusBadgeColors: Record<string, string> = {
                AVAILABLE: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
                ASSIGNED: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
                ON_DELIVERY: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
                MAINTENANCE: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
              };

              return (
                <div
                  key={v.id}
                  className="p-4 rounded-xl bg-obsidian-900 border border-slate-800 flex flex-col justify-between gap-3 shadow-panel hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-obsidian-950 border border-slate-800 text-logix-amber">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-tech text-sm font-bold text-slate-100">
                          {v.vehicle_code}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">{v.type}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${statusBadgeColors[v.status] || 'text-slate-400'}`}>
                      {v.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-obsidian-950 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 uppercase block">Capacity</span>
                      <span className="text-slate-200 font-semibold">{v.capacity_kg ? `${v.capacity_kg} kg` : 'N/A'}</span>
                    </div>
                    <div className="p-2 rounded bg-obsidian-950 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 uppercase block">Driver</span>
                      <span className="text-slate-200 font-semibold truncate block">
                        {v.driver?.display_name || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>ID: {v.id.substring(0, 8)}...</span>
                    <span>Registered: {new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // Drivers Section
        drivers.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-obsidian-900/40 border border-slate-800 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-obsidian-850 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-tech text-base font-semibold uppercase text-slate-200">
              No Driver Accounts Registered
            </h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              Real driver records are automatically synced whenever a user signs up with the <strong className="text-amber-400">DRIVER</strong> role. Sign up or invite a driver to establish their field clearance.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.map((d) => {
              const driverStatusColors: Record<DriverStatus, string> = {
                AVAILABLE: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
                ASSIGNED: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
                ON_DELIVERY: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
                OFFLINE: 'bg-slate-900 text-slate-400 border-slate-800',
              };

              const activeMission = d.missions?.find(
                (m) => m.status === 'ASSIGNED' || m.status === 'IN_TRANSIT'
              );

              return (
                <div
                  key={d.id}
                  className="p-4 rounded-xl bg-obsidian-900 border border-slate-800 flex flex-col justify-between gap-3 shadow-panel hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-obsidian-950 border border-slate-800 text-emerald-400">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-tech text-sm font-bold text-slate-100">
                          {d.display_name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          Clearance: DRIVER BOUND
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${driverStatusColors[d.status] || 'text-slate-400'}`}>
                      {d.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-obsidian-950 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 uppercase block">Vehicle</span>
                      <span className="text-slate-200 font-semibold truncate block">
                        {d.vehicle?.vehicle_code || 'None'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-obsidian-950 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 uppercase block">Current Mission</span>
                      <span className="text-amber-400 font-semibold truncate block">
                        {activeMission ? activeMission.mission_code : 'None'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Profile: {d.profile_id.substring(0, 8)}...</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modal: Register Vehicle */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-tech text-base font-bold uppercase text-slate-100 flex items-center gap-2">
                <Truck className="w-5 h-5 text-logix-amber" />
                Register New Vehicle
              </h3>
              <button
                onClick={() => setShowVehicleModal(false)}
                className="text-slate-400 hover:text-white text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="text-slate-300 block mb-1">VEHICLE CODE *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VAN-01, BIKE-04, LOGIX-TRK"
                  value={vehicleCode}
                  onChange={(e) => setVehicleCode(e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">VEHICLE TYPE *</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                  className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                >
                  <option value="VAN">VAN (Standard Logistics Van)</option>
                  <option value="BIKE">BIKE (Express Two-Wheeler Courier)</option>
                  <option value="SMALL_VEHICLE">SMALL_VEHICLE (Urban Electric Carrier)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">PAYLOAD CAPACITY (KG)</label>
                <input
                  type="number"
                  min="1"
                  value={capacityKg}
                  onChange={(e) => setCapacityKg(Number(e.target.value))}
                  className="w-full bg-obsidian-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-logix-amber"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
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
                  <span>REGISTER VEHICLE</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
