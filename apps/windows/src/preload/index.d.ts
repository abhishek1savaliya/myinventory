import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    myinventory: {
      platform: NodeJS.Platform
    }
  }
}

export {}
