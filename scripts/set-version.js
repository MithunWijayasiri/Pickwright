#!/usr/bin/env node
// Sync a release version into package.json, src/manifest.json, and package-lock.json.
// Usage: node scripts/set-version.js <version>   (a leading "v" is stripped)
const fs = require('fs');
const path = require('path');

function normalizeVersion(raw) {
  const version = raw.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version "${raw}" — expected semver like 1.2.3`);
  }
  return version;
}

// package-lock.json (lockfileVersion 3) repeats the version in two places.
function setVersion(version, { packageJsonPath, manifestJsonPath, packageLockJsonPath }) {
  for (const file of [packageJsonPath, manifestJsonPath]) {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    json.version = version;
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  }

  const lockJson = JSON.parse(fs.readFileSync(packageLockJsonPath, 'utf8'));
  lockJson.version = version;
  if (lockJson.packages && lockJson.packages['']) {
    lockJson.packages[''].version = version;
  }
  fs.writeFileSync(packageLockJsonPath, JSON.stringify(lockJson, null, 2) + '\n');
}

module.exports = { normalizeVersion, setVersion };

if (require.main === module) {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: node scripts/set-version.js <version>');
    process.exit(1);
  }

  let version;
  try {
    version = normalizeVersion(raw);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const files = {
    packageJsonPath: path.resolve(__dirname, '../package.json'),
    manifestJsonPath: path.resolve(__dirname, '../src/manifest.json'),
    packageLockJsonPath: path.resolve(__dirname, '../package-lock.json'),
  };

  setVersion(version, files);
  console.log(`Updated package.json → ${version}`);
  console.log(`Updated manifest.json → ${version}`);
  console.log(`Updated package-lock.json → ${version}`);
}
