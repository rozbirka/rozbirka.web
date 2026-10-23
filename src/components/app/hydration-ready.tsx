import { useEffect } from 'react'

export function HydrationReady() {
  useEffect(() => {
    document.getElementById('root')?.setAttribute('data-app-hydrated', 'true')
  }, [])
  return null
}
