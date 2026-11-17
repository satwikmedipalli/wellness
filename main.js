// Wellness — Electron main process
// Stores everything in one JSON file in the app's data folder and
// fires a Mac notification when a block with an alert starts.
const { app, BrowserWindow, ipcMain, Notification, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const updater = require('./updater');

const DATA_FILE = () => path.join(app.getPath('userData'), 'wellness-data.json');
let win = null;
const fired = new Set(); // "YYYY-MM-DD|blockId" already notified this run

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE(), 'utf8')); } catch { return null; }
}

function writeData(data) {
  const file = DATA_FILE();
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#131714' : '#EFF0EA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(updater.entry());
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

// ---- notifications -------------------------------------------------------
function pad(n) { return String(n).padStart(2, '0'); }
function localDateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

function checkAlerts() {
  const data = readData();
  if (!data || !data.days) return;
  const now = new Date();
  const key = localDateKey(now);
  const day = data.days[key];
  if (!day || !day.blocks) return;
  const hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  for (const b of day.blocks) {
    if (!b.alert || !b.start) continue;
    const id = key + '|' + b.id;
    if (fired.has(id)) continue;
    if (b.start === hm) {
      fired.add(id);
      const time = formatTime(b.start) + (b.end ? ' – ' + formatTime(b.end) : '');
      const body = b.kind === 'choice' ? time + ' · pick what you’ll do' : time;
      if (Notification.isSupported()) {
        const n = new Notification({ title: b.title, body, silent: false });
        n.on('click', () => { if (win) { win.show(); win.focus(); } else { createWindow(); } });
        n.show();
      }
    }
  }
}

function formatTime(hm) {
  const [h, m] = hm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return h12 + ':' + pad(m) + ' ' + ap;
}

async function runUpdateCheck() {
  const r = await updater.check();
  if (r.status === 'updated' && win && !win.isDestroyed()) win.webContents.send('update:ready', r);
  return r;
}

// ---- app lifecycle -------------------------------------------------------
app.setName('Wellness');

app.whenReady().then(() => {
  ipcMain.handle('data:load', () => readData());
  ipcMain.handle('data:save', (_e, data) => { writeData(data); return true; });
  ipcMain.handle('app:setOpenAtLogin', (_e, on) => { app.setLoginItemSettings({ openAtLogin: !!on }); return app.getLoginItemSettings().openAtLogin; });
  ipcMain.handle('app:getOpenAtLogin', () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle('app:testNotification', () => {
    if (Notification.isSupported()) new Notification({ title: 'Wellness', body: 'Notifications are working.' }).show();
    return Notification.isSupported();
  });

  ipcMain.handle('update:info', () => updater.info());
  ipcMain.handle('update:set', (_e, cfg) => updater.setConfig(cfg || {}));
  ipcMain.handle('update:check', () => runUpdateCheck());
  ipcMain.handle('update:reload', () => { if (win) win.loadFile(updater.entry()); return true; });

  createWindow();

  // look for new versions on GitHub shortly after launch, then every 3 hours
  setTimeout(runUpdateCheck, 8 * 1000);
  setInterval(runUpdateCheck, 3 * 60 * 60 * 1000);

  // check every 15 seconds so an alert lands within the right minute
  setInterval(checkAlerts, 15 * 1000);
  checkAlerts();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

// On the Mac, closing the window keeps Wellness running so alerts still fire.
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
