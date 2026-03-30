#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(projectRoot, 'src', 'index.ts');
const distDir = path.join(projectRoot, 'dist');
const distPath = path.join(distDir, 'index.js');

if (!fs.existsSync(sourcePath)) {
  console.error(`Source file not found at ${sourcePath}`);
  process.exit(1);
}

fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(sourcePath, distPath);
fs.chmodSync(distPath, 0o755);
console.log(`Copied ${sourcePath} -> ${distPath}`);
