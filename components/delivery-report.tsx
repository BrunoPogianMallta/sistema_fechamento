"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, DollarSign, Package, User, Trash2 } from "lucide-react"

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

interface DelivererReport {
  delivererId: string
  delivererName: string
  totalDeliveries: number
  totalDeliveryFees: number
  deliveriesByType: Record<string, number>
  valuesByType: Record<string, number>
}

const DELIVERY_TYPES = {
  ifood: "iFood",
  app: "App Próprio",
  card: "Cartão",
  cash: "Dinheiro",
  pix: "PIX",
}

export function DeliveryReport() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [selectedDeliverer, setSelectedDeliverer] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0])

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
    setDeliveries([])
    localStorage.removeItem("deliveries")
  }

  const filteredDeliveries = deliveries.filter((delivery) => {
    const deliveryDate = new Date(delivery.timestamp).toISOString().split("T")[0]
    const matchesDate = deliveryDate === selectedDate
    const matchesDeliverer = selectedDeliverer === "all" || delivery.delivererId === selectedDeliverer
    return matchesDate && matchesDeliverer
  })

  const generateReport = (): DelivererReport[] => {
    const reportMap = new Map<string, DelivererReport>()

    filteredDeliveries.forEach((delivery) => {
      if (!reportMap.has(delivery.delivererId)) {
        reportMap.set(delivery.delivererId, {
          delivererId: delivery.delivererId,
          delivererName: delivery.delivererName,
          totalDeliveries: 0,
          totalDeliveryFees: 0,
          deliveriesByType: {},
          valuesByType: {},
        })
      }

      const report = reportMap.get(delivery.delivererId)!
      report.totalDeliveries++
      report.totalDeliveryFees += delivery.deliveryFee

      // Contar por tipo
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

  const uniqueDeliverers = Array.from(new Set(deliveries.map((d) => ({ id: d.delivererId, name: d.delivererName }))))

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
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
        <div className="flex-1">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md"
          />
        </div>
        <Button onClick={clearAllDeliveries} variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Limpar Tudo
        </Button>
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Entregas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total em Taxas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ {totalDeliveryFees.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Pedidos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">R$ {totalOrderValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Relatório por Entregador */}
      {reports.map((report) => (
        <Card key={report.delivererId}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {report.delivererName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total de Entregas</p>
                <p className="text-2xl font-bold">{report.totalDeliveries}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total em Taxas</p>
                <p className="text-2xl font-bold text-green-600">R$ {report.totalDeliveryFees.toFixed(2)}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-3">Entregas por Tipo</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {Object.entries(report.deliveriesByType).map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="justify-center p-2">
                    {DELIVERY_TYPES[type as keyof typeof DELIVERY_TYPES]}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Valores por Tipo</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(report.valuesByType).map(([type, value]) => (
                  <div key={type} className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">{DELIVERY_TYPES[type as keyof typeof DELIVERY_TYPES]}</span>
                    <span className="font-semibold">R$ {value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Lista de Entregas */}
      {filteredDeliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Entregas do Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entregador</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell>{delivery.delivererName}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{delivery.address}</TableCell>
                    <TableCell>{delivery.neighborhood}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {DELIVERY_TYPES[delivery.deliveryType as keyof typeof DELIVERY_TYPES]}
                      </Badge>
                    </TableCell>
                    <TableCell>R$ {delivery.orderValue.toFixed(2)}</TableCell>
                    <TableCell className="text-green-600">R$ {delivery.deliveryFee.toFixed(2)}</TableCell>
                    <TableCell>{new Date(delivery.timestamp).toLocaleTimeString()}</TableCell>
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
  )
}
