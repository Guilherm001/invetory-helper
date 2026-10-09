'use client'

import { useState } from 'react'
import { Button } from '../../../../components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from '../../../../components/ui/dialog'
import {
    Plus,
    Minus,
    PackagePlus,
    Search,
    Loader2,
    ListPlus,
    Pencil,
    X,
} from 'lucide-react'

import { Product } from "../services/listService"
import BuscaCatalogo from '@/features/catalogo/components/buscarCatalogo'

type NovoProduto = Omit<Product, 'id' | 'created_at'>

interface BotaoAddProps {
    addProducts: (products: NovoProduto[]) => Promise<Product[]>
}

interface Opcao {
    value: string
    dot?: string
}

const PRIORIDADES: Opcao[] = [
    { value: 'Baixa', dot: 'bg-slate-400' },
    { value: 'Média', dot: 'bg-amber-500' },
    { value: 'Alta', dot: 'bg-red-500' },
]

const STATUS: Opcao[] = [
    { value: 'Pendente', dot: 'bg-slate-400' },
    { value: 'Em progresso', dot: 'bg-amber-500' },
    { value: 'Concluído', dot: 'bg-emerald-500' },
]

const PRIORIDADE_COR: Record<string, string> = {
    Baixa: 'bg-slate-400',
    Média: 'bg-amber-500',
    Alta: 'bg-red-500',
}

const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <span className="block text-sm font-semibold text-slate-700">{label}</span>
            {children}
        </div>
    )
}

function Segmentado({
    opcoes,
    valor,
    onChange,
    label,
}: {
    opcoes: Opcao[]
    valor: string
    onChange: (v: string) => void
    label: string
}) {
    return (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
            {opcoes.map((op) => {
                const ativo = valor === op.value
                return (
                    <button
                        key={op.value}
                        type="button"
                        role="radio"
                        aria-checked={ativo}
                        onClick={() => onChange(op.value)}
                        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C] ${
                            ativo
                                ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <span className={`size-2 rounded-full ${op.dot}`} />
                        {op.value}
                    </button>
                )
            })}
        </div>
    )
}

export default function BotaoAdd({ addProducts }: BotaoAddProps) {
    const [open, setOpen] = useState(false)

    // item em edição (formulário)
    const [name, setName] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [priority, setPriority] = useState('Média')
    const [status, setStatus] = useState('Pendente')
    const [notes, setNotes] = useState('')
    const [unit, setUnit] = useState<string | null>(null)
    const [catalogCode, setCatalogCode] = useState<string | null>(null)

    // lista de itens já adicionados, aguardando salvar
    const [itens, setItens] = useState<NovoProduto[]>([])

    // muda para limpar o campo de busca do catálogo
    const [buscaKey, setBuscaKey] = useState(0)

    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const formTemItem = name.trim() !== ''
    const total = itens.length + (formTemItem ? 1 : 0)

    // limpa só os campos do item; mantém prioridade e status para agilizar
    const limparItem = () => {
        setName('')
        setQuantity(1)
        setNotes('')
        setUnit(null)
        setCatalogCode(null)
        setBuscaKey((k) => k + 1)
    }

    const resetTudo = () => {
        limparItem()
        setPriority('Média')
        setStatus('Pendente')
        setItens([])
        setErrorMessage('')
    }

    const montarItemAtual = (): NovoProduto => ({
        name: name.trim(),
        quantity,
        priority,
        status,
        notes,
        unit,
        catalog_code: catalogCode,
    })

    const handleAdicionarNaLista = () => {
        if (!formTemItem) {
            setErrorMessage('Informe o nome do produto antes de adicionar à lista.')
            return
        }
        if (!quantity || quantity < 1) {
            setErrorMessage('A quantidade precisa ser pelo menos 1.')
            return
        }
        setErrorMessage('')
        setItens((prev) => [...prev, montarItemAtual()])
        limparItem()
    }

    const handleRemover = (index: number) => {
        setItens((prev) => prev.filter((_, i) => i !== index))
    }

    // devolve o item para o formulário para editar
    const handleEditar = (index: number) => {
        const item = itens[index]

        // se já tem algo digitado no formulário, guarda na lista para não perder
        const restantes = itens.filter((_, i) => i !== index)
        setItens(formTemItem ? [...restantes, montarItemAtual()] : restantes)

        setName(item.name)
        setQuantity(item.quantity)
        setPriority(item.priority)
        setStatus(item.status)
        setNotes(item.notes ?? '')
        setUnit(item.unit ?? null)
        setCatalogCode(item.catalog_code ?? null)
        setErrorMessage('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // o que está no formulário entra junto, para ninguém perder o que digitou
        const lista = formTemItem ? [...itens, montarItemAtual()] : itens

        if (lista.length === 0) {
            setErrorMessage('Adicione pelo menos um produto.')
            return
        }

        setIsSaving(true)
        setErrorMessage('')

        try {
            await addProducts(lista)
            setOpen(false)
            resetTudo()
        } catch (error: unknown) {
            setErrorMessage((error as Error).message || 'Erro ao salvar produtos')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    className="relative flex flex-1 items-center justify-center gap-2
                    px-6 py-5 text-base font-medium text-white bg-[#079C9C]
                    transition-colors duration-200
                    hover:bg-slate-50 hover:text-[#079C9C]"
                >
                    <Plus className="w-5 h-5" />
                    Adicionar Produtos
                </Button>
            </DialogTrigger>

            <DialogContent
                className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[480px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
            >
                {/* Cabeçalho */}
                <DialogHeader className="bg-[#079C9C] px-6 py-5 text-left">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
                            <PackagePlus className="size-6 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-white">
                                Novos Produtos
                            </DialogTitle>
                            <DialogDescription className="text-sm text-white/80">
                                Monte a lista e salve tudo de uma vez
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    {/* Corpo com rolagem */}
                    <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                        {/* Busca no catálogo */}
                        <div className="space-y-2 rounded-xl border border-[#079C9C]/20 bg-[#079C9C]/5 p-4">
                            <span className="flex items-center gap-2 text-sm font-semibold text-[#079C9C]">
                                <Search className="size-4" />
                                Buscar no catálogo
                            </span>
                            <BuscaCatalogo
                                key={buscaKey}
                                onSelect={(item) => {
                                    setName(item.name)
                                    setUnit(item.unit)
                                    setCatalogCode(item.code)
                                }}
                            />
                            <p className="text-xs text-slate-500">
                                Selecione um item para preencher o nome e a unidade automaticamente.
                            </p>
                        </div>

                        {/* Nome */}
                        <Campo label="Nome do produto">
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    // Enter adiciona à lista (em vez de salvar tudo)
                                    if (e.key !== 'Enter') return
                                    e.preventDefault()
                                    handleAdicionarNaLista()
                                }}
                                className={inputClass}
                                placeholder="Ex: Cimento, Tijolo..."
                            />
                        </Campo>

                        {/* Quantidade */}
                        <Campo label="Quantidade">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-label="Diminuir quantidade"
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#079C9C] hover:text-[#079C9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]"
                                >
                                    <Minus className="size-4" />
                                </button>

                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Number(e.target.value))}
                                    className={`${inputClass} text-center font-semibold`}
                                />

                                <button
                                    type="button"
                                    aria-label="Aumentar quantidade"
                                    onClick={() => setQuantity((q) => q + 1)}
                                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#079C9C] hover:text-[#079C9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]"
                                >
                                    <Plus className="size-4" />
                                </button>

                                {unit && (
                                    <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                                        {unit}
                                    </span>
                                )}
                            </div>
                        </Campo>

                        {/* Prioridade */}
                        <Campo label="Prioridade">
                            <Segmentado
                                label="Prioridade"
                                opcoes={PRIORIDADES}
                                valor={priority}
                                onChange={setPriority}
                            />
                        </Campo>

                        {/* Status */}
                        <Campo label="Status">
                            <Segmentado
                                label="Status"
                                opcoes={STATUS}
                                valor={status}
                                onChange={setStatus}
                            />
                        </Campo>

                        {/* Notas */}
                        <Campo label="Notas">
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className={`${inputClass} min-h-[72px] resize-none`}
                                placeholder="Observações adicionais..."
                            />
                        </Campo>

                        {/* Adicionar à lista */}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleAdicionarNaLista}
                            className="w-full gap-2 border-[#079C9C] bg-white text-[#079C9C] hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                        >
                            <ListPlus className="size-4" />
                            Adicionar à lista
                        </Button>

                        {/* Lista de itens adicionados */}
                        {itens.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-slate-700">
                                        Na lista ({itens.length})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setItens([])}
                                        className="text-xs font-medium text-slate-500 hover:text-red-600"
                                    >
                                        Limpar lista
                                    </button>
                                </div>

                                <ul className="space-y-2">
                                    {itens.map((item, index) => (
                                        <li
                                            key={index}
                                            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                        >
                                            <span
                                                className={`size-2.5 shrink-0 rounded-full ${PRIORIDADE_COR[item.priority] ?? 'bg-slate-400'}`}
                                                title={`Prioridade ${item.priority}`}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-slate-800">
                                                    {item.name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {item.quantity}
                                                    {item.unit ? ` ${item.unit}` : ''} · {item.priority} · {item.status}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                aria-label={`Editar ${item.name}`}
                                                onClick={() => handleEditar(index)}
                                                className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-[#079C9C]"
                                            >
                                                <Pencil className="size-4" />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Remover ${item.name}`}
                                                onClick={() => handleRemover(index)}
                                                className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-red-600"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {errorMessage && (
                            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                                {errorMessage}
                            </p>
                        )}
                    </div>

                    {/* Rodapé fixo */}
                    <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isSaving}
                            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving || total === 0}
                            className="min-w-44 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90 active:bg-[#079C9C]/80"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                `Salvar ${total} ${total === 1 ? 'produto' : 'produtos'}`
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}