"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

// Adicionar interface para delivery com distância após as interfaces existentes:
interface DeliveryWithDistance extends Delivery {
  distanceKm?: number
  roundTripKm?: number
}

export default function FechamentoPage() {
  const [deliveries, setDeliveries] = useState<DeliveryWithDistance[]>([])
  const [selectedDeliverer, setSelectedDeliverer] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])
  const router = useRouter()

  useEffect(() => {
    loadDeliveries()
  }, [])

  const loadDeliveries = () => {
    const savedDeliveries = localStorage.getItem("deliveries")
    if (savedDeliveries) {
      setDeliveries(JSON.parse(savedDeliveries))
    }
  }

  const deleteDelivery = (deliveryId: string) => {
    const updatedDeliveries = deliveries.filter((d) => d.id !== deliveryId)
    setDeliveries(updatedDeliveries)
    localStorage.setItem("deliveries", JSON.stringify(updatedDeliveries))
  }

  const clearAllDeliveries = () => {
    if (confirm("Tem certeza que deseja limpar todas as entregas? Esta ação não pode ser desfeita.")) {
      setDeliveries([])
      localStorage.removeItem("deliveries")
    }
  }

  const exportReport = () => {
    const reportData = {
      date: selectedDate,
      deliverer: selectedDeliverer === "all" ? "Todos" : uniqueDeliverers.find((d) => d.id === selectedDeliverer)?.name,
      summary: {
        totalDeliveries,
        totalDeliveryFees,
        totalOrderValue,
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
  }

  const filteredDeliveries = deliveries.filter((delivery) => {
    const deliveryDate = new Date(delivery.timestamp).toISOString().split("T")[0]
    const matchesDate = deliveryDate === selectedDate
    const matchesDeliverer = selectedDeliverer === "all" || delivery.delivererId === selectedDeliverer
    return matchesDate && matchesDeliverer
  })

  // Modificar a função generateReport para incluir quilometragem:
  const generateReport = (): any[] => {
    const reportMap = new Map<string, any>()

    filteredDeliveries.forEach((delivery) => {
      if (!reportMap.has(delivery.delivererId)) {
        reportMap.set(delivery.delivererId, {
          delivererId: delivery.delivererId,
          delivererName: delivery.delivererName,
          totalDeliveries: 0,
          totalDeliveryFees: 0,
          totalOrderValue: 0,
          totalKm: 0,
          deliveriesByType: {},
          valuesByType: {},
        })
      }

      const report = reportMap.get(delivery.delivererId)!
      report.totalDeliveries++
      report.totalDeliveryFees += delivery.deliveryFee
      report.totalOrderValue += delivery.orderValue
      report.totalKm += delivery.roundTripKm || 0

      if (!report.deliveriesByType[delivery.deliveryType]) {
        report.deliveriesByType[delivery.deliveryType] = 0
        report.valuesByType[delivery.deliveryType] = 0
      }
      report.deliveriesByType[delivery.deliveryType]++
      report.valuesByType[delivery.deliveryType] += delivery.orderValue
    })

    return Array.from(reportMap.values())
  }

  const reports = generateReport()
  const totalDeliveries = filteredDeliveries.length
  const totalDeliveryFees = filteredDeliveries.reduce((sum, d) => sum + d.deliveryFee, 0)
  const totalOrderValue = filteredDeliveries.reduce((sum, d) => sum + d.orderValue, 0)

  // Adicionar cálculo de quilometragem total:
  const totalKm = filteredDeliveries.reduce((sum, d) => sum + (d.roundTripKm || 0), 0)

  const uniqueDeliverers = Array.from(new Set(deliveries.map((d) => ({ id: d.delivererId, name: d.delivererName }))))

  const DELIVERY_TYPES = {
    ifood: "iFood",
    app: "App Próprio",
    card: "Cartão",
    cash: "Dinheiro",
    pix: "PIX",
  }

  const handleLogout = () => {
    localStorage.removeItem("userType")
    localStorage.removeItem("userId")
    router.push("/")
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
              <Button onClick={exportReport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button onClick={clearAllDeliveries} variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Tudo
              </Button>
            </div>
          </div>

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
                      {uniqueDeliverers.map((deliverer) => (
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
          {reports.map((report) => (
            <Card key={report.delivererId} className="mb-6">
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
                          <Badge variant="secondary">{DELIVERY_TYPES[type]}</Badge>
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
                          <span className="text-sm">{DELIVERY_TYPES[type]}</span>
                          <span className="font-semibold">R$ {value.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Lista Detalhada de Entregas */}
          {filteredDeliveries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Entregas Detalhadas</CardTitle>
              </CardHeader>
              <CardContent>
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
                        <TableCell>{new Date(delivery.timestamp).toLocaleTimeString()}</TableCell>
                        <TableCell>{delivery.delivererName}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{delivery.address}</TableCell>
                        <TableCell>{delivery.neighborhood}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{DELIVERY_TYPES[delivery.deliveryType]}</Badge>
                        </TableCell>
                        <TableCell>R$ {delivery.orderValue.toFixed(2)}</TableCell>
                        <TableCell className="text-green-600">R$ {delivery.deliveryFee.toFixed(2)}</TableCell>
                        <TableCell className="text-orange-600">
                          {delivery.roundTripKm ? `${delivery.roundTripKm.toFixed(1)} km` : "-"}
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
              </CardContent>
            </Card>
          )}

          {filteredDeliveries.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma entrega encontrada para os filtros selecionados</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
