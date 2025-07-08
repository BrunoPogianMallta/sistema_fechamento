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
import { ArrowLeft, DollarSign, Navigation, Clock, Package, LogOut, Wifi, WifiOff, Printer } from "lucide-react"
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

  // Função para obter informações do dia atual
  const getTodayInfo = useCallback(() => {
    const today = new Date()
    return {
      date: today.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
      dateString: today.toISOString().split("T")[0],
    }
  }, [])

  // Função simplificada para buscar entregas do dia atual (mesma lógica da página de fechamento)
  const fetchTodayDeliveries = useCallback(async () => {
    if (!delivererId) return

    try {
      setLoading(true)

      // Usar a mesma lógica da página de fechamento
      const today = new Date().toISOString().split("T")[0]
      const startDate = today + "T00:00:00Z"
      const endDate = today + "T23:59:59Z"

      console.log("Buscando entregas entre:", startDate, "e", endDate)
      console.log("Para entregador:", delivererId)

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
          description: "Não foi possível carregar as entregas do dia.",
          variant: "destructive",
        })
        return
      }

      console.log("Entregas encontradas:", data?.length || 0)
      console.log("Dados das entregas:", data)

      // Atualizar o estado com as entregas do banco
      setDeliveries((prev) => {
        // Manter apenas entregas que ainda estão sincronizando
        const syncingDeliveries = prev.filter((d) => d.isSyncing && !data?.some((db) => db.id === d.id))
        return [...(data || []), ...syncingDeliveries]
      })
    } catch (error) {
      console.error("Erro inesperado:", error)
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar entregas.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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
          console.log("Real-time event:", payload.eventType, payload)

          // Recarregar entregas após qualquer mudança
          await fetchTodayDeliveries()

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

  // Função para adicionar entrega
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

      // Dados da entrega
      const deliveryData = {
        deliverer_id: deliverer.id,
        deliverer_name: deliverer.name,
        address: formData.address,
        neighborhood: selectedNeighborhood,
        delivery_type: formData.deliveryType,
        order_value: Number.parseFloat(formData.orderValue),
        delivery_fee: deliveryFee,
        distance_km: distanceResult.distanceKm,
        round_trip_km: distanceResult.roundTripKm,
      }

      console.log("Inserindo entrega:", deliveryData)

      // Inserir no banco de dados
      const { data, error } = await supabase.from("deliveries").insert([deliveryData]).select().single()

      if (error) {
        console.error("Erro ao inserir entrega:", error)
        throw error
      }

      console.log("Entrega inserida com sucesso:", data)

      // Limpar formulário apenas após sucesso
      setFormData({ address: "", deliveryType: "", orderValue: "" })
      setSelectedNeighborhood("")
      setDeliveryFee(0)

      // Recarregar entregas para garantir sincronização
      await fetchTodayDeliveries()

      toast({
        title: "✅ Sucesso",
        description: "Entrega registrada com sucesso!",
        variant: "default",
      })
    } catch (error) {
      console.error("Erro ao registrar entrega:", error)

      toast({
        title: "Erro",
        description: "Falha ao registrar entrega. Tente novamente.",
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
      const { error } = await supabase.from("deliveries").delete().eq("id", deliveryId)

      if (error) throw error

      // Recarregar entregas após deletar
      await fetchTodayDeliveries()

      toast({
        title: "Sucesso",
        description: "Entrega removida com sucesso.",
        variant: "default",
      })
    } catch (error) {
      console.error("Erro ao deletar entrega:", error)
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

  // Função para imprimir/exportar o relatório diário
  const handlePrintDailyReport = () => {
    const { date, dateString } = getTodayInfo()

    const reportContent = `
      <html>
        <head>
          <title>Relatório Diário - ${dateString}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            .header { margin-bottom: 20px; }
            .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
            .stat-card { border: 1px solid #ddd; padding: 10px; border-radius: 5px; }
            .deliveries { margin-top: 20px; }
            .delivery-item { border-bottom: 1px solid #eee; padding: 10px 0; }
            .total { font-weight: bold; margin-top: 20px; text-align: right; }
          </style>
        </head>
        <body>
          <h1>Relatório Diário</h1>
          
          <div class="header">
            <p><strong>Data:</strong> ${date}</p>
            <p><strong>Entregador:</strong> ${deliverer?.name || ""}</p>
          </div>
          
          <div class="stats">
            <div class="stat-card">
              <strong>Total de Entregas:</strong> ${todayStats.total}
            </div>
            <div class="stat-card">
              <strong>Valor em Pedidos:</strong> R$ ${todayStats.totalValue.toFixed(2)}
            </div>
            <div class="stat-card">
              <strong>Total em Taxas:</strong> R$ ${todayStats.totalFees.toFixed(2)}
            </div>
            <div class="stat-card">
              <strong>Km Rodados:</strong> ${todayStats.totalKm.toFixed(1)} km
            </div>
          </div>
          
          <div class="deliveries">
            <h3>Detalhes das Entregas:</h3>
            ${deliveries
              .map(
                (d) => `
              <div class="delivery-item">
                <p><strong>${new Date(d.created_at).toLocaleTimeString()}</strong> - ${d.neighborhood} | ${DELIVERY_TYPES.find((t) => t.value === d.delivery_type)?.label || d.delivery_type}</p>
                <p>Endereço: ${d.address}</p>
                <p>Pedido: R$ ${d.order_value.toFixed(2)} | Taxa: R$ ${d.delivery_fee.toFixed(2)} ${d.round_trip_km ? `| Distância: ${d.round_trip_km.toFixed(1)} km` : ""}</p>
              </div>
            `,
              )
              .join("")}
          </div>
          
          <div class="total">
            <p><strong>Total Geral:</strong> R$ ${(todayStats.totalValue + todayStats.totalFees).toFixed(2)}</p>
          </div>
        </body>
      </html>
    `

    // Abre uma nova janela para impressão
    const printWindow = window.open("", "_blank")
    printWindow?.document.write(reportContent)
    printWindow?.document.close()
    printWindow?.print()
  }

  // Estatísticas do dia
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
              <h1 className="text-2xl font-bold text-gray-900">Relatório Diário</h1>
              <p className="text-gray-600">{getTodayInfo().date}</p>
              <p className="text-sm text-gray-500">Entregas de hoje</p>
            </div>

            <div className="flex items-center gap-4">
              <Button onClick={handlePrintDailyReport} variant="outline" className="bg-white hover:bg-gray-50">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
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
          </div>

          {/* Debug Info */}
          <Card className="mb-4 bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="text-sm text-blue-800">
                <p>
                  <strong>Debug:</strong> {deliveries.length} entregas carregadas para hoje ({getTodayInfo().dateString}
                  ) | Entregador: {deliverer.name}
                </p>
              </div>
            </CardContent>
          </Card>

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
                      availableNeighborhoods={neighborhoods.map((n) => n.name)}
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
                      const hoursDiff = Math.abs(now.getTime() - deliveryTime.getTime()) / (1000 * 60 * 60)

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
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {deliveryTime.toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
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
                                    {delivery.round_trip_km.toFixed(1)}km
                                  </>
                                )}
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
