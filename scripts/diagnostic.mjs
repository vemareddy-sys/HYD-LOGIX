import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ychtpkpfukatrminfarn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3GCZ0UqoVt-bCJzYU6fAIQ_ckZAKZGm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runDiagnostic() {
  // Sign in as CONTROL_CENTER
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'hydlogix.control.1789741397600@gmail.com',
    password: 'LivePassword2026!',
  });

  if (authErr) {
    console.error('Auth error:', authErr);
    return;
  }

  console.log('Logged in as CONTROL_CENTER:', authData.user?.email);

  // 1. ALL DRIVERS
  const { data: drivers, error: dErr } = await supabase
    .from('drivers')
    .select('id, display_name, status, assigned_vehicle_id, profile_id')
    .order('created_at', { ascending: false });
  if (dErr) console.error('Drivers error:', dErr);

  console.log('\n--- ALL DRIVERS ---');
  console.table(drivers);

  // 2. ALL VEHICLES
  const { data: vehicles, error: vErr } = await supabase
    .from('vehicles')
    .select('id, vehicle_code, status, assigned_driver_id, type, capacity_kg')
    .order('created_at', { ascending: false });
  if (vErr) console.error('Vehicles error:', vErr);

  console.log('\n--- ALL VEHICLES ---');
  console.table(vehicles);

  // 3. ALL ACTIVE MISSIONS
  const { data: missions, error: mErr } = await supabase
    .from('missions')
    .select('id, mission_code, driver_id, vehicle_id, status, order_id, warehouse_id')
    .in('status', ['ASSIGNED', 'READY', 'IN_TRANSIT', 'REROUTING'])
    .order('created_at', { ascending: false });
  if (mErr) console.error('Missions error:', mErr);

  console.log('\n--- ALL ACTIVE MISSIONS ---');
  console.table(missions);

  // 4. ORDERS
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('id, order_code, package_name, status')
    .order('created_at', { ascending: false });
  if (oErr) console.error('Orders error:', oErr);

  console.log('\n--- ALL ORDERS ---');
  console.table(orders);

  // Also test driver isolation
  await supabase.auth.signOut();

  // Sign in as Ravi Kumar
  const { data: _raviAuth, error: raviAuthErr } = await supabase.auth.signInWithPassword({
    email: 'hydlogix.driver.1789741397600@gmail.com',
    password: 'LivePassword2026!',
  });
  if (raviAuthErr) console.error('Ravi auth error:', raviAuthErr);
  else {
    const { data: raviMissions } = await supabase
      .from('missions')
      .select('id, mission_code, status');
    console.log('\n--- RAVI DRIVER ACCOUNT MISSIONS (RLS TEST) ---');
    console.table(raviMissions);
  }
  await supabase.auth.signOut();

  // Sign in as vr
  const { data: _vrAuth, error: vrAuthErr } = await supabase.auth.signInWithPassword({
    email: 'vema413@gmail.com',
    password: 'LivePassword2026!',
  });
  if (vrAuthErr) console.error('vr auth error:', vrAuthErr);
  else {
    const { data: vrMissions } = await supabase
      .from('missions')
      .select('id, mission_code, status');
    console.log('\n--- VR DRIVER ACCOUNT MISSIONS (RLS TEST) ---');
    console.table(vrMissions);
  }
}

runDiagnostic();
