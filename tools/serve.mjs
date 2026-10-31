// An app's server alone (no desktop window): open the page in a browser to build and test.
//   node tools/serve.mjs <app> [--mock]      e.g. node tools/serve.mjs hello --mock
// Then open http://127.0.0.1:<port>/ (the port from app.json). Stop with Ctrl+C.
import { appDir, args } from './common.mjs';
import { createAppServer } from '../core/server.js';

const a = args();
const dir = appDir(a._[0]);
const server = await createAppServer({ appDir: dir, mock: a.mock ? true : undefined });
const { port } = await server.start();
console.log(`open http://127.0.0.1:${port}/`);
process.on('SIGINT', () => { server.stop(); process.exit(0); });
