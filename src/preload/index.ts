import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/types'

const api: IpcApi = {
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    create: (data) => ipcRenderer.invoke('accounts:create', data),
    update: (id, data) => ipcRenderer.invoke('accounts:update', id, data),
    archive: (id) => ipcRenderer.invoke('accounts:archive', id),
    unarchive: (id) => ipcRenderer.invoke('accounts:unarchive', id),
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (data) => ipcRenderer.invoke('categories:create', data),
    update: (id, data) => ipcRenderer.invoke('categories:update', id, data),
    archive: (id) => ipcRenderer.invoke('categories:archive', id),
    unarchive: (id) => ipcRenderer.invoke('categories:unarchive', id),
  },
  transactions: {
    list: (filters) => ipcRenderer.invoke('transactions:list', filters),
    create: (data) => ipcRenderer.invoke('transactions:create', data),
    update: (id, data) => ipcRenderer.invoke('transactions:update', id, data),
    delete: (id) => ipcRenderer.invoke('transactions:delete', id),
  },
  recurringRules: {
    list: () => ipcRenderer.invoke('recurring-rules:list'),
    create: (data) => ipcRenderer.invoke('recurring-rules:create', data),
    update: (id, data) => ipcRenderer.invoke('recurring-rules:update', id, data),
    delete: (id) => ipcRenderer.invoke('recurring-rules:delete', id),
  },
}

contextBridge.exposeInMainWorld('api', api)
