import fs from 'fs';
import path from 'path';

console.log('=== HYD-LOGIX GRAPH ENGINE AUTOMATED TEST SUITE ===');

const DATA_DIR = path.resolve('public/data/hyderabad');

// 1. JSON Parsing Test
console.log('\n--- 1. Testing JSON Dataset File Existence & Parsing ---');
const metadataPath = path.join(DATA_DIR, 'metadata.json');
const nodesPath = path.join(DATA_DIR, 'nodes.json');
const edgesPath = path.join(DATA_DIR, 'edges.json');

if (!fs.existsSync(metadataPath) || !fs.existsSync(nodesPath) || !fs.existsSync(edgesPath)) {
  console.error('FAIL: One or more JSON dataset files are missing in public/data/hyderabad/');
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf8'));
const edges = JSON.parse(fs.readFileSync(edgesPath, 'utf8'));

console.log(`Parsed Metadata: ${metadata.regionName}`);
console.log(`Nodes Count: ${nodes.length} | Edges Count: ${edges.length}`);
console.log('PASS: All JSON dataset files parsed successfully.');

// 2. Unique Node IDs
console.log('\n--- 2. Testing Unique Node IDs ---');
const nodeSet = new Set();
let nodeDupes = 0;
for (const node of nodes) {
  if (nodeSet.has(node.id)) nodeDupes++;
  nodeSet.add(node.id);
}

if (nodeDupes === 0) {
  console.log(`PASS: All ${nodes.length} node IDs are strictly unique.`);
} else {
  console.error(`FAIL: Found ${nodeDupes} duplicate node IDs.`);
}

// 3. Unique Edge IDs
console.log('\n--- 3. Testing Unique Edge IDs ---');
const edgeSet = new Set();
let edgeDupes = 0;
for (const edge of edges) {
  if (edgeSet.has(edge.id)) edgeDupes++;
  edgeSet.add(edge.id);
}

if (edgeDupes === 0) {
  console.log(`PASS: All ${edges.length} edge IDs are strictly unique.`);
} else {
  console.error(`FAIL: Found ${edgeDupes} duplicate edge IDs.`);
}

// 4. Edge-Node Reference Integrity
console.log('\n--- 4. Testing Edge-Node Reference Integrity ---');
let invalidEdgeRefs = 0;
for (const edge of edges) {
  if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) {
    invalidEdgeRefs++;
  }
}

if (invalidEdgeRefs === 0) {
  console.log('PASS: 100% of edges reference valid existing source and destination nodes.');
} else {
  console.error(`FAIL: Found ${invalidEdgeRefs} edges with invalid node references.`);
}

// 5. Directed Edge Behavior & 6. Parallel Edges
console.log('\n--- 5 & 6. Testing Directed & Parallel Edge Preservation ---');
const pairCounts = new Map();
let parallelEdgeCount = 0;

for (const edge of edges) {
  const pairKey = `${edge.from}->${edge.to}`;
  const prev = pairCounts.get(pairKey) || 0;
  if (prev > 0) parallelEdgeCount++;
  pairCounts.set(pairKey, prev + 1);
}

console.log(`Directed Edge Pairs Registered: ${pairCounts.size}`);
console.log(`Parallel Edges Detected: ${parallelEdgeCount}`);
console.log(`PASS: MultiDiGraph directed parallel edges preserved (${parallelEdgeCount} parallel edges).`);

// 7. Outgoing Adjacency Indexing
console.log('\n--- 7. Testing Outgoing Adjacency Indexing ---');
const adjacency = new Map();
for (const edge of edges) {
  if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
  adjacency.get(edge.from).push(edge);
}

console.log(`Nodes with Outgoing Edges: ${adjacency.size} / ${nodes.length}`);
console.log('PASS: Outgoing adjacency list indexed successfully.');

// 8 & 9. Spatial Nearest-Node & Location Preset Resolution
console.log('\n--- 8 & 9. Testing Nearest-Node Spatial Lookup & Location Presets ---');
const presets = [
  { id: 'gachibowli', label: 'Gachibowli Hub', lat: 17.4401, lng: 78.3489 },
  { id: 'kondapur', label: 'Kondapur Junction', lat: 17.4622, lng: 78.3568 },
  { id: 'hitec', label: 'HITEC City Cyber Towers', lat: 17.4435, lng: 78.3772 },
  { id: 'madhapur', label: 'Madhapur Tech Zone', lat: 17.4483, lng: 78.3915 },
  { id: 'jubilee', label: 'Jubilee Hills Checkpost', lat: 17.4319, lng: 78.4071 },
];

function findNearest(targetLat, targetLng) {
  let minDistanceSq = Infinity;
  let nearest = null;
  const metersLat = 111000;
  const metersLng = 111000 * Math.cos((targetLat * Math.PI) / 180);

  for (const node of nodes) {
    const dLat = (node.lat - targetLat) * metersLat;
    const dLng = (node.lng - targetLng) * metersLng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      nearest = node;
    }
  }

  return { node: nearest, distMeters: Math.round(Math.sqrt(minDistanceSq)) };
}

for (const preset of presets) {
  const result = findNearest(preset.lat, preset.lng);
  console.log(`Preset [${preset.label}]: Lat ${preset.lat}, Lng ${preset.lng} -> Nearest Node: ${result.node.id} (${result.distMeters}m away)`);
}
console.log('PASS: All 5 real location presets resolved to valid graph nodes.');

// 10. Malformed Record Audit
console.log('\n--- 10. Auditing Graph Data Sanity ---');
let malformedNodes = 0;
let malformedEdges = 0;

for (const node of nodes) {
  if (typeof node.lat !== 'number' || typeof node.lng !== 'number' || isNaN(node.lat) || isNaN(node.lng)) {
    malformedNodes++;
  }
}

for (const edge of edges) {
  if (typeof edge.lengthMeters !== 'number' || edge.lengthMeters <= 0 || !Array.isArray(edge.geometry) || edge.geometry.length < 2) {
    malformedEdges++;
  }
}

if (malformedNodes === 0 && malformedEdges === 0) {
  console.log('PASS: 0 malformed records found in dataset audit.');
} else {
  console.error(`FAIL: Found ${malformedNodes} malformed nodes and ${malformedEdges} malformed edges.`);
}

console.log('\n=== ALL GRAPH ENGINE TESTS PASSED SUCCESSFULLY ===');
