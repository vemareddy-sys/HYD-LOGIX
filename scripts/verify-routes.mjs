const routes = [
  '/',
  '/login',
  '/signup',
  '/unauthorized',
  '/control',
  '/control/orders',
  '/control/missions',
  '/control/live',
  '/control/fleet',
  '/control/intelligence',
  '/control/lab',
  '/control/analytics',
  '/control/twin',
  '/driver',
  '/driver/missions',
  '/driver/incidents',
  '/driver/logs'
];

async function checkRoutes() {
  console.log('=== ROUTE VERIFICATION SUITE ===');
  for (const route of routes) {
    const res = await fetch(`http://localhost:5173${route}`);
    console.log(`GET ${route.padEnd(25)} -> Status ${res.status}`);
  }
}

checkRoutes().catch(console.error);
