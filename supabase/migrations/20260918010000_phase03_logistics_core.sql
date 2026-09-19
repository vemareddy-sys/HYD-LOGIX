-- ============================================================================
-- HYD-LOGIX Phase 03: Real Logistics Core & Mission Planning Schema
-- Database Migration: 20260918010000_phase03_logistics_core.sql
-- ============================================================================

-- 1. WAREHOUSES TABLE
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address_label TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude >= -180.0 AND longitude <= 180.0),
    nearest_graph_node_id TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_warehouses_nearest_node ON public.warehouses(nearest_graph_node_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_created_by ON public.warehouses(created_by);

-- 2. VEHICLES TABLE
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('VAN', 'BIKE', 'SMALL_VEHICLE')),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'ON_DELIVERY', 'MAINTENANCE')),
    capacity_kg DOUBLE PRECISION CHECK (capacity_kg IS NULL OR capacity_kg >= 0),
    assigned_driver_id UUID, -- Foreign key added after drivers table definition
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON public.vehicles(type);

-- 3. DRIVERS TABLE
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'ON_DELIVERY', 'OFFLINE')),
    assigned_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_drivers_profile_id ON public.drivers(profile_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_assigned_vehicle ON public.drivers(assigned_vehicle_id);

-- Add mutual foreign key on vehicles now that drivers table exists
ALTER TABLE public.vehicles
    DROP CONSTRAINT IF EXISTS fk_vehicles_assigned_driver,
    ADD CONSTRAINT fk_vehicles_assigned_driver 
        FOREIGN KEY (assigned_driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_driver ON public.vehicles(assigned_driver_id);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code TEXT NOT NULL UNIQUE,
    package_name TEXT NOT NULL,
    package_description TEXT,
    weight_kg DOUBLE PRECISION CHECK (weight_kg IS NULL OR weight_kg >= 0),
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    destination_label TEXT NOT NULL,
    destination_latitude DOUBLE PRECISION NOT NULL CHECK (destination_latitude >= -90.0 AND destination_latitude <= 90.0),
    destination_longitude DOUBLE PRECISION NOT NULL CHECK (destination_longitude >= -180.0 AND destination_longitude <= 180.0),
    destination_graph_node_id TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('URGENT', 'HIGH', 'NORMAL', 'LOW')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING', 'DELIVERED', 'CANCELLED', 'FAILED')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_orders_warehouse_id ON public.orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON public.orders(priority);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_destination_node ON public.orders(destination_graph_node_id);

-- 5. MISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_code TEXT NOT NULL UNIQUE,
    order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    source_graph_node_id TEXT NOT NULL,
    destination_graph_node_id TEXT NOT NULL,
    routing_algorithm TEXT NOT NULL DEFAULT 'ASTAR' CHECK (routing_algorithm IN ('ASTAR', 'BFS', 'UCS', 'GREEDY')),
    route_node_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    route_edge_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    route_geometry JSONB NOT NULL DEFAULT '[]'::jsonb,
    route_distance_meters DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (route_distance_meters >= 0),
    route_effective_cost DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (route_effective_cost >= 0),
    route_hop_count INTEGER NOT NULL DEFAULT 0 CHECK (route_hop_count >= 0),
    status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING', 'DELIVERED', 'CANCELLED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_missions_order_id ON public.missions(order_id);
CREATE INDEX IF NOT EXISTS idx_missions_warehouse_id ON public.missions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_missions_driver_id ON public.missions(driver_id);
CREATE INDEX IF NOT EXISTS idx_missions_vehicle_id ON public.missions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON public.missions(status);

-- 6. AUDIT & LOGISTICS LIFECYCLE EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_events_event_type ON public.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_mission_id ON public.events(mission_id);
CREATE INDEX IF NOT EXISTS idx_events_order_id ON public.events(order_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);

-- 7. AUTO DRIVER RECORD CREATION TRIGGER
-- When a profile with DRIVER role is registered, automatically ensure a drivers row exists
CREATE OR REPLACE FUNCTION public.handle_driver_profile_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role = 'DRIVER'::public.user_role THEN
        INSERT INTO public.drivers (profile_id, display_name, status)
        VALUES (NEW.id, NEW.full_name, 'AVAILABLE')
        ON CONFLICT (profile_id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            updated_at = timezone('utc'::text, now());
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_driver_profile ON public.profiles;
CREATE TRIGGER trg_sync_driver_profile
    AFTER INSERT OR UPDATE OF full_name, role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_driver_profile_sync();

-- Backfill existing DRIVER profiles into drivers table if any exist
INSERT INTO public.drivers (profile_id, display_name, status)
SELECT id, full_name, 'AVAILABLE'
FROM public.profiles
WHERE role = 'DRIVER'::public.user_role
ON CONFLICT (profile_id) DO NOTHING;

-- 8. TRANSACTIONAL MISSION CREATION RPC
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
    -- 1. Verify Caller is CONTROL_CENTER
    v_caller_role := public.get_current_user_role();
    IF v_caller_role IS DISTINCT FROM 'CONTROL_CENTER'::public.user_role THEN
        RAISE EXCEPTION 'HYD-LOGIX Security Violation: Only Control Center operators can dispatch delivery missions.';
    END IF;

    -- 2. Validate Route Payload & Metrics Integrity
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

    -- 3. Validate and Lock Order (must be PENDING)
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

    -- 4. Validate Warehouse Association and Graph Node Consistency
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

    -- 5. Validate and Lock Driver (must be AVAILABLE)
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

    -- 6. Validate and Lock Vehicle (must be AVAILABLE)
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

    -- 7. Generate Unique Mission Code
    v_mission_code := 'MSN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

    -- 8. Insert Mission Record
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

    -- 9. Update Related Entities Atomically
    UPDATE public.orders
    SET status = 'ASSIGNED', updated_at = timezone('utc'::text, now())
    WHERE id = p_order_id;

    UPDATE public.drivers
    SET status = 'ASSIGNED', assigned_vehicle_id = p_vehicle_id, updated_at = timezone('utc'::text, now())
    WHERE id = p_driver_id;

    UPDATE public.vehicles
    SET status = 'ASSIGNED', assigned_driver_id = p_driver_id, updated_at = timezone('utc'::text, now())
    WHERE id = p_vehicle_id;

    -- 10. Record Lifecycle Audit Events
    INSERT INTO public.events (event_type, actor_profile_id, mission_id, order_id, payload)
    VALUES (
        'MISSION_CREATED',
        auth.uid(),
        v_mission_id,
        p_order_id,
        jsonb_build_object(
            'mission_code', v_mission_code,
            'driver_id', p_driver_id,
            'vehicle_id', p_vehicle_id,
            'distance_meters', p_distance_meters,
            'effective_cost', p_effective_cost,
            'hop_count', p_hop_count
        )
    );

    INSERT INTO public.events (event_type, actor_profile_id, mission_id, order_id, payload)
    VALUES (
        'MISSION_ASSIGNED',
        auth.uid(),
        v_mission_id,
        p_order_id,
        jsonb_build_object(
            'mission_code', v_mission_code,
            'driver_name', v_driver.display_name,
            'vehicle_code', v_vehicle.vehicle_code
        )
    );

    -- 11. Return JSON of the newly created mission
    SELECT to_jsonb(m) INTO v_created_mission
    FROM public.missions m
    WHERE m.id = v_mission_id;

    RETURN v_created_mission;
END;
$$;

-- 9. PERMISSIONS / API GRANTS
GRANT ALL ON TABLE public.warehouses TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.warehouses TO authenticated;

GRANT ALL ON TABLE public.vehicles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicles TO authenticated;

GRANT ALL ON TABLE public.drivers TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.drivers TO authenticated;

GRANT ALL ON TABLE public.orders TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO authenticated;

GRANT ALL ON TABLE public.missions TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.missions TO authenticated;

GRANT ALL ON TABLE public.events TO postgres, service_role;
GRANT SELECT, INSERT ON TABLE public.events TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_delivery_mission TO authenticated;

-- 10. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- WAREHOUSES POLICIES
DROP POLICY IF EXISTS "Authenticated can view warehouses" ON public.warehouses;
CREATE POLICY "Authenticated can view warehouses"
    ON public.warehouses FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Control Center can manage warehouses" ON public.warehouses;
CREATE POLICY "Control Center can manage warehouses"
    ON public.warehouses FOR ALL
    TO authenticated
    USING (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role)
    WITH CHECK (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role);

-- VEHICLES POLICIES
DROP POLICY IF EXISTS "Control Center or Assigned Driver can view vehicles" ON public.vehicles;
CREATE POLICY "Control Center or Assigned Driver can view vehicles"
    ON public.vehicles FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role
        OR id IN (
            SELECT assigned_vehicle_id FROM public.drivers WHERE profile_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Control Center can manage vehicles" ON public.vehicles;
CREATE POLICY "Control Center can manage vehicles"
    ON public.vehicles FOR ALL
    TO authenticated
    USING (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role)
    WITH CHECK (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role);

-- DRIVERS POLICIES
-- DRIVER can only SELECT their own record. No direct UPDATE capability.
-- CONTROL_CENTER has full management rights.
DROP POLICY IF EXISTS "Control Center or Self Driver can view driver records" ON public.drivers;
CREATE POLICY "Control Center or Self Driver can view driver records"
    ON public.drivers FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role
        OR profile_id = (select auth.uid())
    );

DROP POLICY IF EXISTS "Control Center or Self can manage driver status" ON public.drivers;
DROP POLICY IF EXISTS "Control Center can manage driver records" ON public.drivers;
CREATE POLICY "Control Center can manage driver records"
    ON public.drivers FOR ALL
    TO authenticated
    USING (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role)
    WITH CHECK (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role);

-- ORDERS POLICIES
DROP POLICY IF EXISTS "Control Center or Mission Driver can view orders" ON public.orders;
CREATE POLICY "Control Center or Mission Driver can view orders"
    ON public.orders FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role
        OR id IN (
            SELECT m.order_id 
            FROM public.missions m
            JOIN public.drivers d ON d.id = m.driver_id
            WHERE d.profile_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Control Center can manage orders" ON public.orders;
CREATE POLICY "Control Center can manage orders"
    ON public.orders FOR ALL
    TO authenticated
    USING (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role)
    WITH CHECK (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role);

-- MISSIONS POLICIES
DROP POLICY IF EXISTS "Control Center or Assigned Driver can view missions" ON public.missions;
CREATE POLICY "Control Center or Assigned Driver can view missions"
    ON public.missions FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role
        OR driver_id IN (
            SELECT id FROM public.drivers WHERE profile_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Control Center can manage missions" ON public.missions;
CREATE POLICY "Control Center can manage missions"
    ON public.missions FOR ALL
    TO authenticated
    USING (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role)
    WITH CHECK (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role);

-- EVENTS POLICIES
-- Control Center can inspect all audit events; drivers can only view events where they are the actor.
-- Only Control Center can directly INSERT events. Driver events will be emitted via dedicated SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "Control Center can view all events" ON public.events;
CREATE POLICY "Control Center can view all events"
    ON public.events FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role
        OR actor_profile_id = (select auth.uid())
    );

DROP POLICY IF EXISTS "Control Center can insert events" ON public.events;
DROP POLICY IF EXISTS "Authenticated can insert events" ON public.events;
CREATE POLICY "Control Center can insert events"
    ON public.events FOR INSERT
    TO authenticated
    WITH CHECK (public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role);

-- 11. ENABLE SUPABASE REALTIME
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.missions;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
