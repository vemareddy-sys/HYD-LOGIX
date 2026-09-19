import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context';
import { 
  Boxes, 
  Activity, 
  Truck, 
  Users, 
  Clock, 
  Layers,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { logisticsService } from '../../services/logisticsService';
import type { Order, Mission, Driver, Vehicle } from '../../types/logistics';

export const OverviewPage: React.FC = () => {
  const { user, profile } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [activeMissions, setActiveMissions] = useState<Mission[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const [orderList, missionList, activeList, driverList, availDList, vehicleList, availVList] = await Promise.all([
        logisticsService.getAllOrders(),
        logisticsService.getAllMissions(),
        logisticsService.getActiveMissions(),
        logisticsService.getAllDrivers(),
        logisticsService.getAvailableDrivers(),
        logisticsService.getAllVehicles(),
        logisticsService.getAvailableVehicles(),
      ]);
      setOrders(orderList);
      setMissions(missionList);
      setActiveMissions(activeList);
      setDrivers(driverList);
      setAvailableDrivers(availDList);
      setVehicles(vehicleList);
      setAvailableVehicles(availVList);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      logisticsService.getAllOrders(),
      logisticsService.getAllMissions(),
      logisticsService.getActiveMissions(),
      logisticsService.getAllDrivers(),
      logisticsService.getAvailableDrivers(),
      logisticsService.getAllVehicles(),
      logisticsService.getAvailableVehicles(),
    ])
      .then(([orderList, missionList, activeList, driverList, availDList, vehicleList, availVList]) => {
        if (!active) return;
        setOrders(orderList);
        setMissions(missionList);
        setActiveMissions(activeList);
        setDrivers(driverList);
        setAvailableDrivers(availDList);
        setVehicles(vehicleList);
        setAvailableVehicles(availVList);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load overview data:', err);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;
  const activeMissionsCount = activeMissions.length;
  const availableDriversCount = availableDrivers.length;
  const availableVehiclesCount = availableVehicles.length;

  return (
    <div className="flex-1 p-4 sm:p-6 flex flex-col gap-6 overflow-x-hidden bg-obsidian-950 text-slate-200">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-950/60 text-amber-300 border border-amber-800/60">
              LIVE DISPATCH NETWORK
            </span>
            <span className="font-mono text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-logix-amber" />
              Realtime Database Connected
            </span>
          </div>
          <h1 className="font-tech text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-100 mt-1 flex items-center gap-2">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-logix-amber shrink-0" />
            <span>Central Operations Overview</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSummary}
            className="p-2 rounded-lg bg-obsidian-900 border border-slate-800 text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="px-3 py-1.5 rounded-lg bg-obsidian-900 border border-slate-800 text-xs font-mono text-slate-300">
            OPERATOR: <span className="text-emerald-400">{profile?.full_name || user?.email}</span>
          </div>
        </div>
      </div>

      {/* Real Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Orders */}
        <Link
          to="/control/orders"
          className="p-4 rounded-xl bg-obsidian-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-panel group"
        >
          <div className="flex items-center justify-between">
            <span className="tech-label text-[11px]">Pending Orders</span>
            <div className="p-2 rounded-lg bg-obsidian-950 border border-slate-800 text-logix-amber group-hover:text-amber-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-tech text-3xl font-bold text-slate-100">
              {loading ? '-' : pendingOrdersCount}
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-1">
              {pendingOrdersCount === 1 ? '1 order pending dispatch' : `${pendingOrdersCount} orders pending dispatch`}
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-amber-500">
            <span>Manage Orders</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Active Missions */}
        <Link
          to="/control/missions"
          className="p-4 rounded-xl bg-obsidian-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-panel group"
        >
          <div className="flex items-center justify-between">
            <span className="tech-label text-[11px]">Active Missions</span>
            <div className="p-2 rounded-lg bg-obsidian-950 border border-slate-800 text-emerald-400 group-hover:text-emerald-300">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-tech text-3xl font-bold text-slate-100">
              {loading ? '-' : activeMissionsCount}
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-1">
              {activeMissionsCount === 1 ? '1 mission in progress' : `${activeMissionsCount} missions in progress`}
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-emerald-400">
            <span>Mission Control</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Available Drivers */}
        <Link
          to="/control/fleet"
          className="p-4 rounded-xl bg-obsidian-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-panel group"
        >
          <div className="flex items-center justify-between">
            <span className="tech-label text-[11px]">Available Drivers</span>
            <div className="p-2 rounded-lg bg-obsidian-950 border border-slate-800 text-sky-400 group-hover:text-sky-300">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-tech text-3xl font-bold text-slate-100">
              {loading ? '-' : availableDriversCount}
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-1">
              {drivers.length} total registered drivers
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-sky-400">
            <span>Driver Roster</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {/* Available Vehicles */}
        <Link
          to="/control/fleet"
          className="p-4 rounded-xl bg-obsidian-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-panel group"
        >
          <div className="flex items-center justify-between">
            <span className="tech-label text-[11px]">Available Vehicles</span>
            <div className="p-2 rounded-lg bg-obsidian-950 border border-slate-800 text-amber-400 group-hover:text-amber-300">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-tech text-3xl font-bold text-slate-100">
              {loading ? '-' : availableVehiclesCount}
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-1">
              {vehicles.length} total registered fleet
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-amber-400">
            <span>Fleet Registry</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Recent Dispatches & Orders Split Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Missions */}
        <div className="p-4 rounded-xl bg-obsidian-900 border border-slate-800 flex flex-col shadow-panel">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="font-tech text-sm font-bold uppercase text-slate-200 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              Recent Missions
            </span>
            <Link to="/control/missions" className="text-xs font-mono text-amber-500 hover:underline">
              View All →
            </Link>
          </div>

          <div className="mt-3 flex-1 overflow-x-auto">
            {missions.length === 0 ? (
              <div className="text-center py-8 text-xs font-mono text-slate-500">
                No missions dispatched yet.
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[10px] text-slate-500 uppercase">
                    <th className="py-2 px-2">Code</th>
                    <th className="py-2 px-2">Package</th>
                    <th className="py-2 px-2">Distance</th>
                    <th className="py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {missions.slice(0, 5).map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 px-2 font-bold text-amber-400">
                        <code>{m.mission_code}</code>
                      </td>
                      <td className="py-2 px-2 text-slate-300 truncate max-w-[120px]">
                        {m.order?.package_name || 'Package'}
                      </td>
                      <td className="py-2 px-2 text-slate-400">
                        {(m.route_distance_meters / 1000).toFixed(2)} km
                      </td>
                      <td className="py-2 px-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-sky-950/60 text-sky-400 border border-sky-800/60">
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

        {/* Recent Orders */}
        <div className="p-4 rounded-xl bg-obsidian-900 border border-slate-800 flex flex-col shadow-panel">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="font-tech text-sm font-bold uppercase text-slate-200 flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-logix-amber" />
              Recent Orders
            </span>
            <Link to="/control/orders" className="text-xs font-mono text-amber-500 hover:underline">
              View All →
            </Link>
          </div>

          <div className="mt-3 flex-1 overflow-x-auto">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-xs font-mono text-slate-500">
                No orders registered yet.
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[10px] text-slate-500 uppercase">
                    <th className="py-2 px-2">Order</th>
                    <th className="py-2 px-2">Package</th>
                    <th className="py-2 px-2">Destination</th>
                    <th className="py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {orders.slice(0, 5).map((o) => (
                    <tr key={o.id}>
                      <td className="py-2 px-2 font-bold text-amber-400">
                        <code>{o.order_code}</code>
                      </td>
                      <td className="py-2 px-2 text-slate-300 truncate max-w-[120px]">
                        {o.package_name}
                      </td>
                      <td className="py-2 px-2 text-slate-400 truncate max-w-[140px]">
                        {o.destination_label}
                      </td>
                      <td className="py-2 px-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950/60 text-amber-400 border border-amber-800/60">
                          {o.status}
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
