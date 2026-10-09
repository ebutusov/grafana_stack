/**
 * Node-RED runtime settings (mounted read-only at /data/settings.js by docker-compose).
 * Secrets come from environment variables - nothing sensitive lives in this file.
 */

// bcryptjs ships with Node-RED, but /data/settings.js cannot resolve it by name.
const bcrypt = require(require.resolve('bcryptjs', {
  paths: ['/usr/src/node-red', '/usr/src/node-red/node_modules/node-red']
}));

const adminPassword = process.env.NODE_RED_ADMIN_PASSWORD;
if (!adminPassword || !process.env.NODE_RED_CREDENTIAL_SECRET) {
  throw new Error('NODE_RED_ADMIN_PASSWORD and NODE_RED_CREDENTIAL_SECRET must be set');
}

module.exports = {
  flowFile: 'flows.json',
  flowFilePretty: true,                       // readable diffs if you export/commit flows

  // Encrypts flows_cred.json at rest. Keep this value stable, or stored credentials become unreadable.
  credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET,

  uiPort: process.env.PORT || 1880,

  // Served under /nodered/ behind the nginx gateway
  httpAdminRoot: '/nodered',

  // Editor / admin API authentication (the editor is reachable from the network).
  adminAuth: {
    type: 'credentials',
    users: [{
      username: process.env.NODE_RED_ADMIN_USER || 'admin',
      password: bcrypt.hashSync(adminPassword, 8),
      permissions: '*'
    }]
  },

  // Function-node hygiene
  functionTimeout: 5,                         // seconds; kills runaway code
  functionExternalModules: false,             // no arbitrary npm imports from function nodes
  exportGlobalContextKeys: false,

  // Keep context in memory; swap for the localfilesystem store if counters must survive restarts.
  contextStorage: { default: { module: 'memory' } },

  editorTheme: {
    projects: { enabled: false }              // flows live in the volume, not in git projects
  },

  logging: {
    console: { level: 'info', metrics: false, audit: false }
  }
};
