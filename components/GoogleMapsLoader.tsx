// components/GoogleMapsLoader.tsx
"use client"

import { useEffect, useState } from "react"

export function GoogleMapsLoader({ apiKey }: { apiKey: string }) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    if (window.google?.maps) {
      setLoaded(true)
      return
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.onload = () => setLoaded(true)
    document.head.appendChild(script)
  }, [apiKey])

  if (!loaded) return <p>Carregando Google Maps...</p>
  return null
}
