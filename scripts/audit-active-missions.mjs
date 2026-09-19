import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ychtpkpfukatrminfarn.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(SUPABASE_URL, SECRET_KEY);

async function audit() {
  console.log('=== AUDIT CURRENT DATABASE STATE ===\n');

  // 1. DRIVERS
  const { data: drivers } = await admin
    .from('drivers')
    .select('id, display_name, status, assigned_vehicle_id, profile_id')
    .order('created_at', { ascending: false });

  console.log('--- ALL DRIVERS ---');
  console.table(drivers);

  // 2. VEHICLES
  const { data: vehicles } = await admin
    .from('vehicles')
    .select('id, vehicle_code, status, assigned_driver_id, type')
    .order('created_at', { ascending: false });

  console.log('--- ALL VEHICLES ---');
  console.table(vehicles);

  // 3. ALL ACTIVE MISSIONS
  const activeStatuses = ['PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING'];
  const { data: activeMissions } = await admin
    .from('missions')
    .select('id, mission_code, driver_id, vehicle_id, status, order_id, warehouse_id, created_at, updated_at')
    .in('status', activeStatuses)
    .order('created_at', { ascending: false });

  console.log('--- ACTIVE MISSIONS ---');
  console.table(activeMissions);

  // Check duplicates
  const driverCounts = {};
  const vehicleCounts = {};

  for (const m of activeMissions || []) {
    driverCounts[m.driver_id] = (driverCounts[m.driver_id] || 0) + 1;
    vehicleCounts[m.vehicle_id] = (vehicleCounts[m.vehicle_id] || 0) + 1;
  }

  console.log('\n--- DUPLICATE ANALYSIS ---');
  console.log('Driver Active Mission Counts:', driverCounts);
  console.log('Vehicle Active Mission Counts:', vehicleCounts);

  // Orders attached to active missions
  const orderIds = (activeMissions || []).map(m => m.order_id);
  const { data: orders } = await admin
    .from('orders')
    .select('id, order_code, package_name, status')
    .in('id', orderIds);

  console.log('\n--- ORDERS ATTACHED TO ACTIVE MISSIONS ---');
  console.table(orders);
}

audit().catch(console.error);
