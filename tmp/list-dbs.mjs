import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/postgres" });
await c.connect();
const dbs = await c.query("SELECT datname FROM pg_database WHERE datistemplate=false ORDER BY datname");
console.log("DATABASES:", dbs.rows.map(r=>r.datname).join(", "));
await c.end();
