"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, DollarSign, Navigation, Clock, Package, LogOut, Wifi, WifiOff, Edit, Save, X, Route, Map } from "lucide-react"
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
  isSyncing?: boolean
}

interface RouteResult {
  totalDistanceKm: number
  optimizedOrder: number[]
  duration: string
  legs: Array<{
    distance: { value: number; text: string }
    duration: { value: number; text: string }
    startAddress: string
    endAddress: string
  }>
  optimizedAddresses: string[]
}

const DELIVERY_TYPES = [
  { value: "ifood", label: "iFood", color: "bg-red-100 text-red-800" },
  { value: "app", label: "App Próprio", color: "bg-blue-100 text-blue-800" },
  { value: "card", label: "Cartão", color: "bg-green-100 text-green-800" },
  { value: "cash", label: "Dinheiro", color: "bg-yellow-100 text-yellow-800" },
  { value: "pix", label: "PIX", color: "bg-purple-100 text-purple-800" },
  { value: "rappi", label: "RAPPI", color: "bg-orange-100 text-white-800" },
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
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null)
  const addressAutocompleteRef = useRef<any>(null)
  const [routePlanningMode, setRoutePlanningMode] = useState(false)
  const [selectedForRoute, setSelectedForRoute] = useState<string[]>([])
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [showRouteDetails, setShowRouteDetails] = useState(false)

  const fetchTodayDeliveries = useCallback(async () => {
    if (!delivererId) return

    try {
      const now = new Date()
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .eq("deliverer_id", delivererId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false })

      if (error) throw error
      setDeliveries(data || [])
    } catch (error) {
      console.error("Erro ao buscar entregas:", error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar entregas.",
        variant: "destructive",
      })
    }
  }, [delivererId, toast])

  useEffect(() => {
    async function loadInitialData() {
      if (!delivererId) return

      try {
        const { data: delivererData, error: delivererError } = await supabase
          .from("deliverers")
          .select("*")
          .eq("id", delivererId)
          .single()

        if (delivererError || !delivererData) {
          toast({
            title: "Erro",
            description: "Entregador não encontrado.",
            variant: "destructive",
          })
          router.push("/")
          return
        }

        setDeliverer(delivererData)

        const { data: neighborhoodsData, error: neighborhoodsError } = await supabase
          .from("neighborhoods")
          .select("*")
          .order("name", { ascending: true })

        if (!neighborhoodsError) {
          setNeighborhoods(neighborhoodsData || [])
        }

        await fetchTodayDeliveries()
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error)
      }
    }

    loadInitialData()
  }, [delivererId, router, toast, fetchTodayDeliveries])

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
          await fetchTodayDeliveries()
          if (payload.eventType === "INSERT") {
            toast({
              title: "✅ Nova entrega registrada",
              description: `Entrega para ${payload.new?.neighborhood || "endereço"} adicionada.`,
            })
          }
        }
      )
      .on("presence", { event: "sync" }, () => setIsConnected(true))
      .on("presence", { event: "leave" }, () => setIsConnected(false))
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [delivererId, fetchTodayDeliveries, toast])

  useEffect(() => {
    const neighborhood = neighborhoods.find((n) => n.name === selectedNeighborhood)
    setDeliveryFee(neighborhood?.delivery_fee || 0)
  }, [selectedNeighborhood, neighborhoods])

  const clearAddressField = () => {
    setFormData(prev => ({ ...prev, address: "" }))
    if (addressAutocompleteRef.current) {
      addressAutocompleteRef.current.clear()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
      const calculator = DistanceCalculator.getInstance()
      let distanceResult = { distanceKm: 0, roundTripKm: 0 }

      try {
        distanceResult = await calculator.calculateDistance(formData.address)
      } catch (error) {
        console.warn("⚠️ Falha no cálculo de distância:", error)
      }

      const tempDelivery: Delivery = {
        id: `temp-${Date.now()}`,
        deliverer_id: deliverer.id,
        deliverer_name: deliverer.name,
        address: formData.address,
        neighborhood: selectedNeighborhood,
        delivery_type: formData.deliveryType,
        order_value: Number(formData.orderValue),
        delivery_fee: deliveryFee,
        distance_km: distanceResult.distanceKm,
        round_trip_km: distanceResult.roundTripKm,
        created_at: new Date().toISOString(),
        isSyncing: true
      }

      setDeliveries(prev => [tempDelivery, ...prev])

      setFormData({ address: "", deliveryType: "", orderValue: "" })
      setSelectedNeighborhood("")
      clearAddressField()

      const { data, error } = await supabase
        .from("deliveries")
        .insert([
          {
            deliverer_id: deliverer.id,
            deliverer_name: deliverer.name,
            address: formData.address,
            neighborhood: selectedNeighborhood,
            delivery_type: formData.deliveryType,
            order_value: Number(formData.orderValue),
            delivery_fee: deliveryFee,
            distance_km: distanceResult.distanceKm,
            round_trip_km: distanceResult.roundTripKm,
          },
        ])
        .select()
        .single()

      if (error) throw error

      setDeliveries(prev => 
        prev.map(d => 
          d.id === tempDelivery.id 
            ? { ...data, isSyncing: false } 
            : d
        )
      )

      toast({
        title: "✅ Sucesso",
        description: "Entrega registrada com sucesso!",
      })

    } catch (error) {
      console.error("Erro ao registrar entrega:", error)
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

  const startEditing = (delivery: Delivery) => {
    setEditingDelivery(delivery)
    setFormData({
      address: delivery.address,
      deliveryType: delivery.delivery_type,
      orderValue: delivery.order_value.toString(),
    })
    setSelectedNeighborhood(delivery.neighborhood)
  }

  const cancelEditing = () => {
    setEditingDelivery(null)
    setFormData({ address: "", deliveryType: "", orderValue: "" })
    setSelectedNeighborhood("")
    clearAddressField()
  }

  const saveEdit = async () => {
    if (!editingDelivery) return
    if (!formData.address || !selectedNeighborhood || !formData.deliveryType || !formData.orderValue) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      
      let distanceResult = { 
        distanceKm: editingDelivery.distance_km || 0, 
        roundTripKm: editingDelivery.round_trip_km || 0 
      }

      if (formData.address !== editingDelivery.address) {
        const calculator = DistanceCalculator.getInstance()
        try {
          distanceResult = await calculator.calculateDistance(formData.address)
        } catch (error) {
          console.warn("⚠️ Falha no cálculo de distância:", error)
        }
      }

      setDeliveries(prev => 
        prev.map(d => 
          d.id === editingDelivery.id 
            ? { 
                ...d, 
                address: formData.address,
                neighborhood: selectedNeighborhood,
                delivery_type: formData.deliveryType,
                order_value: Number(formData.orderValue),
                delivery_fee: deliveryFee,
                distance_km: distanceResult.distanceKm,
                round_trip_km: distanceResult.roundTripKm,
                isSyncing: true
              } 
            : d
        )
      )

      const { error } = await supabase
        .from("deliveries")
        .update({
          address: formData.address,
          neighborhood: selectedNeighborhood,
          delivery_type: formData.deliveryType,
          order_value: Number(formData.orderValue),
          delivery_fee: deliveryFee,
          distance_km: distanceResult.distanceKm,
          round_trip_km: distanceResult.roundTripKm,
        })
        .eq("id", editingDelivery.id)

      if (error) throw error

      setDeliveries(prev => 
        prev.map(d => 
          d.id === editingDelivery.id 
            ? { 
                ...d, 
                isSyncing: false 
              } 
            : d
        )
      )

      toast({
        title: "✅ Sucesso",
        description: "Entrega atualizada com sucesso!",
      })

      setEditingDelivery(null)
      setFormData({ address: "", deliveryType: "", orderValue: "" })
      setSelectedNeighborhood("")
      clearAddressField()

    } catch (error) {
      console.error("Erro ao atualizar entrega:", error)
      fetchTodayDeliveries()
      toast({
        title: "Erro",
        description: "Falha ao atualizar entrega.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const deleteDelivery = async (deliveryId: string) => {
    if (!confirm("Tem certeza que deseja remover esta entrega?")) return

    try {
      setDeliveries(prev => prev.filter(d => d.id !== deliveryId))
      const { error } = await supabase.from("deliveries").delete().eq("id", deliveryId)
      if (error) throw error
      toast({
        title: "✅ Sucesso",
        description: "Entrega removida com sucesso!",
      })
    } catch (error) {
      console.error("Erro ao deletar entrega:", error)
      fetchTodayDeliveries()
      toast({
        title: "Erro",
        description: "Falha ao remover entrega.",
        variant: "destructive",
      })
    }
  }

  const navigateToAddress = (address: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, "_blank")
  }

  const handleLogout = () => {
    localStorage.removeItem("userType")
    localStorage.removeItem("userId")
    localStorage.removeItem("userName")
    router.push("/")
  }

  const toggleRoutePlanningMode = () => {
    setRoutePlanningMode(!routePlanningMode)
    if (routePlanningMode) {
      setSelectedForRoute([])
      setRouteResult(null)
      setShowRouteDetails(false)
    }
  }

  const toggleDeliverySelection = (deliveryId: string) => {
    setSelectedForRoute(prev => 
      prev.includes(deliveryId)
        ? prev.filter(id => id !== deliveryId)
        : [...prev, deliveryId]
    )
  }

  const calculateOptimizedRoute = async () => {
  console.log("Iniciando cálculo de rota...") // Debug
  
  if (selectedForRoute.length < 2) {
    toast({
      title: "Atenção",
      description: "Selecione pelo menos 2 entregas para planejar uma rota.",
      variant: "destructive",
    })
    return
  }

  try {
    setLoading(true)
    const selectedDeliveries = deliveries.filter(d => selectedForRoute.includes(d.id))
    const addresses = selectedDeliveries.map(d => d.address)
    
    console.log("Endereços selecionados:", addresses) // Debug
    
    const config = localStorage.getItem("pizzariaConfig")
    const pizzariaAddress = config ? JSON.parse(config).address : "Rua Principal, 123, Centro"
    
    console.log("Endereço da pizzaria:", pizzariaAddress) // Debug
    
    // Cria array com: [pizzaria, ...entregas, pizzaria]
    const fullRoute = [pizzariaAddress, ...addresses, pizzariaAddress]
    console.log("Rota completa:", fullRoute) // Debug

    const calculator = DistanceCalculator.getInstance()
    console.log("Instância do calculador obtida") // Debug
    
    const result = await calculator.calculateRoute(fullRoute)
    console.log("Resultado da rota:", result) // Debug
    
    // Ordena as entregas conforme a otimização do Google
    const optimizedDeliveries = result.optimizedOrder.map(index => selectedDeliveries[index])
    
    setRouteResult({
      ...result,
      optimizedAddresses: optimizedDeliveries.map(d => d.address)
    })

    console.log("Atualizando distâncias no banco...") // Debug
    await Promise.all(
      optimizedDeliveries.map(async (delivery, index) => {
        const legDistanceKm = result.legs[index+1].distance.value / 1000 // +1 porque o primeiro trecho é da pizzaria até a primeira entrega
        const { error } = await supabase
          .from('deliveries')
          .update({
            distance_km: legDistanceKm,
            round_trip_km: legDistanceKm * 2
          })
          .eq('id', delivery.id)
        
        if (error) {
          console.error("Erro ao atualizar entrega:", delivery.id, error)
          throw error
        }
      })
    )
    
    console.log("Rota calculada com sucesso!") // Debug
    toast({
      title: "✅ Rota calculada!",
      description: `Distância total: ${result.totalDistanceKm.toFixed(1)} km | Tempo: ${result.duration}`,
      action: (
        <Button 
          variant="outline" 
          size="sm"
          onClick={navigateOptimizedRoute}
        >
          <Navigation className="h-4 w-4 mr-2" />
          Abrir no Maps
        </Button>
      )
    })

  } catch (error: any) {
    console.error("Erro detalhado:", error) // Debug
    toast({
      title: "Erro",
      description: error.message || "Falha ao calcular rota otimizada",
      variant: "destructive",
    })
  } finally {
    setLoading(false)
  }
}

  const navigateOptimizedRoute = () => {
    if (!routeResult) return
    
    const config = localStorage.getItem("pizzariaConfig")
    const pizzariaAddress = config ? JSON.parse(config).address : "Rua Principal, 123, Centro"
    
    const waypoints = routeResult.optimizedAddresses
      .map(addr => encodeURIComponent(addr))
      .join('|')

    window.open(
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${encodeURIComponent(pizzariaAddress)}` +
      `&destination=${encodeURIComponent(pizzariaAddress)}` +
      `&waypoints=optimize:true|${waypoints}` +
      `&travelmode=driving`,
      '_blank'
    )
  }

  const todayStats = {
    total: deliveries.length,
    totalFees: deliveries.reduce((sum, d) => sum + d.delivery_fee, 0),
    totalValue: deliveries.reduce((sum, d) => sum + d.order_value, 0),
    totalKm: deliveries.reduce((sum, d) => sum + (d.round_trip_km || 0), 0),
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

  return (
    <AuthGuard allowedUserTypes={["restaurant", "deliverer"]} delivererId={delivererId}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
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
            </div>
            
            <div className="text-center">
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

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Entregas Hoje</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayStats.total}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total em Taxas</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">R$ {todayStats.totalFees.toFixed(2)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">R$ {todayStats.totalValue.toFixed(2)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Km Rodados</CardTitle>
                <Navigation className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{todayStats.totalKm.toFixed(1)} km</div>
              </CardContent>
            </Card>
          </div>

          {/* Controle de Rotas */}
          <div className="flex justify-end mb-4">
            <Button 
              onClick={toggleRoutePlanningMode}
              variant={routePlanningMode ? "destructive" : "outline"}
              className="gap-2"
            >
              <Route className="h-4 w-4" />
              {routePlanningMode ? "Cancelar Planejamento" : "Planejar Rota"}
            </Button>
          </div>

          {/* Painel de Planejamento de Rota */}
          {routePlanningMode && (
            <div className="mb-6 p-4 border rounded-lg bg-blue-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">
                  {selectedForRoute.length} entrega(s) selecionada(s)
                </h3>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={calculateOptimizedRoute}
                    disabled={selectedForRoute.length < 2 || loading}
                    className="gap-2"
                  >
                    <Map className="h-4 w-4" />
                    Calcular Rota
                  </Button>
                  
                  {routeResult && (
                    <Button 
                      onClick={navigateOptimizedRoute}
                      variant="secondary"
                      className="gap-2"
                    >
                      <Navigation className="h-4 w-4" />
                      Navegar
                    </Button>
                  )}
                </div>
              </div>
              
              {routeResult && (
                <>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-muted-foreground">Distância Total</p>
                      <p className="font-medium">{routeResult.totalDistanceKm.toFixed(1)} km</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tempo Estimado</p>
                      <p className="font-medium">{routeResult.duration}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ordem Otimizada</p>
                      <p className="font-medium">
                        {routeResult.optimizedOrder.map(i => i + 1).join(" → ")}
                      </p>
                    </div>
                  </div>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowRouteDetails(!showRouteDetails)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {showRouteDetails ? "Ocultar detalhes" : "Mostrar detalhes da rota"}
                  </Button>

                  {showRouteDetails && (
                    <div className="mt-4 space-y-3">
                      {routeResult.legs.map((leg, index) => (
                        <div key={index} className="p-3 bg-white rounded-lg shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{leg.startAddress}</p>
                              <p className="text-xs text-muted-foreground">para</p>
                              <p className="font-medium text-sm">{leg.endAddress}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm">{leg.distance.text}</p>
                              <p className="text-xs text-muted-foreground">{leg.duration.text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Corpo principal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário de Nova Entrega/Edição */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingDelivery ? "Editar Entrega" : "Nova Entrega"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={editingDelivery ? (e) => { e.preventDefault(); saveEdit() } : handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço Completo *</Label>
                    <AddressAutocomplete
                      ref={addressAutocompleteRef}
                      onSelect={(address, neighborhood) => {
                        setFormData(prev => ({ ...prev, address }))
                        setSelectedNeighborhood(neighborhood)
                      }}
                      initialValue={editingDelivery?.address || ""}
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
                              <span className="text-sm text-muted-foreground ml-2">
                                R$ {n.delivery_fee.toFixed(2)}
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
                        <span className="font-semibold text-green-600">
                          R$ {deliveryFee.toFixed(2)}
                        </span>
                      </div>
                    </Card>
                  </div>

                  <div className="flex gap-2">
                    {editingDelivery ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          size="lg"
                          onClick={cancelEditing}
                          disabled={loading}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          className="w-full"
                          size="lg"
                          disabled={loading || !isConnected}
                        >
                          {loading ? (
                            "Salvando..."
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Salvar
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={loading || !isConnected}
                      >
                        {loading ? "Registrando..." : "Registrar Entrega"}
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Lista de Entregas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Entregas de Hoje</span>
                  <Badge variant="secondary">{deliveries.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {deliveries.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma entrega registrada hoje</p>
                    </div>
                  ) : (
                    deliveries.map((delivery) => {
                      const deliveryType = DELIVERY_TYPES.find((t) => t.value === delivery.delivery_type)
                      const deliveryTime = new Date(delivery.created_at)
                      const now = new Date()
                      const hoursDiff = (now.getTime() - deliveryTime.getTime()) / (1000 * 60 * 60)

                      return (
                        <Card 
                          key={delivery.id}
                          className={`p-3 hover:shadow-md transition-shadow cursor-pointer ${
                            delivery.isSyncing ? "opacity-70 bg-gray-50 animate-pulse" : ""
                          } ${
                            routePlanningMode && selectedForRoute.includes(delivery.id) 
                              ? "border-2 border-blue-500 bg-blue-50" 
                              : ""
                          } ${
                            routeResult?.optimizedOrder && selectedForRoute.includes(delivery.id)
                              ? "ring-2 ring-green-500"
                              : ""
                          }`}
                          onClick={() => routePlanningMode && toggleDeliverySelection(delivery.id)}
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
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startEditing(delivery)
                                  }}
                                  title="Editar entrega"
                                  className="hover:bg-blue-50 hover:text-blue-600"
                                  disabled={delivery.isSyncing}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigateToAddress(delivery.address)
                                  }}
                                  title="Navegar até o endereço"
                                >
                                  <Navigation className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteDelivery(delivery.id)
                                  }}
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
                                {deliveryType && (
                                  <Badge className={deliveryType.color}>
                                    {deliveryType.label}
                                  </Badge>
                                )}
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {deliveryTime.toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {hoursDiff < 1
                                      ? `${Math.round(hoursDiff * 60)} min atrás`
                                      : `${Math.round(hoursDiff)} h atrás`}
                                  </span>
                                </div>
                                {delivery.round_trip_km && (
                                  <>
                                    <span>•</span>
                                    <Navigation className="h-3 w-3" />
                                    {delivery.round_trip_km.toFixed(1)} km
                                  </>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  R$ {delivery.order_value.toFixed(2)}
                                </p>
                                <p className="text-xs text-green-600">
                                  +R$ {delivery.delivery_fee.toFixed(2)}
                                </p>
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
