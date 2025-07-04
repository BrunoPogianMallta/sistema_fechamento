"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { MapPin, Plus, Trash2, Edit } from "lucide-react"

interface Neighborhood {
  id: string
  name: string
  deliveryFee: number
}

export function NeighborhoodManager() {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
  const [formData, setFormData] = useState({ name: "", deliveryFee: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadNeighborhoods()
  }, [])

  const loadNeighborhoods = () => {
    const saved = localStorage.getItem("neighborhoods")
    if (saved) {
      setNeighborhoods(JSON.parse(saved))
    } else {
      // Bairros padrão
      const defaultNeighborhoods = [
        { id: "1", name: "Centro", deliveryFee: 3.0 },
        { id: "2", name: "Jardim América", deliveryFee: 4.0 },
        { id: "3", name: "Vila Nova", deliveryFee: 5.0 },
        { id: "4", name: "Bairro Alto", deliveryFee: 6.0 },
      ]
      setNeighborhoods(defaultNeighborhoods)
      localStorage.setItem("neighborhoods", JSON.stringify(defaultNeighborhoods))
    }
  }

  const saveNeighborhoods = (updatedNeighborhoods: Neighborhood[]) => {
    setNeighborhoods(updatedNeighborhoods)
    localStorage.setItem("neighborhoods", JSON.stringify(updatedNeighborhoods))
  }

  const handleSubmit = (e: React.FormEvent) => {
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
    if (isNaN(deliveryFee) || deliveryFee < 0) {
      toast({
        title: "Erro",
        description: "Taxa de entrega deve ser um número válido",
        variant: "destructive",
      })
      return
    }

    if (editingId) {
      // Editar bairro existente
      const updated = neighborhoods.map((n) => (n.id === editingId ? { ...n, name: formData.name, deliveryFee } : n))
      saveNeighborhoods(updated)
      setEditingId(null)
      toast({
        title: "Sucesso",
        description: "Bairro atualizado com sucesso!",
      })
    } else {
      // Adicionar novo bairro
      const newNeighborhood: Neighborhood = {
        id: Date.now().toString(),
        name: formData.name,
        deliveryFee,
      }
      saveNeighborhoods([...neighborhoods, newNeighborhood])
      toast({
        title: "Sucesso",
        description: "Bairro adicionado com sucesso!",
      })
    }

    setFormData({ name: "", deliveryFee: "" })
  }

  const handleEdit = (neighborhood: Neighborhood) => {
    setFormData({
      name: neighborhood.name,
      deliveryFee: neighborhood.deliveryFee.toString(),
    })
    setEditingId(neighborhood.id)
  }

  const handleDelete = (id: string) => {
    const updated = neighborhoods.filter((n) => n.id !== id)
    saveNeighborhoods(updated)
    toast({
      title: "Sucesso",
      description: "Bairro removido com sucesso!",
    })
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
                <Label htmlFor="name">Nome do Bairro</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Digite o nome do bairro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryFee">Taxa de Entrega (R$)</Label>
                <Input
                  id="deliveryFee"
                  type="number"
                  step="0.01"
                  value={formData.deliveryFee}
                  onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">{editingId ? "Atualizar" : "Adicionar"} Bairro</Button>
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
          {neighborhoods.length === 0 ? (
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
                      R$ {neighborhood.deliveryFee.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(neighborhood)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(neighborhood.id)}>
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
