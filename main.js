const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC handlers for file operations
ipcMain.handle('read-excel', async (event, filePath) => {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);
  const data = {};
  workbook.SheetNames.forEach(sheetName => {
    data[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
  });
  return data;
});

ipcMain.handle('write-excel', async (event, data, filePath) => {
  const XLSX = require('xlsx');
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filePath);
  return true;
});

ipcMain.handle('show-open-dialog', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
      { name: 'SQL Files', extensions: ['sql'] }
    ]
  });
  return result;
});

ipcMain.handle('show-save-dialog', async (event, defaultName) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: 'SQL Files', extensions: ['sql'] },
      { name: 'Excel Files', extensions: ['xlsx'] }
    ]
  });
  return result;
});