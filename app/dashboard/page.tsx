"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, FileText, Settings, Pizza, LogOut } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Deliverer {
  id: string
  name: string
  phone?: string
}

export default function RestaurantDashboard() {
  const [deliverers, setDeliverers] = useState<Deliverer[]>([])
  const router = useRouter()

  useEffect(() => {
    // Verificar se é acesso do restaurante
    const userType = localStorage.getItem("userType")
    if (userType !== "restaurant") {
      router.push("/")
      return
    }

    async function fetchDeliverers() {
      try {
        const res = await fetch("/api/entregadores")
        if (!res.ok) throw new Error("Erro ao carregar entregadores")
        const data: Deliverer[] = await res.json()
        setDeliverers(data)
      } catch (error) {
        console.error(error)
        // Aqui você pode adicionar tratamento visual de erro, se quiser
      }
    }

    fetchDeliverers()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("userType")
    localStorage.removeItem("userId")
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="text-center">
            <div className="flex items-center gap-2 mb-4">
              <Pizza className="h-8 w-8 text-orange-600" />
              <h1 className="text-3xl font-bold text-gray-900">Painel do Restaurante</h1>
            </div>
            <p className="text-gray-600">Acesso completo ao sistema de entregas</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {deliverers.map((deliverer) => (
            <Card key={deliverer.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  {deliverer.name}
                </CardTitle>
                {deliverer.phone && <p className="text-sm text-muted-foreground">{deliverer.phone}</p>}
              </CardHeader>
              <CardContent>
                <Link href={`/entregador/${deliverer.id}`}>
                  <Button className="w-full" size="lg">
                    Ver Painel do Entregador
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                Relatórios e Fechamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">Visualize relatórios detalhados e faça o fechamento do dia</p>
              <Link href="/fechamento">
                <Button className="w-full bg-transparent" variant="outline" size="lg">
                  Acessar Fechamento
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-600" />
                Configurações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">Gerencie bairros, entregadores e configurações do sistema</p>
              <Link href="/configuracoes">
                <Button className="w-full bg-transparent" variant="outline" size="lg">
                  Configurar Sistema
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
