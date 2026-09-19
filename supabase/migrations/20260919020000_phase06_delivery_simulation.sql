-- ====================================================================
-- HYD-LOGIX PHASE 06 MIGRATION: DELIVERY SIMULATION & RUNTIME ENGINE
-- ====================================================================
-- Establishes:
-- 1. public.mission_runtime table for single-source vehicle tracking
-- 2. Granular RLS policies (Control Center oversight, Driver scoped select)
-- 3. Atomic lifecycle RPCs:
--    - start_delivery_mission
--    - update_mission_runtime_progress
--    - pause_delivery_simulation
--    - resume_delivery_simulation
--    - complete_delivery_mission
-- 4. Audit events: DELIVERY_STARTED, DELIVERY_PAUSED, DELIVERY_RESUMED,
--    VEHICLE_ARRIVED, DELIVERY_COMPLETED
-- ====================================================================

-- 1. CREATE MISSION_RUNTIME TABLE
CREATE TABLE IF NOT EXISTS public.mission_runtime (
    mission_id UUID PRIMARY KEY REFERENCES public.missions(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_mission_runtime_status ON public.mission_runtime(simulation_status);

-- Enable RLS
ALTER TABLE public.mission_runtime ENABLE ROW LEVEL SECURITY;

-- 2. ROW LEVEL SECURITY POLICIES FOR MISSION_RUNTIME
-- Control Center operators have complete operational access
DROP POLICY IF EXISTS "Control Center operators can manage mission runtimes" ON public.mission_runtime;
CREATE POLICY "Control Center operators can manage mission runtimes"
    ON public.mission_runtime
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'CONTROL_CENTER'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'CONTROL_CENTER'
        )
    );

-- Drivers may SELECT only their own active mission runtime
DROP POLICY IF EXISTS "Drivers can view their own mission runtime" ON public.mission_runtime;
CREATE POLICY "Drivers can view their own mission runtime"
    ON public.mission_runtime
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.drivers
            WHERE drivers.id = mission_runtime.driver_id
              AND drivers.profile_id = auth.uid()
        )
    );

-- 3. SECURE RPC: start_delivery_mission
-- Atomically starts delivery, transitions mission, order, driver, and vehicle states.
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
    v_start_lat DOUBLE PRECISION;
    v_start_lng DOUBLE PRECISION;
    v_first_node_id TEXT;
    v_first_edge_id TEXT := NULL;
    v_runtime RECORD;
BEGIN
    -- 1. Security Check: Authenticated user must be assigned DRIVER (or Control Center override)
    SELECT * INTO v_mission
    FROM public.missions
    WHERE id = p_mission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission with ID % not found.', p_mission_id;
    END IF;

    IF v_mission.status NOT IN ('ASSIGNED', 'READY') THEN
        RAISE EXCEPTION 'Mission "%" cannot be started from status "%" (must be ASSIGNED or READY).',
            v_mission.mission_code, v_mission.status;
    END IF;

    SELECT * INTO v_driver
    FROM public.drivers
    WHERE id = v_mission.driver_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned driver record not found.';
    END IF;

    -- Validate caller identity
    IF v_driver.profile_id <> auth.uid() THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'CONTROL_CENTER'
        ) THEN
            RAISE EXCEPTION 'Security Violation: Only the assigned driver can start this delivery mission.';
        END IF;
    END IF;

    -- 2. Determine initial coordinates from route_geometry or warehouse
    IF jsonb_array_length(v_mission.route_geometry) > 0 THEN
        v_start_lat := (v_mission.route_geometry->0->>0)::DOUBLE PRECISION;
        v_start_lng := (v_mission.route_geometry->0->>1)::DOUBLE PRECISION;
    ELSE
        SELECT latitude, longitude INTO v_start_lat, v_start_lng
        FROM public.warehouses
        WHERE id = v_mission.warehouse_id;
    END IF;

    IF jsonb_array_length(v_mission.route_node_ids) > 0 THEN
        v_first_node_id := v_mission.route_node_ids->>0;
    ELSE
        v_first_node_id := v_mission.source_graph_node_id;
    END IF;

    IF jsonb_array_length(v_mission.route_edge_ids) > 0 THEN
        v_first_edge_id := v_mission.route_edge_ids->>0;
    END IF;

    -- 3. Atomic state updates
    UPDATE public.missions
    SET status = 'IN_TRANSIT',
        started_at = COALESCE(started_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_mission_id;

    UPDATE public.orders
    SET status = 'IN_TRANSIT',
        updated_at = timezone('utc'::text, now())
    WHERE id = v_mission.order_id;

    UPDATE public.drivers
    SET status = 'ON_DELIVERY',
        updated_at = timezone('utc'::text, now())
    WHERE id = v_mission.driver_id;

    UPDATE public.vehicles
    SET status = 'ON_DELIVERY',
        updated_at = timezone('utc'::text, now())
    WHERE id = v_mission.vehicle_id;

    -- 4. Upsert runtime state
    INSERT INTO public.mission_runtime (
        mission_id,
        driver_id,
        vehicle_id,
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
        'RUNNING',
        v_start_lat,
        v_start_lng,
        v_first_edge_id,
        v_first_node_id,
        CASE WHEN jsonb_array_length(v_mission.route_node_ids) > 1 THEN v_mission.route_node_ids->>1 ELSE NULL END,
        0.0,
        0.0,
        30.0,
        1.0,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (mission_id) DO UPDATE
    SET simulation_status = 'RUNNING',
        started_at = COALESCE(public.mission_runtime.started_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_runtime;

    -- 5. Record DELIVERY_STARTED event
    INSERT INTO public.events (event_type, actor_profile_id, mission_id, order_id, payload)
    VALUES (
        'DELIVERY_STARTED',
        auth.uid(),
        p_mission_id,
        v_mission.order_id,
        jsonb_build_object(
            'mission_code', v_mission.mission_code,
            'driver_id', v_mission.driver_id,
            'vehicle_id', v_mission.vehicle_id,
            'start_coordinates', jsonb_build_array(v_start_lat, v_start_lng)
        )
    );

    RETURN to_jsonb(v_runtime);
END;
$$;

-- 4. SECURE RPC: update_mission_runtime_progress
-- Throttled updates from simulation engine to sync live position and graph tracking.
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
    v_new_status TEXT;
BEGIN
    SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission % not found.', p_mission_id;
    END IF;

    SELECT * INTO v_driver FROM public.drivers WHERE id = v_mission.driver_id;
    IF v_driver.profile_id <> auth.uid() THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'CONTROL_CENTER'
        ) THEN
            RAISE EXCEPTION 'Security Violation: Cannot update runtime for non-assigned mission.';
        END IF;
    END IF;

    -- Validate simulation status
    IF p_simulation_status IS NOT NULL THEN
        IF p_simulation_status NOT IN ('READY', 'RUNNING', 'PAUSED', 'ARRIVED', 'COMPLETED') THEN
            RAISE EXCEPTION 'Invalid simulation status %.', p_simulation_status;
        END IF;
        v_new_status := p_simulation_status;
    END IF;

    UPDATE public.mission_runtime
    SET current_latitude = p_latitude,
        current_longitude = p_longitude,
        current_edge_id = p_current_edge_id,
        last_reached_node_id = p_last_reached_node_id,
        next_node_id = p_next_node_id,
        traveled_meters = GREATEST(0.0, p_traveled_meters),
        route_progress = LEAST(1.0, GREATEST(0.0, p_route_progress)),
        simulation_status = COALESCE(v_new_status, simulation_status),
        updated_at = timezone('utc'::text, now())
    WHERE mission_id = p_mission_id
    RETURNING * INTO v_runtime;

    IF p_simulation_status = 'ARRIVED' THEN
        INSERT INTO public.events (event_type, actor_profile_id, mission_id, order_id, payload)
        VALUES (
            'VEHICLE_ARRIVED',
            auth.uid(),
            p_mission_id,
            v_mission.order_id,
            jsonb_build_object(
                'mission_code', v_mission.mission_code,
                'destination_coordinates', jsonb_build_array(p_latitude, p_longitude),
                'traveled_meters', p_traveled_meters
            )
        );
    END IF;

    RETURN to_jsonb(v_runtime);
END;
$$;

-- 5. SECURE RPC: pause_delivery_simulation
CREATE OR REPLACE FUNCTION public.pause_delivery_simulation(
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
    v_runtime RECORD;
BEGIN
    SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission % not found.', p_mission_id;
    END IF;

    SELECT * INTO v_driver FROM public.drivers WHERE id = v_mission.driver_id;
    IF v_driver.profile_id <> auth.uid() THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'CONTROL_CENTER'
        ) THEN
            RAISE EXCEPTION 'Security Violation: Cannot pause simulation for non-assigned mission.';
        END IF;
    END IF;

    UPDATE public.mission_runtime
    SET simulation_status = 'PAUSED',
        updated_at = timezone('utc'::text, now())
    WHERE mission_id = p_mission_id
    RETURNING * INTO v_runtime;

    INSERT INTO public.events (event_type, actor_profile_id, mission_id, order_id, payload)
    VALUES (
        'DELIVERY_PAUSED',
        auth.uid(),
        p_mission_id,
        v_mission.order_id,
        jsonb_build_object('mission_code', v_mission.mission_code, 'traveled_meters', v_runtime.traveled_meters)
    );

    RETURN to_jsonb(v_runtime);
END;
$$;

-- 6. SECURE RPC: resume_delivery_simulation
CREATE OR REPLACE FUNCTION public.resume_delivery_simulation(
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
    v_runtime RECORD;
BEGIN
    SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission % not found.', p_mission_id;
    END IF;

    SELECT * INTO v_driver FROM public.drivers WHERE id = v_mission.driver_id;
    IF v_driver.profile_id <> auth.uid() THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'CONTROL_CENTER'
        ) THEN
            RAISE EXCEPTION 'Security Violation: Cannot resume simulation for non-assigned mission.';
        END IF;
    END IF;

    UPDATE public.mission_runtime
    SET simulation_status = 'RUNNING',
        updated_at = timezone('utc'::text, now())
    WHERE mission_id = p_mission_id
    RETURNING * INTO v_runtime;

    INSERT INTO public.events (event_type, actor_profile_id, mission_id, order_id, payload)
    VALUES (
        'DELIVERY_RESUMED',
        auth.uid(),
        p_mission_id,
        v_mission.order_id,
        jsonb_build_object('mission_code', v_mission.mission_code, 'traveled_meters', v_runtime.traveled_meters)
    );

    RETURN to_jsonb(v_runtime);
END;
$$;

-- 7. SECURE RPC: complete_delivery_mission
-- Explicit confirmation of delivery by assigned driver at destination.
CREATE OR REPLACE FUNCTION public.complete_delivery_mission(
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
    v_runtime RECORD;
BEGIN
    SELECT * INTO v_mission
    FROM public.missions
    WHERE id = p_mission_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mission % not found.', p_mission_id;
    END IF;

    IF v_mission.status NOT IN ('IN_TRANSIT', 'READY', 'ASSIGNED') THEN
        RAISE EXCEPTION 'Mission % cannot be completed from status "%".', v_mission.mission_code, v_mission.status;
    END IF;

    SELECT * INTO v_driver
    FROM public.drivers
    WHERE id = v_mission.driver_id;

    IF v_driver.profile_id <> auth.uid() THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'CONTROL_CENTER'
        ) THEN
            RAISE EXCEPTION 'Security Violation: Only the assigned driver can confirm delivery.';
        END IF;
    END IF;

    -- Atomic status completions
    UPDATE public.missions
    SET status = 'DELIVERED',
        completed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_mission_id;

    UPDATE public.orders
    SET status = 'DELIVERED',
        updated_at = timezone('utc'::text, now())
    WHERE id = v_mission.order_id;

    -- Release driver and vehicle
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

    -- Complete runtime state
    UPDATE public.mission_runtime
    SET simulation_status = 'COMPLETED',
        route_progress = 1.0,
        traveled_meters = v_mission.route_distance_meters,
        updated_at = timezone('utc'::text, now())
    WHERE mission_id = p_mission_id
    RETURNING * INTO v_runtime;

    -- Audit event
    INSERT INTO public.events (event_type, actor_profile_id, mission_id, order_id, payload)
    VALUES (
        'DELIVERY_COMPLETED',
        auth.uid(),
        p_mission_id,
        v_mission.order_id,
        jsonb_build_object(
            'mission_code', v_mission.mission_code,
            'completed_at', timezone('utc'::text, now())
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'mission_code', v_mission.mission_code,
        'status', 'DELIVERED'
    );
END;
$$;
