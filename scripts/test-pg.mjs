import pg from 'pg';
const { Client } = pg;

const hosts = [
  'db.ychtpkpfukatrminfarn.supabase.co',
  'aws-0-ap-south-1.pooler.supabase.com'
];

async function tryConnect() {
  for (const host of hosts) {
    console.log(`Trying ${host}...`);
    const client = new Client({
      host,
      port: host.includes('pooler') ? 6543 : 5432,
      user: host.includes('pooler') ? 'postgres.ychtpkpfukatrminfarn' : 'postgres',
      password: 'LivePassword2026!',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    try {
      await client.connect();
      console.log(`Connected to ${host}!`);
      const res = await client.query('SELECT current_database(), current_user;');
      console.log('Query result:', res.rows);
      await client.end();
      return host;
    } catch (err) {
      console.log(`Failed on ${host}:`, err.message);
      try { await client.end(); } catch {}
    }
  }
  return null;
}

tryConnect().catch(console.error);
