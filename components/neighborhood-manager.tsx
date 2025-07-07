"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { MapPin, Plus, Trash2, Edit } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Skeleton } from "@/components/ui/skeleton"

interface Neighborhood {
  id: string
  name: string
  delivery_fee: number
}

export function NeighborhoodManager() {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
  const [formData, setFormData] = useState({ name: "", deliveryFee: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadNeighborhoods()
  }, [])

  const loadNeighborhoods = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('neighborhoods')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error

      setNeighborhoods(data || [])
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar bairros",
        variant: "destructive",
      })
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.deliveryFee) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      })
      return
    }

    const deliveryFee = Number.parseFloat(formData.deliveryFee)
    if (isNaN(deliveryFee)) {
      toast({
        title: "Erro",
        description: "Taxa de entrega deve ser um número válido",
        variant: "destructive",
      })
      return
    }

    try {
      if (editingId) {
        // Atualizar bairro existente
        const { error } = await supabase
          .from('neighborhoods')
          .update({ 
            name: formData.name,
            delivery_fee: deliveryFee
          })
          .eq('id', editingId)

        if (error) throw error

        toast({
          title: "Sucesso",
          description: "Bairro atualizado com sucesso!",
        })
      } else {
        // Adicionar novo bairro
        const { error } = await supabase
          .from('neighborhoods')
          .insert([{ 
            name: formData.name,
            delivery_fee: deliveryFee 
          }])

        if (error) throw error

        toast({
          title: "Sucesso",
          description: "Bairro adicionado com sucesso!",
        })
      }

      setFormData({ name: "", deliveryFee: "" })
      setEditingId(null)
      loadNeighborhoods()
    } catch (error) {
      toast({
        title: "Erro",
        description: editingId ? "Falha ao atualizar bairro" : "Falha ao adicionar bairro",
        variant: "destructive",
      })
      console.error(error)
    }
  }

  const handleEdit = (neighborhood: Neighborhood) => {
    setFormData({
      name: neighborhood.name,
      deliveryFee: neighborhood.delivery_fee.toString(),
    })
    setEditingId(neighborhood.id)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este bairro?")) return

    try {
      const { error } = await supabase
        .from('neighborhoods')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Sucesso",
        description: "Bairro removido com sucesso!",
      })

      loadNeighborhoods()
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao remover bairro",
        variant: "destructive",
      })
      console.error(error)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormData({ name: "", deliveryFee: "" })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {editingId ? "Editar Bairro" : "Adicionar Novo Bairro"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Bairro *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Digite o nome do bairro"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryFee">Taxa de Entrega (R$) *</Label>
                <Input
                  id="deliveryFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.deliveryFee}
                  onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">
                {editingId ? "Atualizar" : "Adicionar"} Bairro
              </Button>
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
            <MapPin className="h-5 w-5" />
            Bairros Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : neighborhoods.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum bairro cadastrado ainda</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Taxa de Entrega</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {neighborhoods.map((neighborhood) => (
                  <TableRow key={neighborhood.id}>
                    <TableCell className="font-medium">{neighborhood.name}</TableCell>
                    <TableCell className="text-green-600 font-semibold">
                      R$ {neighborhood.delivery_fee.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(neighborhood)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(neighborhood.id)}
                          className="hover:text-red-600"
                        >
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