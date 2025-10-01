import { mkdirSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');

mkdirSync(dist, { recursive: true });

// Copy manifest
cpSync(resolve(root, 'src/manifest.json'), resolve(dist, 'manifest.json'));

// Copy popup HTML and CSS
cpSync(resolve(root, 'src/popup'), resolve(dist, 'popup'), { recursive: true });

// Copy static corpora
cpSync(resolve(root, 'corpus'), resolve(dist, 'corpus'), { recursive: true });

// Copy icons if present
const srcIcons = resolve(root, 'src/icons');
if (existsSync(srcIcons)) {
  cpSync(srcIcons, resolve(dist, 'icons'), { recursive: true });
}

// Patch manifest version if needed (noop here, but placeholder for future)
const manifestPath = resolve(dist, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('Static files copied to dist/.');
