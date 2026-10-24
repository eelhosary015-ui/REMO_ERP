import { pool } from './server-db.ts';
import { initDb } from './server-db-init.ts';

(async () => {
  try {
    await initDb(pool);
    console.log('Database schema successfully initialized/patched!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
})();
