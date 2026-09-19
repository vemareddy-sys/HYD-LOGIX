const SUPABASE_URL = 'https://ychtpkpfukatrminfarn.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Test if /pg or /sql or management API exists
async function testSql() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': SECRET_KEY,
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('RPC endpoint status:', res.status, await res.text());
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

testSql();
