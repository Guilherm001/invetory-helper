'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Product } from '../../hooks/useProducts'
import {Label} from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"


interface EditProductDialogProps {
    open: boolean
    product: Product | null
    onClose: () => void
    onSave: (id: string, data: Partial<Product>) => Promise<void>
}

export default function EditProductDialog({ open, product, onClose, onSave }: EditProductDialogProps) {
    const [formData, setFormData] = useState<Partial<Product>>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name,
                quantity: product.quantity,
                priority: product.priority,
                status: product.status,
                notes: product.notes || ''
            })
        }
    }, [product])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!product?.id) return

        setLoading(true)
        try {
            await onSave(product.id, formData)
            onClose()
        } catch (error) {
            alert('Erro ao atualizar produto')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900">Editar Produto</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Nome do Produto</label>
                        <input
                            required
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Quantidade</label>
                            <input
                                type="number"
                                min="1"
                                required
                                value={formData.quantity || 0}
                                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Prioridade</label>
                            <RadioGroup
                              value={formData.priority || "Média"}
                              onValueChange={(value) =>
                                setFormData({ ...formData, priority: value })
                              }
                            >
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value="Baixa" id="baixa" />
                                <Label htmlFor="baixa">Baixa</Label>
                              </div>
                          
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value="Média" id="media" />
                                <Label htmlFor="media">Média</Label>
                              </div>
                          
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value="Alta" id="alta" />
                                <Label htmlFor="alta">Alta</Label>
                              </div>
                            </RadioGroup>
                            
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Status</label>
                        <RadioGroup
                            className='flex'
                              value={formData.status || "Pendente"}
                              onValueChange={(value) =>
                                setFormData({ ...formData, status: value })
                              }
                            >
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value="Pendente" id="pendente" />
                                <Label htmlFor="pendente">Pendente</Label>
                              </div>
                          
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value="Em progresso" id="progresso" />
                                <Label htmlFor="progresso">Em progresso</Label>
                              </div>
                          
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value="Concluído" id="concluido" />
                                <Label htmlFor="concluido">Concluído</Label>
                              </div>
                            </RadioGroup>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Notas</label>
                        <textarea
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[80px]"
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={loading}
                        >
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
