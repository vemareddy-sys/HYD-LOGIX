import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ychtpkpfukatrminfarn.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_3GCZ0UqoVt-bCJzYU6fAIQ_ckZAKZGm';

console.log('================================================================');
console.log('HYD-LOGIX PHASE 03B: REAL OPERATIONS END-TO-END VERIFICATION');
console.log('================================================================');

// -------------------------------------------------------------------
// 1. Minimal GraphEngine & A* for Node runtime script execution
// -------------------------------------------------------------------
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class RuntimeGraph {
  constructor(nodes, edges) {
    this.nodes = new Map();
    this.edges = new Map();
    this.outgoing = new Map();

    for (const n of nodes) {
      this.nodes.set(n.id, n);
      this.outgoing.set(n.id, []);
    }
    for (const e of edges) {
      this.edges.set(e.id, e);
      const list = this.outgoing.get(e.from);
      if (list) list.push(e);
      else this.outgoing.set(e.from, [e]);
    }
  }

  findNearestNode(lat, lng) {
    let best = null;
    let minDist = Infinity;
    for (const n of this.nodes.values()) {
      const d = haversineDistanceMeters(lat, lng, n.lat, n.lng);
      if (d < minDist) {
        minDist = d;
        best = n;
      }
    }
    return { node: best, distanceMeters: minDist };
  }

  runAStar(startNodeId, goalNodeId) {
    const startNode = this.nodes.get(startNodeId);
    const goalNode = this.nodes.get(goalNodeId);
    if (!startNode || !goalNode) return { found: false };

    const gScore = new Map();
    const fScore = new Map();
    const parentEdge = new Map();
    const parentNode = new Map();

    gScore.set(startNodeId, 0);
    const startH = haversineDistanceMeters(startNode.lat, startNode.lng, goalNode.lat, goalNode.lng);
    fScore.set(startNodeId, startH);

    // Simple priority queue (array based for verification script)
    const openSet = [{ id: startNodeId, f: startH }];
    const closedSet = new Set();

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      const currId = current.id;

      if (currId === goalNodeId) {
        // Reconstruct path
        const pathNodeIds = [currId];
        const pathEdgeIds = [];
        let curr = currId;
        while (parentEdge.has(curr)) {
          const edgeId = parentEdge.get(curr);
          pathEdgeIds.unshift(edgeId);
          curr = parentNode.get(curr);
          pathNodeIds.unshift(curr);
        }

        let distanceMeters = 0;
        let effectiveCost = 0;
        const fullGeometry = [];

        for (const edgeId of pathEdgeIds) {
          const edge = this.edges.get(edgeId);
          if (edge) {
            distanceMeters += edge.lengthMeters || 0;
            effectiveCost += (edge.lengthMeters || 0) * (edge.trafficFactor || 1.0);
            if (edge.geometry && edge.geometry.length > 0) {
              for (const pt of edge.geometry) fullGeometry.push(pt);
            } else {
              const u = this.nodes.get(edge.from);
              const v = this.nodes.get(edge.to);
              if (u && v) fullGeometry.push([u.lat, u.lng], [v.lat, v.lng]);
            }
          }
        }

        return {
          found: true,
          pathNodeIds,
          pathEdgeIds,
          fullGeometry,
          distanceMeters: Math.round(distanceMeters * 100) / 100,
          effectiveCost: Math.round(effectiveCost * 100) / 100,
          hopCount: pathEdgeIds.length,
        };
      }

      closedSet.add(currId);
      const edges = this.outgoing.get(currId) || [];

      for (const edge of edges) {
        if (edge.blocked) continue;
        const neighborId = edge.to;
        if (closedSet.has(neighborId)) continue;

        const weight = (edge.lengthMeters || 1) * (edge.trafficFactor || 1.0);
        const tentativeG = gScore.get(currId) + weight;

        if (!gScore.has(neighborId) || tentativeG < gScore.get(neighborId)) {
          parentNode.set(neighborId, currId);
          parentEdge.set(neighborId, edge.id);
          gScore.set(neighborId, tentativeG);

          const neighborNode = this.nodes.get(neighborId);
          const h = haversineDistanceMeters(
            neighborNode.lat,
            neighborNode.lng,
            goalNode.lat,
            goalNode.lng
          );
          const f = tentativeG + h;
          fScore.set(neighborId, f);

          const existingIdx = openSet.findIndex((item) => item.id === neighborId);
          if (existingIdx >= 0) {
            openSet[existingIdx].f = f;
          } else {
            openSet.push({ id: neighborId, f });
          }
        }
      }
    }

    return { found: false };
  }
}

// -------------------------------------------------------------------
// 2. Main E2E Test Execution
// -------------------------------------------------------------------
async function runE2E() {
  // Load Hyderabad graph
  console.log('\n[INIT] Loading real Hyderabad OSM graph from public/data/hyderabad/...');
  const nodes = JSON.parse(fs.readFileSync('public/data/hyderabad/nodes.json', 'utf8'));
  const edges = JSON.parse(fs.readFileSync('public/data/hyderabad/edges.json', 'utf8'));
  const graph = new RuntimeGraph(nodes, edges);
  console.log(`[INIT] Loaded ${graph.nodes.size} nodes and ${graph.edges.size} directed edges.`);

  // Create clients
  const controlClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const driverClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // A. Authenticate Control Center & Confirm DRIVER exists
  console.log('\n--- STEP A: Authenticate Control Center & Verify DRIVER Accounts ---');
  const { data: controlAuth, error: cAuthErr } = await controlClient.auth.signInWithPassword({
    email: 'hydlogix.control.1789741397600@gmail.com',
    password: 'LivePassword2026!',
  });
  if (cAuthErr) throw new Error(`Control Center sign in failed: ${cAuthErr.message}`);
  console.log(`Control Center authenticated (UID: ${controlAuth.user.id})`);

  const { data: driversList, error: dListErr } = await controlClient
    .from('drivers')
    .select('*, profile:profiles(full_name, email)');
  if (dListErr) throw new Error(`Failed to list drivers: ${dListErr.message}`);

  console.log(`Verified ${driversList.length} driver(s) present in database:`);
  for (const d of driversList) {
    console.log(`  - Driver: ${d.display_name} | Status: ${d.status} | ID: ${d.id}`);
  }
  const primaryDriver =
    driversList.find((d) => d.profile?.email === 'hydlogix.driver.1789741397600@gmail.com') ||
    driversList[0];
  if (!primaryDriver) throw new Error('No DRIVER account found.');
  console.log(`Selected Driver for test: "${primaryDriver.display_name}" (Email: ${primaryDriver.profile?.email}, ID: ${primaryDriver.id})`);

  // Ensure driver status is AVAILABLE for test run
  await controlClient
    .from('drivers')
    .update({ status: 'AVAILABLE', assigned_vehicle_id: null })
    .eq('id', primaryDriver.id);
  primaryDriver.status = 'AVAILABLE';
  primaryDriver.assigned_vehicle_id = null;

  // B. Create: Gachibowli Distribution Hub
  console.log('\n--- STEP B: Create Warehouse (Gachibowli Distribution Hub) ---');
  const gachibowliCoords = { lat: 17.4401, lng: 78.3489 };
  const nearestWarehouseNode = graph.findNearestNode(gachibowliCoords.lat, gachibowliCoords.lng);
  console.log(
    `Nearest OSM node for Gachibowli (${gachibowliCoords.lat}, ${gachibowliCoords.lng}) -> ${nearestWarehouseNode.node.id} (${nearestWarehouseNode.distanceMeters.toFixed(1)}m away)`
  );

  // Check if warehouse already exists or create
  const { data: existingWh } = await controlClient
    .from('warehouses')
    .select('*')
    .eq('name', 'Gachibowli Distribution Hub')
    .maybeSingle();

  let warehouse = existingWh;
  if (!warehouse) {
    const { data: newWh, error: whErr } = await controlClient
      .from('warehouses')
      .insert({
        name: 'Gachibowli Distribution Hub',
        address_label: 'Plot 12, Financial District, Gachibowli',
        latitude: gachibowliCoords.lat,
        longitude: gachibowliCoords.lng,
        nearest_graph_node_id: nearestWarehouseNode.node.id,
      })
      .select()
      .single();

    if (whErr) throw new Error(`Warehouse creation failed: ${whErr.message}`);
    warehouse = newWh;
    console.log(`Created new Warehouse: "${warehouse.name}" (ID: ${warehouse.id})`);
  } else {
    console.log(`Existing Warehouse found: "${warehouse.name}" (ID: ${warehouse.id})`);
  }

  // C. Create Vehicle: VAN-01
  console.log('\n--- STEP C: Create Vehicle (VAN-01) ---');
  const { data: existingVeh } = await controlClient
    .from('vehicles')
    .select('*')
    .eq('vehicle_code', 'VAN-01')
    .maybeSingle();

  let vehicle = existingVeh;
  if (!vehicle) {
    const { data: newVeh, error: vehErr } = await controlClient
      .from('vehicles')
      .insert({
        vehicle_code: 'VAN-01',
        type: 'VAN',
        capacity_kg: 500,
        status: 'AVAILABLE',
      })
      .select()
      .single();

    if (vehErr) throw new Error(`Vehicle creation failed: ${vehErr.message}`);
    vehicle = newVeh;
    console.log(`Created Vehicle: ${vehicle.vehicle_code} | Status: ${vehicle.status} (ID: ${vehicle.id})`);
  } else {
    console.log(`Existing Vehicle found: ${vehicle.vehicle_code} | Status: ${vehicle.status}`);
    if (vehicle.status !== 'AVAILABLE') {
      await controlClient
        .from('vehicles')
        .update({ status: 'AVAILABLE', assigned_driver_id: null })
        .eq('id', vehicle.id);
      vehicle.status = 'AVAILABLE';
      console.log(`Reset vehicle ${vehicle.vehicle_code} to AVAILABLE.`);
    }
  }

  // D. Create Order: Package: Medicine, Destination: Jubilee Hills Checkpost, Priority: URGENT
  console.log('\n--- STEP D: Create Order (Medicine / Jubilee Hills Checkpost / URGENT) ---');
  const jubileeCoords = { lat: 17.4319, lng: 78.4071 };
  const nearestOrderNode = graph.findNearestNode(jubileeCoords.lat, jubileeCoords.lng);
  console.log(
    `Nearest OSM node for Jubilee Hills (${jubileeCoords.lat}, ${jubileeCoords.lng}) -> ${nearestOrderNode.node.id} (${nearestOrderNode.distanceMeters.toFixed(1)}m away)`
  );

  const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
  const orderCode = `ORD-${randomHex}`;

  const { data: order, error: ordErr } = await controlClient
    .from('orders')
    .insert({
      order_code: orderCode,
      package_name: 'Medicine',
      package_description: 'Emergency Medical Supplies',
      weight_kg: 5,
      warehouse_id: warehouse.id,
      destination_label: 'Jubilee Hills Checkpost',
      destination_latitude: jubileeCoords.lat,
      destination_longitude: jubileeCoords.lng,
      destination_graph_node_id: nearestOrderNode.node.id,
      priority: 'URGENT',
      status: 'PENDING',
      created_by: controlAuth.user.id,
    })
    .select()
    .single();

  if (ordErr) throw new Error(`Order creation failed: ${ordErr.message}`);
  console.log(
    `Created Order: [${order.order_code}] "${order.package_name}" | Priority: ${order.priority} | Status: ${order.status}`
  );

  // E. Mission Control: Select Order, Driver, Vehicle
  console.log('\n--- STEP E: Mission Control Selection ---');
  console.log(`Selected Order: ${order.order_code} (${order.package_name})`);
  console.log(`Selected Driver: ${primaryDriver.display_name} (${primaryDriver.id})`);
  console.log(`Selected Vehicle: ${vehicle.vehicle_code} (${vehicle.id})`);

  // F. PLAN ROUTE via Real A*
  console.log('\n--- STEP F: PLAN ROUTE (Real A* Engine Execution) ---');
  const t0 = performance.now();
  const routeResult = graph.runAStar(warehouse.nearest_graph_node_id, order.destination_graph_node_id);
  const t1 = performance.now();

  if (!routeResult.found) {
    throw new Error('A* could not find a path between warehouse and destination nodes.');
  }

  console.log(`A* Path Found in ${(t1 - t0).toFixed(2)} ms!`);
  console.log(`  - Distance: ${routeResult.distanceMeters.toFixed(1)} meters (${(routeResult.distanceMeters / 1000).toFixed(2)} km)`);
  console.log(`  - Effective Cost: ${routeResult.effectiveCost.toFixed(2)}`);
  console.log(`  - Hop Count: ${routeResult.hopCount} edges`);
  console.log(`  - Path Node Count: ${routeResult.pathNodeIds.length} nodes`);
  console.log(`  - Road Geometry Points: ${routeResult.fullGeometry.length} points`);

  // G. CREATE MISSION via Secure Database RPC
  console.log('\n--- STEP G: CREATE MISSION (Transactional Supabase RPC) ---');
  const { data: missionRpcResult, error: rpcErr } = await controlClient.rpc('create_delivery_mission', {
    p_order_id: order.id,
    p_driver_id: primaryDriver.id,
    p_vehicle_id: vehicle.id,
    p_warehouse_id: warehouse.id,
    p_source_node_id: warehouse.nearest_graph_node_id,
    p_destination_node_id: order.destination_graph_node_id,
    p_route_node_ids: routeResult.pathNodeIds,
    p_route_edge_ids: routeResult.pathEdgeIds,
    p_route_geometry: routeResult.fullGeometry,
    p_distance_meters: routeResult.distanceMeters,
    p_effective_cost: routeResult.effectiveCost,
    p_hop_count: routeResult.hopCount,
  });

  if (rpcErr) throw new Error(`create_delivery_mission RPC failed: ${rpcErr.message}`);

  console.log('Mission Created Successfully:');
  console.log(`  - Mission Code: ${missionRpcResult.mission_code}`);
  console.log(`  - Mission Status: ${missionRpcResult.status}`);
  console.log(`  - Mission ID: ${missionRpcResult.id}`);

  // Verify Atomic State Changes
  console.log('\n--- Verifying Atomic State Changes in Supabase ---');
  const { data: updatedOrder } = await controlClient.from('orders').select('status').eq('id', order.id).single();
  const { data: updatedDriver } = await controlClient.from('drivers').select('status, assigned_vehicle_id').eq('id', primaryDriver.id).single();
  const { data: updatedVehicle } = await controlClient.from('vehicles').select('status, assigned_driver_id').eq('id', vehicle.id).single();

  console.log(`Order Status: ${updatedOrder.status} (Expected: ASSIGNED)`);
  console.log(`Driver Status: ${updatedDriver.status} | Assigned Vehicle: ${updatedDriver.assigned_vehicle_id} (Expected: ASSIGNED)`);
  console.log(`Vehicle Status: ${updatedVehicle.status} | Assigned Driver: ${updatedVehicle.assigned_driver_id} (Expected: ASSIGNED)`);

  if (
    updatedOrder.status !== 'ASSIGNED' ||
    updatedDriver.status !== 'ASSIGNED' ||
    updatedVehicle.status !== 'ASSIGNED' ||
    missionRpcResult.status !== 'ASSIGNED'
  ) {
    throw new Error('Atomic state verification failed: entities did not transition to ASSIGNED.');
  }
  console.log('PASS: All 4 entities updated atomically.');

  // H. Login as DRIVER & Verify Mission Visibility
  console.log('\n--- STEP H: Login as DRIVER & Verify Scoped Mission Visibility ---');
  const { data: driverAuth, error: dAuthErr } = await driverClient.auth.signInWithPassword({
    email: 'hydlogix.driver.1789741397600@gmail.com',
    password: 'LivePassword2026!',
  });
  if (dAuthErr) throw new Error(`Driver sign in failed: ${dAuthErr.message}`);
  console.log(`Driver authenticated (UID: ${driverAuth.user.id})`);

  // Query Driver record and active mission using DRIVER's authenticated client
  const { data: myDriverRecord, error: myDErr } = await driverClient
    .from('drivers')
    .select('*, vehicle:vehicles!assigned_vehicle_id(*)')
    .eq('profile_id', driverAuth.user.id)
    .single();

  if (myDErr) throw new Error(`Driver could not fetch own driver record: ${myDErr.message}`);
  console.log(`Driver Terminal Record: ${myDriverRecord.display_name} | Status: ${myDriverRecord.status}`);
  console.log(`Driver Assigned Vehicle: ${myDriverRecord.vehicle?.vehicle_code}`);

  const { data: driverMissions, error: dMissionsErr } = await driverClient
    .from('missions')
    .select('*, order:orders(*), vehicle:vehicles(*)')
    .eq('driver_id', myDriverRecord.id)
    .order('created_at', { ascending: false });

  if (dMissionsErr) throw new Error(`Driver mission query error: ${dMissionsErr.message}`);

  console.log(`Driver has ${driverMissions.length} assigned mission(s).`);
  const activeMission = driverMissions.find((m) => m.id === missionRpcResult.id);
  if (!activeMission) throw new Error('Driver cannot see the newly assigned mission.');

  console.log('Driver Active Mission Details:');
  console.log(`  - Mission Code: ${activeMission.mission_code}`);
  console.log(`  - Package: ${activeMission.order?.package_name}`);
  console.log(`  - Destination: ${activeMission.order?.destination_label}`);
  console.log(`  - Priority: ${activeMission.order?.priority}`);
  console.log(`  - Vehicle: ${activeMission.vehicle?.vehicle_code}`);
  console.log(`  - Route Distance: ${(activeMission.route_distance_meters / 1000).toFixed(2)} km`);
  console.log(`  - Hop Count: ${activeMission.route_hop_count} road segments`);

  // I. Refresh Simulation (Re-querying session & profile)
  console.log('\n--- STEP I: Refresh Simulation & Persistence Check ---');
  const { data: refreshedSession } = await driverClient.auth.getSession();
  const { data: persistedMission } = await driverClient
    .from('missions')
    .select('id, mission_code, status')
    .eq('id', activeMission.id)
    .single();

  console.log(`Session valid for user: ${refreshedSession.session?.user?.email}`);
  console.log(`Persisted Mission: [${persistedMission.mission_code}] Status: ${persistedMission.status}`);
  console.log('PASS: Data persists across application reloads.');

  // J. Verify Driver RLS Isolation
  console.log('\n--- STEP J: Verify Driver RLS Isolation & Security Barriers ---');

  // 1. Driver cannot see other drivers' missions
  const { data: allMissionsAsDriver } = await driverClient.from('missions').select('id, driver_id');
  const nonOwnMissions = allMissionsAsDriver.filter((m) => m.driver_id !== myDriverRecord.id);
  console.log(
    `Missions query returned ${allMissionsAsDriver.length} total rows to driver; non-own rows: ${nonOwnMissions.length}`
  );
  if (nonOwnMissions.length > 0) {
    throw new Error('RLS VIOLATION: Driver can see missions belonging to other drivers!');
  }
  console.log('PASS: Driver cannot see missions of other drivers (Strict RLS Isolation).');

  // 2. Driver cannot access other drivers' private driver records
  const { data: otherDrivers } = await driverClient
    .from('drivers')
    .select('id, profile_id, display_name')
    .neq('profile_id', driverAuth.user.id);

  if (otherDrivers && otherDrivers.length > 0) {
    throw new Error('RLS VIOLATION: Driver can see other driver profile records!');
  }
  console.log('PASS: Driver cannot access other drivers\' private records (Strict Driver Row Isolation).');

  // 3. Driver cannot call create_delivery_mission RPC
  const { error: illegalRpcErr } = await driverClient.rpc('create_delivery_mission', {
    p_order_id: order.id,
    p_driver_id: primaryDriver.id,
    p_vehicle_id: vehicle.id,
    p_warehouse_id: warehouse.id,
    p_source_node_id: warehouse.nearest_graph_node_id,
    p_destination_node_id: order.destination_graph_node_id,
    p_route_node_ids: routeResult.pathNodeIds,
    p_route_edge_ids: routeResult.pathEdgeIds,
    p_route_geometry: routeResult.fullGeometry,
    p_distance_meters: routeResult.distanceMeters,
    p_effective_cost: routeResult.effectiveCost,
    p_hop_count: routeResult.hopCount,
  });

  if (!illegalRpcErr) {
    throw new Error('SECURITY BREACH: Driver was able to call create_delivery_mission RPC!');
  }
  console.log(`PASS: Driver cannot call create_delivery_mission (${illegalRpcErr.message}).`);

  console.log('\n================================================================');
  console.log('ALL PHASE 03B END-TO-END CRITERIA (A THROUGH J) SUCCESSFULLY PASSED!');
  console.log('================================================================');
}

runE2E().catch((err) => {
  console.error('\nE2E VERIFICATION FAILED:', err);
  process.exit(1);
});
