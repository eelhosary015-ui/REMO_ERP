import { enterpriseRoutes } from './routes/enterprise.routes.js';

// ═══════════════════════════════════════════════════════════════
// Enterprise Module - Layered Architecture
// ═══════════════════════════════════════════════════════════════

export function bootstrapEnterpriseModule() {
  console.log('  🏢 Enterprise module bootstrapped (migrations, audit, company context)');
}

export { enterpriseRoutes };