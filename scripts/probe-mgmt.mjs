const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function testManagement() {
  const res = await fetch('https://api.supabase.com/v1/projects/ychtpkpfukatrminfarn/database/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: 'SELECT 1;' })
  });
  console.log('Management API status:', res.status, await res.text());
}

testManagement();
