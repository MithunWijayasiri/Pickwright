const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeVersion, setVersion } = require('./set-version.js');

function writeTempJson(dir, name, data) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return file;
}

test('normalizeVersion strips a leading v and validates semver', () => {
  assert.equal(normalizeVersion('v1.2.3'), '1.2.3');
  assert.equal(normalizeVersion('1.2.3'), '1.2.3');
  assert.throws(() => normalizeVersion('not-a-version'), /Invalid version/);
});

test('setVersion updates package.json, manifest.json, and both package-lock.json version fields', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-version-'));
  const packageJsonPath = writeTempJson(dir, 'package.json', { name: 'pickwright', version: '0.4.0' });
  const manifestJsonPath = writeTempJson(dir, 'manifest.json', { manifest_version: 3, version: '0.4.0' });
  const packageLockJsonPath = writeTempJson(dir, 'package-lock.json', {
    name: 'pickwright',
    version: '0.4.0',
    lockfileVersion: 3,
    packages: { '': { name: 'pickwright', version: '0.4.0' } },
  });

  setVersion('1.0.3', { packageJsonPath, manifestJsonPath, packageLockJsonPath });

  assert.equal(JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version, '1.0.3');
  assert.equal(JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8')).version, '1.0.3');
  const lockJson = JSON.parse(fs.readFileSync(packageLockJsonPath, 'utf8'));
  assert.equal(lockJson.version, '1.0.3');
  assert.equal(lockJson.packages[''].version, '1.0.3');

  fs.rmSync(dir, { recursive: true, force: true });
});
