"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { User, Plus, Trash2, Edit } from "lucide-react"

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
  const { toast } = useToast()

  useEffect(() => {
    loadDeliverers()
  }, [])

  const loadDeliverers = () => {
    const saved = localStorage.getItem("deliverers")
    if (saved) {
      setDeliverers(JSON.parse(saved))
    } else {
      // Entregadores padrão
      const defaultDeliverers = [
        { id: "1", name: "João Silva", phone: "(11) 99999-1111", password: "password1" },
        { id: "2", name: "Maria Santos", phone: "(11) 99999-2222", password: "password2" },
        { id: "3", name: "Pedro Oliveira", phone: "(11) 99999-3333", password: "password3" },
      ]
      setDeliverers(defaultDeliverers)
      localStorage.setItem("deliverers", JSON.stringify(defaultDeliverers))
    }
  }

  const saveDeliverers = (updatedDeliverers: Deliverer[]) => {
    setDeliverers(updatedDeliverers)
    localStorage.setItem("deliverers", JSON.stringify(updatedDeliverers))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório",
        variant: "destructive",
      })
      return
    }

    if (editingId) {
      // Editar entregador existente
      const updated = deliverers.map((d) =>
        d.id === editingId ? { ...d, name: formData.name, phone: formData.phone, password: formData.password } : d,
      )
      saveDeliverers(updated)
      setEditingId(null)
      toast({
        title: "Sucesso",
        description: "Entregador atualizado com sucesso!",
      })
    } else {
      // Adicionar novo entregador
      const newDeliverer: Deliverer = {
        id: Date.now().toString(),
        name: formData.name,
        phone: formData.phone,
        password: formData.password || "123", // Senha padrão se não informada
      }
      saveDeliverers([...deliverers, newDeliverer])
      toast({
        title: "Sucesso",
        description: "Entregador adicionado com sucesso!",
      })
    }

    setFormData({ name: "", phone: "", password: "" })
  }

  const handleEdit = (deliverer: Deliverer) => {
    setFormData({
      name: deliverer.name,
      phone: deliverer.phone || "",
      password: deliverer.password || "123",
    })
    setEditingId(deliverer.id)
  }

  const handleDelete = (id: string) => {
    const updated = deliverers.filter((d) => d.id !== id)
    saveDeliverers(updated)
    toast({
      title: "Sucesso",
      description: "Entregador removido com sucesso!",
    })
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
          {deliverers.length === 0 ? (
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
