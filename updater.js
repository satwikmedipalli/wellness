// Wellness — self-updater for the app's screens and logic.
// The installed app carries a copy of src/. When GitHub has a newer
// src/version.json, the files it lists are downloaded into the app's
// data folder and loaded from there from then on. Your data is never touched.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const pkg = require('./package.json');

const CFG = pkg.wellness || {};
const SHELL = CFG.shell || 1;
const bundledDir = path.join(__dirname, 'src');
const uiDir = () => path.join(app.getPath('userData'), 'ui');
const cfgFile = () => path.join(app.getPath('userData'), 'updater.json');

function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function settings() { return readJSON(cfgFile()) || {}; }
function saveSettings(s) { fs.mkdirSync(path.dirname(cfgFile()), { recursive: true }); fs.writeFileSync(cfgFile(), JSON.stringify(s, null, 2)); }
function repo() { return settings().repo || CFG.repo || ''; }
function configured() { return /^[\w.-]+\/[\w.-]+$/.test(repo()) && !repo().startsWith('OWNER/'); }

function bundledVersion() { return (readJSON(path.join(bundledDir, 'version.json')) || { version: 0 }).version; }
function downloadedVersion() {
  const v = readJSON(path.join(uiDir(), 'version.json'));
  if (!v || (v.minShell || 0) > SHELL || !fs.existsSync(path.join(uiDir(), 'index.html'))) return 0;
  return v.version;
}
function currentVersion() { return Math.max(bundledVersion(), downloadedVersion()); }
function entry() {
  return downloadedVersion() > bundledVersion() ? path.join(uiDir(), 'index.html') : path.join(bundledDir, 'index.html');
}

async function getFile(p) {
  const url = `https://api.github.com/repos/${repo()}/contents/${p}?ref=${encodeURIComponent(CFG.branch || 'main')}`;
  const headers = { Accept: 'application/vnd.github.raw', 'User-Agent': 'Wellness-app' };
  const token = settings().token;
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(res.status === 404 ? 'not found (is the repo private? add a token in Settings)' : 'GitHub said ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

let busy = false;
async function check() {
  if (!configured()) return { status: 'not-configured', version: currentVersion() };
  if (busy) return { status: 'busy', version: currentVersion() };
  busy = true;
  try {
    const remote = JSON.parse((await getFile('src/version.json')).toString('utf8'));
    const cur = currentVersion();
    if (!remote.version || remote.version <= cur) return { status: 'current', version: cur };
    if ((remote.minShell || 0) > SHELL) return { status: 'needs-rebuild', version: cur, remote: remote.version };
    const files = Array.isArray(remote.files) ? remote.files : [];
    if (!files.includes('index.html') || files.some((f) => !/^[\w.-]+$/.test(f))) throw new Error('update file list looks wrong');
    const tmp = uiDir() + '-new';
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(tmp, f), await getFile('src/' + f));
    const old = uiDir() + '-old';
    fs.rmSync(old, { recursive: true, force: true });
    if (fs.existsSync(uiDir())) fs.renameSync(uiDir(), old);
    fs.renameSync(tmp, uiDir());
    fs.rmSync(old, { recursive: true, force: true });
    return { status: 'updated', version: remote.version };
  } catch (e) {
    return { status: 'error', version: currentVersion(), error: String(e.message || e) };
  } finally {
    busy = false;
  }
}

function info() { const s = settings(); return { repo: repo(), configured: configured(), hasToken: !!s.token, version: currentVersion(), shell: SHELL }; }
function setConfig({ repo: r, token }) {
  const s = settings();
  if (typeof r === 'string') s.repo = r.trim();
  if (typeof token === 'string') { if (token.trim()) s.token = token.trim(); else delete s.token; }
  saveSettings(s);
  return info();
}

module.exports = { entry, check, info, setConfig, currentVersion };
