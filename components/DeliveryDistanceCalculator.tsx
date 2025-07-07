// components/DeliveryDistanceCalculator.tsx
"use client"

import React, { useEffect, useState } from "react"

interface DeliveryDistanceCalculatorProps {
  originAddress: string
  destinationAddress: string
}

interface DistanceResult {
  idaKm: number
  voltaKm: number
  totalKm: number
  durationText: string
  distanceText: string
  error?: string
}

export function DeliveryDistanceCalculator({
  originAddress,
  destinationAddress,
}: DeliveryDistanceCalculatorProps) {
  const [result, setResult] = useState<DistanceResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!originAddress || !destinationAddress) return
    if (!window.google?.maps?.DistanceMatrixService) return

    setLoading(true)
    setResult(null)

    const service = new window.google.maps.DistanceMatrixService()

    service.getDistanceMatrix(
      {
        origins: [originAddress],
        destinations: [destinationAddress],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
      },
      (
        response: google.maps.DistanceMatrixResponse | null,
        status: google.maps.DistanceMatrixStatus
      ) => {
        if (status !== "OK" || !response) {
          setResult({
            idaKm: 0,
            voltaKm: 0,
            totalKm: 0,
            durationText: "",
            distanceText: "",
            error: "Falha ao obter distância (ida).",
          })
          setLoading(false)
          return
        }

        const element = response.rows[0].elements[0]
        if (element.status !== "OK") {
          setResult({
            idaKm: 0,
            voltaKm: 0,
            totalKm: 0,
            durationText: "",
            distanceText: "",
            error: "Endereço de origem ou destino inválido (ida).",
          })
          setLoading(false)
          return
        }

        const idaMeters = element.distance.value
        const idaKm = idaMeters / 1000

        const serviceReturn = new window.google.maps.DistanceMatrixService()
        serviceReturn.getDistanceMatrix(
          {
            origins: [destinationAddress],
            destinations: [originAddress],
            travelMode: window.google.maps.TravelMode.DRIVING,
            unitSystem: window.google.maps.UnitSystem.METRIC,
          },
          (
            responseReturn: google.maps.DistanceMatrixResponse | null,
            statusReturn: google.maps.DistanceMatrixStatus
          ) => {
            if (statusReturn !== "OK" || !responseReturn) {
              setResult({
                idaKm,
                voltaKm: 0,
                totalKm: idaKm,
                durationText: element.duration.text,
                distanceText: element.distance.text,
                error: "Falha ao obter distância (volta).",
              })
              setLoading(false)
              return
            }

            const elementReturn = responseReturn.rows[0].elements[0]
            if (elementReturn.status !== "OK") {
              setResult({
                idaKm,
                voltaKm: 0,
                totalKm: idaKm,
                durationText: element.duration.text,
                distanceText: element.distance.text,
                error: "Endereço inválido (volta).",
              })
              setLoading(false)
              return
            }

            const voltaMeters = elementReturn.distance.value
            const voltaKm = voltaMeters / 1000
            const totalKm = idaKm + voltaKm

            setResult({
              idaKm,
              voltaKm,
              totalKm,
              durationText: element.duration.text,
              distanceText: element.distance.text,
            })
            setLoading(false)
          }
        )
      }
    )
  }, [originAddress, destinationAddress])

  if (loading) return <p>Calculando distância...</p>
  if (!result) return null

  if (result.error)
    return <p className="text-red-600 font-semibold">Erro: {result.error}</p>

  return (
    <div>
      <p>Distância de ida: <strong>{result.idaKm.toFixed(2)} km</strong></p>
      <p>Distância de volta: <strong>{result.voltaKm.toFixed(2)} km</strong></p>
      <p>Distância total (ida + volta): <strong>{result.totalKm.toFixed(2)} km</strong></p>
      <p>Duração aproximada da ida: {result.durationText}</p>
      <p>Distância aproximada da ida: {result.distanceText}</p>
    </div>
  )
}
