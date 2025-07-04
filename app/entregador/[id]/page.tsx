"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, DollarSign, Navigation, Clock, Package, LogOut } from "lucide-react"
import Link from "next/link"
import { DistanceCalculator } from "@/utils/distance-calculator"
import { AuthGuard } from "@/components/auth-guard"

interface Neighborhood {
  id: string
  name: string
  deliveryFee: number
}

interface Deliverer {
  id: string
  name: string
  phone?: string
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

interface DeliveryWithDistance extends Delivery {
  distanceKm?: number
  roundTripKm?: number
}

const DELIVERY_TYPES = [
  { value: "ifood", label: "iFood", color: "bg-red-100 text-red-800" },
  { value: "app", label: "App Próprio", color: "bg-blue-100 text-blue-800" },
  { value: "card", label: "Cartão", color: "bg-green-100 text-green-800" },
  { value: "cash", label: "Dinheiro", color: "bg-yellow-100 text-yellow-800" },
  { value: "pix", label: "PIX", color: "bg-purple-100 text-purple-800" },
]

export default function DelivererPage() {
  const params = useParams()
  const router = useRouter()
  const delivererId = params.id as string

  const [deliverer, setDeliverer] = useState<Deliverer | null>(null)
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
  const [deliveries, setDeliveries] = useState<DeliveryWithDistance[]>([])
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [formData, setFormData] = useState({
    address: "",
    deliveryType: "",
    orderValue: "",
  })
  const { toast } = useToast()

  useEffect(() => {
    // Carregar dados do entregador
    const savedDeliverers = localStorage.getItem("deliverers")
    if (savedDeliverers) {
      const deliverers = JSON.parse(savedDeliverers)
      const currentDeliverer = deliverers.find((d: Deliverer) => d.id === delivererId)
      if (currentDeliverer) {
        setDeliverer(currentDeliverer)
      } else {
        router.push("/")
      }
    }

    // Carregar bairros
    const savedNeighborhoods = localStorage.getItem("neighborhoods")
    if (savedNeighborhoods) {
      setNeighborhoods(JSON.parse(savedNeighborhoods))
    } else {
      const defaultNeighborhoods = [
        { id: "1", name: "Centro", deliveryFee: 3.0 },
        { id: "2", name: "Jardim América", deliveryFee: 4.0 },
        { id: "3", name: "Vila Nova", deliveryFee: 5.0 },
        { id: "4", name: "Bairro Alto", deliveryFee: 6.0 },
      ]
      setNeighborhoods(defaultNeighborhoods)
      localStorage.setItem("neighborhoods", JSON.stringify(defaultNeighborhoods))
    }

    // Carregar entregas do dia do entregador
    loadTodayDeliveries()
  }, [delivererId, router])

  const loadTodayDeliveries = () => {
    const savedDeliveries = localStorage.getItem("deliveries")
    if (savedDeliveries) {
      const allDeliveries = JSON.parse(savedDeliveries)
      const today = new Date().toISOString().split("T")[0]
      const todayDeliveries = allDeliveries.filter((d: Delivery) => {
        const deliveryDate = new Date(d.timestamp).toISOString().split("T")[0]
        return deliveryDate === today && d.delivererId === delivererId
      })
      setDeliveries(todayDeliveries)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.address || !selectedNeighborhood || !formData.deliveryType || !formData.orderValue) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      })
      return
    }

    if (!deliverer) return

    try {
      // Calcular distância usando o utilitário
      const calculator = DistanceCalculator.getInstance()
      const distanceResult = await calculator.calculateDistance(formData.address)

      const delivery: DeliveryWithDistance = {
        id: Date.now().toString(),
        delivererId: deliverer.id,
        delivererName: deliverer.name,
        address: formData.address,
        neighborhood: selectedNeighborhood,
        deliveryType: formData.deliveryType,
        orderValue: Number.parseFloat(formData.orderValue),
        deliveryFee: deliveryFee,
        timestamp: new Date().toISOString(),
        distanceKm: distanceResult.distanceKm,
        roundTripKm: distanceResult.roundTripKm,
      }

      // Salvar entrega
      const savedDeliveries = localStorage.getItem("deliveries")
      const allDeliveries = savedDeliveries ? JSON.parse(savedDeliveries) : []
      allDeliveries.push(delivery)
      localStorage.setItem("deliveries", JSON.stringify(allDeliveries))

      toast({
        title: "Sucesso",
        description: `Entrega registrada! Distância: ${distanceResult.distanceKm.toFixed(1)}km (ida e volta: ${distanceResult.roundTripKm.toFixed(1)}km)`,
      })

      // Limpar formulário e recarregar entregas
      setFormData({ address: "", deliveryType: "", orderValue: "" })
      setSelectedNeighborhood("")
      setDeliveryFee(0)
      loadTodayDeliveries()
    } catch (error) {
      // Se não conseguir calcular a distância, registra a entrega sem ela
      const delivery: DeliveryWithDistance = {
        id: Date.now().toString(),
        delivererId: deliverer.id,
        delivererName: deliverer.name,
        address: formData.address,
        neighborhood: selectedNeighborhood,
        deliveryType: formData.deliveryType,
        orderValue: Number.parseFloat(formData.orderValue),
        deliveryFee: deliveryFee,
        timestamp: new Date().toISOString(),
        distanceKm: 0,
        roundTripKm: 0,
      }

      const savedDeliveries = localStorage.getItem("deliveries")
      const allDeliveries = savedDeliveries ? JSON.parse(savedDeliveries) : []
      allDeliveries.push(delivery)
      localStorage.setItem("deliveries", JSON.stringify(allDeliveries))

      toast({
        title: "Entrega registrada",
        description: "Não foi possível calcular a distância. Configure a API do Google Maps.",
        variant: "default",
      })

      setFormData({ address: "", deliveryType: "", orderValue: "" })
      setSelectedNeighborhood("")
      setDeliveryFee(0)
      loadTodayDeliveries()
    }
  }

  useEffect(() => {
    const neighborhood = neighborhoods.find((n) => n.name === selectedNeighborhood)
    if (neighborhood) {
      setDeliveryFee(neighborhood.deliveryFee)
    }
  }, [selectedNeighborhood, neighborhoods])

  const navigateToAddress = (address: string) => {
    const encodedAddress = encodeURIComponent(address)
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`
    window.open(googleMapsUrl, "_blank")
  }

  const deleteDelivery = (deliveryId: string) => {
    const savedDeliveries = localStorage.getItem("deliveries")
    if (savedDeliveries) {
      const allDeliveries = JSON.parse(savedDeliveries)
      const updatedDeliveries = allDeliveries.filter((d: Delivery) => d.id !== deliveryId)
      localStorage.setItem("deliveries", JSON.stringify(updatedDeliveries))
      loadTodayDeliveries()
      toast({
        title: "Sucesso",
        description: "Entrega removida com sucesso!",
      })
    }
  }

  if (!deliverer) {
    return <div>Carregando...</div>
  }

  const todayStats = {
    total: deliveries.length,
    totalFees: deliveries.reduce((sum, d) => sum + d.deliveryFee, 0),
    totalValue: deliveries.reduce((sum, d) => sum + d.orderValue, 0),
    totalKm: deliveries.reduce((sum, d) => sum + (d.roundTripKm || 0), 0),
  }

  const handleLogout = () => {
    localStorage.removeItem("userType")
    localStorage.removeItem("userId")
    localStorage.removeItem("userName")
    router.push("/")
  }

  return (
    <AuthGuard allowedUserTypes={["restaurant", "deliverer"]} delivererId={delivererId}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Painel do Entregador</h1>
              <p className="text-gray-600">{deliverer.name}</p>
            </div>
          </div>

          {/* Stats do Dia */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entregas Hoje</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayStats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total em Taxas</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">R$ {todayStats.totalFees.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">R$ {todayStats.totalValue.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Km Rodados</CardTitle>
                <Navigation className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{todayStats.totalKm.toFixed(1)} km</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário de Nova Entrega */}
            <Card>
              <CardHeader>
                <CardTitle>Nova Entrega</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço Completo *</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Rua, número, complemento"
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
                              <span>{neighborhood.name}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                R$ {neighborhood.deliveryFee.toFixed(2)}
                              </span>
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

                  <Button type="submit" className="w-full" size="lg">
                    Registrar Entrega
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Lista de Entregas do Dia */}
            <Card>
              <CardHeader>
                <CardTitle>Entregas de Hoje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {deliveries.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma entrega registrada hoje</p>
                  ) : (
                    deliveries.map((delivery) => {
                      const deliveryType = DELIVERY_TYPES.find((t) => t.value === delivery.deliveryType)
                      return (
                        <Card key={delivery.id} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{delivery.address}</p>
                                <p className="text-xs text-muted-foreground">{delivery.neighborhood}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigateToAddress(delivery.address)}
                                  title="Navegar até o endereço"
                                >
                                  <Navigation className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteDelivery(delivery.id)}
                                  title="Remover entrega"
                                >
                                  ×
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge className={deliveryType?.color}>{deliveryType?.label}</Badge>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {new Date(delivery.timestamp).toLocaleTimeString()}
                                  {delivery.roundTripKm && (
                                    <>
                                      <span>•</span>
                                      <Navigation className="h-3 w-3" />
                                      {delivery.roundTripKm.toFixed(1)}km
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">R$ {delivery.orderValue.toFixed(2)}</p>
                                <p className="text-xs text-green-600">+R$ {delivery.deliveryFee.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
