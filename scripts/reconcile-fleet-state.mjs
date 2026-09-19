import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ychtpkpfukatrminfarn.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ACTIVE_STATUSES = ['PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING'];
const CANONICAL_MISSION_CODE = 'MSN-D31F03DA';

export async function reconcileFleetState(options = { dryRun: false }) {
  console.log('====================================================');
  console.log('  HYD-LOGIX FLEET STATE RECONCILIATION & AUDIT UTILITY');
  console.log('====================================================');
  console.log(`Mode: ${options.dryRun ? 'DRY-RUN (Audit Only)' : 'EXECUTE (Fix & Reconcile)'}\n`);

  // 1. Fetch all missions
  const { data: allMissions, error: mErr } = await admin
    .from('missions')
    .select('id, mission_code, driver_id, vehicle_id, order_id, warehouse_id, status, created_at')
    .order('created_at', { ascending: false });

  if (mErr) throw mErr;

  const activeMissions = (allMissions || []).filter(m => ACTIVE_STATUSES.includes(m.status));
  console.log(`Found ${allMissions?.length || 0} total missions, ${activeMissions.length} currently active.`);

  // 2. Identify canonical vs duplicate test missions
  const canonicalMission = activeMissions.find(m => m.mission_code === CANONICAL_MISSION_CODE);
  const duplicateActiveMissions = activeMissions.filter(m => m.mission_code !== CANONICAL_MISSION_CODE);

  console.log('\n--- ACTIVE MISSIONS AUDIT ---');
  console.table(activeMissions.map(m => ({
    mission_code: m.mission_code,
    driver_id: m.driver_id,
    vehicle_id: m.vehicle_id,
    order_id: m.order_id,
    status: m.status,
    is_canonical: m.mission_code === CANONICAL_MISSION_CODE ? 'YES (KEEP)' : 'NO (DUPLICATE)'
  })));

  if (!canonicalMission) {
    console.error(`WARNING: Canonical mission ${CANONICAL_MISSION_CODE} not found in active missions!`);
  }

  // 3. Detect Contradictions & Duplicates
  const driverActiveMissions = new Map();
  const vehicleActiveMissions = new Map();

  for (const m of activeMissions) {
    if (!driverActiveMissions.has(m.driver_id)) driverActiveMissions.set(m.driver_id, []);
    driverActiveMissions.get(m.driver_id).push(m);

    if (!vehicleActiveMissions.has(m.vehicle_id)) vehicleActiveMissions.set(m.vehicle_id, []);
    vehicleActiveMissions.get(m.vehicle_id).push(m);
  }

  const driverDuplicates = [];
  for (const [dId, list] of driverActiveMissions.entries()) {
    if (list.length > 1) driverDuplicates.push({ driver_id: dId, count: list.length, codes: list.map(x => x.mission_code) });
  }

  const vehicleDuplicates = [];
  for (const [vId, list] of vehicleActiveMissions.entries()) {
    if (list.length > 1) vehicleDuplicates.push({ vehicle_id: vId, count: list.length, codes: list.map(x => x.mission_code) });
  }

  console.log('\n--- CONTRADICTION & DUPLICATE REPORT ---');
  console.log('Driver Duplicate Active Missions:', driverDuplicates);
  console.log('Vehicle Duplicate Active Missions:', vehicleDuplicates);

  // 4. Safe Cleanup of Duplicate Test Missions
  if (!options.dryRun && duplicateActiveMissions.length > 0) {
    console.log(`\nSafely marking ${duplicateActiveMissions.length} duplicate test missions as CANCELLED...`);

    for (const dup of duplicateActiveMissions) {
      console.log(`Cancelling duplicate mission ${dup.mission_code} (ID: ${dup.id})...`);
      const { error: cErr } = await admin
        .from('missions')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', dup.id);
      if (cErr) console.error(`Failed to cancel mission ${dup.mission_code}:`, cErr.message);

      // Also cancel associated test order
      if (dup.order_id) {
        console.log(`Cancelling associated duplicate test order (ID: ${dup.order_id})...`);
        const { error: oErr } = await admin
          .from('orders')
          .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
          .eq('id', dup.order_id);
        if (oErr) console.error(`Failed to cancel order ${dup.order_id}:`, oErr.message);
      }
    }
  }

  // 5. Fetch updated active missions (post-cleanup)
  const { data: postMissions } = await admin
    .from('missions')
    .select('id, mission_code, driver_id, vehicle_id, status')
    .in('status', ACTIVE_STATUSES);

  const activeDriverMap = new Map();
  const activeVehicleMap = new Map();

  for (const m of postMissions || []) {
    activeDriverMap.set(m.driver_id, m);
    activeVehicleMap.set(m.vehicle_id, m);
  }

  // 6. Reconcile DRIVERS state
  const { data: drivers } = await admin.from('drivers').select('*');
  console.log('\n--- RECONCILING DRIVERS ---');
  for (const d of drivers || []) {
    const activeM = activeDriverMap.get(d.id);
    const expectedStatus = activeM ? (activeM.status === 'IN_TRANSIT' ? 'ON_DELIVERY' : 'ASSIGNED') : 'AVAILABLE';
    const expectedVehicleId = activeM ? activeM.vehicle_id : null;

    const hasStatusDiff = d.status !== expectedStatus;
    const hasVehicleDiff = d.assigned_vehicle_id !== expectedVehicleId;

    if (hasStatusDiff || hasVehicleDiff) {
      console.log(`Driver "${d.display_name}" (${d.id}):`);
      console.log(`  Current:  status=${d.status}, vehicle=${d.assigned_vehicle_id}`);
      console.log(`  Expected: status=${expectedStatus}, vehicle=${expectedVehicleId}`);

      if (!options.dryRun) {
        const { error: updErr } = await admin
          .from('drivers')
          .update({
            status: expectedStatus,
            assigned_vehicle_id: expectedVehicleId,
            updated_at: new Date().toISOString()
          })
          .eq('id', d.id);
        if (updErr) console.error(`  Error updating driver ${d.id}:`, updErr.message);
        else console.log('  Updated successfully.');
      }
    } else {
      console.log(`Driver "${d.display_name}" (${d.id}) is CONSISTENT: status=${d.status}, vehicle=${d.assigned_vehicle_id}`);
    }
  }

  // 7. Reconcile VEHICLES state
  const { data: vehicles } = await admin.from('vehicles').select('*');
  console.log('\n--- RECONCILING VEHICLES ---');
  for (const v of vehicles || []) {
    const activeM = activeVehicleMap.get(v.id);
    const expectedStatus = activeM ? (activeM.status === 'IN_TRANSIT' ? 'ON_DELIVERY' : 'ASSIGNED') : 'AVAILABLE';
    const expectedDriverId = activeM ? activeM.driver_id : null;

    const hasStatusDiff = v.status !== expectedStatus;
    const hasDriverDiff = v.assigned_driver_id !== expectedDriverId;

    if (hasStatusDiff || hasDriverDiff) {
      console.log(`Vehicle "${v.vehicle_code}" (${v.id}):`);
      console.log(`  Current:  status=${v.status}, driver=${v.assigned_driver_id}`);
      console.log(`  Expected: status=${expectedStatus}, driver=${expectedDriverId}`);

      if (!options.dryRun) {
        const { error: updErr } = await admin
          .from('vehicles')
          .update({
            status: expectedStatus,
            assigned_driver_id: expectedDriverId,
            updated_at: new Date().toISOString()
          })
          .eq('id', v.id);
        if (updErr) console.error(`  Error updating vehicle ${v.id}:`, updErr.message);
        else console.log('  Updated successfully.');
      }
    } else {
      console.log(`Vehicle "${v.vehicle_code}" (${v.id}) is CONSISTENT: status=${v.status}, driver=${v.assigned_driver_id}`);
    }
  }

  // 8. Final Audit Verification
  console.log('\n--- POST-RECONCILIATION FINAL VERIFICATION ---');
  const { data: finalDrivers } = await admin.from('drivers').select('id, display_name, status, assigned_vehicle_id');
  const { data: finalVehicles } = await admin.from('vehicles').select('id, vehicle_code, status, assigned_driver_id');
  const { data: finalActiveMissions } = await admin.from('missions').select('id, mission_code, driver_id, vehicle_id, status').in('status', ACTIVE_STATUSES);

  console.log('\nFINAL ACTIVE MISSIONS:');
  console.table(finalActiveMissions);

  console.log('\nFINAL DRIVERS:');
  console.table(finalDrivers);

  console.log('\nFINAL VEHICLES:');
  console.table(finalVehicles);

  const finalAvailableDrivers = (finalDrivers || []).filter(d => d.status === 'AVAILABLE');
  const finalAvailableVehicles = (finalVehicles || []).filter(v => v.status === 'AVAILABLE');

  console.log(`\nSUMMARY COUNTS:`);
  console.log(`Drivers:  ${finalDrivers?.length || 0} registered, ${finalAvailableDrivers.length} available`);
  console.log(`Vehicles: ${finalVehicles?.length || 0} registered, ${finalAvailableVehicles.length} available`);

  return {
    registeredDrivers: finalDrivers?.length || 0,
    availableDrivers: finalAvailableDrivers.length,
    registeredVehicles: finalVehicles?.length || 0,
    availableVehicles: finalAvailableVehicles.length,
    activeMissions: finalActiveMissions?.length || 0,
  };
}

// If executed directly
if (process.argv[1]?.endsWith('reconcile-fleet-state.mjs')) {
  const isDryRun = process.argv.includes('--dry-run');
  reconcileFleetState({ dryRun: isDryRun }).catch(console.error);
}
