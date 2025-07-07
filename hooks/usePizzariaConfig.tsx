import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export interface PizzariaConfig {
  googleMapsApiKey: string
  address: string
}

const FIXED_CONFIG_ID = "7fb78137-ee32-4598-b9b3-eeaf9b63329e"

export function usePizzariaConfig() {
  const [config, setConfig] = useState<PizzariaConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from("config")
        .select("google_maps_api_key, pizzaria_address")
        .eq("id", FIXED_CONFIG_ID)
        .single()

      if (error) {
        console.error("Erro ao buscar config:", error.message)
        setError("Erro ao buscar configurações.")
        setLoading(false)
        return
      }

      if (data) {
        const config: PizzariaConfig = {
          googleMapsApiKey: data.google_maps_api_key,
          address: data.pizzaria_address,
        }

        setConfig(config)
        localStorage.setItem("pizzariaConfig", JSON.stringify(config))
      }

      setLoading(false)
    }

    fetchConfig()
  }, [])

  return { config, loading, error, setConfig }
}
