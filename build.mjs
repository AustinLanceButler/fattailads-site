// Build app.js from src/ — mirrors the hand pipeline exactly.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const order = ['1', '2', '3', '4', '5', '6', '7', '8_inline'];
const concat = order.map(n => readFileSync(`src/${n}.jsx`, 'utf8') + '\n;\n').join('');
writeFileSync('concat.jsx', concat);
mkdirSync('dist', { recursive: true });
execSync('./node_modules/.bin/esbuild concat.jsx --loader:.jsx=jsx --jsx=transform --minify --target=es2018 --outfile=dist/app.js', { stdio: 'inherit' });
copyFileSync('index.html', 'dist/index.html');
console.log('build complete: dist/app.js + dist/index.html');
