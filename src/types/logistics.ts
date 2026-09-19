export type VehicleType = 'VAN' | 'BIKE' | 'SMALL_VEHICLE';
export type VehicleStatus = 'AVAILABLE' | 'ASSIGNED' | 'ON_DELIVERY' | 'MAINTENANCE';

export type DriverStatus = 'AVAILABLE' | 'ASSIGNED' | 'ON_DELIVERY' | 'OFFLINE';

export type OrderPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
export type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'READY'
  | 'IN_TRANSIT'
  | 'REROUTING'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export type MissionStatus =
  | 'PLANNED'
  | 'ASSIGNED'
  | 'READY'
  | 'IN_TRANSIT'
  | 'REROUTING'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type MissionOrderStatus =
  | 'PENDING'
  | 'NEXT'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'FAILED'
  | 'SKIPPED';

export type RouteLegStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'REROUTED';

export interface MissionOrder {
  id: string;
  mission_id: string;
  order_id: string;
  stop_sequence: number;
  status: MissionOrderStatus;
  planned_arrival_sequence?: number | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joined order
  order?: Order | null;
}

export interface MissionRouteLeg {
  id: string;
  mission_id: string;
  leg_sequence: number;
  from_graph_node_id: string;
  to_graph_node_id: string;
  from_label: string;
  to_label: string;
  order_id?: string | null;
  mission_order_id?: string | null;
  route_node_ids: string[];
  route_edge_ids: string[];
  route_geometry: [number, number][];
  distance_meters: number;
  effective_cost: number;
  hop_count: number;
  status: RouteLegStatus;
  created_at: string;
  updated_at: string;
  // Optional joined order
  order?: Order | null;
}

export interface Warehouse {
  id: string;
  name: string;
  address_label: string;
  latitude: number;
  longitude: number;
  nearest_graph_node_id: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  vehicle_code: string;
  type: VehicleType;
  status: VehicleStatus;
  capacity_kg: number | null;
  assigned_driver_id: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined driver
  driver?: Driver | null;
}

export interface Driver {
  id: string;
  profile_id: string;
  display_name: string;
  status: DriverStatus;
  assigned_vehicle_id: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined vehicle & missions
  vehicle?: Vehicle | null;
  missions?: Mission[] | null;
}

export interface Order {
  id: string;
  order_code: string;
  package_name: string;
  package_description: string | null;
  weight_kg: number | null;
  warehouse_id: string;
  destination_label: string;
  destination_latitude: number;
  destination_longitude: number;
  destination_graph_node_id: string;
  priority: OrderPriority;
  status: OrderStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined warehouse
  warehouse?: Warehouse | null;
}

export interface Mission {
  id: string;
  mission_code: string;
  order_id?: string | null;
  warehouse_id: string;
  driver_id: string;
  vehicle_id: string;
  source_graph_node_id: string;
  destination_graph_node_id: string;
  routing_algorithm: 'ASTAR';
  route_node_ids: string[];
  route_edge_ids: string[];
  route_geometry: [number, number][];
  route_distance_meters: number;
  route_effective_cost: number;
  route_hop_count: number;
  total_route_distance_meters?: number;
  total_effective_cost?: number;
  current_stop_sequence?: number;
  total_stops?: number;
  status: MissionStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  // Joined entities
  order?: Order | null;
  warehouse?: Warehouse | null;
  driver?: Driver | null;
  vehicle?: Vehicle | null;
  mission_orders?: MissionOrder[];
  route_legs?: MissionRouteLeg[];
}

export interface LogisticsEvent {
  id: string;
  event_type: string;
  actor_profile_id: string | null;
  mission_id: string | null;
  order_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export type SimulationStatus = 'READY' | 'RUNNING' | 'PAUSED' | 'ARRIVED' | 'COMPLETED';

export interface MissionRuntime {
  mission_id: string;
  driver_id: string;
  vehicle_id: string;
  current_leg_sequence?: number;
  simulation_status: SimulationStatus;
  current_latitude: number;
  current_longitude: number;
  current_edge_id: string | null;
  last_reached_node_id: string | null;
  next_node_id: string | null;
  traveled_meters: number;
  route_progress: number;
  base_speed_kmh: number;
  playback_multiplier: number;
  started_at: string | null;
  updated_at: string;
  // Optional joined relations
  mission?: Mission | null;
  driver?: Driver | null;
  vehicle?: Vehicle | null;
}

