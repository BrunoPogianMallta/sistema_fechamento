declare global {
  interface Window {
    google: any
  }
}

export interface DistanceResult {
  distanceKm: number
  roundTripKm: number
  duration: string
}

export interface RouteResult {
  totalDistanceKm: number
  optimizedOrder: number[]
  duration: string
  legs: Array<{
    distance: { value: number; text: string }
    duration: { value: number; text: string }
    startAddress: string
    endAddress: string
  }>
}

export class DistanceCalculator {
  private static instance: DistanceCalculator
  private isLoaded = false

  private constructor() {}

  static getInstance(): DistanceCalculator {
    if (!DistanceCalculator.instance) {
      DistanceCalculator.instance = new DistanceCalculator()
    }
    return DistanceCalculator.instance
  }

  async loadGoogleMapsAPI(): Promise<void> {
    if (this.isLoaded || window.google) {
      return
    }

    const config = localStorage.getItem("pizzariaConfig")
    const apiKey = config ? JSON.parse(config).googleMapsApiKey : ""

    if (!apiKey) {
      throw new Error("Google Maps API Key não configurada")
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places,directions`
      script.async = true
      script.defer = true

      script.onload = () => {
        this.isLoaded = true
        resolve()
      }

      script.onerror = () => {
        reject(new Error("Erro ao carregar Google Maps API"))
      }

      document.head.appendChild(script)
    })
  }

  async calculateDistance(destinationAddress: string): Promise<DistanceResult> {
    try {
      await this.loadGoogleMapsAPI()

      const config = localStorage.getItem("pizzariaConfig")
      const pizzariaAddress = config ? JSON.parse(config).address : "Rua Principal, 123, Centro"

      const service = new window.google.maps.DistanceMatrixService()

      return new Promise((resolve, reject) => {
        service.getDistanceMatrix(
          {
            origins: [pizzariaAddress],
            destinations: [destinationAddress],
            travelMode: window.google.maps.TravelMode.DRIVING,
            unitSystem: window.google.maps.UnitSystem.METRIC,
            avoidHighways: false,
            avoidTolls: false,
          },
          (response: any, status: any) => {
            if (status === "OK" && response.rows[0].elements[0].status === "OK") {
              const element = response.rows[0].elements[0]
              const distanceInMeters = element.distance.value
              const distanceKm = distanceInMeters / 1000
              const duration = element.duration.text

              resolve({
                distanceKm: distanceKm,
                roundTripKm: distanceKm * 2,
                duration: duration,
              })
            } else {
              reject(new Error("Não foi possível calcular a distância"))
            }
          },
        )
      })
    } catch (error) {
      console.error("Erro ao calcular distância:", error)
      throw error
    }
  }

  async calculateRoute(waypoints: string[]): Promise<RouteResult> {
    try {
      await this.loadGoogleMapsAPI()

      const config = localStorage.getItem("pizzariaConfig")
      const pizzariaAddress = config ? JSON.parse(config).address : "Rua Principal, 123, Centro"

      const directionsService = new window.google.maps.DirectionsService()

      return new Promise((resolve, reject) => {
        directionsService.route(
          {
            origin: pizzariaAddress,
            destination: pizzariaAddress,
            waypoints: waypoints.slice(1, -1).map(address => ({
              location: address,
              stopover: true
            })),
            optimizeWaypoints: true,
            travelMode: window.google.maps.TravelMode.DRIVING,
            unitSystem: window.google.maps.UnitSystem.METRIC
          },
          (response, status) => {
            if (status === "OK") {
              const route = response.routes[0]
              const totalDistance = route.legs.reduce(
                (sum, leg) => sum + (leg.distance?.value || 0),
                0
              ) / 1000

              const legsDetails = route.legs.map(leg => ({
                distance: leg.distance,
                duration: leg.duration,
                startAddress: leg.start_address,
                endAddress: leg.end_address
              }))

              resolve({
                totalDistanceKm: totalDistance,
                optimizedOrder: route.waypoint_order,
                duration: route.legs[0].duration?.text || "Desconhecido",
                legs: legsDetails
              })
            } else {
              reject(new Error(`Não foi possível calcular a rota: ${status}`))
            }
          }
        )
      })
    } catch (error) {
      console.error("Erro ao calcular rota:", error)
      throw error
    }
  }
          }
