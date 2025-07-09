"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
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
  Printer,
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
  rappi: "Rappi",
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

  // Carregar entregas
  useEffect(() => {
  async function fetchDeliveries() {
    setLoading(true)
    try {
      // Ajuste para o fuso horário do Brasil (UTC-3)
      const timezoneOffset = -3 * 60 * 60 * 1000
      
      // Período: 18:00 do dia selecionado até 02:30 do dia seguinte
      const startDateObj = new Date(selectedDate)
      startDateObj.setHours(18, 0, 0, 0)
      const startDate = new Date(startDateObj.getTime() + timezoneOffset).toISOString()
      
      const endDateObj = new Date(selectedDate)
      endDateObj.setDate(endDateObj.getDate() + 1) // Dia seguinte
      endDateObj.setHours(2, 30, 0, 0) // Até 02:30
      const endDate = new Date(endDateObj.getTime() + timezoneOffset).toISOString()

      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }
      setDeliveries(data || [])
    } catch (error) {
      console.error("Erro ao buscar entregas:", error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar entregas.",
        variant: "destructive",
      })
      setDeliveries([])
    } finally {
      setLoading(false)
    }
  }
  fetchDeliveries()
}, [selectedDate, toast])

  // Filtrar entregas por entregador
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      if (selectedDeliverer === "all") return true
      return delivery.deliverer_id === selectedDeliverer
    })
  }, [deliveries, selectedDeliverer])

  // Gerar relatório por entregador
  const reports = useMemo((): DelivererReport[] => {
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

      // Contar por tipo
      if (!report.deliveriesByType[delivery.delivery_type]) {
        report.deliveriesByType[delivery.delivery_type] = 0
        report.valuesByType[delivery.delivery_type] = 0
      }
      report.deliveriesByType[delivery.delivery_type]++
      report.valuesByType[delivery.delivery_type] += delivery.order_value
    })
    return Array.from(reportMap.values())
  }, [filteredDeliveries])

  // Estatísticas gerais memoizadas
  const stats = useMemo(
    () => ({
      totalDeliveries: filteredDeliveries.length,
      totalDeliveryFees: filteredDeliveries.reduce((sum, d) => sum + d.delivery_fee, 0),
      totalOrderValue: filteredDeliveries.reduce((sum, d) => sum + d.order_value, 0),
      totalKm: filteredDeliveries.reduce((sum, d) => sum + (d.round_trip_km || 0), 0),
    }),
    [filteredDeliveries],
  )

  const deleteDelivery = useCallback(
    async (deliveryId: string) => {
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
    },
    [toast],
  )

  const exportReport = useCallback(() => {
    // Criar dados CSV para o resumo geral
    const csvContent = [
      "RELATÓRIO DE FECHAMENTO",
      `Data:,${selectedDate}`,
      `Entregador:,${selectedDeliverer === "all" ? "Todos" : deliverers.find((d) => d.id === selectedDeliverer)?.name || ""}`,
      "",
      "RESUMO GERAL",
      `Total de Entregas:,${stats.totalDeliveries.toString()}`,
      `Total em Taxas:,R$ ${stats.totalDeliveryFees.toFixed(2)}`,
      `Valor Total Pedidos:,R$ ${stats.totalOrderValue.toFixed(2)}`,
      `Total Km Rodados:,${stats.totalKm.toFixed(1)} km`,
      "",
      "RELATÓRIOS POR ENTREGADOR",
      "",
    ]

    // Adicionar dados dos entregadores
    reports.forEach((report) => {
      csvContent.push(`Entregador: ${report.delivererName}`)
      csvContent.push(`Entregas:,${report.totalDeliveries.toString()}`)
      csvContent.push(`Taxas:,R$ ${report.totalDeliveryFees.toFixed(2)}`)
      csvContent.push(`Valor Total:,R$ ${report.totalOrderValue.toFixed(2)}`)
      csvContent.push(`Km Rodados:,${report.totalKm.toFixed(1)} km`)
      csvContent.push("")

      csvContent.push("Entregas por Tipo:")
      Object.entries(report.deliveriesByType).forEach(([type, count]) => {
        csvContent.push(`  ${DELIVERY_TYPES[type] || type}:,${count.toString()}`)
      })
      csvContent.push("")
    })

    // Adicionar entregas detalhadas
    csvContent.push("ENTREGAS DETALHADAS")
    csvContent.push("")
    csvContent.push("Hora,Entregador,Endereço,Bairro,Tipo,Valor Pedido,Taxa Entrega,Km")

    filteredDeliveries.forEach((delivery) => {
      const hora = new Date(delivery.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      const tipo = DELIVERY_TYPES[delivery.delivery_type] || delivery.delivery_type
      const valor = `R$ ${delivery.order_value.toFixed(2)}`
      const taxa = `R$ ${delivery.delivery_fee.toFixed(2)}`
      const km = delivery.round_trip_km ? `${delivery.round_trip_km.toFixed(1)} km` : "-"

      csvContent.push(
        `${hora},"${delivery.deliverer_name}","${delivery.address}","${delivery.neighborhood}","${tipo}",${valor},${taxa},${km}`,
      )
    })

    // Criar e baixar arquivo CSV
    const csvString = csvContent.join("\n")
    const BOM = "\uFEFF" // BOM para UTF-8 para Excel reconhecer acentos
    const blob = new Blob([BOM + csvString], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `fechamento-${selectedDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [selectedDate, selectedDeliverer, deliverers, stats, reports, filteredDeliveries])

  const printThermalReceipt = useCallback(() => {
    const printContent = `
================================
      FECHAMENTO DO DIA
================================
Data: ${new Date(selectedDate).toLocaleDateString("pt-BR")}
Entregador: ${selectedDeliverer === "all" ? "TODOS" : deliverers.find((d) => d.id === selectedDeliverer)?.name || ""}

================================
         RESUMO GERAL
================================
Total de Entregas: ${stats.totalDeliveries}
Total em Taxas: R$ ${stats.totalDeliveryFees.toFixed(2)}
Valor Total Pedidos: R$ ${stats.totalOrderValue.toFixed(2)}
Total Km Rodados: ${stats.totalKm.toFixed(1)} km

Média por Entrega:
- Taxa: R$ ${stats.totalDeliveries > 0 ? (stats.totalDeliveryFees / stats.totalDeliveries).toFixed(2) : "0,00"}
- Valor: R$ ${stats.totalDeliveries > 0 ? (stats.totalOrderValue / stats.totalDeliveries).toFixed(2) : "0,00"}
- Km: ${stats.totalDeliveries > 0 ? (stats.totalKm / stats.totalDeliveries).toFixed(1) : "0,0"} km

${
  reports.length > 0
    ? `
================================
     RELATÓRIO POR ENTREGADOR
================================
${reports
  .map(
    (report) => `
${report.delivererName}:
- Entregas: ${report.totalDeliveries}
- Taxas: R$ ${report.totalDeliveryFees.toFixed(2)}
- Valor Total: R$ ${report.totalOrderValue.toFixed(2)}
- Km: ${report.totalKm.toFixed(1)} km

Tipos de Entrega:
${Object.entries(report.deliveriesByType)
  .map(([type, count]) => `  ${DELIVERY_TYPES[type] || type}: ${count}`)
  .join("\n")}
`,
  )
  .join("\n--------------------------------\n")}`
    : ""
}

================================
      ENTREGAS DETALHADAS
================================
${filteredDeliveries
  .map(
    (delivery) => `
${new Date(delivery.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - ${delivery.deliverer_name}
${delivery.address}
${delivery.neighborhood}
${DELIVERY_TYPES[delivery.delivery_type] || delivery.delivery_type}
Valor: R$ ${delivery.order_value.toFixed(2)} | Taxa: R$ ${delivery.delivery_fee.toFixed(2)}
${delivery.round_trip_km ? `Km: ${delivery.round_trip_km.toFixed(1)}` : ""}
`,
  )
  .join("\n--------------------------------\n")}

================================
     Gerado em: ${new Date().toLocaleString("pt-BR")}
================================
`

    // Criar uma nova janela para impressão
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Fechamento ${selectedDate}</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.2;
                margin: 0;
                padding: 10px;
                white-space: pre-wrap;
                width: 58mm;
              }
              @media print {
                body {
                  margin: 0;
                  padding: 5px;
                }
              }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }
  }, [selectedDate, selectedDeliverer, deliverers, stats, reports, filteredDeliveries])

  const handleLogout = useCallback(() => {
    localStorage.removeItem("userType")
    localStorage.removeItem("userId")
    localStorage.removeItem("userName")
    router.push("/")
  }, [router])

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
          {/* Header Responsivo */}
          <div className="mb-6">
            {/* Mobile Header */}
            <div className="block lg:hidden">
              {/* Container principal com overflow controlado */}
              <div className="w-full overflow-hidden">
                {/* Botões de navegação mobile - linha superior */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <Link href="/dashboard" className="flex-1 max-w-[120px]">
                    <Button variant="outline" size="sm" className="w-full h-8 text-xs bg-transparent">
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      Voltar
                    </Button>
                  </Link>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    size="sm"
                    className="flex-1 max-w-[120px] h-8 text-xs bg-transparent"
                  >
                    <LogOut className="h-3 w-3 mr-1" />
                    Sair
                  </Button>
                </div>

                {/* Título mobile - centralizado */}
                <div className="text-center mb-3 px-1">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <h1 className="text-base font-bold text-gray-900 leading-tight">Fechamento</h1>
                  </div>
                  <p className="text-xs text-gray-600 leading-tight px-2">Relatórios das entregas</p>
                </div>

                {/* Botões de ação mobile */}
                <div className="flex justify-center gap-2 mb-4">
                  <Button
                    onClick={exportReport}
                    variant="outline"
                    size="sm"
                    disabled={filteredDeliveries.length === 0}
                    className="h-9 bg-white hover:bg-gray-50 border-green-200 hover:border-green-300"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    onClick={printThermalReceipt}
                    variant="outline"
                    size="sm"
                    disabled={filteredDeliveries.length === 0}
                    className="h-9 bg-white hover:bg-gray-50 border-blue-200 hover:border-blue-300"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden lg:block">
              <div className="flex items-center justify-between mb-2">
                {/* Lado esquerdo - Botões de navegação */}
                <div className="flex items-center gap-3">
                  <Link href="/dashboard">
                    <Button variant="outline" size="sm" className="h-9 bg-transparent">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Dashboard
                    </Button>
                  </Link>
                  <Button onClick={handleLogout} variant="outline" size="sm" className="h-9 bg-transparent">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </Button>
                </div>

                {/* Lado direito - Botões de ação */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={exportReport}
                    variant="outline"
                    disabled={filteredDeliveries.length === 0}
                    className="h-9 bg-white hover:bg-gray-50 border-green-200 hover:border-green-300"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    onClick={printThermalReceipt}
                    variant="outline"
                    disabled={filteredDeliveries.length === 0}
                    className="h-9 bg-white hover:bg-gray-50 border-blue-200 hover:border-blue-300"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </div>

              {/* Título e descrição desktop */}
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <FileText className="h-6 w-6 text-green-600" />
                  <h1 className="text-2xl font-bold text-gray-900">Fechamento e Relatórios</h1>
                </div>
                <p className="text-gray-600">Relatórios detalhados das entregas</p>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
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
                    className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo Geral */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="transition-all duration-300 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Entregas</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDeliveries}</div>
                <p className="text-xs text-muted-foreground">
                  {selectedDate === new Date().toISOString().split("T")[0] ? "Hoje" : selectedDate}
                </p>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total em Taxas</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">R$ {stats.totalDeliveryFees.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Média: R${" "}
                  {stats.totalDeliveries > 0 ? (stats.totalDeliveryFees / stats.totalDeliveries).toFixed(2) : "0,00"}
                </p>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total Pedidos</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">R$ {stats.totalOrderValue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Ticket médio: R${" "}
                  {stats.totalDeliveries > 0 ? (stats.totalOrderValue / stats.totalDeliveries).toFixed(2) : "0,00"}
                </p>
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Km Rodados</CardTitle>
                <Navigation className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.totalKm.toFixed(1)} km</div>
                <p className="text-xs text-muted-foreground">
                  Média: {stats.totalDeliveries > 0 ? (stats.totalKm / stats.totalDeliveries).toFixed(1) : "0,0"}{" "}
                  km/entrega
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Relatório por Entregador */}
          {reports.length > 0 && (
            <div className="space-y-6 mb-6">
              {reports.map((report) => (
                <Card key={report.delivererId} className="transition-all duration-300 hover:shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {report.delivererName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="text-center lg:text-left">
                        <p className="text-sm text-muted-foreground">Entregas</p>
                        <p className="text-xl lg:text-2xl font-bold">{report.totalDeliveries}</p>
                      </div>
                      <div className="text-center lg:text-left">
                        <p className="text-sm text-muted-foreground">Taxas</p>
                        <p className="text-xl lg:text-2xl font-bold text-green-600">
                          R$ {report.totalDeliveryFees.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center lg:text-left">
                        <p className="text-sm text-muted-foreground">Valor Total</p>
                        <p className="text-xl lg:text-2xl font-bold text-blue-600">
                          R$ {report.totalOrderValue.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center lg:text-left">
                        <p className="text-sm text-muted-foreground">Km Rodados</p>
                        <p className="text-xl lg:text-2xl font-bold text-orange-600">{report.totalKm.toFixed(1)} km</p>
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
                              <span className="text-sm">{DELIVERY_TYPES[type] || type}</span>
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

          {/* Lista Detalhada de Entregas */}
          {filteredDeliveries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Entregas Detalhadas</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mobile View */}
                <div className="block md:hidden space-y-3">
                  {filteredDeliveries.map((delivery) => (
                    <Card key={delivery.id} className="p-3">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{delivery.deliverer_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(delivery.created_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => deleteDelivery(delivery.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{delivery.address}</p>
                          <p className="text-xs text-muted-foreground">{delivery.neighborhood}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <Badge variant="outline">
                            {DELIVERY_TYPES[delivery.delivery_type] || delivery.delivery_type}
                          </Badge>
                          <div className="text-right">
                            <p className="text-sm font-medium">R$ {delivery.order_value.toFixed(2)}</p>
                            <p className="text-xs text-green-600">Taxa: R$ {delivery.delivery_fee.toFixed(2)}</p>
                          </div>
                        </div>
                        {delivery.round_trip_km && (
                          <p className="text-xs text-orange-600">{delivery.round_trip_km.toFixed(1)} km</p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead>Entregador</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Bairro</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Taxa</TableHead>
                        <TableHead>Km</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDeliveries.map((delivery) => (
                        <TableRow key={delivery.id}>
                          <TableCell>
                            {new Date(delivery.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>{delivery.deliverer_name}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={delivery.address}>
                            {delivery.address}
                          </TableCell>
                          <TableCell>{delivery.neighborhood}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {DELIVERY_TYPES[delivery.delivery_type] || delivery.delivery_type}
                            </Badge>
                          </TableCell>
                          <TableCell>R$ {delivery.order_value.toFixed(2)}</TableCell>
                          <TableCell className="text-green-600">R$ {delivery.delivery_fee.toFixed(2)}</TableCell>
                          <TableCell className="text-orange-600">
                            {delivery.round_trip_km ? `${delivery.round_trip_km.toFixed(1)} km` : "-"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => deleteDelivery(delivery.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mensagem quando não há entregas */}
          {filteredDeliveries.length === 0 && !loading && (
            <Card>
              <CardContent className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhuma entrega encontrada para {selectedDate}
                  {selectedDeliverer !== "all" &&
                    ` do entregador ${deliverers.find((d) => d.id === selectedDeliverer)?.name}`}
                </p>
                {deliverers.length > 0 && (
                  <div>
                    <p className="font-semibold mb-2">Entregadores disponíveis:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        variant={selectedDeliverer === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedDeliverer("all")}
                      >
                        Todos
                      </Button>
                      {deliverers.map((deliverer) => (
                        <Button
                          key={deliverer.id}
                          variant={selectedDeliverer === deliverer.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedDeliverer(deliverer.id)}
                        >
                          {deliverer.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
