const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readExcel: (filePath) => ipcRenderer.invoke('read-excel', filePath),
  writeExcel: (data, filePath) => ipcRenderer.invoke('write-excel', data, filePath),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showSaveDialog: (defaultName) => ipcRenderer.invoke('show-save-dialog', defaultName)
});