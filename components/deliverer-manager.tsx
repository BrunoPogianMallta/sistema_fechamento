"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { User, Plus, Trash2, Edit } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Skeleton } from "@/components/ui/skeleton"

interface Deliverer {
  id: string
  name: string
  phone?: string
  password?: string
}

export function DelivererManager() {
  const [deliverers, setDeliverers] = useState<Deliverer[]>([])
  const [formData, setFormData] = useState({ name: "", phone: "", password: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadDeliverers()
  }, [])

  const loadDeliverers = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('deliverers')
        .select('id, name, phone')
        .order('name', { ascending: true })

      if (error) throw error

      setDeliverers(data || [])
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar entregadores",
        variant: "destructive",
      })
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      })
      return
    }

    try {
      if (editingId) {
        // Atualizar entregador existente
        const { error } = await supabase
          .from('deliverers')
          .update({
            name: formData.name,
            phone: formData.phone,
            password: formData.password || "123"
          })
          .eq('id', editingId)

        if (error) throw error

        toast({
          title: "Sucesso",
          description: "Entregador atualizado com sucesso!",
        })
      } else {
        // Criar novo entregador
        const { data, error } = await supabase
          .from('deliverers')
          .insert([{
            name: formData.name,
            phone: formData.phone,
            password: formData.password || "123"
          }])
          .select()

        if (error) throw error

        // Criar usuário associado
        await supabase
          .from('users')
          .insert([{
            username: formData.name.toLowerCase().replace(/\s+/g, ''),
            password: formData.password || "123",
            user_type: 'deliverer',
            deliverer_id: data[0].id
          }])

        toast({
          title: "Sucesso",
          description: "Entregador adicionado com sucesso!",
        })
      }

      setFormData({ name: "", phone: "", password: "" })
      setEditingId(null)
      loadDeliverers()
    } catch (error) {
      toast({
        title: "Erro",
        description: editingId ? "Falha ao atualizar entregador" : "Falha ao adicionar entregador",
        variant: "destructive",
      })
      console.error(error)
    }
  }

  const handleEdit = (deliverer: Deliverer) => {
    setFormData({
      name: deliverer.name,
      phone: deliverer.phone || "",
      password: deliverer.password || "123",
    })
    setEditingId(deliverer.id)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este entregador?")) return

    try {
      // Primeiro remover o usuário associado
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('deliverer_id', id)

      if (userError) throw userError

      // Depois remover o entregador
      const { error } = await supabase
        .from('deliverers')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Entregador removido com sucesso!",
      })

      loadDeliverers()
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao remover entregador",
        variant: "destructive",
      })
      console.error(error)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormData({ name: "", phone: "", password: "" })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {editingId ? "Editar Entregador" : "Adicionar Novo Entregador"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Digite o nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha de Acesso</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Senha para login do entregador"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">{editingId ? "Atualizar" : "Adicionar"} Entregador</Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Entregadores Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : deliverers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum entregador cadastrado ainda</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliverers.map((deliverer) => (
                  <TableRow key={deliverer.id}>
                    <TableCell className="font-medium">{deliverer.name}</TableCell>
                    <TableCell>{deliverer.phone || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(deliverer)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(deliverer.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}