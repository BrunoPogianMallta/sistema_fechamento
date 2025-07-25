"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, DollarSign, Package, LogOut, Wifi, WifiOff, Edit, Save, X, Clock } from "lucide-react"
import Link from "next/link"
import { AuthGuard } from "@/components/auth-guard"
import { supabase } from "@/lib/supabaseClient"

interface Neighborhood {
  id: string
  name: string
  delivery_fee: number
}

interface Deliverer {
  id: string
  name: string
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
  created_at: string
}

const DELIVERY_TYPE_OPTIONS = [
  { value: "ifood", label: "iFood" },
  { value: "app", label: "App Próprio" },
  { value: "card", label: "Cartão" },
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "rappi", label: "RAPPI" },
]

const DELIVERY_TYPES: Record<string, string> = {
  ifood: "iFood",
  app: "App Próprio",
  card: "Cartão",
  cash: "Dinheiro",
  pix: "PIX",
  rappi: "RAPPI",
}

interface Report {
  deliveriesByType: Record<string, number>
  valuesByType: Record<string, number>
}

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
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null)

  // Calcula estatísticas
  const todayStats = deliveries.reduce(
    (stats, delivery) => ({
      total: stats.total + 1,
      totalFees: stats.totalFees + delivery.delivery_fee,
      totalValue: stats.totalValue + delivery.order_value,
    }),
    { total: 0, totalFees: 0, totalValue: 0 }
  )

  // Gera relatório por tipo de entrega
  const generateReport = (): Report => {
    const report: Report = {
      deliveriesByType: {},
      valuesByType: {}
    }

    deliveries.forEach(delivery => {
      // Contagem por tipo
      report.deliveriesByType[delivery.delivery_type] = 
        (report.deliveriesByType[delivery.delivery_type] || 0) + 1
      
      // Valores por tipo
      report.valuesByType[delivery.delivery_type] = 
        (report.valuesByType[delivery.delivery_type] || 0) + delivery.order_value
    })

    return report
  }

  const report = generateReport()

  // Busca entregas do dia
  const fetchTodayDeliveries = useCallback(async () => {
    try {
      const now = new Date()
      const start = new Date(now.setHours(0, 0, 0, 0))
      const end = new Date(now.setHours(23, 59, 59, 999))

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
      toast({
        title: "Erro",
        description: "Falha ao carregar entregas",
        variant: "destructive",
      })
    }
  }, [delivererId, toast])

  // Carrega dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Busca entregador
        const { data: delivererData, error: delivererError } = await supabase
          .from("deliverers")
          .select("*")
          .eq("id", delivererId)
          .single()

        if (delivererError) throw delivererError
        setDeliverer(delivererData)

        // Busca bairros
        const { data: neighborhoodsData, error: neighborhoodsError } = await supabase
          .from("neighborhoods")
          .select("*")

        if (neighborhoodsError) throw neighborhoodsError
        setNeighborhoods(neighborhoodsData || [])

        await fetchTodayDeliveries()
      } catch (error) {
        toast({
          title: "Erro",
          description: "Falha ao carregar dados",
          variant: "destructive",
        })
        router.push("/")
      }
    }

    loadInitialData()
  }, [delivererId, router, toast, fetchTodayDeliveries])

  // Atualiza taxa quando muda o bairro
  useEffect(() => {
    const neighborhood = neighborhoods.find(n => n.name === selectedNeighborhood)
    setDeliveryFee(neighborhood?.delivery_fee || 0)
  }, [selectedNeighborhood, neighborhoods])

  // Configura realtime
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
        () => fetchTodayDeliveries()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [delivererId, fetchTodayDeliveries])

  // Registra nova entrega
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.address || !selectedNeighborhood || !formData.deliveryType || !formData.orderValue) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos!",
        variant: "destructive",
      })
      return
    }

    if (!deliverer) return

    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from("deliveries")
        .insert([{
          deliverer_id: deliverer.id,
          deliverer_name: deliverer.name,
          address: formData.address,
          neighborhood: selectedNeighborhood,
          delivery_type: formData.deliveryType,
          order_value: Number(formData.orderValue),
          delivery_fee: deliveryFee,
        }])
        .select()
        .single()

      if (error) throw error

      setDeliveries(prev => [data, ...prev])
      setFormData({ address: "", deliveryType: "", orderValue: "" })
      setSelectedNeighborhood("")

      toast({
        title: "✅ Sucesso",
        description: "Entrega registrada!",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao registrar entrega",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Edição de entrega
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
  }

  const saveEdit = async () => {
    if (!editingDelivery) return

    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from("deliveries")
        .update({
          address: formData.address,
          neighborhood: selectedNeighborhood,
          delivery_type: formData.deliveryType,
          order_value: Number(formData.orderValue),
          delivery_fee: deliveryFee,
        })
        .eq("id", editingDelivery.id)
        .select()
        .single()

      if (error) throw error

      setDeliveries(prev => 
        prev.map(d => d.id === editingDelivery.id ? data : d)
      )
      cancelEditing()

      toast({
        title: "✅ Sucesso",
        description: "Entrega atualizada!",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar entrega",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Remove entrega
  const deleteDelivery = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta entrega?")) return

    try {
      await supabase.from("deliveries").delete().eq("id", id)
      setDeliveries(prev => prev.filter(d => d.id !== id))
      toast({
        title: "✅ Sucesso",
        description: "Entrega removida!",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao remover entrega",
        variant: "destructive",
      })
    }
  }

  // Logout
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
          {/* Cabeçalho */}
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
              <p className="text-gray-600">{deliverer?.name || "Carregando..."}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                <div className="text-2xl font-bold text-green-600">
                  R$ {todayStats.totalFees.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  R$ {todayStats.totalValue.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estatísticas por Tipo de Entrega */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Entregas por Tipo</h4>
                    <div className="space-y-2">
                      {Object.entries(report.deliveriesByType).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <Badge variant="secondary">{DELIVERY_TYPES[type] || type}</Badge>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Valores por Tipo</h4>
                    <div className="space-y-2">
                      {Object.entries(report.valuesByType).map(([type, value]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-sm">{DELIVERY_TYPES[type] || type}</span>
                          <span className="font-semibold">R$ {value.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Formulário e Lista */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingDelivery ? "Editar Entrega" : "Nova Entrega"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={editingDelivery ? saveEdit : handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço *</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Digite o endereço completo"
                      required
                      disabled={loading}
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
                            {n.name} (R$ {n.delivery_fee.toFixed(2)})
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
                        {DELIVERY_TYPE_OPTIONS.map((type) => (
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
                          disabled={loading}
                        >
                          {loading ? "Salvando..." : (
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
                        disabled={loading}
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
                      const deliveryType = DELIVERY_TYPE_OPTIONS.find((t) => t.value === delivery.delivery_type)
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
                                  onClick={() => startEditing(delivery)}
                                  title="Editar entrega"
                                  className="hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Edit className="h-4 w-4" />
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
                                  <Badge>
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