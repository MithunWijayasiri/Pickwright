#!/usr/bin/env node
// Sync a release version into package.json, src/manifest.json, and package-lock.json.
// Usage: node scripts/set-version.js <version>   (a leading "v" is stripped)
const fs = require('fs');
const path = require('path');

const raw = process.argv[2];
if (!raw) {
  console.error('Usage: node scripts/set-version.js <version>');
  process.exit(1);
}

const version = raw.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version "${raw}" — expected semver like 1.2.3`);
  process.exit(1);
}

const targets = [
  path.resolve(__dirname, '../package.json'),
  path.resolve(__dirname, '../src/manifest.json'),
];

for (const file of targets) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.version = version;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  console.log(`Updated ${path.basename(file)} → ${version}`);
}

// package-lock.json (lockfileVersion 3) repeats the version in two places.
const lockfile = path.resolve(__dirname, '../package-lock.json');
const lockJson = JSON.parse(fs.readFileSync(lockfile, 'utf8'));
lockJson.version = version;
if (lockJson.packages && lockJson.packages['']) {
  lockJson.packages[''].version = version;
}
fs.writeFileSync(lockfile, JSON.stringify(lockJson, null, 2) + '\n');
console.log(`Updated ${path.basename(lockfile)} → ${version}`);
