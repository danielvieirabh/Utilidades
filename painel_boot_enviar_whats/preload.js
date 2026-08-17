const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendWhatsapp: (data) => ipcRenderer.send('send-whatsapp', data),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => {
        callback(value);
    }),
});