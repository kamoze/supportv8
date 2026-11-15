// Runs after the inherited loopback network guard, so mapped fixture requests
// still pass through that guard. No production module imports this launcher.
require('./standalone-registry-transport.cjs');
require(require('node:path').join(process.cwd(), '.next/standalone/server.js'));
