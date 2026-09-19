-- =============================================================================
-- HYD-LOGIX PHASE 06 CORRECTION: DATABASE CONSTRAINTS & MISSION RPC HARDENING
-- File: 20260919030000_phase06_data_consistency.sql
--
-- 1. Partial Unique Indexes preventing multiple active missions per driver or vehicle.
-- 2. Hardened create_delivery_mission RPC with explicit active-mission pre-checks.
-- =============================================================================

-- 1. PARTIAL UNIQUE INDEXES: ACTIVE MISSION CONSTRAINTS
-- Active statuses: 'PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING'
-- Completed, Cancelled, and Failed missions are excluded, allowing resources
-- to be reassigned across successive dispatches.

CREATE UNIQUE INDEX IF NOT EXISTS idx_missions_unique_active_driver
ON public.missions (driver_id)
WHERE status IN ('PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING');

CREATE UNIQUE INDEX IF NOT EXISTS idx_missions_unique_active_vehicle
ON public.missions (vehicle_id)
WHERE status IN ('PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING');

-- 2. HARDEN TRANSACTIONAL MISSION CREATION RPC
CREATE OR REPLACE FUNCTION public.create_delivery_mission(
    p_order_id UUID,
    p_driver_id UUID,
    p_vehicle_id UUID,
    p_warehouse_id UUID,
    p_source_node_id TEXT,
    p_destination_node_id TEXT,
    p_route_node_ids JSONB,
    p_route_edge_ids JSONB,
    p_route_geometry JSONB,
    p_distance_meters DOUBLE PRECISION,
    p_effective_cost DOUBLE PRECISION,
    p_hop_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role public.user_role;
    v_order RECORD;
    v_warehouse RECORD;
    v_driver RECORD;
    v_vehicle RECORD;
    v_mission_id UUID;
    v_mission_code TEXT;
    v_created_mission JSONB;
BEGIN
    -- A. Verify Caller is CONTROL_CENTER
    v_caller_role := public.get_current_user_role();
    IF v_caller_role IS DISTINCT FROM 'CONTROL_CENTER'::public.user_role THEN
        RAISE EXCEPTION 'HYD-LOGIX Security Violation: Only Control Center operators can dispatch delivery missions.';
    END IF;

    -- B. Validate Route Payload & Metrics Integrity
    IF p_route_node_ids IS NULL 
       OR jsonb_typeof(p_route_node_ids) <> 'array' 
       OR jsonb_array_length(p_route_node_ids) = 0 THEN
        RAISE EXCEPTION 'Invalid route: p_route_node_ids must be a non-empty JSON array.';
    END IF;

    IF p_route_edge_ids IS NULL 
       OR jsonb_typeof(p_route_edge_ids) <> 'array' 
       OR jsonb_array_length(p_route_edge_ids) = 0 THEN
        RAISE EXCEPTION 'Invalid route: p_route_edge_ids must be a non-empty JSON array.';
    END IF;

    IF p_route_geometry IS NULL 
       OR jsonb_typeof(p_route_geometry) <> 'array' 
       OR jsonb_array_length(p_route_geometry) = 0 THEN
        RAISE EXCEPTION 'Invalid route: p_route_geometry must be a non-empty JSON array.';
    END IF;

    IF p_distance_meters IS NULL OR p_distance_meters <= 0 THEN
        RAISE EXCEPTION 'Invalid route metric: distance_meters must be greater than 0 (received %).', p_distance_meters;
    END IF;

    IF p_effective_cost IS NULL OR p_effective_cost <= 0 THEN
        RAISE EXCEPTION 'Invalid route metric: effective_cost must be greater than 0 (received %).', p_effective_cost;
    END IF;

    IF p_hop_count IS NULL OR p_hop_count <= 0 THEN
        RAISE EXCEPTION 'Invalid route metric: hop_count must be greater than 0 (received %).', p_hop_count;
    END IF;

    IF jsonb_array_length(p_route_edge_ids) <> p_hop_count THEN
        RAISE EXCEPTION 'Route consistency violation: route edge count (%) must equal hop count (%).',
            jsonb_array_length(p_route_edge_ids), p_hop_count;
    END IF;

    -- C. Validate and Lock Order (must be PENDING)
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order with ID % not found.', p_order_id;
    END IF;

    IF v_order.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Order % is currently in state "%" and cannot be assigned (must be PENDING).', v_order.order_code, v_order.status;
    END IF;

    -- D. Validate Warehouse Association and Graph Node Consistency
    IF p_warehouse_id IS DISTINCT FROM v_order.warehouse_id THEN
        RAISE EXCEPTION 'Warehouse mismatch: Order % is assigned to warehouse %, but mission requested warehouse %.',
            v_order.order_code, v_order.warehouse_id, p_warehouse_id;
    END IF;

    SELECT * INTO v_warehouse
    FROM public.warehouses
    WHERE id = p_warehouse_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warehouse with ID % not found.', p_warehouse_id;
    END IF;

    IF p_source_node_id IS DISTINCT FROM v_warehouse.nearest_graph_node_id THEN
        RAISE EXCEPTION 'Source node mismatch: Warehouse "%" nearest node is %, but mission requested %.',
            v_warehouse.name, v_warehouse.nearest_graph_node_id, p_source_node_id;
    END IF;

    IF p_destination_node_id IS DISTINCT FROM v_order.destination_graph_node_id THEN
        RAISE EXCEPTION 'Destination node mismatch: Order % destination node is %, but mission requested %.',
            v_order.order_code, v_order.destination_graph_node_id, p_destination_node_id;
    END IF;

    -- E. Validate and Lock Driver (must be AVAILABLE & have NO active missions)
    SELECT * INTO v_driver
    FROM public.drivers
    WHERE id = p_driver_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Driver with ID % not found.', p_driver_id;
    END IF;

    IF v_driver.status <> 'AVAILABLE' THEN
        RAISE EXCEPTION 'Driver "%" is currently in state "%" and cannot accept new missions (must be AVAILABLE).', v_driver.display_name, v_driver.status;
    END IF;

    -- Explicit active mission guard for driver
    IF EXISTS (
        SELECT 1 FROM public.missions
        WHERE driver_id = p_driver_id
          AND status IN ('PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING')
    ) THEN
        RAISE EXCEPTION 'Driver already has an active mission.';
    END IF;

    -- F. Validate and Lock Vehicle (must be AVAILABLE & have NO active missions)
    SELECT * INTO v_vehicle
    FROM public.vehicles
    WHERE id = p_vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle with ID % not found.', p_vehicle_id;
    END IF;

    IF v_vehicle.status <> 'AVAILABLE' THEN
        RAISE EXCEPTION 'Vehicle "%" is currently in state "%" and cannot be deployed (must be AVAILABLE).', v_vehicle.vehicle_code, v_vehicle.status;
    END IF;

    -- Explicit active mission guard for vehicle
    IF EXISTS (
        SELECT 1 FROM public.missions
        WHERE vehicle_id = p_vehicle_id
          AND status IN ('PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING')
    ) THEN
        RAISE EXCEPTION 'Vehicle already has an active mission.';
    END IF;

    -- G. Generate Unique Mission Code
    v_mission_code := 'MSN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

    -- H. Insert Mission Record (Protected by Partial Unique Indexes)
    INSERT INTO public.missions (
        mission_code,
        order_id,
        warehouse_id,
        driver_id,
        vehicle_id,
        source_graph_node_id,
        destination_graph_node_id,
        routing_algorithm,
        route_node_ids,
        route_edge_ids,
        route_geometry,
        route_distance_meters,
        route_effective_cost,
        route_hop_count,
        status,
        created_at,
        updated_at
    )
    VALUES (
        v_mission_code,
        p_order_id,
        p_warehouse_id,
        p_driver_id,
        p_vehicle_id,
        p_source_node_id,
        p_destination_node_id,
        'ASTAR',
        p_route_node_ids,
        p_route_edge_ids,
        p_route_geometry,
        p_distance_meters,
        p_effective_cost,
        p_hop_count,
        'ASSIGNED',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_mission_id;

    -- I. Update Related Entities Atomically
    UPDATE public.orders
    SET status = 'ASSIGNED', updated_at = timezone('utc'::text, now())
    WHERE id = p_order_id;

    UPDATE public.drivers
    SET status = 'ASSIGNED', assigned_vehicle_id = p_vehicle_id, updated_at = timezone('utc'::text, now())
    WHERE id = p_driver_id;

    UPDATE public.vehicles
    SET status = 'ASSIGNED', assigned_driver_id = p_driver_id, updated_at = timezone('utc'::text, now())
    WHERE id = p_vehicle_id;

    -- J. Insert Audit Event
    INSERT INTO public.events (
        event_type,
        actor_profile_id,
        mission_id,
        order_id,
        payload
    )
    VALUES (
        'MISSION_DISPATCHED',
        auth.uid(),
        v_mission_id,
        p_order_id,
        jsonb_build_object(
            'mission_code', v_mission_code,
            'driver_id', p_driver_id,
            'driver_name', v_driver.display_name,
            'vehicle_id', p_vehicle_id,
            'vehicle_code', v_vehicle.vehicle_code,
            'warehouse_id', p_warehouse_id,
            'distance_meters', p_distance_meters,
            'effective_cost', p_effective_cost,
            'hop_count', p_hop_count
        )
    );

    -- K. Return Complete Dispatched Mission Record
    SELECT to_jsonb(m.*) INTO v_created_mission
    FROM public.missions m
    WHERE m.id = v_mission_id;

    RETURN v_created_mission;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_delivery_mission TO authenticated;
