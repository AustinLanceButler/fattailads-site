// Build app.js from src/ — mirrors the hand pipeline exactly.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const order = ['1', '2', '3', '4', '5', '6', '7', '8_inline'];
const concat = order.map(n => readFileSync(`src/${n}.jsx`, 'utf8') + '\n;\n').join('');
writeFileSync('concat.jsx', concat);
mkdirSync('dist', { recursive: true });
execSync('./node_modules/.bin/esbuild concat.jsx --loader:.jsx=jsx --jsx=transform --minify --target=es2018 --outfile=dist/app.js', { stdio: 'inherit' });
copyFileSync('index.html', 'dist/index.html');
// Standalone, unlisted booking page → served at /meet (dist/meet/index.html).
mkdirSync('dist/meet', { recursive: true });
copyFileSync('meet.html', 'dist/meet/index.html');
// Standalone, unlisted client-access page → served at /connect (dist/connect/index.html).
mkdirSync('dist/connect', { recursive: true });
copyFileSync('connect.html', 'dist/connect/index.html');
// Beta client-access wizard (Google sign-in for GA4/GTM) → /connect/beta. Unlisted, noindex;
// /connect itself still embeds Leadsie until cutover.
mkdirSync('dist/connect/beta', { recursive: true });
copyFileSync('connect-beta.html', 'dist/connect/beta/index.html');
// Phase 1 client-access wizard (all platforms, agency + guided) → /connect/v2 (unlisted, noindex),
// and the admin dashboard → /connect/admin (noindex, frame-denied via vercel.json).
mkdirSync('dist/connect/v2', { recursive: true });
copyFileSync('connect-v2.html', 'dist/connect/v2/index.html');
mkdirSync('dist/connect/admin', { recursive: true });
copyFileSync('connect-admin.html', 'dist/connect/admin/index.html');
// Public page describing FTA Connect and its Google API use → /connect/about (crawlable;
// the Google Cloud branding "home page" for the FTA ops app).
mkdirSync('dist/connect/about', { recursive: true });
copyFileSync('connect-about.html', 'dist/connect/about/index.html');
// Standalone legal pages → /privacy and /terms (crawlable; linked from the site footer).
mkdirSync('dist/privacy', { recursive: true });
copyFileSync('privacy.html', 'dist/privacy/index.html');
mkdirSync('dist/terms', { recursive: true });
copyFileSync('terms.html', 'dist/terms/index.html');
console.log('build complete: dist/app.js + dist/index.html + dist/{meet,connect,connect/beta,connect/v2,connect/admin,connect/about,privacy,terms}/index.html');
