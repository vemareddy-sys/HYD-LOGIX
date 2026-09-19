-- =============================================================================
-- HYD-LOGIX PHASE 05/06 ARCHITECTURE CORRECTION: MULTI-ORDER DELIVERY RUNS
-- File: 20260919040000_phase06_multi_order_delivery_runs.sql
--
-- MODEL: 1 Delivery Run = 1 Driver + 1 Vehicle + 1 Warehouse + N Orders + N Stops + N A* Route Legs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ALTER MISSIONS TABLE (RELAX SINGLE-ORDER ASSUMPTION & ADD MULTI-STOP COLUMNS)
-- -----------------------------------------------------------------------------

-- Drop unique constraint on order_id so a mission does NOT have to represent 1 order
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_order_id_key;
ALTER TABLE public.missions ALTER COLUMN order_id DROP NOT NULL;

-- Add multi-stop tracking columns
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS current_stop_sequence INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS total_stops INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS total_route_distance_meters DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS total_effective_cost DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill total_route_distance_meters and total_effective_cost from legacy columns if empty
UPDATE public.missions
SET total_route_distance_meters = route_distance_meters,
    total_effective_cost = route_effective_cost
WHERE total_route_distance_meters = 0 AND route_distance_meters > 0;

-- Update status check constraint to support 'COMPLETED'
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_status_check;
ALTER TABLE public.missions ADD CONSTRAINT missions_status_check
    CHECK (status IN ('PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED'));

-- Enforce ONE ACTIVE MISSION PER DRIVER and ONE ACTIVE MISSION PER VEHICLE
DROP INDEX IF EXISTS public.idx_missions_unique_active_driver;
CREATE UNIQUE INDEX idx_missions_unique_active_driver
    ON public.missions (driver_id)
    WHERE status IN ('PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING');

DROP INDEX IF EXISTS public.idx_missions_unique_active_vehicle;
CREATE UNIQUE INDEX idx_missions_unique_active_vehicle
    ON public.missions (vehicle_id)
    WHERE status IN ('PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING');

-- -----------------------------------------------------------------------------
-- 2. CREATE PUBLIC.MISSION_ORDERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mission_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    stop_sequence INTEGER NOT NULL CHECK (stop_sequence >= 1),
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'NEXT', 'ARRIVED', 'DELIVERED', 'FAILED', 'SKIPPED')),
    planned_arrival_sequence INTEGER,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(mission_id, order_id),
    UNIQUE(mission_id, stop_sequence)
);

CREATE INDEX IF NOT EXISTS idx_mission_orders_mission_id ON public.mission_orders(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_orders_order_id ON public.mission_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_mission_orders_status ON public.mission_orders(status);

-- An ORDER must not belong to two active delivery runs simultaneously
DROP INDEX IF EXISTS public.idx_mission_orders_unique_active_order;
CREATE UNIQUE INDEX idx_mission_orders_unique_active_order
    ON public.mission_orders (order_id)
    WHERE status IN ('PENDING', 'NEXT', 'ARRIVED');

-- -----------------------------------------------------------------------------
-- 3. CREATE PUBLIC.MISSION_ROUTE_LEGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mission_route_legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
    leg_sequence INTEGER NOT NULL CHECK (leg_sequence >= 1),
    from_graph_node_id TEXT NOT NULL,
    to_graph_node_id TEXT NOT NULL,
    from_label TEXT NOT NULL,
    to_label TEXT NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    mission_order_id UUID REFERENCES public.mission_orders(id) ON DELETE SET NULL,
    route_node_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    route_edge_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    route_geometry JSONB NOT NULL DEFAULT '[]'::jsonb,
    distance_meters DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (distance_meters >= 0),
    effective_cost DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (effective_cost >= 0),
    hop_count INTEGER NOT NULL DEFAULT 0 CHECK (hop_count >= 0),
    status TEXT NOT NULL DEFAULT 'PLANNED'
        CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'REROUTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(mission_id, leg_sequence)
);

CREATE INDEX IF NOT EXISTS idx_mission_route_legs_mission_id ON public.mission_route_legs(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_route_legs_order_id ON public.mission_route_legs(order_id);
CREATE INDEX IF NOT EXISTS idx_mission_route_legs_status ON public.mission_route_legs(status);

-- -----------------------------------------------------------------------------
-- 4. CREATE PUBLIC.MISSION_RUNTIME TABLE (IF NOT ALREADY EXISTING)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mission_runtime (
    mission_id UUID PRIMARY KEY REFERENCES public.missions(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    current_leg_sequence INTEGER NOT NULL DEFAULT 1,
    simulation_status TEXT NOT NULL DEFAULT 'READY'
        CHECK (simulation_status IN ('READY', 'RUNNING', 'PAUSED', 'ARRIVED', 'COMPLETED')),
    current_latitude DOUBLE PRECISION NOT NULL
        CHECK (current_latitude >= -90.0 AND current_latitude <= 90.0),
    current_longitude DOUBLE PRECISION NOT NULL
        CHECK (current_longitude >= -180.0 AND current_longitude <= 180.0),
    current_edge_id TEXT,
    last_reached_node_id TEXT,
    next_node_id TEXT,
    traveled_meters DOUBLE PRECISION NOT NULL DEFAULT 0.0
        CHECK (traveled_meters >= 0.0),
    route_progress DOUBLE PRECISION NOT NULL DEFAULT 0.0
        CHECK (route_progress >= 0.0 AND route_progress <= 1.0),
    base_speed_kmh DOUBLE PRECISION NOT NULL DEFAULT 30.0
        CHECK (base_speed_kmh > 0.0),
    playback_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.0
        CHECK (playback_multiplier > 0.0),
    started_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_mission_runtime_driver ON public.mission_runtime(driver_id);
CREATE INDEX IF NOT EXISTS idx_mission_runtime_vehicle ON public.mission_runtime(vehicle_id);

-- -----------------------------------------------------------------------------
-- 5. SAFELY MIGRATE CANONICAL MISSION DATA (MSN-D31F03DA & HISTORICAL MISSIONS)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    m RECORD;
    v_wh RECORD;
    v_ord RECORD;
    v_mo_id UUID;
    v_mo_status TEXT;
    v_leg_status TEXT;
BEGIN
    FOR m IN SELECT * FROM public.missions WHERE order_id IS NOT NULL LOOP
        -- Check if already migrated to mission_orders
        IF NOT EXISTS (SELECT 1 FROM public.mission_orders WHERE mission_id = m.id AND order_id = m.order_id) THEN
            v_mo_status := CASE 
                WHEN m.status IN ('DELIVERED', 'COMPLETED') THEN 'DELIVERED'
                WHEN m.status = 'IN_TRANSIT' THEN 'NEXT'
                ELSE 'PENDING'
            END;

            INSERT INTO public.mission_orders (
                mission_id,
                order_id,
                stop_sequence,
                status,
                planned_arrival_sequence,
                delivered_at,
                created_at,
                updated_at
            ) VALUES (
                m.id,
                m.order_id,
                1,
                v_mo_status,
                1,
                CASE WHEN v_mo_status = 'DELIVERED' THEN m.completed_at ELSE NULL END,
                m.created_at,
                m.updated_at
            ) RETURNING id INTO v_mo_id;
        ELSE
            SELECT id INTO v_mo_id FROM public.mission_orders WHERE mission_id = m.id AND order_id = m.order_id;
        END IF;

        -- Check if already migrated to mission_route_legs
        IF NOT EXISTS (SELECT 1 FROM public.mission_route_legs WHERE mission_id = m.id AND leg_sequence = 1) THEN
            SELECT * INTO v_wh FROM public.warehouses WHERE id = m.warehouse_id;
            SELECT * INTO v_ord FROM public.orders WHERE id = m.order_id;

            v_leg_status := CASE
                WHEN m.status IN ('DELIVERED', 'COMPLETED') THEN 'COMPLETED'
                WHEN m.status = 'IN_TRANSIT' THEN 'ACTIVE'
                ELSE 'PLANNED'
            END;

            INSERT INTO public.mission_route_legs (
                mission_id,
                leg_sequence,
                from_graph_node_id,
                to_graph_node_id,
                from_label,
                to_label,
                order_id,
                mission_order_id,
                route_node_ids,
                route_edge_ids,
                route_geometry,
                distance_meters,
                effective_cost,
                hop_count,
                status,
                created_at,
                updated_at
            ) VALUES (
                m.id,
                1,
                m.source_graph_node_id,
                m.destination_graph_node_id,
                COALESCE(v_wh.name, 'Warehouse'),
                COALESCE(v_ord.destination_label, 'Destination Stop 1'),
                m.order_id,
                v_mo_id,
                m.route_node_ids,
                m.route_edge_ids,
                m.route_geometry,
                m.route_distance_meters,
                m.route_effective_cost,
                m.route_hop_count,
                v_leg_status,
                m.created_at,
                m.updated_at
            );
        END IF;

        -- Ensure mission fields are properly synchronized
        UPDATE public.missions
        SET total_stops = 1,
            current_stop_sequence = 1,
            total_route_distance_meters = route_distance_meters,
            total_effective_cost = route_effective_cost
        WHERE id = m.id;
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.mission_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_route_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_runtime ENABLE ROW LEVEL SECURITY;

-- Control Center full access
DROP POLICY IF EXISTS "Control Center operators manage mission orders" ON public.mission_orders;
CREATE POLICY "Control Center operators manage mission orders"
    ON public.mission_orders FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'CONTROL_CENTER'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'CONTROL_CENTER'));

DROP POLICY IF EXISTS "Control Center operators manage mission route legs" ON public.mission_route_legs;
CREATE POLICY "Control Center operators manage mission route legs"
    ON public.mission_route_legs FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'CONTROL_CENTER'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'CONTROL_CENTER'));

DROP POLICY IF EXISTS "Control Center operators manage mission runtime" ON public.mission_runtime;
CREATE POLICY "Control Center operators manage mission runtime"
    ON public.mission_runtime FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'CONTROL_CENTER'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'CONTROL_CENTER'));

-- Drivers isolated select (only view rows for missions assigned to them)
DROP POLICY IF EXISTS "Drivers can view their own mission orders" ON public.mission_orders;
CREATE POLICY "Drivers can view their own mission orders"
    ON public.mission_orders FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.missions m
        JOIN public.drivers d ON d.id = m.driver_id
        WHERE m.id = mission_orders.mission_id AND d.profile_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Drivers can view their own mission route legs" ON public.mission_route_legs;
CREATE POLICY "Drivers can view their own mission route legs"
    ON public.mission_route_legs FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.missions m
        JOIN public.drivers d ON d.id = m.driver_id
        WHERE m.id = mission_route_legs.mission_id AND d.profile_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Drivers can view their own mission runtime" ON public.mission_runtime;
CREATE POLICY "Drivers can view their own mission runtime"
    ON public.mission_runtime FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.drivers d
        WHERE d.id = mission_runtime.driver_id AND d.profile_id = auth.uid()
    ));

-- -----------------------------------------------------------------------------
-- 7. TRANSACTIONAL RPC: create_delivery_run
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_delivery_run(
    p_warehouse_id UUID,
    p_driver_id UUID,
    p_vehicle_id UUID,
    p_order_ids UUID[],
    p_legs JSONB,
    p_total_distance DOUBLE PRECISION,
    p_total_cost DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_role public.user_role;
    v_warehouse RECORD;
    v_driver RECORD;
    v_vehicle RECORD;
    v_order RECORD;
    v_total_weight NUMERIC := 0;
    v_total_stops INTEGER;
    v_mission_id UUID;
    v_mission_code TEXT;
    v_first_leg JSONB;
    v_created_mission JSONB;
    v_leg_elem JSONB;
    v_leg_idx INTEGER := 0;
    v_order_id UUID;
    v_stop_idx INTEGER := 0;
    v_mission_order_id UUID;
BEGIN
    -- A. Verify Caller is CONTROL_CENTER
    v_caller_role := public.get_current_user_role();
    IF v_caller_role IS DISTINCT FROM 'CONTROL_CENTER'::public.user_role THEN
        RAISE EXCEPTION 'HYD-LOGIX Security Violation: Only Control Center operators can dispatch delivery runs.';
    END IF;

    -- B. Basic array and leg validations
    IF p_order_ids IS NULL OR array_length(p_order_ids, 1) = 0 THEN
        RAISE EXCEPTION 'Validation error: Delivery run must contain at least one order.';
    END IF;

    v_total_stops := array_length(p_order_ids, 1);

    IF p_legs IS NULL OR jsonb_typeof(p_legs) <> 'array' OR jsonb_array_length(p_legs) <> v_total_stops THEN
        RAISE EXCEPTION 'Validation error: p_legs count (%) must match orders count (%).',
            jsonb_array_length(p_legs), v_total_stops;
    END IF;

    -- C. Validate & Lock Warehouse
    SELECT * INTO v_warehouse FROM public.warehouses WHERE id = p_warehouse_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Warehouse with ID % not found.', p_warehouse_id;
    END IF;

    -- D. Validate & Lock Driver (must be AVAILABLE & have NO active missions)
    SELECT * INTO v_driver FROM public.drivers WHERE id = p_driver_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Driver with ID % not found.', p_driver_id;
    END IF;

    IF v_driver.status <> 'AVAILABLE' THEN
        RAISE EXCEPTION 'Driver "%" is currently "%" and cannot accept new runs (must be AVAILABLE).',
            v_driver.display_name, v_driver.status;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.missions
        WHERE driver_id = p_driver_id
          AND status IN ('PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING')
    ) THEN
        RAISE EXCEPTION 'Driver "%" already operates an active delivery mission.', v_driver.display_name;
    END IF;

    -- E. Validate & Lock Vehicle (must be AVAILABLE & have NO active missions)
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle with ID % not found.', p_vehicle_id;
    END IF;

    IF v_vehicle.status <> 'AVAILABLE' THEN
        RAISE EXCEPTION 'Vehicle "%" is currently "%" and cannot be deployed (must be AVAILABLE).',
            v_vehicle.vehicle_code, v_vehicle.status;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.missions
        WHERE vehicle_id = p_vehicle_id
          AND status IN ('PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING')
    ) THEN
        RAISE EXCEPTION 'Vehicle "%" already operates an active delivery mission.', v_vehicle.vehicle_code;
    END IF;

    -- F. Validate & Lock every order, compute total weight
    FOREACH v_order_id IN ARRAY p_order_ids LOOP
        SELECT * INTO v_order FROM public.orders WHERE id = v_order_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Order with ID % not found.', v_order_id;
        END IF;

        IF v_order.status <> 'PENDING' THEN
            RAISE EXCEPTION 'Order % is in status "%" (must be PENDING).', v_order.order_code, v_order.status;
        END IF;

        IF v_order.warehouse_id <> p_warehouse_id THEN
            RAISE EXCEPTION 'Order % belongs to another warehouse (%).', v_order.order_code, v_order.warehouse_id;
        END IF;

        v_total_weight := v_total_weight + COALESCE(v_order.weight_kg, 0);
    END LOOP;

    -- G. Vehicle Capacity Check
    IF v_vehicle.capacity_kg IS NOT NULL AND v_total_weight > v_vehicle.capacity_kg THEN
        RAISE EXCEPTION 'Capacity Exceeded: Total package weight (% kg) exceeds vehicle % capacity (% kg).',
            v_total_weight, v_vehicle.vehicle_code, v_vehicle.capacity_kg;
    END IF;

    -- H. Generate unique mission code
    v_mission_code := 'MSN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    v_first_leg := p_legs->0;

    -- I. Insert Mission Run record
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
        total_route_distance_meters,
        total_effective_cost,
        current_stop_sequence,
        total_stops,
        status,
        created_at,
        updated_at
    )
    VALUES (
        v_mission_code,
        p_order_ids[1], -- Legacy reference points to first order
        p_warehouse_id,
        p_driver_id,
        p_vehicle_id,
        v_first_leg->>'from_graph_node_id',
        (p_legs->(v_total_stops - 1))->>'to_graph_node_id',
        'ASTAR',
        COALESCE(v_first_leg->'route_node_ids', '[]'::jsonb),
        COALESCE(v_first_leg->'route_edge_ids', '[]'::jsonb),
        COALESCE(v_first_leg->'route_geometry', '[]'::jsonb),
        p_total_distance,
        p_total_cost,
        COALESCE((v_first_leg->>'hop_count')::INTEGER, 0),
        p_total_distance,
        p_total_cost,
        1,
        v_total_stops,
        'ASSIGNED',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_mission_id;

    -- J. Insert mission_orders and mission_route_legs
    FOR v_stop_idx IN 1..v_total_stops LOOP
        v_order_id := p_order_ids[v_stop_idx];
        v_leg_elem := p_legs->(v_stop_idx - 1);

        INSERT INTO public.mission_orders (
            mission_id,
            order_id,
            stop_sequence,
            status,
            planned_arrival_sequence,
            created_at,
            updated_at
        )
        VALUES (
            v_mission_id,
            v_order_id,
            v_stop_idx,
            CASE WHEN v_stop_idx = 1 THEN 'NEXT' ELSE 'PENDING' END,
            v_stop_idx,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        )
        RETURNING id INTO v_mission_order_id;

        INSERT INTO public.mission_route_legs (
            mission_id,
            leg_sequence,
            from_graph_node_id,
            to_graph_node_id,
            from_label,
            to_label,
            order_id,
            mission_order_id,
            route_node_ids,
            route_edge_ids,
            route_geometry,
            distance_meters,
            effective_cost,
            hop_count,
            status,
            created_at,
            updated_at
        )
        VALUES (
            v_mission_id,
            v_stop_idx,
            v_leg_elem->>'from_graph_node_id',
            v_leg_elem->>'to_graph_node_id',
            COALESCE(v_leg_elem->>'from_label', 'Stop ' || (v_stop_idx - 1)),
            COALESCE(v_leg_elem->>'to_label', 'Stop ' || v_stop_idx),
            v_order_id,
            v_mission_order_id,
            COALESCE(v_leg_elem->'route_node_ids', '[]'::jsonb),
            COALESCE(v_leg_elem->'route_edge_ids', '[]'::jsonb),
            COALESCE(v_leg_elem->'route_geometry', '[]'::jsonb),
            COALESCE((v_leg_elem->>'distance_meters')::DOUBLE PRECISION, 0),
            COALESCE((v_leg_elem->>'effective_cost')::DOUBLE PRECISION, 0),
            COALESCE((v_leg_elem->>'hop_count')::INTEGER, 0),
            CASE WHEN v_stop_idx = 1 THEN 'ACTIVE' ELSE 'PLANNED' END,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        );

        -- Update order state to ASSIGNED
        UPDATE public.orders
        SET status = 'ASSIGNED', updated_at = timezone('utc'::text, now())
        WHERE id = v_order_id;
    END LOOP;

    -- K. Update Driver & Vehicle
    UPDATE public.drivers
    SET status = 'ASSIGNED', assigned_vehicle_id = p_vehicle_id, updated_at = timezone('utc'::text, now())
    WHERE id = p_driver_id;

    UPDATE public.vehicles
    SET status = 'ASSIGNED', assigned_driver_id = p_driver_id, updated_at = timezone('utc'::text, now())
    WHERE id = p_vehicle_id;

    -- L. Insert Audit Event
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
        p_order_ids[1],
        jsonb_build_object(
            'mission_code', v_mission_code,
            'driver_id', p_driver_id,
            'driver_name', v_driver.display_name,
            'vehicle_id', p_vehicle_id,
            'vehicle_code', v_vehicle.vehicle_code,
            'warehouse_id', p_warehouse_id,
            'order_ids', to_jsonb(p_order_ids),
            'total_stops', v_total_stops,
            'total_distance_meters', p_total_distance,
            'total_weight_kg', v_total_weight
        )
    );

    -- M. Return complete mission jsonb
    SELECT to_jsonb(m.*) INTO v_created_mission
    FROM public.missions m
    WHERE m.id = v_mission_id;

    RETURN v_created_mission;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_delivery_run TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. SECURE RPC: start_delivery_mission (Multi-Stop Aware)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_delivery_mission(
    p_mission_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_mission RECORD;
    v_driver RECORD;
    v_first_leg RECORD;
    v_start_lat DOUBLE PRECISION;
    v_start_lng DOUBLE PRECISION;
    v_runtime RECORD;
BEGIN
    SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission % not found.', p_mission_id;
    END IF;

    IF v_mission.status NOT IN ('ASSIGNED', 'READY') THEN
        RAISE EXCEPTION 'Mission % cannot be started from status %.', v_mission.mission_code, v_mission.status;
    END IF;

    SELECT * INTO v_driver FROM public.drivers WHERE id = v_mission.driver_id;
    IF v_driver.profile_id <> auth.uid() THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'CONTROL_CENTER') THEN
            RAISE EXCEPTION 'Security Violation: Only assigned driver or Control Center can start run.';
        END IF;
    END IF;

    -- Fetch first leg
    SELECT * INTO v_first_leg
    FROM public.mission_route_legs
    WHERE mission_id = p_mission_id AND leg_sequence = 1;

    IF FOUND AND jsonb_array_length(v_first_leg.route_geometry) > 0 THEN
        v_start_lat := (v_first_leg.route_geometry->0->>0)::DOUBLE PRECISION;
        v_start_lng := (v_first_leg.route_geometry->0->>1)::DOUBLE PRECISION;
    ELSE
        SELECT latitude, longitude INTO v_start_lat, v_start_lng
        FROM public.warehouses WHERE id = v_mission.warehouse_id;
    END IF;

    -- Update Mission, Driver, Vehicle
    UPDATE public.missions
    SET status = 'IN_TRANSIT',
        started_at = COALESCE(started_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_mission_id;

    UPDATE public.drivers
    SET status = 'ON_DELIVERY', updated_at = timezone('utc'::text, now())
    WHERE id = v_mission.driver_id;

    UPDATE public.vehicles
    SET status = 'ON_DELIVERY', updated_at = timezone('utc'::text, now())
    WHERE id = v_mission.vehicle_id;

    -- Update Orders linked to mission
    UPDATE public.orders
    SET status = 'IN_TRANSIT', updated_at = timezone('utc'::text, now())
    WHERE id IN (SELECT order_id FROM public.mission_orders WHERE mission_id = p_mission_id);

    -- Ensure first leg is ACTIVE
    UPDATE public.mission_route_legs
    SET status = 'ACTIVE', updated_at = timezone('utc'::text, now())
    WHERE mission_id = p_mission_id AND leg_sequence = 1;

    -- Upsert mission_runtime
    INSERT INTO public.mission_runtime (
        mission_id,
        driver_id,
        vehicle_id,
        current_leg_sequence,
        simulation_status,
        current_latitude,
        current_longitude,
        current_edge_id,
        last_reached_node_id,
        next_node_id,
        traveled_meters,
        route_progress,
        base_speed_kmh,
        playback_multiplier,
        started_at,
        updated_at
    )
    VALUES (
        p_mission_id,
        v_mission.driver_id,
        v_mission.vehicle_id,
        1,
        'RUNNING',
        v_start_lat,
        v_start_lng,
        CASE WHEN v_first_leg.route_edge_ids IS NOT NULL AND jsonb_array_length(v_first_leg.route_edge_ids) > 0 THEN v_first_leg.route_edge_ids->>0 ELSE NULL END,
        v_first_leg.from_graph_node_id,
        v_first_leg.to_graph_node_id,
        0.0,
        0.0,
        30.0,
        1.0,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (mission_id) DO UPDATE SET
        simulation_status = 'RUNNING',
        current_leg_sequence = 1,
        started_at = COALESCE(public.mission_runtime.started_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_runtime;

    -- Audit event
    INSERT INTO public.events (event_type, actor_profile_id, mission_id, payload)
    VALUES (
        'DELIVERY_STARTED',
        auth.uid(),
        p_mission_id,
        jsonb_build_object('mission_code', v_mission.mission_code, 'driver_id', v_mission.driver_id)
    );

    RETURN to_jsonb(v_runtime);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_delivery_mission TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. SECURE RPC: complete_mission_stop (Sequential Multi-Stop Completion)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_mission_stop(
    p_mission_id UUID,
    p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_mission RECORD;
    v_driver RECORD;
    v_mo RECORD;
    v_current_seq INTEGER;
    v_total_stops INTEGER;
    v_next_mo RECORD;
    v_all_completed BOOLEAN;
BEGIN
    SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission % not found.', p_mission_id;
    END IF;

    IF v_mission.status NOT IN ('IN_TRANSIT', 'ASSIGNED', 'READY', 'REROUTING') THEN
        RAISE EXCEPTION 'Mission % is not in an active delivery state (status: %).', v_mission.mission_code, v_mission.status;
    END IF;

    SELECT * INTO v_driver FROM public.drivers WHERE id = v_mission.driver_id;
    IF v_driver.profile_id <> auth.uid() THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'CONTROL_CENTER') THEN
            RAISE EXCEPTION 'Security Violation: Only assigned driver or Control Center can complete delivery stops.';
        END IF;
    END IF;

    -- Locate mission order
    SELECT * INTO v_mo FROM public.mission_orders
    WHERE mission_id = p_mission_id AND order_id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % is not part of mission %.', p_order_id, p_mission_id;
    END IF;

    IF v_mo.status = 'DELIVERED' THEN
        RAISE EXCEPTION 'Order % is already DELIVERED.', p_order_id;
    END IF;

    v_current_seq := v_mo.stop_sequence;
    v_total_stops := v_mission.total_stops;

    -- 1. Mark this stop DELIVERED
    UPDATE public.mission_orders
    SET status = 'DELIVERED',
        delivered_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_mo.id;

    UPDATE public.orders
    SET status = 'DELIVERED',
        updated_at = timezone('utc'::text, now())
    WHERE id = p_order_id;

    -- 2. Mark this route leg COMPLETED
    UPDATE public.mission_route_legs
    SET status = 'COMPLETED',
        updated_at = timezone('utc'::text, now())
    WHERE mission_id = p_mission_id AND leg_sequence = v_current_seq;

    -- 3. Check if all orders in this mission are delivered
    SELECT (count(*) = 0) INTO v_all_completed
    FROM public.mission_orders
    WHERE mission_id = p_mission_id AND status <> 'DELIVERED';

    IF v_all_completed THEN
        -- All stops delivered: complete the mission and release resources
        UPDATE public.missions
        SET status = 'COMPLETED',
            completed_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = p_mission_id;

        UPDATE public.drivers
        SET status = 'AVAILABLE',
            assigned_vehicle_id = NULL,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_mission.driver_id;

        UPDATE public.vehicles
        SET status = 'AVAILABLE',
            assigned_driver_id = NULL,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_mission.vehicle_id;

        UPDATE public.mission_runtime
        SET simulation_status = 'COMPLETED',
            route_progress = 1.0,
            updated_at = timezone('utc'::text, now())
        WHERE mission_id = p_mission_id;

        INSERT INTO public.events (event_type, actor_profile_id, mission_id, order_id, payload)
        VALUES (
            'MISSION_COMPLETED',
            auth.uid(),
            p_mission_id,
            p_order_id,
            jsonb_build_object(
                'mission_code', v_mission.mission_code,
                'total_stops', v_total_stops,
                'completed_at', timezone('utc'::text, now())
            )
        );

        RETURN jsonb_build_object(
            'complete', true,
            'mission_code', v_mission.mission_code,
            'completed_stop_sequence', v_current_seq,
            'message', 'All stops delivered. Mission completed.'
        );
    ELSE
        -- More stops remaining: advance current_stop_sequence
        UPDATE public.missions
        SET current_stop_sequence = v_current_seq + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_mission_id;

        -- Next mission_order becomes 'NEXT'
        UPDATE public.mission_orders
        SET status = 'NEXT', updated_at = timezone('utc'::text, now())
        WHERE mission_id = p_mission_id AND stop_sequence = v_current_seq + 1;

        -- Next route leg becomes 'ACTIVE'
        UPDATE public.mission_route_legs
        SET status = 'ACTIVE', updated_at = timezone('utc'::text, now())
        WHERE mission_id = p_mission_id AND leg_sequence = v_current_seq + 1;

        -- Advance runtime leg tracker
        UPDATE public.mission_runtime
        SET current_leg_sequence = v_current_seq + 1,
            simulation_status = 'RUNNING',
            updated_at = timezone('utc'::text, now())
        WHERE mission_id = p_mission_id;

        INSERT INTO public.events (event_type, actor_profile_id, mission_id, order_id, payload)
        VALUES (
            'STOP_DELIVERED',
            auth.uid(),
            p_mission_id,
            p_order_id,
            jsonb_build_object(
                'mission_code', v_mission.mission_code,
                'completed_stop_sequence', v_current_seq,
                'next_stop_sequence', v_current_seq + 1
            )
        );

        RETURN jsonb_build_object(
            'complete', false,
            'mission_code', v_mission.mission_code,
            'completed_stop_sequence', v_current_seq,
            'next_stop_sequence', v_current_seq + 1,
            'remaining_stops', v_total_stops - v_current_seq
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_mission_stop TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. SECURE RPC: complete_delivery_mission (Backward Compatibility Wrapper)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_delivery_mission(
    p_mission_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_mo RECORD;
    v_res JSONB;
BEGIN
    FOR v_mo IN 
        SELECT order_id FROM public.mission_orders 
        WHERE mission_id = p_mission_id AND status <> 'DELIVERED' 
        ORDER BY stop_sequence ASC 
    LOOP
        v_res := public.complete_mission_stop(p_mission_id, v_mo.order_id);
    END LOOP;

    RETURN jsonb_build_object('success', true, 'mission_id', p_mission_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_delivery_mission TO authenticated;

-- -----------------------------------------------------------------------------
-- 11. SECURE RPC: update_mission_runtime_progress
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_mission_runtime_progress(
    p_mission_id UUID,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_current_edge_id TEXT,
    p_last_reached_node_id TEXT,
    p_next_node_id TEXT,
    p_traveled_meters DOUBLE PRECISION,
    p_route_progress DOUBLE PRECISION,
    p_simulation_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_mission RECORD;
    v_driver RECORD;
    v_runtime RECORD;
BEGIN
    SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission % not found.', p_mission_id;
    END IF;

    SELECT * INTO v_driver FROM public.drivers WHERE id = v_mission.driver_id;
    IF v_driver.profile_id <> auth.uid() THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'CONTROL_CENTER') THEN
            RAISE EXCEPTION 'Security Violation: Cannot update runtime for non-assigned mission.';
        END IF;
    END IF;

    UPDATE public.mission_runtime
    SET current_latitude = p_latitude,
        current_longitude = p_longitude,
        current_edge_id = p_current_edge_id,
        last_reached_node_id = p_last_reached_node_id,
        next_node_id = p_next_node_id,
        traveled_meters = GREATEST(0.0, p_traveled_meters),
        route_progress = LEAST(1.0, GREATEST(0.0, p_route_progress)),
        simulation_status = COALESCE(p_simulation_status, simulation_status),
        updated_at = timezone('utc'::text, now())
    WHERE mission_id = p_mission_id
    RETURNING * INTO v_runtime;

    RETURN to_jsonb(v_runtime);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_mission_runtime_progress TO authenticated;
