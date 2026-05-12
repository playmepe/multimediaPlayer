const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('get-displays'),
                                getSources: () => ipcRenderer.invoke('get-sources'),
                                addSource: (s) => ipcRenderer.invoke('add-source', s),
                                updateSource: (s) => ipcRenderer.invoke('update-source', s),
                                removeSource: (id) => ipcRenderer.invoke('remove-source', id),
                                openOnDisplay: (id, url) => ipcRenderer.invoke('open-on-display', id, url),
                                closeProjectionOn: (id) => ipcRenderer.invoke('close-projection-on', id),
                                closeAllProjections: () => ipcRenderer.invoke('close-all-projections'),
                                previewURL: (url) => ipcRenderer.invoke('preview-url', url),
                                onDisplaysChanged: (cb) => ipcRenderer.on('displays-changed', cb),
                                onProjectionClosed: (cb) => ipcRenderer.on('projection-closed', (e, data) => cb(data)),
                                onProjectionOpened: (cb) => ipcRenderer.on('projection-opened', (e, data) => cb(data))
});
