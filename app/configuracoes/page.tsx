"use client"

import { NeighborhoodManager } from "@/components/neighborhood-manager"
import { DelivererManager } from "@/components/deliverer-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Users, Settings, LogOut } from "lucide-react"
import Link from "next/link"
import { PizzariaConfig } from "@/components/pizzaria-config"
import { AuthGuard } from "@/components/auth-guard"
import { useRouter } from "next/navigation"

export default function ConfiguracoesPage() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem("userType")
    localStorage.removeItem("userId")
    router.push("/")
  }

  return (
    <AuthGuard allowedUserTypes={["restaurant"]}>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <div className="max-w-6xl mx-auto">
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
                  <Settings className="h-6 w-6" />
                  Configurações do Sistema
                </h1>
                <p className="text-gray-600">Gerencie bairros, entregadores e configurações</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="pizzaria" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pizzaria" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Pizzaria
              </TabsTrigger>
              <TabsTrigger value="neighborhoods" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Bairros
              </TabsTrigger>
              <TabsTrigger value="deliverers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Entregadores
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pizzaria">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações da Pizzaria</CardTitle>
                  <CardDescription>Configure o endereço da pizzaria e API do Google Maps</CardDescription>
                </CardHeader>
                <CardContent>
                  <PizzariaConfig />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="neighborhoods">
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciar Bairros</CardTitle>
                  <CardDescription>Configure os bairros e suas respectivas taxas de entrega</CardDescription>
                </CardHeader>
                <CardContent>
                  <NeighborhoodManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deliverers">
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciar Entregadores</CardTitle>
                  <CardDescription>Cadastre e gerencie os entregadores da pizzaria</CardDescription>
                </CardHeader>
                <CardContent>
                  <DelivererManager />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  )
}
