"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pizza, User, Building2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabaseClient"

export default function LoginPage() {
  const [loginType, setLoginType] = useState<"deliverer" | "restaurant" | null>(null)
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async () => {
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Erro",
        description: "Preencha usuário e senha",
        variant: "destructive",
      })
      return
    }

    if (loginType === "restaurant") {
      // Login do restaurante - senha fixa para simplicidade
      if (credentials.username === "admin" && credentials.password === "123456") {
        // Busca o ID da config da pizzaria no Supabase
        const { data, error } = await supabase
          .from("config")
          .select("id")
          .limit(1)
          .single()

        if (error || !data) {
          toast({
            title: "Erro",
            description: "Não foi possível carregar as configurações da pizzaria.",
            variant: "destructive",
          })
          return
        }

        // Salva o tipo e o ID real da config no localStorage
        localStorage.setItem("userType", "restaurant")
        localStorage.setItem("userId", data.id)

        router.push("/dashboard")
      } else {
        toast({
          title: "Erro",
          description: "Usuário ou senha incorretos",
          variant: "destructive",
        })
      }
    } else if (loginType === "deliverer") {
      // Login do entregador - buscar no Supabase
      const { data, error } = await supabase
        .from("deliverers")
        .select("*")
        .eq("name", credentials.username)
        .eq("password", credentials.password)
        .single()

      if (error || !data) {
        toast({
          title: "Erro",
          description: "Entregador não encontrado ou senha incorreta",
          variant: "destructive",
        })
        return
      }

      // Login OK
      localStorage.setItem("userType", "deliverer")
      localStorage.setItem("userId", data.id)
      localStorage.setItem("userName", data.name)
      router.push(`/entregador/${data.id}`)
    }
  }

  if (!loginType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Pizza className="h-8 w-8 text-orange-600" />
              <h1 className="text-3xl font-bold text-gray-900">Sistema de Entregas</h1>
            </div>
            <p className="text-gray-600">Selecione seu tipo de acesso</p>
          </div>

          <div className="space-y-4">
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-orange-300"
              onClick={() => setLoginType("restaurant")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-orange-600" />
                  Acesso Restaurante
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Acesso completo ao sistema: relatórios, configurações, todos os entregadores
                </p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-300"
              onClick={() => setLoginType("deliverer")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Acesso Entregador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Acesso apenas ao seu painel individual de entregas</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {loginType === "restaurant" ? (
                <>
                  <Building2 className="h-5 w-5 text-orange-600" />
                  Login Restaurante
                </>
              ) : (
                <>
                  <User className="h-5 w-5 text-blue-600" />
                  Login Entregador
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{loginType === "restaurant" ? "Usuário" : "Nome do Entregador"}</Label>
              <Input
                id="username"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                placeholder={loginType === "restaurant" ? "admin" : "João Silva"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                placeholder="Digite sua senha"
              />
            </div>

            {loginType === "restaurant" && (
              <div className="text-xs text-muted-foreground bg-orange-50 p-2 rounded">
                <strong>Acesso padrão:</strong>
                <br />
                Usuário: admin
                <br />
                Senha: 123456
              </div>
            )}

            {loginType === "deliverer" && (
              <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
                <strong>Entregadores padrão:</strong>
                <br />
                João Silva, Maria Santos, Pedro Oliveira
                <br />
                Senha padrão: 123
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => setLoginType(null)} variant="outline" className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleLogin} className="flex-1">
                Entrar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
