"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { MapPin, Save } from "lucide-react"
import { usePizzariaConfig } from "@/hooks/usePizzariaConfig"
import { supabase } from "@/lib/supabaseClient"

const FIXED_CONFIG_ID = "7fb78137-ee32-4598-b9b3-eeaf9b63329e"

export function PizzariaConfig() {
  const { config, loading, error, setConfig } = usePizzariaConfig()
  const [formData, setFormData] = useState({
    address: "",
    googleMapsApiKey: "",
  })
  const { toast } = useToast()

  useEffect(() => {
    if (config) {
      setFormData({
        address: config.address,
        googleMapsApiKey: config.googleMapsApiKey,
      })
    }
  }, [config])

  const handleSave = async () => {
    const { error: updateError } = await supabase
      .from("config")
      .update({
        pizzaria_address: formData.address,
        google_maps_api_key: formData.googleMapsApiKey,
        updated_at: new Date().toISOString(),
      })
      .eq("id", FIXED_CONFIG_ID)

    if (updateError) {
      console.error("Erro ao salvar config:", updateError)
      toast({
        title: "Erro",
        description: "Falha ao salvar as configurações.",
        variant: "destructive",
      })
      return
    }

    const updatedConfig = {
      address: formData.address,
      googleMapsApiKey: formData.googleMapsApiKey,
    }

    localStorage.setItem("pizzariaConfig", JSON.stringify(updatedConfig))
    setConfig(updatedConfig)

    toast({
      title: "Sucesso",
      description: "Configurações salvas com sucesso!",
    })
  }

  if (loading) return <p>Carregando configurações...</p>
  if (error) return <p className="text-red-500">{error}</p>

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Configurações da Pizzaria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address">Endereço da Pizzaria</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Rua, número, bairro, cidade"
          />
          <p className="text-xs text-muted-foreground">
            Este endereço será usado como ponto de partida para calcular as distâncias
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">Google Maps API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={formData.googleMapsApiKey}
            onChange={(e) => setFormData({ ...formData, googleMapsApiKey: e.target.value })}
            placeholder="Sua chave da API do Google Maps"
          />
          <p className="text-xs text-muted-foreground">
            Necessária para calcular distâncias automaticamente.{" "}
            <a
              href="https://developers.google.com/maps/documentation/javascript/get-api-key"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Como obter uma chave API
            </a>
          </p>
        </div>

        <Button onClick={handleSave} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Salvar Configurações
        </Button>
      </CardContent>
    </Card>
  )
}
