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
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`
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
}
