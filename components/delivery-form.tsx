"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { MapPin, DollarSign, User } from "lucide-react"

interface Neighborhood {
  id: string
  name: string
  deliveryFee: number
}

interface Deliverer {
  id: string
  name: string
}

interface Delivery {
  id: string
  delivererId: string
  delivererName: string
  address: string
  neighborhood: string
  deliveryType: string
  orderValue: number
  deliveryFee: number
  timestamp: string
}

const DELIVERY_TYPES = [
  { value: "ifood", label: "iFood" },
  { value: "app", label: "App Próprio" },
  { value: "card", label: "Cartão" },
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
]

export function DeliveryForm() {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
  const [deliverers, setDeliverers] = useState<Deliverer[]>([])
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [formData, setFormData] = useState({
    delivererId: "",
    address: "",
    deliveryType: "",
    orderValue: "",
  })
  const { toast } = useToast()

  useEffect(() => {
    // Carregar bairros do localStorage
    const savedNeighborhoods = localStorage.getItem("neighborhoods")
    if (savedNeighborhoods) {
      setNeighborhoods(JSON.parse(savedNeighborhoods))
    }

    // Carregar entregadores do localStorage
    const savedDeliverers = localStorage.getItem("deliverers")
    if (savedDeliverers) {
      setDeliverers(JSON.parse(savedDeliverers))
    }
  }, [])

  useEffect(() => {
    // Atualizar taxa de entrega quando bairro for selecionado
    const neighborhood = neighborhoods.find((n) => n.name === selectedNeighborhood)
    if (neighborhood) {
      setDeliveryFee(neighborhood.deliveryFee)
    }
  }, [selectedNeighborhood, neighborhoods])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !formData.delivererId ||
      !formData.address ||
      !selectedNeighborhood ||
      !formData.deliveryType ||
      !formData.orderValue
    ) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      })
      return
    }

    const deliverer = deliverers.find((d) => d.id === formData.delivererId)
    if (!deliverer) return

    const delivery: Delivery = {
      id: Date.now().toString(),
      delivererId: formData.delivererId,
      delivererName: deliverer.name,
      address: formData.address,
      neighborhood: selectedNeighborhood,
      deliveryType: formData.deliveryType,
      orderValue: Number.parseFloat(formData.orderValue),
      deliveryFee: deliveryFee,
      timestamp: new Date().toISOString(),
    }

    // Salvar entrega no localStorage
    const savedDeliveries = localStorage.getItem("deliveries")
    const deliveries = savedDeliveries ? JSON.parse(savedDeliveries) : []
    deliveries.push(delivery)
    localStorage.setItem("deliveries", JSON.stringify(deliveries))

    toast({
      title: "Sucesso",
      description: "Entrega registrada com sucesso!",
    })

    // Limpar formulário
    setFormData({
      delivererId: "",
      address: "",
      deliveryType: "",
      orderValue: "",
    })
    setSelectedNeighborhood("")
    setDeliveryFee(0)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="deliverer">Entregador *</Label>
          <Select
            value={formData.delivererId}
            onValueChange={(value) => setFormData({ ...formData, delivererId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o entregador" />
            </SelectTrigger>
            <SelectContent>
              {deliverers.map((deliverer) => (
                <SelectItem key={deliverer.id} value={deliverer.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {deliverer.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deliveryType">Tipo de Entrega *</Label>
          <Select
            value={formData.deliveryType}
            onValueChange={(value) => setFormData({ ...formData, deliveryType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {DELIVERY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Endereço *</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Digite o endereço completo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="neighborhood">Bairro *</Label>
          <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o bairro" />
            </SelectTrigger>
            <SelectContent>
              {neighborhoods.map((neighborhood) => (
                <SelectItem key={neighborhood.id} value={neighborhood.name}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {neighborhood.name}
                    </div>
                    <span className="text-sm text-muted-foreground ml-2">R$ {neighborhood.deliveryFee.toFixed(2)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="orderValue">Valor do Pedido *</Label>
          <Input
            id="orderValue"
            type="number"
            step="0.01"
            value={formData.orderValue}
            onChange={(e) => setFormData({ ...formData, orderValue: e.target.value })}
            placeholder="0,00"
          />
        </div>

        <div className="space-y-2">
          <Label>Taxa de Entrega</Label>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-green-600">R$ {deliveryFee.toFixed(2)}</span>
            </div>
          </Card>
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg">
        Registrar Entrega
      </Button>
    </form>
  )
}
