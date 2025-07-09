"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
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
  displayed_time?: string
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
  const isInitializedRef = useRef(false)

  // Calcula o período do turno (18:00 até 02:30 do dia seguinte)
  const shiftInfo = useMemo(() => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinutes = now.getMinutes()
    
    // Verifica se está no período de tolerância (00:00-02:30)
    const isGracePeriod = (currentHour >= 0 && currentHour < 2) || 
                         (currentHour === 2 && currentMinutes <= 30)
    
    // Data de referência (dia do turno)
    const referenceDate = isGracePeriod ? 
      new Date(now.getTime() - 24 * 60 * 60 * 1000) : // Volta um dia se for período de tolerância
      now

    // Calcula as datas de início e fim do turno
    const startDate = new Date(referenceDate)
    startDate.setHours(18, 0, 0, 0)
    
    const endDate = new Date(referenceDate)
    endDate.setDate(endDate.getDate() + 1)
    endDate.setHours(2, 30, 0, 0)

    return {
      date: referenceDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
      dateString: referenceDate.toISOString().split("T")[0],
      startDate,
      endDate,
      isGracePeriod,
      periodText: `${referenceDate.toLocaleDateString("pt-BR")} 18:00 até ${endDate.toLocaleDateString("pt-BR")} 02:30`
    }
  }, [])

  // Busca as entregas do turno atual
  const fetchShiftDeliveries = useCallback(async () => {
    if (!delivererId) return

    try {
      setLoading(true)
      
      // Formata as datas para o filtro
      const startDate = shiftInfo.startDate.toISOString()
      const endDate = shiftInfo.endDate.toISOString()

      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .eq("deliverer_id", delivererId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Adiciona o horário local formatado para exibição
      const deliveriesWithLocalTime = data?.map(delivery => ({
        ...delivery,
        displayed_time: new Date(delivery.created_at).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        })
      })) || []

      setDeliveries(deliveriesWithLocalTime)
    } catch (error) {
      console.error("Erro ao buscar entregas:", error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar as entregas do turno.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [delivererId, shiftInfo, toast])

  // Carrega os dados iniciais
  useEffect(() => {
    if (!delivererId || isInitializedRef.current) return

    const loadInitialData = async () => {
      // Carrega entregador
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

      // Carrega bairros
      const { data: neighborhoodsData, error: neighborhoodsError } = await supabase
        .from("neighborhoods")
        .select("*")
        .order("name", { ascending: true })

      if (!neighborhoodsError) {
        setNeighborhoods(neighborhoodsData || [])
      }

      isInitializedRef.current = true
      fetchShiftDeliveries()
    }

    loadInitialData()
  }, [delivererId, router, toast, fetchShiftDeliveries])

  // Configura a subscription em tempo real
  useEffect(() => {
    if (!delivererId || subscriptionRef.current) return

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
          const delivery = payload.new as Delivery
          const deliveryDate = new Date(delivery.created_at)
          
          // Verifica se está dentro do turno atual
          if (deliveryDate >= shiftInfo.startDate && deliveryDate <= shiftInfo.endDate) {
            if (payload.eventType === "INSERT") {
              // Adiciona o horário local formatado
              const deliveryWithLocalTime = {
                ...delivery,
                displayed_time: deliveryDate.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Sao_Paulo'
                })
              }
              
              setDeliveries(prev => [deliveryWithLocalTime, ...prev])
              toast({
                title: "✅ Nova entrega registrada",
                description: `Entrega para ${delivery.neighborhood} adicionada.`,
              })
            } else if (payload.eventType === "DELETE") {
              setDeliveries(prev => prev.filter(d => d.id !== payload.old.id))
            }
          }
        }
      )
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [delivererId, shiftInfo, toast])

  // Atualiza a taxa de entrega quando muda o bairro
  useEffect(() => {
    const neighborhood = neighborhoods.find(n => n.name === selectedNeighborhood)
    setDeliveryFee(neighborhood?.delivery_fee || 0)
  }, [selectedNeighborhood, neighborhoods])

  // Registra uma nova entrega
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
        // Calcula distância
        const calculator = DistanceCalculator.getInstance()
        let distanceResult = { distanceKm: 0, roundTripKm: 0 }

        try {
          distanceResult = await calculator.calculateDistance(formData.address)
        } catch (error) {
          console.warn("Erro no cálculo de distância:", error)
        }

        // Prepara os dados da entrega com o horário atual
        const now = new Date()
        const deliveryData = {
          deliverer_id: deliverer.id,
          deliverer_name: deliverer.name,
          address: formData.address,
          neighborhood: selectedNeighborhood,
          delivery_type: formData.deliveryType,
          order_value: Number(formData.orderValue),
          delivery_fee: deliveryFee,
          distance_km: distanceResult.distanceKm,
          round_trip_km: distanceResult.roundTripKm,
          created_at: now.toISOString() // Armazena como UTC
        }

        // Insere no banco de dados
        const { error } = await supabase.from("deliveries").insert([deliveryData])

        if (error) throw error

        // Limpa o formulário
        setFormData({ address: "", deliveryType: "", orderValue: "" })
        setSelectedNeighborhood("")

        toast({
          title: "✅ Sucesso",
          description: "Entrega registrada com sucesso!",
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
    },
    [formData, selectedNeighborhood, deliveryFee, deliverer, toast]
  )

  // Remove uma entrega
  const deleteDelivery = useCallback(
    async (deliveryId: string) => {
      if (!confirm("Tem certeza que deseja remover esta entrega?")) return

      try {
        const { error } = await supabase.from("deliveries").delete().eq("id", deliveryId)
        if (error) throw error

        toast({
          title: "Sucesso",
          description: "Entrega removida com sucesso.",
        })
      } catch (error) {
        console.error("Erro ao remover entrega:", error)
        toast({
          title: "Erro",
          description: "Falha ao remover entrega.",
          variant: "destructive",
        })
      }
    },
    [toast]
  )

  // Navega para o endereço no Google Maps
  const navigateToAddress = useCallback((address: string) => {
    const encodedAddress = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, "_blank")
  }, [])

  // Faz logout do sistema
  const handleLogout = useCallback(() => {
    localStorage.removeItem("userType")
    localStorage.removeItem("userId")
    localStorage.removeItem("userName")
    router.push("/")
  }, [router])

  // Gera relatório impresso
  const handlePrintReport = useCallback(() => {
    const printContent = `
      <html>
        <head>
          <title>Relatório de Turno - ${shiftInfo.periodText}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            .header { margin-bottom: 20px; text-align: center; }
            .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
            .stat-card { border: 1px solid #ddd; padding: 10px; border-radius: 5px; }
            .deliveries { margin-top: 20px; }
            .delivery-item { border-bottom: 1px solid #eee; padding: 10px 0; }
            .total { font-weight: bold; margin-top: 20px; text-align: right; }
            .delivery-type { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; }
          </style>
        </head>
        <body>
          <h1>Relatório de Turno</h1>
          <div class="header">
            <p><strong>Período:</strong> ${shiftInfo.periodText}</p>
            <p><strong>Entregador:</strong> ${deliverer?.name || ""}</p>
            <p><small>(Tolerância até 02:30 para lançamentos)</small></p>
          </div>
          
          <div class="stats">
            <div class="stat-card"><strong>Total de Entregas:</strong> ${deliveries.length}</div>
            <div class="stat-card"><strong>Valor em Pedidos:</strong> R$ ${deliveries.reduce((sum, d) => sum + d.order_value, 0).toFixed(2)}</div>
            <div class="stat-card"><strong>Total em Taxas:</strong> R$ ${deliveries.reduce((sum, d) => sum + d.delivery_fee, 0).toFixed(2)}</div>
            <div class="stat-card"><strong>Km Rodados:</strong> ${deliveries.reduce((sum, d) => sum + (d.round_trip_km || 0), 0).toFixed(1)} km</div>
          </div>
          
          <div class="deliveries">
            <h3>Detalhes das Entregas:</h3>
            ${deliveries.map(d => {
              const type = DELIVERY_TYPES.find(t => t.value === d.delivery_type)
              return `
                <div class="delivery-item">
                  <p>
                    <strong>${d.displayed_time || new Date(d.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong> - 
                    ${d.neighborhood} | 
                    <span class="delivery-type" style="background-color: ${type?.color.split(' ')[0]}; color: ${type?.color.split(' ')[2]}">
                      ${type?.label || d.delivery_type}
                    </span>
                  </p>
                  <p>Endereço: ${d.address}</p>
                  <p>
                    Pedido: R$ ${d.order_value.toFixed(2)} | 
                    Taxa: R$ ${d.delivery_fee.toFixed(2)} | 
                    ${d.round_trip_km ? `Distância: ${d.round_trip_km.toFixed(1)} km` : ''}
                  </p>
                </div>
              `
            }).join('')}
          </div>
          
          <div class="total">
            <p>Total Geral: R$ ${(deliveries.reduce((sum, d) => sum + d.order_value + d.delivery_fee, 0).toFixed(2))}</p>
          </div>
        </body>
      </html>
    `

    const printWindow = window.open("", "_blank")
    printWindow?.document.write(printContent)
    printWindow?.document.close()
    setTimeout(() => {
      printWindow?.print()
    }, 200)
  }, [deliverer, deliveries, shiftInfo])

  // Calcula as estatísticas do turno
  const shiftStats = useMemo(() => ({
    total: deliveries.length,
    totalFees: deliveries.reduce((sum, d) => sum + d.delivery_fee, 0),
    totalValue: deliveries.reduce((sum, d) => sum + d.order_value, 0),
    totalKm: deliveries.reduce((sum, d) => sum + (d.round_trip_km || 0), 0),
  }), [deliveries])

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
          {/* Cabeçalho */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
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
              <h1 className="text-2xl font-bold text-gray-900">Relatório de Turno</h1>
              <p className="text-gray-600">{shiftInfo.periodText}</p>
              <p className="text-sm text-gray-500">(Tolerância até 02:30 para lançamentos)</p>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                onClick={handlePrintReport} 
                variant="outline" 
                className="bg-white hover:bg-gray-50"
                disabled={deliveries.length === 0}
              >
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

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Entregas</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{shiftStats.total}</div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Taxas</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">R$ {shiftStats.totalFees.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Valor Pedidos</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">R$ {shiftStats.totalValue.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Km Rodados</CardTitle>
                <Navigation className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{shiftStats.totalKm.toFixed(1)} km</div>
              </CardContent>
            </Card>
          </div>

          {/* Corpo principal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário de nova entrega */}
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
                        setFormData(prev => ({ ...prev, address }))
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
                        {neighborhoods.map(n => (
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
                      onValueChange={value => setFormData({ ...formData, deliveryType: value })}
                      required
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_TYPES.map(type => (
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
                      onChange={e => setFormData({ ...formData, orderValue: e.target.value })}
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

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? "Registrando..." : "Registrar Entrega"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Lista de entregas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Entregas do Turno</span>
                  <Badge variant="secondary">{deliveries.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {deliveries.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma entrega registrada no turno</p>
                      <p className="text-sm">{shiftInfo.periodText}</p>
                    </div>
                  ) : (
                    deliveries.map(delivery => {
                      const deliveryType = DELIVERY_TYPES.find(t => t.value === delivery.delivery_type)
                      const deliveryTime = new Date(delivery.created_at)
                      const now = new Date()
                      const hoursDiff = (now.getTime() - deliveryTime.getTime()) / (1000 * 60 * 60)

                      return (
                        <Card key={delivery.id} className="p-3 hover:shadow-md transition-shadow">
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
                                  <span>{delivery.displayed_time}</span>
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