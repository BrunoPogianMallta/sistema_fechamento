"use client"

import type React from "react"
import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, DollarSign, Navigation, Clock, Package, LogOut, Wifi, WifiOff } from "lucide-react"
import Link from "next/link"
import { DistanceCalculator } from "@/utils/distance-calculator"
import { AuthGuard } from "@/components/auth-guard"
import { supabase } from "@/lib/supabaseClient"
import { AddressAutocomplete } from "@/components/AddressAutocomplete"






interface Neighborhood {
  id: string
  name: string
  delivery_fee: number
}

interface Deliverer {
  id: string
  name: string
  phone?: string
}

interface Delivery {
  id: string
  deliverer_id: string
  deliverer_name: string
  address: string
  neighborhood: string
  delivery_type: string
  order_value: number
  delivery_fee: number
  distance_km: number | null
  round_trip_km: number | null
  created_at: string
  isSyncing?: boolean // Novo campo para indicar sincronização
}

const DELIVERY_TYPES = [
  { value: "ifood", label: "iFood", color: "bg-red-100 text-red-800" },
  { value: "app", label: "App Próprio", color: "bg-blue-100 text-blue-800" },
  { value: "card", label: "Cartão", color: "bg-green-100 text-green-800" },
  { value: "cash", label: "Dinheiro", color: "bg-yellow-100 text-yellow-800" },
  { value: "pix", label: "PIX", color: "bg-purple-100 text-purple-800" },
  { value: "rappi", label: "Rappi", color: "bg-orange-100 text-purple-800" },
]


export default function DelivererPage() {
  const params = useParams()
  const router = useRouter()
  const delivererId = params.id as string
  const [deliverer, setDeliverer] = useState<Deliverer | null>(null)
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("")
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [formData, setFormData] = useState({
    address: "",
    deliveryType: "",
    orderValue: "",
  })
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const subscriptionRef = useRef<any>(null)

  // Função para buscar entregas do dia
  const fetchTodayDeliveries = useCallback(async () => {
    if (!delivererId) return

    try {
      const today = new Date().toISOString().split("T")[0]
      const startDate = `${today}T00:00:00Z`
      const endDate = `${today}T23:59:59Z`

      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .eq("deliverer_id", delivererId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Erro ao buscar entregas:", error)
        toast({
          title: "Erro",
          description: "Não foi possível carregar entregas.",
          variant: "destructive",
        })
        return
      }

      // Manter entregas locais que ainda estão sincronizando
      setDeliveries(prev => [
        ...(data || []),
        ...prev.filter(d => d.isSyncing && !data?.some(dbDelivery => dbDelivery.id === d.id))
      ])
    } catch (error) {
      console.error("Erro inesperado:", error)
    }
  }, [delivererId, toast])

  // Carregar entregador
  useEffect(() => {
    async function fetchDeliverer() {
      if (!delivererId) return

      const { data, error } = await supabase.from("deliverers").select("*").eq("id", delivererId).single()

      if (error || !data) {
        toast({
          title: "Erro",
          description: "Entregador não encontrado.",
          variant: "destructive",
        })
        router.push("/")
        return
      }

      setDeliverer(data)
    }

    fetchDeliverer()
  }, [delivererId, router, toast])

  // Carregar bairros
  useEffect(() => {
    async function fetchNeighborhoods() {
      const { data, error } = await supabase.from("neighborhoods").select("*").order("name", { ascending: true })

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar bairros.",
          variant: "destructive",
        })
        return
      }

      setNeighborhoods(data || [])
    }

    fetchNeighborhoods()
  }, [toast])

  // Carregar entregas iniciais
  useEffect(() => {
    fetchTodayDeliveries()
  }, [fetchTodayDeliveries])

  // Configurar Real-time subscriptions
  useEffect(() => {
    if (!delivererId) return

    const channel = supabase
      .channel(`deliveries-${delivererId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
          filter: `deliverer_id=eq.${delivererId}`,
        },
        async (payload) => {
          // Atualizar lista quando houver mudanças no banco
          await fetchTodayDeliveries()

          // Notificações específicas por tipo de evento
          if (payload.eventType === "INSERT") {
            toast({
              title: "✅ Nova entrega registrada",
              description: `Entrega para ${payload.new?.neighborhood || "endereço"} adicionada.`,
            })
          }
        },
      )
      .on("presence", { event: "sync" }, () => {
        setIsConnected(true)
      })
      .on("presence", { event: "leave" }, () => {
        setIsConnected(false)
      })
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [delivererId, fetchTodayDeliveries, toast])

  // Atualizar taxa quando bairro muda
  useEffect(() => {
    const neighborhood = neighborhoods.find((n) => n.name === selectedNeighborhood)
    setDeliveryFee(neighborhood?.delivery_fee || 0)
  }, [selectedNeighborhood, neighborhoods])

  // Função para adicionar entrega com atualização instantânea
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.address || !selectedNeighborhood || !formData.deliveryType || !formData.orderValue) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      })
      return
    }

    if (!deliverer) return

    setLoading(true)
    
    try {
      // Calcular distância
      const calculator = DistanceCalculator.getInstance()
      let distanceResult = { distanceKm: 0, roundTripKm: 0 }

      try {
        distanceResult = await calculator.calculateDistance(formData.address)
      } catch (error) {
        console.warn("⚠️ Falha no cálculo de distância:", error)
      }

      // Criar objeto de entrega temporário
      const tempDelivery: Delivery = {
        id: `temp-${Date.now()}`, // ID temporário
        deliverer_id: deliverer.id,
        deliverer_name: deliverer.name,
        address: formData.address,
        neighborhood: selectedNeighborhood,
        delivery_type: formData.deliveryType,
        order_value: Number.parseFloat(formData.orderValue),
        delivery_fee: deliveryFee,
        distance_km: distanceResult.distanceKm,
        round_trip_km: distanceResult.roundTripKm,
        created_at: new Date().toISOString(),
        isSyncing: true // Marcar como sincronizando
      }

      // Adicionar imediatamente ao estado local
      setDeliveries(prev => [tempDelivery, ...prev])

      // Limpar formulário
      setFormData({ address: "", deliveryType: "", orderValue: "" })
      setSelectedNeighborhood("")
      setDeliveryFee(0)

      // Inserir no banco de dados (em segundo plano)
      const { data, error } = await supabase
        .from("deliveries")
        .insert([
          {
            deliverer_id: deliverer.id,
            deliverer_name: deliverer.name,
            address: formData.address,
            neighborhood: selectedNeighborhood,
            delivery_type: formData.deliveryType,
            order_value: Number.parseFloat(formData.orderValue),
            delivery_fee: deliveryFee,
            distance_km: distanceResult.distanceKm,
            round_trip_km: distanceResult.roundTripKm,
          },
        ])
        .select()
        .single()

      if (error) throw error

      // Atualizar a entrega local com o ID real do banco de dados
      setDeliveries(prev => 
        prev.map(d => 
          d.id === tempDelivery.id 
            ? { ...data, isSyncing: false } 
            : d
        )
      )

    } catch (error) {
      console.error("Erro ao registrar entrega:", error)
      
      // Remover a entrega temporária em caso de erro
      setDeliveries(prev => prev.filter(d => d.id !== `temp-${Date.now()}`))
      
      toast({
        title: "Erro",
        description: "Falha ao registrar entrega.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Função para deletar entrega
  async function deleteDelivery(deliveryId: string) {
    if (!confirm("Tem certeza que deseja remover esta entrega?")) return

    try {
      // Remover imediatamente do estado local
      setDeliveries(prev => prev.filter(d => d.id !== deliveryId))

      const { error } = await supabase.from("deliveries").delete().eq("id", deliveryId)

      if (error) throw error

    } catch (error) {
      console.error("Erro ao deletar entrega:", error)
      // Se falhar, recarregar as entregas do banco
      fetchTodayDeliveries()
      toast({
        title: "Erro",
        description: "Falha ao remover entrega.",
        variant: "destructive",
      })
    }
  }

  function navigateToAddress(address: string) {
    const encodedAddress = encodeURIComponent(address)
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`
    window.open(googleMapsUrl, "_blank")
  }

  function handleLogout() {
    localStorage.removeItem("userType")
    localStorage.removeItem("userId")
    localStorage.removeItem("userName")
    router.push("/")
  }

  if (!deliverer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando entregador...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Estatísticas do dia
  const todayStats = {
    total: deliveries.length,
    totalFees: deliveries.reduce((sum, d) => sum + d.delivery_fee, 0),
    totalValue: deliveries.reduce((sum, d) => sum + d.order_value, 0),
    totalKm: deliveries.reduce((sum, d) => sum + (d.round_trip_km || 0), 0),
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
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Painel do Entregador</h1>
              <p className="text-gray-600">{deliverer.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-600">Offline</span>
                </>
              )}
            </div>
          </div>

          {/* Status de sincronização */}
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
              ></div>
              <span className={isConnected ? "text-green-600" : "text-red-600"}>
                {isConnected ? "Sincronização automática ativa" : "Reconectando..."}
              </span>
            </div>
          </div>

          {/* Estatísticas do dia */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="transition-all duration-300 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entregas Hoje</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayStats.total}</div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total em Taxas</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">R$ {todayStats.totalFees.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">R$ {todayStats.totalValue.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:shadow-lg">
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
                    <AddressAutocomplete
                      onSelect={(address, neighborhood) => {
                        setFormData((prev) => ({ ...prev, address }))
                        setSelectedNeighborhood(neighborhood)
                      }}
                      disabled={loading}
                      availableNeighborhoods={neighborhoods.map(n => n.name)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Bairro *</Label>
                    <Select
                      value={selectedNeighborhood}
                      onValueChange={setSelectedNeighborhood}
                      required
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o bairro" />
                      </SelectTrigger>
                      <SelectContent>
                        {neighborhoods.map((n) => (
                          <SelectItem key={n.id} value={n.name}>
                            <div className="flex items-center justify-between w-full">
                              <span>{n.name}</span>
                              <span className="text-sm text-muted-foreground ml-2">R$ {n.delivery_fee.toFixed(2)}</span>
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
                      required
                      disabled={loading}
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
                      min="0"
                      value={formData.orderValue}
                      onChange={(e) => setFormData({ ...formData, orderValue: e.target.value })}
                      placeholder="0,00"
                      required
                      disabled={loading}
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
                  <Button type="submit" className="w-full" size="lg" disabled={loading || !isConnected}>
                    {loading ? "Registrando..." : "Registrar Entrega"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Lista de Entregas do Dia */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Entregas de Hoje</span>
                  <Badge variant="secondary" className="animate-pulse">
                    {deliveries.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {deliveries.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma entrega registrada hoje</p>
                    </div>
                  ) : (
                    deliveries.map((delivery) => {
                      const deliveryType = DELIVERY_TYPES.find((t) => t.value === delivery.delivery_type)
                      return (
                        <Card
                          key={delivery.id}
                          className={`p-3 transition-all duration-300 hover:shadow-md ${
                            delivery.isSyncing ? "opacity-80 bg-gray-50 animate-pulse" : ""
                          }`}
                        >
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
                                  className="hover:bg-red-50 hover:text-red-600"
                                  disabled={delivery.isSyncing}
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
                                  {new Date(delivery.created_at).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                  {delivery.round_trip_km && (
                                    <>
                                      <span>•</span>
                                      <Navigation className="h-3 w-3" />
                                      {delivery.round_trip_km.toFixed(1)}km
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">R$ {delivery.order_value.toFixed(2)}</p>
                                <p className="text-xs text-green-600">+R$ {delivery.delivery_fee.toFixed(2)}</p>
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
