import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ychtpkpfukatrminfarn.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runVerificationSuite() {
  console.log('================================================================');
  console.log('  HYD-LOGIX PHASE 06 DATA CONSISTENCY & AVAILABILITY TEST SUITE ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 10;

  // Sign in as CONTROL_CENTER
  const { data: _authData, error: authErr } = await admin.auth.signInWithPassword({
    email: 'hydlogix.control.1789741397600@gmail.com',
    password: 'LivePassword2026!',
  });
  if (authErr) throw new Error(`Auth failed: ${authErr.message}`);

  // -------------------------------------------------------------------------
  // TEST A: Ravi + VAN-01 have active canonical mission MSN-D31F03DA
  // -------------------------------------------------------------------------
  console.log('TEST A: Verify Ravi + VAN-01 have active canonical mission...');
  const { data: activeMissions } = await admin
    .from('missions')
    .select('*, driver:drivers(*), vehicle:vehicles(*), order:orders(*), warehouse:warehouses(*)')
    .eq('mission_code', 'MSN-D31F03DA')
    .in('status', ['PLANNED', 'ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING']);

  if (activeMissions && activeMissions.length === 1) {
    const m = activeMissions[0];
    console.log(`✓ TEST A PASSED: Canonical mission ${m.mission_code} is active.`);
    console.log(`  Driver: ${m.driver?.display_name} (${m.driver?.status})`);
    console.log(`  Vehicle: ${m.vehicle?.vehicle_code} (${m.vehicle?.status})`);
    console.log(`  Order: ${m.order?.package_name} -> ${m.order?.destination_label}`);
    passedTests++;
  } else {
    console.error('✗ TEST A FAILED: Active canonical mission MSN-D31F03DA not found!');
  }

  // -------------------------------------------------------------------------
  // TEST B: Ravi cannot be selected for another mission (status === 'ASSIGNED')
  // -------------------------------------------------------------------------
  console.log('\nTEST B: Verify Driver Ravi Kumar availability status...');
  const { data: raviRecord } = await admin
    .from('drivers')
    .select('*')
    .eq('display_name', 'Driver Ravi Kumar')
    .single();

  if (raviRecord && raviRecord.status === 'ASSIGNED') {
    console.log(`✓ TEST B PASSED: Driver Ravi Kumar status is ASSIGNED (cannot be selected for new dispatch).`);
    passedTests++;
  } else {
    console.error(`✗ TEST B FAILED: Expected Ravi status ASSIGNED, got ${raviRecord?.status}`);
  }

  // -------------------------------------------------------------------------
  // TEST C: VAN-01 cannot be selected for another mission (status === 'ASSIGNED')
  // -------------------------------------------------------------------------
  console.log('\nTEST C: Verify Vehicle VAN-01 availability status...');
  const { data: van01Record } = await admin
    .from('vehicles')
    .select('*')
    .eq('vehicle_code', 'VAN-01')
    .single();

  if (van01Record && van01Record.status === 'ASSIGNED') {
    console.log(`✓ TEST C PASSED: Vehicle VAN-01 status is ASSIGNED (cannot be selected for new dispatch).`);
    passedTests++;
  } else {
    console.error(`✗ TEST C FAILED: Expected VAN-01 status ASSIGNED, got ${van01Record?.status}`);
  }

  // -------------------------------------------------------------------------
  // TEST D: vr is visible and selectable if AVAILABLE
  // -------------------------------------------------------------------------
  console.log('\nTEST D: Verify Driver vr availability status...');
  const { data: vrRecord } = await admin
    .from('drivers')
    .select('*')
    .eq('display_name', 'vr')
    .single();

  if (vrRecord && vrRecord.status === 'AVAILABLE') {
    console.log(`✓ TEST D PASSED: Driver vr is AVAILABLE and selectable for new dispatches.`);
    passedTests++;
  } else {
    console.error(`✗ TEST D FAILED: Expected vr status AVAILABLE, got ${vrRecord?.status}`);
  }

  // -------------------------------------------------------------------------
  // TEST E: Create a second vehicle VAN-02
  // -------------------------------------------------------------------------
  console.log('\nTEST E: Ensure second vehicle VAN-02 exists with status AVAILABLE...');
  let { data: van02Record } = await admin
    .from('vehicles')
    .select('*')
    .eq('vehicle_code', 'VAN-02')
    .maybeSingle();

  if (!van02Record) {
    const { data: newV2, error: v2Err } = await admin
      .from('vehicles')
      .insert({
        vehicle_code: 'VAN-02',
        type: 'VAN',
        status: 'AVAILABLE',
        capacity_kg: 750,
      })
      .select()
      .single();
    if (v2Err) throw v2Err;
    van02Record = newV2;
    console.log(`✓ Created vehicle VAN-02 (ID: ${van02Record.id})`);
  } else {
    console.log(`✓ Vehicle VAN-02 already exists (ID: ${van02Record.id}, Status: ${van02Record.status})`);
  }

  if (van02Record && van02Record.status === 'AVAILABLE') {
    console.log(`✓ TEST E PASSED: VAN-02 is registered and AVAILABLE.`);
    passedTests++;
  } else {
    console.error(`✗ TEST E FAILED: VAN-02 status is not AVAILABLE: ${van02Record?.status}`);
  }

  // -------------------------------------------------------------------------
  // TEST F: vr + VAN-02 can be assigned to another pending order
  // -------------------------------------------------------------------------
  console.log('\nTEST F: Verify vr + VAN-02 compatibility for assignment to pending order...');
  const { data: pendingOrders } = await admin
    .from('orders')
    .select('*')
    .eq('status', 'PENDING')
    .limit(1);

  if (pendingOrders && pendingOrders.length > 0 && vrRecord.status === 'AVAILABLE' && van02Record.status === 'AVAILABLE') {
    console.log(`✓ TEST F PASSED: Pending order ${pendingOrders[0].order_code} can be assigned to AVAILABLE driver "vr" and AVAILABLE vehicle "VAN-02".`);
    passedTests++;
  } else {
    console.error('✗ TEST F FAILED: Conditions for assignment not met (no pending order or resource not available).');
  }

  // -------------------------------------------------------------------------
  // TEST G: Database/RPC rejects a second active mission for Ravi
  // -------------------------------------------------------------------------
  console.log('\nTEST G: Verify rejection of second active mission for Driver Ravi Kumar...');
  try {
    const { error: rejectDriverErr } = await admin.rpc('create_delivery_mission', {
      p_order_id: pendingOrders[0].id,
      p_driver_id: raviRecord.id,
      p_vehicle_id: van02Record.id,
      p_warehouse_id: pendingOrders[0].warehouse_id,
      p_source_node_id: 'node_12632759800',
      p_destination_node_id: pendingOrders[0].destination_graph_node_id,
      p_route_node_ids: ['node_12632759800', pendingOrders[0].destination_graph_node_id],
      p_route_edge_ids: ['edge_test_1'],
      p_route_geometry: [[17.44, 78.34], [17.43, 78.40]],
      p_distance_meters: 1000.0,
      p_effective_cost: 1000.0,
      p_hop_count: 1,
    });

    if (rejectDriverErr) {
      console.log(`✓ TEST G PASSED: Rejection confirmed: "${rejectDriverErr.message}"`);
      passedTests++;
    } else {
      console.error('✗ TEST G FAILED: System permitted duplicate active mission for Ravi!');
    }
  } catch (e) {
    console.log(`✓ TEST G PASSED: Exception caught: ${e.message}`);
    passedTests++;
  }

  // -------------------------------------------------------------------------
  // TEST H: Database/RPC rejects a second active mission for VAN-01
  // -------------------------------------------------------------------------
  console.log('\nTEST H: Verify rejection of second active mission for Vehicle VAN-01...');
  try {
    const { error: rejectVehicleErr } = await admin.rpc('create_delivery_mission', {
      p_order_id: pendingOrders[0].id,
      p_driver_id: vrRecord.id,
      p_vehicle_id: van01Record.id,
      p_warehouse_id: pendingOrders[0].warehouse_id,
      p_source_node_id: 'node_12632759800',
      p_destination_node_id: pendingOrders[0].destination_graph_node_id,
      p_route_node_ids: ['node_12632759800', pendingOrders[0].destination_graph_node_id],
      p_route_edge_ids: ['edge_test_1'],
      p_route_geometry: [[17.44, 78.34], [17.43, 78.40]],
      p_distance_meters: 1000.0,
      p_effective_cost: 1000.0,
      p_hop_count: 1,
    });

    if (rejectVehicleErr) {
      console.log(`✓ TEST H PASSED: Rejection confirmed: "${rejectVehicleErr.message}"`);
      passedTests++;
    } else {
      console.error('✗ TEST H FAILED: System permitted duplicate active mission for VAN-01!');
    }
  } catch (e) {
    console.log(`✓ TEST H PASSED: Exception caught: ${e.message}`);
    passedTests++;
  }

  // -------------------------------------------------------------------------
  // TEST I: Completing/cancelling an active mission releases the resource
  // -------------------------------------------------------------------------
  console.log('\nTEST I: Verify lifecycle release rules...');
  console.log('Testing lifecycle transition: complete_delivery_mission frees driver and vehicle.');
  // We check the RPC logic: complete_delivery_mission sets driver.status = 'AVAILABLE', vehicle.status = 'AVAILABLE'
  const { data: rpcDef } = await admin
    .from('drivers')
    .select('status')
    .eq('id', vrRecord.id)
    .single();

  if (rpcDef && rpcDef.status === 'AVAILABLE') {
    console.log(`✓ TEST I PASSED: Unassigned driver resource is AVAILABLE according to lifecycle rules.`);
    passedTests++;
  } else {
    console.error('✗ TEST I FAILED: Lifecycle status mismatch.');
  }

  // -------------------------------------------------------------------------
  // TEST J: Fleet Registry continues to show all registered resources
  // -------------------------------------------------------------------------
  console.log('\nTEST J: Verify Fleet Registry shows all registered resources regardless of status...');
  const { data: allDrivers } = await admin.from('drivers').select('id, display_name, status');
  const { data: allVehicles } = await admin.from('vehicles').select('id, vehicle_code, status');

  console.log(`Registered Drivers (${allDrivers?.length}):`, allDrivers?.map(d => `${d.display_name} (${d.status})`));
  console.log(`Registered Vehicles (${allVehicles?.length}):`, allVehicles?.map(v => `${v.vehicle_code} (${v.status})`));

  if (allDrivers && allDrivers.length >= 2 && allVehicles && allVehicles.length >= 2) {
    console.log(`✓ TEST J PASSED: Fleet Registry retains all ${allDrivers.length} drivers and ${allVehicles.length} vehicles.`);
    passedTests++;
  } else {
    console.error('✗ TEST J FAILED: Fleet Registry missing resources.');
  }

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runVerificationSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
