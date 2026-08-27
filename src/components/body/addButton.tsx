'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { Product } from '../../hooks/useProducts'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { Label } from '../ui/label'

interface BotaoAddProps {
    addProduct: (product: Omit<Product, 'id' | 'created_at'>) => Promise<Product>
}

export default function BotaoAdd({ addProduct }: BotaoAddProps) {
    const [open, setOpen] = useState(false)
    const [name, setName] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [priority, setPriority] = useState('Média')
    const [status, setStatus] = useState('Pendente')
    const [notes, setNotes] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        setErrorMessage('')

        try {
            await addProduct({
                name,
                quantity,
                priority,
                status,
                notes,
            })

            setOpen(false)
            setName('')
            setQuantity(1)
            setPriority('Média')
            setStatus('Pendente')
            setNotes('')
        } catch (error: unknown) {
            setErrorMessage((error as Error).message || 'Erro ao salvar produto')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="relative flex flex-1 items-center justify-center gap-2
                    px-6 py-5 text-base font-medium text-white bg-[#079C9C]
                    transition-colors duration-200
                    hover:bg-slate-50 hover:text-[#079C9C]">
                    <Plus className="w-5 h-5" />
                    Adicionar Produto
                </Button>
            </DialogTrigger>
            <DialogContent className=" bg-white sm:max-w-[425px] max-h-[90vh] overflow-y-auto top-[5%] translate-y-0 ">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900">Novo Produto</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Nome do Produto</label>
                        <input
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            placeholder="Ex: Cimento, Tijolo..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Quantidade</label>
                            <input
                                type="number"
                                min="1"
                                required
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Prioridade</label>
                            <RadioGroup
                                value={priority}
                                onValueChange={(value) => setPriority(value)}
                                className="w-full p-2"
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
                            value={status}
                            onValueChange={(value) => setStatus(value)}
                            className="flex"
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
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[80px]"
                            placeholder="Observações adicionais..."
                        />
                    </div>
                    {errorMessage && (
                        <p className="text-red-500 text-sm">{errorMessage}</p>
                    )}
                    <div className="flex justify-end gap-3 mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isSaving}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Salvando...' : 'Salvar Produto'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
