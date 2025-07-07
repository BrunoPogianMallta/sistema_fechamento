"use client"

import { useEffect, useState } from "react"

interface Props {
  originAddress: string
  destinationAddress: string
  onDistanceCalculated?: (distanceKm: number) => void
}

export default function DeliveryDistanceCalculator({
  originAddress,
  destinationAddress,
  onDistanceCalculated,
}: Props) {
  const [distanceKm, setDistanceKm] = useState<number | null>(null)

  useEffect(() => {
    async function fetchDistance() {
      if (!originAddress || !destinationAddress) return

      console.log("Calculando distância de:")
      console.log("Origem:", originAddress)
      console.log("Destino:", destinationAddress)

      try {
        const apiKey = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY
        const url = `https://api.openrouteservice.org/v2/directions/driving-car`

        // Geocodificar os endereços
        const geocode = async (address: string) => {
          const geoUrl = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(
            address
          )}`
          const res = await fetch(geoUrl)
          const data = await res.json()
          const [lon, lat] = data.features[0].geometry.coordinates
          return [lon, lat] // ORS usa [lon, lat]
        }

        const originCoords = await geocode(originAddress)
        const destCoords = await geocode(destinationAddress)

        const body = {
          coordinates: [originCoords, destCoords],
        }

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: apiKey!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        const data = await response.json()
        const meters = data.features[0].properties.segments[0].distance
        const km = meters / 1000
        const roundedKm = Math.round(km * 10) / 10

        console.log("Distância calculada:", roundedKm, "km")

        if (roundedKm > 0 && roundedKm < 100) {
          setDistanceKm(roundedKm)
          onDistanceCalculated?.(roundedKm)
        } else {
          console.warn("Distância fora do esperado:", roundedKm)
        }
      } catch (err) {
        console.error("Erro ao calcular distância:", err)
      }
    }

    fetchDistance()
  }, [originAddress, destinationAddress, onDistanceCalculated])

  return (
    <span className="text-sm text-gray-600">
      {distanceKm ? `${distanceKm.toFixed(1)} km` : "Calculando..."}
    </span>
  )
}
