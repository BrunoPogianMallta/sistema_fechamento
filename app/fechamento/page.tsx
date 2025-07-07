"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Package,
  User,
  Trash2,
  FileText,
  Download,
  Navigation,
  LogOut,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { supabase } from "@/lib/supabaseClient"

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
  round_trip_km?: number
  distance_km?: number
}

interface Deliverer {
  id: string
  name: string
}

interface DelivererReport {
  delivererId: string
  delivererName: string
  totalDeliveries: number
  totalDeliveryFees: number
  totalOrderValue: number
  totalKm: number
  deliveriesByType: Record<string, number>
  valuesByType: Record<string, number>
}

const DELIVERY_TYPES: Record<string, string> = {
  ifood: "iFood",
  app: "App Próprio",
  card: "Cartão",
  cash: "Dinheiro",
  pix: "PIX",
}

// Função para obter intervalo de data operacional (18:00 do dia até 01:00 do dia seguinte)
function getOperationalDateRange(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00")

  const start = new Date(date)
  start.setHours(18, 0, 0, 0) // 18:00 do dia selecionado

  const end = new Date(date)
  end.setDate(end.getDate() + 1)
  end.setHours(1, 0, 0, 0) // 01:00 do dia seguinte

  return { start, end }
}

// Opcional: para mostrar a data operacional correta no relatório
function getOperationalDate(createdAt: string): string {
  const date = new Date(createdAt)
  const hour = date.getHours()
  if (hour < 5) {
    date.setDate(date.getDate() - 1)
  }
  return date.toISOString().split("T")[0]
}

export default function FechamentoPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [deliverers, setDeliverers] = useState<Deliverer[]>([])
  const [selectedDeliverer, setSelectedDeliverer] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  // Carregar entregadores
  useEffect(() => {
    async function fetchDeliverers() {
      try {
        const { data, error } = await supabase.from("deliverers").select("id, name").order("name", { ascending: true })

        if (error) {
          console.error("Erro ao buscar entregadores:", error)
          toast({
            title: "Erro",
            description: "Não foi possível carregar entregadores.",
            variant: "destructive",
          })
          return
        }

        setDeliverers(data || [])
      } catch (error) {
        console.error("Erro inesperado ao buscar entregadores:", error)
      }
    }

    fetchDeliverers()
  }, [toast])

  // Carregar entregas considerando o horário operacional 18:00-01:00
  useEffect(() => {
    async function fetchDeliveries() {
      setLoading(true)
      try {
        const { start, end } = getOperationalDateRange(selectedDate)
        const startISO = start.toISOString()
        const endISO = end.toISOString()

        const { data, error } = await supabase
          .from("deliveries")
          .select("*")
          .gte("created_at", startISO)
          .lt("created_at", endISO)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Erro ao buscar entregas:", error)
          toast({
            title: "Erro",
            description: "Não foi possível carregar entregas.",
            variant: "destructive",
          })
          setDeliveries([])
          return
        }

        setDeliveries(data || [])
      } catch (error) {
        console.error("Erro inesperado ao buscar entregas:", error)
        setDeliveries([])
      } finally {
        setLoading(false)
      }
    }

    fetchDeliveries()
  }, [selectedDate, toast])

  // Filtrar entregas por entregador
  const filteredDeliveries = useMemo(() => {
    if (selectedDeliverer === "all") return deliveries
    return deliveries.filter((d) => d.deliverer_id === selectedDeliverer)
  }, [deliveries, selectedDeliverer])

  // Gerar relatório por entregador
  const generateReport = (): DelivererReport[] => {
    const reportMap = new Map<string, DelivererReport>()

    filteredDeliveries.forEach((delivery) => {
      if (!reportMap.has(delivery.deliverer_id)) {
        reportMap.set(delivery.deliverer_id, {
          delivererId: delivery.deliverer_id,
          delivererName: delivery.deliverer_name,
          totalDeliveries: 0,
          totalDeliveryFees: 0,
          totalOrderValue: 0,
          totalKm: 0,
          deliveriesByType: {},
          valuesByType: {},
        })
      }

      const report = reportMap.get(delivery.deliverer_id)!
      report.totalDeliveries++
      report.totalDeliveryFees += delivery.delivery_fee
      report.totalOrderValue += delivery.order_value
      report.totalKm += delivery.round_trip_km || 0

      if (!report.deliveriesByType[delivery.delivery_type]) {
        report.deliveriesByType[delivery.delivery_type] = 0
        report.valuesByType[delivery.delivery_type] = 0
      }
      report.deliveriesByType[delivery.delivery_type]++
      report.valuesByType[delivery.delivery_type] += delivery.order_value
    })

    return Array.from(reportMap.values())
  }

  const reports = generateReport()

  const totalDeliveries = filteredDeliveries.length
  const totalDeliveryFees = filteredDeliveries.reduce((sum, d) => sum + d.delivery_fee, 0)
  const totalOrderValue = filteredDeliveries.reduce((sum, d) => sum + d.order_value, 0)
  const totalKm = filteredDeliveries.reduce((sum, d) => sum + (d.round_trip_km || 0), 0)

  const deleteDelivery = async (deliveryId: string) => {
    if (!confirm("Tem certeza que deseja remover esta entrega?")) return

    try {
      const { error } = await supabase.from("deliveries").delete().eq("id", deliveryId)

      if (error) {
        toast({
          title: "Erro",
          description: "Falha ao remover entrega.",
          variant: "destructive",
        })
        return
      }

      setDeliveries((prev) => prev.filter((d) => d.id !== deliveryId))
      toast({
        title: "Sucesso",
        description: "Entrega removida com sucesso!",
      })
    } catch (error) {
      console.error("Erro ao deletar entrega:", error)
    }
  }

  const exportReport = () => {
    const reportData = {
      date: selectedDate,
      deliverer: selectedDeliverer === "all" ? "Todos" : deliverers.find((d) => d.id === selectedDeliverer)?.name,
      summary: {
        totalDeliveries,
        totalDeliveryFees,
        totalOrderValue,
        totalKm,
      },
      delivererReports: reports,
      deliveries: filteredDeliveries,
    }

    const dataStr = JSON.stringify(reportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `relatorio-${selectedDate}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleLogout = () => {
    localStorage.removeItem("userType")
    localStorage.removeItem("userId")
    localStorage.removeItem("userName")
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando dados...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AuthGuard allowedUserTypes={["restaurant"]}>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Link href="/dashboard">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <Button onClick={handleLogout} variant="outline" size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-6 w-6" />
                  Fechamento e Relatórios
                </h1>
                <p className="text-gray-600">Relatórios detalhados das entregas</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportReport} variant="outline" disabled={filteredDeliveries.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Debug Info */}
          <Card className="mb-4 bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="text-sm text-blue-800">
                <p>
                  <strong>Debug:</strong> {deliveries.length} entregas carregadas | {deliverers.length} entregadores |{" "}
                  {filteredDeliveries.length} entregas filtradas
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Filtros */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Entregador</label>
                  <Select value={selectedDeliverer} onValueChange={setSelectedDeliverer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os entregadores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os entregadores</SelectItem>
                      {deliverers.map((deliverer) => (
                        <SelectItem key={deliverer.id} value={deliverer.id}>
                          {deliverer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo Geral */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Entregas</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalDeliveries}</div>
                <p className="text-xs text-muted-foreground">
                  {selectedDate === new Date().toISOString().split("T")[0] ? "Hoje" : selectedDate}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total em Taxas</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">R$ {totalDeliveryFees.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Média: R$ {totalDeliveries > 0 ? (totalDeliveryFees / totalDeliveries).toFixed(2) : "0,00"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total Pedidos</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">R$ {totalOrderValue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Ticket médio: R$ {totalDeliveries > 0 ? (totalOrderValue / totalDeliveries).toFixed(2) : "0,00"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Km Rodados</CardTitle>
                <Navigation className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{totalKm.toFixed(1)} km</div>
                <p className="text-xs text-muted-foreground">
                  Média: {totalDeliveries > 0 ? (totalKm / totalDeliveries).toFixed(1) : "0,0"} km/entrega
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Relatório por Entregador */}
          {reports.length > 0 && (
            <div className="space-y-6 mb-6">
              {reports.map((report) => (
                <Card key={report.delivererId}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {report.delivererName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Entregas</p>
                        <p className="text-2xl font-bold">{report.totalDeliveries}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Taxas</p>
                        <p className="text-2xl font-bold text-green-600">R$ {report.totalDeliveryFees.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Valor Total</p>
                        <p className="text-2xl font-bold text-blue-600">R$ {report.totalOrderValue.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Km Rodados</p>
                        <p className="text-2xl font-bold text-orange-600">{report.totalKm.toFixed(1)} km</p>
                      </div>
                    </div>

                    <Separator />

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
                              <Badge variant="secondary">{DELIVERY_TYPES[type] || type}</Badge>
                              <span className="font-semibold">R$ {value.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Tabela de entregas */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes das Entregas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entregador</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Valor Pedido</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Data / Hora</TableHead>
                    <TableHead>Km Ida e Volta</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeliveries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Nenhuma entrega encontrada para o filtro selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredDeliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell>{delivery.deliverer_name}</TableCell>
                      <TableCell>
                        {delivery.address} - {delivery.neighborhood}
                      </TableCell>
                      <TableCell>{DELIVERY_TYPES[delivery.delivery_type] || delivery.delivery_type}</TableCell>
                      <TableCell>R$ {delivery.order_value.toFixed(2)}</TableCell>
                      <TableCell>R$ {delivery.delivery_fee.toFixed(2)}</TableCell>
                      <TableCell>
                        {new Date(delivery.created_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>{delivery.round_trip_km ? delivery.round_trip_km.toFixed(1) : "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteDelivery(delivery.id)}
                          aria-label="Remover entrega"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  )
}
