const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  setOpenAtLogin: (on) => ipcRenderer.invoke('app:setOpenAtLogin', on),
  getOpenAtLogin: () => ipcRenderer.invoke('app:getOpenAtLogin'),
  testNotification: () => ipcRenderer.invoke('app:testNotification'),
  updateInfo: () => ipcRenderer.invoke('update:info'),
  updateSet: (cfg) => ipcRenderer.invoke('update:set', cfg),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  reload: () => ipcRenderer.invoke('update:reload'),
  onUpdateReady: (cb) => ipcRenderer.on('update:ready', (_e, r) => cb(r))
});
