# HYD-LOGIX Supabase Setup Guide

## Applying Migrations

1. Go to your Supabase Project Dashboard: `https://supabase.com/dashboard/project/ychtpkpfukatrminfarn`
2. Navigate to the **SQL Editor** on the left menu.
3. Apply migrations in sequential order:
   - `supabase/migrations/20260918000000_init_auth_and_profiles.sql` (Phase 00A - Auth & Roles)
   - `supabase/migrations/20260918010000_phase03_logistics_core.sql` (Phase 03 - Logistics Core, Warehouses, Orders, Vehicles, Drivers, Missions, Events & create_delivery_mission RPC)
   - `supabase/migrations/20260919020000_phase06_delivery_simulation.sql` (Phase 06 - Delivery Simulation Engine, mission_runtime table & lifecycle RPCs)
   - `supabase/migrations/20260919030000_phase06_data_consistency.sql` (Phase 06 Correction - Partial unique indexes preventing multiple active missions per driver/vehicle & hardened create_delivery_mission RPC)
4. Click **Run**.

## What Phase 06 & Correction Establish:
- `mission_runtime`: Single source of truth for real-time vehicle positions, simulation statuses (`READY`, `RUNNING`, `PAUSED`, `ARRIVED`, `COMPLETED`), traveled distance, route progress, and graph-position tracking (`current_edge_id`, `last_reached_node_id`, `next_node_id`).
- `start_delivery_mission()` RPC: Validates driver identity, transitions mission/order to `IN_TRANSIT`, driver/vehicle to `ON_DELIVERY`, and initializes runtime.
- `update_mission_runtime_progress()` RPC: Secure throttled updates from simulation engine to sync live position and emit arrival events.
- `pause_delivery_simulation()` & `resume_delivery_simulation()` RPCs: Controls simulation execution without altering business mission statuses.
- `complete_delivery_mission()` RPC: Explicit delivery confirmation at destination, freeing driver and vehicle to `AVAILABLE`.
- `idx_missions_unique_active_driver` & `idx_missions_unique_active_vehicle`: Partial unique indexes strictly prohibiting duplicate active mission assignments per driver or vehicle.
- `create_delivery_mission()` Hardening: Atomic validation rejecting dispatches if a driver or vehicle is not `AVAILABLE` or already has an active mission (`PLANNED`, `ASSIGNED`, `READY`, `IN_TRANSIT`, `REROUTING`).
- Row-Level Security isolating driver runtime views and preventing unauthorized manipulation.

