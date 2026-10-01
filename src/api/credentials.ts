type Listener = () => void

const clearLegacyAuthStorage = () => {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem('rozbirka.accessToken')
  window.localStorage.removeItem('rozbirka.refreshToken')
}

clearLegacyAuthStorage()

let accessToken: string | null = null
let sessionGeneration = 0
const clearListeners = new Set<Listener>()

export const credentials = {
  getAccess(): string | null {
    return accessToken
  },

  getSessionGeneration(): number {
    return sessionGeneration
  },

  startSession(token: string) {
    sessionGeneration += 1
    accessToken = token
  },

  setAccess(token: string) {
    accessToken = token
  },

  clear() {
    sessionGeneration += 1
    const hadAccessToken = accessToken !== null
    accessToken = null

    if (hadAccessToken) {
      clearListeners.forEach((listener) => listener())
    }
  },

  onCleared(listener: Listener): () => void {
    clearListeners.add(listener)
    return () => clearListeners.delete(listener)
  },
}
