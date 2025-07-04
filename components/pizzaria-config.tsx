"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { MapPin, Save } from "lucide-react"

interface PizzariaConfig {
  address: string
  googleMapsApiKey: string
}

export function PizzariaConfig() {
  const [config, setConfig] = useState<PizzariaConfig>({
    address: "",
    googleMapsApiKey: "",
  })
  const { toast } = useToast()

  useEffect(() => {
    const savedConfig = localStorage.getItem("pizzariaConfig")
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig))
    } else {
      // Configuração padrão
      setConfig({
        address: "Rua Principal, 123, Centro",
        googleMapsApiKey: "",
      })
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem("pizzariaConfig", JSON.stringify(config))
    toast({
      title: "Sucesso",
      description: "Configurações salvas com sucesso!",
    })
  }

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
            value={config.address}
            onChange={(e) => setConfig({ ...config, address: e.target.value })}
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
            value={config.googleMapsApiKey}
            onChange={(e) => setConfig({ ...config, googleMapsApiKey: e.target.value })}
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
