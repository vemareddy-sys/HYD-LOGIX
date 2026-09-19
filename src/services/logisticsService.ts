import { supabase } from '../config/supabase';
import type {
  Warehouse,
  Vehicle,
  Driver,
  Order,
  Mission,
  MissionRuntime,
  VehicleType,
  OrderPriority,
  DriverStatus,
} from '../types/logistics';

export const logisticsService = {
  // ==========================================
  // WAREHOUSES
  // ==========================================
  async getWarehouses(): Promise<Warehouse[]> {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching warehouses:', error);
      throw error;
    }
    return (data || []) as Warehouse[];
  },

  async createWarehouse(params: {
    name: string;
    address_label: string;
    latitude: number;
    longitude: number;
    nearest_graph_node_id: string;
  }): Promise<Warehouse> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const { data, error } = await supabase
      .from('warehouses')
      .insert({
        name: params.name,
        address_label: params.address_label,
        latitude: params.latitude,
        longitude: params.longitude,
        nearest_graph_node_id: params.nearest_graph_node_id,
        created_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating warehouse:', error);
      throw error;
    }
    return data as Warehouse;
  },

  // ==========================================
  // VEHICLES
  // ==========================================
  async getAllVehicles(): Promise<Vehicle[]> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, driver:drivers!assigned_driver_id(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all vehicles:', error);
      throw error;
    }
    return (data || []) as Vehicle[];
  },

  async getAvailableVehicles(): Promise<Vehicle[]> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, driver:drivers!assigned_driver_id(*)')
      .eq('status', 'AVAILABLE')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching available vehicles:', error);
      throw error;
    }
    return (data || []) as Vehicle[];
  },

  // Retain backward-compatible alias
  async getVehicles(): Promise<Vehicle[]> {
    return this.getAllVehicles();
  },

  async createVehicle(params: {
    vehicle_code: string;
    type: VehicleType;
    capacity_kg?: number;
  }): Promise<Vehicle> {
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        vehicle_code: params.vehicle_code.trim().toUpperCase(),
        type: params.type,
        status: 'AVAILABLE',
        capacity_kg: params.capacity_kg || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
    return data as Vehicle;
  },

  // ==========================================
  // DRIVERS
  // ==========================================
  async getAllDrivers(): Promise<Driver[]> {
    const { data, error } = await supabase
      .from('drivers')
      .select('*, vehicle:vehicles!assigned_vehicle_id(*), missions:missions(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all drivers:', error);
      throw error;
    }
    return (data || []) as Driver[];
  },

  async getAvailableDrivers(): Promise<Driver[]> {
    const { data, error } = await supabase
      .from('drivers')
      .select('*, vehicle:vehicles!assigned_vehicle_id(*), missions:missions(*)')
      .eq('status', 'AVAILABLE')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching available drivers:', error);
      throw error;
    }
    return (data || []) as Driver[];
  },

  // Retain backward-compatible alias
  async getDrivers(): Promise<Driver[]> {
    return this.getAllDrivers();
  },

  async getDriverProfile(profileId: string): Promise<Driver | null> {
    const { data, error } = await supabase
      .from('drivers')
      .select('*, vehicle:vehicles!assigned_vehicle_id(*)')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching driver profile:', error);
      throw error;
    }
    return (data || null) as Driver | null;
  },

  async updateDriverStatus(driverId: string, status: DriverStatus): Promise<Driver> {
    const { data, error } = await supabase
      .from('drivers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', driverId)
      .select()
      .single();

    if (error) {
      console.error('Error updating driver status:', error);
      throw error;
    }
    return data as Driver;
  },

  // ==========================================
  // ORDERS
  // ==========================================
  async getAllOrders(filters?: {
    status?: string;
    priority?: string;
    search?: string;
  }): Promise<Order[]> {
    let query = supabase
      .from('orders')
      .select('*, warehouse:warehouses(*)')
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }

    if (filters?.priority && filters.priority !== 'ALL') {
      query = query.eq('priority', filters.priority);
    }

    if (filters?.search && filters.search.trim()) {
      const s = filters.search.trim();
      query = query.or(`order_code.ilike.%${s}%,package_name.ilike.%${s}%,destination_label.ilike.%${s}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
    return (data || []) as Order[];
  },

  // Retain backward-compatible alias
  async getOrders(filters?: {
    status?: string;
    priority?: string;
    search?: string;
  }): Promise<Order[]> {
    return this.getAllOrders(filters);
  },

  async getPendingOrders(): Promise<Order[]> {
    return this.getAllOrders({ status: 'PENDING' });
  },

  async createOrder(params: {
    package_name: string;
    package_description?: string;
    weight_kg?: number;
    warehouse_id: string;
    destination_label: string;
    destination_latitude: number;
    destination_longitude: number;
    destination_graph_node_id: string;
    priority: OrderPriority;
  }): Promise<Order> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    // Generate readable order code e.g. ORD-7F3A9C
    const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
    const order_code = `ORD-${randomHex}`;

    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_code,
        package_name: params.package_name,
        package_description: params.package_description || null,
        weight_kg: params.weight_kg || null,
        warehouse_id: params.warehouse_id,
        destination_label: params.destination_label,
        destination_latitude: params.destination_latitude,
        destination_longitude: params.destination_longitude,
        destination_graph_node_id: params.destination_graph_node_id,
        priority: params.priority,
        status: 'PENDING',
        created_by: userId || null,
      })
      .select('*, warehouse:warehouses(*)')
      .single();

    if (error) {
      console.error('Error creating order:', error);
      throw error;
    }

    // Insert audit event
    await supabase.from('events').insert({
      event_type: 'ORDER_CREATED',
      actor_profile_id: userId || null,
      order_id: data.id,
      payload: {
        order_code: data.order_code,
        package_name: data.package_name,
        priority: data.priority,
      },
    });

    return data as Order;
  },

  // ==========================================
  // MISSIONS (MULTI-ORDER RUNS & LOGISTICS DISPATCH)
  // ==========================================
  async getAllMissions(): Promise<Mission[]> {
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('*, order:orders(*), warehouse:warehouses(*), driver:drivers(*), vehicle:vehicles(*), mission_orders:mission_orders(*, order:orders(*)), route_legs:mission_route_legs(*)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as Mission[];
      }
    } catch {
      // Fallback to basic relation if mission_orders / route_legs are not in schema cache
    }

    const { data, error } = await supabase
      .from('missions')
      .select('*, order:orders(*), warehouse:warehouses(*), driver:drivers(*), vehicle:vehicles(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all missions:', error);
      throw error;
    }
    return (data || []) as Mission[];
  },

  async getActiveMissions(): Promise<Mission[]> {
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('*, order:orders(*), warehouse:warehouses(*), driver:drivers(*), vehicle:vehicles(*), mission_orders:mission_orders(*, order:orders(*)), route_legs:mission_route_legs(*)')
        .in('status', ['ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as Mission[];
      }
    } catch {
      // Fallback
    }

    const { data, error } = await supabase
      .from('missions')
      .select('*, order:orders(*), warehouse:warehouses(*), driver:drivers(*), vehicle:vehicles(*)')
      .in('status', ['ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active missions:', error);
      throw error;
    }
    return (data || []) as Mission[];
  },

  // Retain backward-compatible alias
  async getMissions(): Promise<Mission[]> {
    return this.getAllMissions();
  },

  async getMissionDetails(missionId: string): Promise<Mission | null> {
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('*, order:orders(*), warehouse:warehouses(*), driver:drivers(*), vehicle:vehicles(*), mission_orders:mission_orders(*, order:orders(*)), route_legs:mission_route_legs(*)')
        .eq('id', missionId)
        .maybeSingle();

      if (!error && data) {
        return data as Mission;
      }
    } catch {
      // Fallback
    }

    const { data, error } = await supabase
      .from('missions')
      .select('*, order:orders(*), warehouse:warehouses(*), driver:drivers(*), vehicle:vehicles(*)')
      .eq('id', missionId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching mission details:', error);
      throw error;
    }
    return (data || null) as Mission | null;
  },

  async getDriverMissions(profileId: string): Promise<Mission[]> {
    // 1. Find the driver row for this profile
    const { data: driverRow, error: dErr } = await supabase
      .from('drivers')
      .select('id')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (dErr || !driverRow) {
      return [];
    }

    // 2. Query missions strictly scoped to this driver
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('*, order:orders(*), warehouse:warehouses(*), driver:drivers(*), vehicle:vehicles(*), mission_orders:mission_orders(*, order:orders(*)), route_legs:mission_route_legs(*)')
        .eq('driver_id', driverRow.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as Mission[];
      }
    } catch {
      // Fallback
    }

    const { data, error } = await supabase
      .from('missions')
      .select('*, order:orders(*), warehouse:warehouses(*), driver:drivers(*), vehicle:vehicles(*)')
      .eq('driver_id', driverRow.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching driver missions:', error);
      throw error;
    }
    return (data || []) as Mission[];
  },

  async getDriverActiveMission(profileId: string): Promise<Mission | null> {
    const missions = await this.getDriverMissions(profileId);
    const active = missions.find(
      (m) => m.status === 'ASSIGNED' || m.status === 'READY' || m.status === 'IN_TRANSIT' || m.status === 'REROUTING'
    );
    return active || null;
  },

  /**
   * Transactional Multi-Order Delivery Run Dispatch.
   * Calls PostgreSQL RPC create_delivery_run.
   */
  async createDeliveryRun(params: {
    warehouse_id: string;
    driver_id: string;
    vehicle_id: string;
    order_ids: string[];
    legs: Array<{
      leg_sequence: number;
      from_graph_node_id: string;
      to_graph_node_id: string;
      from_label: string;
      to_label: string;
      order_id?: string | null;
      route_node_ids: string[];
      route_edge_ids: string[];
      route_geometry: [number, number][];
      distance_meters: number;
      effective_cost: number;
      hop_count: number;
    }>;
    total_distance_meters: number;
    total_effective_cost: number;
  }): Promise<Mission> {
    // Pre-flight check: Verify driver has no active mission
    const { data: driverActiveMissions } = await supabase
      .from('missions')
      .select('id, mission_code')
      .eq('driver_id', params.driver_id)
      .in('status', ['PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING']);

    if (driverActiveMissions && driverActiveMissions.length > 0) {
      throw new Error('Driver already has an active delivery mission.');
    }

    // Pre-flight check: Verify vehicle has no active mission
    const { data: vehicleActiveMissions } = await supabase
      .from('missions')
      .select('id, mission_code')
      .eq('vehicle_id', params.vehicle_id)
      .in('status', ['PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING']);

    if (vehicleActiveMissions && vehicleActiveMissions.length > 0) {
      throw new Error('Vehicle already deployed on an active delivery mission.');
    }

    const { data, error } = await supabase.rpc('create_delivery_run', {
      p_warehouse_id: params.warehouse_id,
      p_driver_id: params.driver_id,
      p_vehicle_id: params.vehicle_id,
      p_order_ids: params.order_ids,
      p_legs: params.legs,
      p_total_distance: params.total_distance_meters,
      p_total_cost: params.total_effective_cost,
    });

    if (error) {
      console.error('Transactional delivery run creation failed via RPC:', error);
      throw error;
    }

    return data as Mission;
  },

  /**
   * Completes a single stop in a multi-stop mission run.
   * If further stops remain, advances the stop sequence.
   * If all stops are complete, marks the mission COMPLETED and frees the driver & vehicle.
   */
  async completeMissionStop(
    missionId: string,
    orderId: string
  ): Promise<{
    complete: boolean;
    mission_code: string;
    completed_stop_sequence: number;
    next_stop_sequence?: number;
    remaining_stops?: number;
    message?: string;
  }> {
    const { data, error } = await supabase.rpc('complete_mission_stop', {
      p_mission_id: missionId,
      p_order_id: orderId,
    });

    if (error) {
      console.error('complete_mission_stop RPC failed:', error);
      throw error;
    }

    return data as {
      complete: boolean;
      mission_code: string;
      completed_stop_sequence: number;
      next_stop_sequence?: number;
      remaining_stops?: number;
      message?: string;
    };
  },

  /**
   * Legacy transactional dispatch calling single-order create_delivery_mission.
   * Retained for backward compatibility.
   */
  async dispatchMission(params: {
    order_id: string;
    driver_id: string;
    vehicle_id: string;
    warehouse_id: string;
    source_graph_node_id: string;
    destination_graph_node_id: string;
    route_node_ids: string[];
    route_edge_ids: string[];
    route_geometry: [number, number][];
    route_distance_meters: number;
    route_effective_cost: number;
    route_hop_count: number;
  }): Promise<Mission> {
    return this.createDeliveryRun({
      warehouse_id: params.warehouse_id,
      driver_id: params.driver_id,
      vehicle_id: params.vehicle_id,
      order_ids: [params.order_id],
      legs: [
        {
          leg_sequence: 1,
          from_graph_node_id: params.source_graph_node_id,
          to_graph_node_id: params.destination_graph_node_id,
          from_label: 'Warehouse',
          to_label: 'Destination',
          order_id: params.order_id,
          route_node_ids: params.route_node_ids,
          route_edge_ids: params.route_edge_ids,
          route_geometry: params.route_geometry,
          distance_meters: params.route_distance_meters,
          effective_cost: params.route_effective_cost,
          hop_count: params.route_hop_count,
        },
      ],
      total_distance_meters: params.route_distance_meters,
      total_effective_cost: params.route_effective_cost,
    });
  },

  // ==========================================
  // PHASE 06: SIMULATION RUNTIME & LIFECYCLE
  // ==========================================

  async getMissionRuntime(missionId: string): Promise<MissionRuntime | null> {
    try {
      const { data, error } = await supabase
        .from('mission_runtime')
        .select('*')
        .eq('mission_id', missionId)
        .maybeSingle();

      if (error) {
        // Handle gracefully if table doesn't exist in cache yet
        console.warn('[HYD-LOGIX] mission_runtime query warning:', error.message);
        return null;
      }

      return (data || null) as MissionRuntime | null;
    } catch (err) {
      console.warn('[HYD-LOGIX] Error fetching mission_runtime:', err);
      return null;
    }
  },

  async startDeliveryMission(missionId: string): Promise<MissionRuntime> {
    const { data, error } = await supabase.rpc('start_delivery_mission', {
      p_mission_id: missionId,
    });

    if (error) {
      console.error('start_delivery_mission RPC failed:', error);
      throw error;
    }

    return data as MissionRuntime;
  },

  async updateMissionRuntimeProgress(params: {
    mission_id: string;
    latitude: number;
    longitude: number;
    current_edge_id: string | null;
    last_reached_node_id: string | null;
    next_node_id: string | null;
    traveled_meters: number;
    route_progress: number;
    simulation_status?: string;
  }): Promise<MissionRuntime | null> {
    try {
      const { data, error } = await supabase.rpc('update_mission_runtime_progress', {
        p_mission_id: params.mission_id,
        p_latitude: params.latitude,
        p_longitude: params.longitude,
        p_current_edge_id: params.current_edge_id,
        p_last_reached_node_id: params.last_reached_node_id,
        p_next_node_id: params.next_node_id,
        p_traveled_meters: params.traveled_meters,
        p_route_progress: params.route_progress,
        p_simulation_status: params.simulation_status || null,
      });

      if (error) {
        console.warn('update_mission_runtime_progress RPC notice:', error.message);
        return null;
      }

      return data as MissionRuntime;
    } catch (err) {
      console.warn('update_mission_runtime_progress exception:', err);
      return null;
    }
  },

  async pauseDeliverySimulation(missionId: string): Promise<MissionRuntime | null> {
    try {
      const { data, error } = await supabase.rpc('pause_delivery_simulation', {
        p_mission_id: missionId,
      });

      if (error) {
        console.warn('pause_delivery_simulation RPC notice:', error.message);
        return null;
      }

      return data as MissionRuntime;
    } catch (err) {
      console.warn('pause_delivery_simulation exception:', err);
      return null;
    }
  },

  async resumeDeliverySimulation(missionId: string): Promise<MissionRuntime | null> {
    try {
      const { data, error } = await supabase.rpc('resume_delivery_simulation', {
        p_mission_id: missionId,
      });

      if (error) {
        console.warn('resume_delivery_simulation RPC notice:', error.message);
        return null;
      }

      return data as MissionRuntime;
    } catch (err) {
      console.warn('resume_delivery_simulation exception:', err);
      return null;
    }
  },

  async completeDeliveryMission(missionId: string): Promise<{
    success: boolean;
    mission_code: string;
    status: string;
  }> {
    const { data, error } = await supabase.rpc('complete_delivery_mission', {
      p_mission_id: missionId,
    });

    if (error) {
      console.error('complete_delivery_mission RPC failed:', error);
      throw error;
    }

    return data as { success: boolean; mission_code: string; status: string };
  },

  /**
   * For Control Center Live Operations: Queries the single authoritative
   * active mission along with its live mission_runtime coordinates.
   */
  async getActiveLiveMission(): Promise<{
    mission: Mission;
    runtime: MissionRuntime | null;
  } | null> {
    try {
      // Find mission in IN_TRANSIT or ASSIGNED
      const { data: missions, error } = await supabase
        .from('missions')
        .select('*, order:orders(*), warehouse:warehouses(*), driver:drivers(*), vehicle:vehicles(*)')
        .in('status', ['IN_TRANSIT', 'ASSIGNED', 'READY'])
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error || !missions || missions.length === 0) {
        return null;
      }

      const activeMission = missions[0] as Mission;
      const runtime = await this.getMissionRuntime(activeMission.id);

      return {
        mission: activeMission,
        runtime,
      };
    } catch (err) {
      console.warn('getActiveLiveMission exception:', err);
      return null;
    }
  },
};
