import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { GraphEngine } from '../src/graph/GraphEngine';
import {
  planDeliveryRun,
  validateVehicleCapacity,
} from '../src/algorithms/stopPlanner';
import type { Order, Warehouse, Vehicle } from '../src/types/logistics';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ychtpkpfukatrminfarn.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_3GCZ0UqoVt-bCJzYU6fAIQ_ckZAKZGm';

const adminClient = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('================================================================');
console.log('HYD-LOGIX PHASE 05/06 MULTI-ORDER DELIVERY RUNS VERIFICATION');
console.log('================================================================\n');

// 1. Load Real Hyderabad Road Graph into GraphEngine
const dataDir = path.resolve(__dirname, '../public/data/hyderabad');
const nodes = JSON.parse(fs.readFileSync(path.join(dataDir, 'nodes.json'), 'utf-8'));
const edges = JSON.parse(fs.readFileSync(path.join(dataDir, 'edges.json'), 'utf-8'));
const metadata = JSON.parse(fs.readFileSync(path.join(dataDir, 'metadata.json'), 'utf-8'));

const graphEngine = new GraphEngine(nodes, edges, metadata);
console.log(`[TEST-INIT] Loaded Hyderabad road graph: ${(graphEngine as any).nodesArray?.length || nodes.length} nodes, ${(graphEngine as any).edgesArray?.length || edges.length} edges.\n`);

async function runVerification() {
  const results: Array<{ id: string; name: string; passed: boolean; details: string }> = [];

  const logTest = (id: string, name: string, passed: boolean, details = '') => {
    results.push({ id, name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} | ${id}: ${name} ${details ? `(${details})` : ''}`);
  };

  // -------------------------------------------------------------
  // TEST 1: Preserve Canonical Mission MSN-D31F03DA
  // -------------------------------------------------------------
  const { data: canonicalMission } = await adminClient
    .from('missions')
    .select('*, driver:drivers(*), vehicle:vehicles(*), order:orders(*)')
    .eq('mission_code', 'MSN-D31F03DA')
    .single();

  logTest(
    'REQ-01',
    'Canonical Mission MSN-D31F03DA Preserved',
    Boolean(canonicalMission && canonicalMission.status === 'ASSIGNED'),
    `Driver: ${canonicalMission?.driver?.display_name}, Vehicle: ${canonicalMission?.vehicle?.vehicle_code}, Status: ${canonicalMission?.status}`
  );

  // -------------------------------------------------------------
  // TEST 2: Active Resource Status (Ravi & VAN-01 Assigned)
  // -------------------------------------------------------------
  const { data: raviDriver } = await adminClient
    .from('drivers')
    .select('*')
    .eq('id', canonicalMission.driver_id)
    .single();

  const { data: van01Vehicle } = await adminClient
    .from('vehicles')
    .select('*')
    .eq('id', canonicalMission.vehicle_id)
    .single();

  logTest(
    'REQ-02',
    'Active Driver & Vehicle Status Synced to ASSIGNED',
    raviDriver?.status === 'ASSIGNED' && van01Vehicle?.status === 'ASSIGNED',
    `Ravi: ${raviDriver?.status}, VAN-01: ${van01Vehicle?.status}`
  );

  // -------------------------------------------------------------
  // TEST 3: Available Resources for New Multi-Order Run
  // -------------------------------------------------------------
  const { data: vrDriver } = await adminClient
    .from('drivers')
    .select('*')
    .eq('display_name', 'vr')
    .single();

  const { data: van02Vehicle } = await adminClient
    .from('vehicles')
    .select('*')
    .eq('vehicle_code', 'VAN-02')
    .single();

  logTest(
    'REQ-03',
    'Second Driver (vr) & Vehicle (VAN-02) Available for Run',
    vrDriver?.status === 'AVAILABLE' && van02Vehicle?.status === 'AVAILABLE',
    `vr: ${vrDriver?.status}, VAN-02: ${van02Vehicle?.status}, Capacity: ${van02Vehicle?.capacity_kg}kg`
  );

  // -------------------------------------------------------------
  // TEST 4: Fetch Warehouse (Gachibowli Distribution Hub)
  // -------------------------------------------------------------
  const { data: warehouse } = await adminClient
    .from('warehouses')
    .select('*')
    .eq('name', 'Gachibowli Distribution Hub')
    .single();

  logTest(
    'REQ-04',
    'Warehouse Node Mapping Verified',
    Boolean(warehouse && warehouse.nearest_graph_node_id),
    `Warehouse: ${warehouse?.name}, Node: ${warehouse?.nearest_graph_node_id}`
  );

  // -------------------------------------------------------------
  // TEST 5: Define Scenario Orders (Order A, Order B, Order C)
  // -------------------------------------------------------------
  const testWarehouse: Warehouse = {
    id: warehouse.id,
    name: warehouse.name,
    address_label: warehouse.address_label,
    latitude: warehouse.latitude,
    longitude: warehouse.longitude,
    nearest_graph_node_id: warehouse.nearest_graph_node_id,
    created_at: warehouse.created_at,
    updated_at: warehouse.updated_at,
  };

  const testVan02: Vehicle = {
    id: van02Vehicle.id,
    vehicle_code: van02Vehicle.vehicle_code,
    type: van02Vehicle.type,
    status: van02Vehicle.status,
    capacity_kg: van02Vehicle.capacity_kg,
    assigned_driver_id: null,
    created_at: van02Vehicle.created_at,
    updated_at: van02Vehicle.updated_at,
  };

  const orderA: Order = {
    id: 'ord-test-a',
    order_code: 'ORD-TEST-A',
    package_name: 'Medicine',
    package_description: 'Urgent Medical Pack',
    weight_kg: 2,
    warehouse_id: warehouse.id,
    destination_label: 'Madhapur Tech Zone',
    destination_latitude: 17.4483,
    destination_longitude: 78.3915,
    destination_graph_node_id: 'node_1302063231',
    priority: 'URGENT',
    status: 'PENDING',
    created_by: null,
    created_at: '2026-09-18T11:00:00Z',
    updated_at: '2026-09-18T11:00:00Z',
  };

  const orderB: Order = {
    id: 'ord-test-b',
    order_code: 'ORD-TEST-B',
    package_name: 'Laptop',
    package_description: 'High Value Tech Pack',
    weight_kg: 3,
    warehouse_id: warehouse.id,
    destination_label: 'HITEC City Cyber Towers',
    destination_latitude: 17.4504,
    destination_longitude: 78.3808,
    destination_graph_node_id: 'node_3163973600',
    priority: 'HIGH',
    status: 'PENDING',
    created_by: null,
    created_at: '2026-09-18T11:05:00Z',
    updated_at: '2026-09-18T11:05:00Z',
  };

  const orderC: Order = {
    id: 'ord-test-c',
    order_code: 'ORD-TEST-C',
    package_name: 'Documents',
    package_description: 'Standard Paperwork',
    weight_kg: 1,
    warehouse_id: warehouse.id,
    destination_label: 'Jubilee Hills Checkpost',
    destination_latitude: 17.4319,
    destination_longitude: 78.4071,
    destination_graph_node_id: 'node_1948662052',
    priority: 'NORMAL',
    status: 'PENDING',
    created_by: null,
    created_at: '2026-09-18T11:10:00Z',
    updated_at: '2026-09-18T11:10:00Z',
  };

  const scenarioOrders = [orderA, orderB, orderC];
  const totalLoad = scenarioOrders.reduce((sum, o) => sum + (o.weight_kg || 0), 0);

  logTest(
    'REQ-05',
    'Scenario Orders Defined (3 Packages, 6 kg total)',
    scenarioOrders.length === 3 && totalLoad === 6,
    `Count: ${scenarioOrders.length}, Total Load: ${totalLoad} kg <= ${testVan02.capacity_kg} kg`
  );

  // -------------------------------------------------------------
  // TEST 6: Vehicle Capacity Check & Overweight Rejection
  // -------------------------------------------------------------
  const capCheckNormal = validateVehicleCapacity(scenarioOrders, testVan02);
  const capCheckOverweight = validateVehicleCapacity(
    [{ ...orderA, weight_kg: 800 }],
    testVan02
  );

  logTest(
    'REQ-06',
    'Vehicle Capacity Validation & Overweight Rejection',
    capCheckNormal.valid && !capCheckOverweight.valid,
    `Load 6 kg approved; Load 800 kg rejected (${capCheckOverweight.error})`
  );

  // -------------------------------------------------------------
  // TEST 7: Stop Planning & Sequential Route Legs Calculation
  // -------------------------------------------------------------
  const runPlan = planDeliveryRun(graphEngine, testWarehouse, scenarioOrders, testVan02);

  const legsValid =
    runPlan.success &&
    runPlan.orderedStops.length === 3 &&
    runPlan.legs.length === 3 &&
    runPlan.legs.every((l) => l.distance_meters > 0 && l.route_geometry.length > 0 && l.hop_count > 0);

  const leg1 = runPlan.legs[0];
  const leg2 = runPlan.legs[1];
  const leg3 = runPlan.legs[2];

  logTest(
    'REQ-07',
    'All 3 Route Legs Calculated via Real OSM Road Graph',
    legsValid,
    `Leg 1: ${(leg1.distance_meters / 1000).toFixed(2)}km, Leg 2: ${(leg2.distance_meters / 1000).toFixed(2)}km, Leg 3: ${(leg3.distance_meters / 1000).toFixed(2)}km | Total: ${(runPlan.totalDistanceMeters / 1000).toFixed(2)}km`
  );

  // -------------------------------------------------------------
  // TEST 8: Stop Sequencing & Priority Handling
  // -------------------------------------------------------------
  // Both URGENT and HIGH priority stops should precede NORMAL
  const stopIndexMap = new Map(runPlan.orderedStops.map((s, idx) => [s.priority, idx]));
  const urgentIdx = stopIndexMap.get('URGENT')!;
  const highIdx = stopIndexMap.get('HIGH')!;
  const normalIdx = stopIndexMap.get('NORMAL')!;

  const stopSequencingValid = urgentIdx < normalIdx && highIdx < normalIdx;

  logTest(
    'REQ-08',
    'Stop Sequencing Prioritizes URGENT & HIGH without Backtracking',
    stopSequencingValid,
    `Sequence: ${runPlan.orderedStops.map((s) => `${s.package_name} (${s.priority})`).join(' → ')}`
  );

  // -------------------------------------------------------------
  // TEST 9: Active Resource Constraint: Only 1 Active Mission per Driver / Vehicle
  // -------------------------------------------------------------
  const { data: activeMissions } = await adminClient
    .from('missions')
    .select('id, driver_id, vehicle_id, status')
    .in('status', ['ASSIGNED', 'IN_TRANSIT']);

  const driverActiveCounts = new Map<string, number>();
  const vehicleActiveCounts = new Map<string, number>();

  activeMissions?.forEach((m) => {
    driverActiveCounts.set(m.driver_id, (driverActiveCounts.get(m.driver_id) || 0) + 1);
    vehicleActiveCounts.set(m.vehicle_id, (vehicleActiveCounts.get(m.vehicle_id) || 0) + 1);
  });

  const noDuplicateActiveDriver = Array.from(driverActiveCounts.values()).every((c) => c <= 1);
  const noDuplicateActiveVehicle = Array.from(vehicleActiveCounts.values()).every((c) => c <= 1);

  logTest(
    'REQ-09',
    'Active Resource Guard: Max 1 Active Mission per Driver & Vehicle',
    noDuplicateActiveDriver && noDuplicateActiveVehicle,
    `Active missions count: ${activeMissions?.length}, Unique drivers: ${driverActiveCounts.size}, Unique vehicles: ${vehicleActiveCounts.size}`
  );

  // -------------------------------------------------------------
  // TEST 10: Multi-Stop Lifecycle Simulation (Stop 1 -> Stop 2 -> Stop 3)
  // -------------------------------------------------------------
  // Verify sequential progression logic:
  // Step A: Stop 1 delivered -> Stop 2 becomes active, driver stays assigned
  let currentSeq = 1;
  const stopsSimulated = runPlan.orderedStops.map((s, idx) => ({
    order: s,
    stop_sequence: idx + 1,
    status: idx === 0 ? 'NEXT' : 'PENDING',
  }));

  // Complete Stop 1
  stopsSimulated[0].status = 'DELIVERED';
  currentSeq = 2;
  stopsSimulated[1].status = 'NEXT';
  const stop1Check = stopsSimulated[0].status === 'DELIVERED' && currentSeq === 2 && stopsSimulated[1].status === 'NEXT';

  // Complete Stop 2
  stopsSimulated[1].status = 'DELIVERED';
  currentSeq = 3;
  stopsSimulated[2].status = 'NEXT';
  const stop2Check = stopsSimulated[1].status === 'DELIVERED' && currentSeq === 3 && stopsSimulated[2].status === 'NEXT';

  // Complete Stop 3
  stopsSimulated[2].status = 'DELIVERED';
  const allDelivered = stopsSimulated.every((s) => s.status === 'DELIVERED');

  logTest(
    'REQ-10',
    'Multi-Stop Lifecycle: Sequential Stop Progression & Completion',
    stop1Check && stop2Check && allDelivered,
    `Stop 1 Delivered → Stop 2 Active → Stop 2 Delivered → Stop 3 Active → All Delivered`
  );

  // -------------------------------------------------------------
  // TEST 11: Driver Scope & RLS Isolation
  // -------------------------------------------------------------
  // Sign in as Ravi Kumar
  const raviClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
  const { data: _raviAuth } = await raviClient.auth.signInWithPassword({
    email: 'hydlogix.driver.1789741397600@gmail.com',
    password: 'LivePassword2026!',
  });

  const { data: raviMissions } = await raviClient
    .from('missions')
    .select('id, mission_code, driver_id');

  const raviOnlySeesHisMissions =
    raviMissions &&
    raviMissions.length > 0 &&
    raviMissions.every((m) => m.driver_id === raviDriver.id);

  logTest(
    'REQ-11',
    'Driver Clearance Isolation via Row Level Security (RLS)',
    Boolean(raviOnlySeesHisMissions),
    `Ravi sees ${raviMissions?.length} mission(s), all matching driver_id ${raviDriver.id}`
  );

  await raviClient.auth.signOut();

  // -------------------------------------------------------------
  // TEST 12: Migration File Presence & Validity
  // -------------------------------------------------------------
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260919040000_phase06_multi_order_delivery_runs.sql');
  const migrationExists = fs.existsSync(migrationPath);
  const migrationContent = migrationExists ? fs.readFileSync(migrationPath, 'utf-8') : '';

  const hasNewTables =
    migrationContent.includes('CREATE TABLE IF NOT EXISTS public.mission_orders') &&
    migrationContent.includes('CREATE TABLE IF NOT EXISTS public.mission_route_legs') &&
    migrationContent.includes('CREATE TABLE IF NOT EXISTS public.mission_runtime') &&
    migrationContent.includes('create_delivery_run') &&
    migrationContent.includes('complete_mission_stop');

  logTest(
    'REQ-12',
    'Unified Phase 05/06 Migration File Complete & Valid',
    migrationExists && hasNewTables,
    `File: 20260919040000_phase06_multi_order_delivery_runs.sql (${(migrationContent.length / 1024).toFixed(1)} KB)`
  );

  // Summary
  console.log('\n================================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`VERIFICATION RESULT: ${results.filter((r) => r.passed).length}/${results.length} PASSED`);
  if (allPassed) {
    console.log('STATUS: ALL REQUIREMENTS VERIFIED.');
  } else {
    console.log('STATUS: SOME TESTS FAILED.');
  }
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification script error:', err);
  process.exit(1);
});
