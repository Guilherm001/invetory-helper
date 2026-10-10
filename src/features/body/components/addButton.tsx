'use client'

import { useRef, useState } from 'react'
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
    X,
    StickyNote,
    CornerDownLeft,
    ClipboardList,
} from 'lucide-react'

import { Product } from "../services/listService"
import BuscaCatalogo from '@/features/catalogo/components/buscarCatalogo'

type NovoProduto = Omit<Product, 'id' | 'created_at'>
type Item = NovoProduto & { key: number }

interface BotaoAddProps {
    addProducts: (products: NovoProduto[]) => Promise<Product[]>
}

const PRIORIDADES = ['Baixa', 'Média', 'Alta']
const STATUS = ['Pendente', 'Em progresso', 'Concluído']

// false: o produto repetido apenas some (não duplica)
// true: o produto repetido soma a quantidade no item que já está na lista
const SOMAR_QUANTIDADE_DUPLICADO = false

const COR_PRIORIDADE: Record<string, { chip: string; dot: string }> = {
    Baixa: { chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
    Média: { chip: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    Alta: { chip: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
}

const COR_STATUS: Record<string, string> = {
    Pendente: 'bg-slate-100 text-slate-600',
    'Em progresso': 'bg-amber-50 text-amber-700',
    Concluído: 'bg-emerald-50 text-emerald-700',
}

const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

const stepperClass =
    'flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#079C9C] hover:text-[#079C9C] active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]'

// "10 cimento" ou "10x cimento" -> quantidade 10
function interpretar(texto: string): { name: string; quantity: number | null } {
    const t = texto.trim().replace(/^[-•*]\s*/, '')
    const m = t.match(/^(\d+)\s*x\s*(.+)$/i) || t.match(/^(\d+)\s+(.+)$/)
    if (m) {
        const q = Number(m[1])
        if (q >= 1) return { name: m[2].trim(), quantity: q }
    }
    return { name: t, quantity: null }
}

function proximo(lista: string[], atual: string) {
    return lista[(lista.indexOf(atual) + 1) % lista.length]
}

// sem acento, minúsculo, espaços normalizados
const normalizar = (s: string) =>
    s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()

// dois produtos são o mesmo se tiverem o mesmo código do catálogo
// ou, na falta dele, o mesmo nome
function mesmoProduto(
    a: Pick<NovoProduto, 'name' | 'catalog_code'>,
    b: Pick<NovoProduto, 'name' | 'catalog_code'>
) {
    if (a.catalog_code && b.catalog_code) return a.catalog_code === b.catalog_code
    return normalizar(a.name) === normalizar(b.name)
}

export default function BotaoAdd({ addProducts }: BotaoAddProps) {
    const [open, setOpen] = useState(false)

    // barra de adicionar
    const [nome, setNome] = useState('')
    const [quantidade, setQuantidade] = useState(1)
    const [prioridade, setPrioridade] = useState('Média')
    const [buscaKey, setBuscaKey] = useState(0)

    // lista montada
    const [itens, setItens] = useState<Item[]>([])
    const [notasAbertas, setNotasAbertas] = useState<Set<number>>(new Set())

    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const nomeRef = useRef<HTMLInputElement>(null)
    const contador = useRef(0)

    // o que está digitado só conta se ainda não existe na lista
    const nomePendente = interpretar(nome).name
    const temNomePendente =
        nomePendente !== '' &&
        !itens.some((i) => mesmoProduto(i, { name: nomePendente, catalog_code: null }))
    const total = itens.length + (temNomePendente ? 1 : 0)

    const criarItem = (dados: Partial<NovoProduto> & { name: string }): Item => ({
        key: ++contador.current,
        quantity: 1,
        priority: prioridade,
        status: 'Pendente',
        notes: '',
        unit: null,
        catalog_code: null,
        ...dados,
    })

    const adicionar = (novos: Item[]) => {
        if (novos.length === 0) return

        setItens((prev) => {
            const lista = [...prev]

            for (const novo of novos) {
                const idx = lista.findIndex((i) => mesmoProduto(i, novo))

                if (idx >= 0) {
                    // já está na lista: não duplica
                    if (SOMAR_QUANTIDADE_DUPLICADO) {
                        lista[idx] = {
                            ...lista[idx],
                            quantity: lista[idx].quantity + novo.quantity,
                        }
                    }
                    continue
                }

                // itens novos aparecem no topo, logo abaixo da barra
                lista.unshift(novo)
            }

            return lista
        })
        setErrorMessage('')
    }

    const adicionarDigitado = () => {
        const { name, quantity } = interpretar(nome)
        if (!name) return
        adicionar([criarItem({ name, quantity: quantity ?? quantidade })])
        setNome('')
        setQuantidade(1)
        nomeRef.current?.focus()
    }

    // colar várias linhas: cada linha vira um item
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const texto = e.clipboardData.getData('text')
        if (!texto.includes('\n')) return
        e.preventDefault()

        const novos = texto
            .split('\n')
            .map((linha) => interpretar(linha))
            .filter((x) => x.name)
            .map((x) => criarItem({ name: x.name, quantity: x.quantity ?? 1 }))

        adicionar(novos)
    }

    const atualizar = (key: number, dados: Partial<NovoProduto>) =>
        setItens((prev) => prev.map((i) => (i.key === key ? { ...i, ...dados } : i)))

    const remover = (key: number) =>
        setItens((prev) => prev.filter((i) => i.key !== key))

    const alternarNota = (key: number) =>
        setNotasAbertas((prev) => {
            const novo = new Set(prev)
            if (novo.has(key)) novo.delete(key)
            else novo.add(key)
            return novo
        })

    const handleSalvar = async () => {
        const lista: Item[] = [...itens]

        // o que está digitado e não foi para a lista entra junto (se não for repetido)
        if (temNomePendente) {
            const { name, quantity } = interpretar(nome)
            if (name) lista.unshift(criarItem({ name, quantity: quantity ?? quantidade }))
        }

        if (lista.length === 0) {
            setErrorMessage('Adicione pelo menos um produto.')
            return
        }
        if (lista.some((i) => !i.name.trim())) {
            setErrorMessage('Há itens sem nome na lista. Preencha ou remova.')
            return
        }

        setIsSaving(true)
        setErrorMessage('')

        try {
            await addProducts(
                lista.map(({ key, ...resto }) => ({
                    ...resto,
                    name: resto.name.trim(),
                    quantity: resto.quantity >= 1 ? resto.quantity : 1,
                }))
            )
            setOpen(false)
            setItens([])
            setNotasAbertas(new Set())
            setNome('')
            setQuantidade(1)
            setBuscaKey((k) => k + 1)
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
                className="top-[5%] flex max-h-[90vh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[520px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
            >
                {/* Cabeçalho */}
                <DialogHeader className="bg-[#079C9C] px-5 py-4 text-left">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                            <PackagePlus className="size-5 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-white">
                                Novos Produtos
                            </DialogTitle>
                            <DialogDescription className="text-xs text-white/80">
                                Digite, dê Enter e siga para o próximo
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Barra de adicionar (fixa) */}
                <div className="space-y-3 border-b border-slate-200 bg-[#079C9C]/5 px-5 py-4">
                    {/* Catálogo: escolher já adiciona */}
                    <div className="space-y-1.5">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#079C9C]">
                            <Search className="size-3.5" />
                            Catálogo (toque no item para adicionar)
                        </span>
                        <BuscaCatalogo
                            key={buscaKey}
                            onSelect={(item) => {
                                adicionar([
                                    criarItem({
                                        name: item.name,
                                        unit: item.unit,
                                        catalog_code: item.code,
                                        quantity: quantidade,
                                    }),
                                ])
                                setQuantidade(1)
                                setBuscaKey((k) => k + 1)
                            }}
                        />
                    </div>

                    {/* Nome + quantidade + adicionar */}
                    <div className="flex items-center gap-2">
                        <input
                            ref={nomeRef}
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            onPaste={handlePaste}
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter') return
                                e.preventDefault()
                                adicionarDigitado()
                            }}
                            enterKeyHint="done"
                            className={inputClass}
                            placeholder="Ou digite: 10 cimento"
                        />

                        <div className="flex shrink-0 items-center gap-1">
                            <button
                                type="button"
                                aria-label="Diminuir quantidade"
                                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                                className={`${stepperClass} size-9`}
                            >
                                <Minus className="size-4" />
                            </button>
                            <input
                                type="number"
                                min="1"
                                value={quantidade}
                                onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value)))}
                                className="h-9 w-12 rounded-lg border border-slate-200 bg-white text-center text-sm font-semibold outline-none focus:border-[#079C9C]"
                            />
                            <button
                                type="button"
                                aria-label="Aumentar quantidade"
                                onClick={() => setQuantidade((q) => q + 1)}
                                className={`${stepperClass} size-9`}
                            >
                                <Plus className="size-4" />
                            </button>
                        </div>

                        <button
                            type="button"
                            aria-label="Adicionar à lista"
                            onClick={adicionarDigitado}
                            disabled={nomePendente === ''}
                            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#079C9C] text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-90 disabled:opacity-40"
                        >
                            <CornerDownLeft className="size-5" />
                        </button>
                    </div>

                    {/* Prioridade padrão dos próximos itens */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Prioridade:</span>
                        <div role="radiogroup" aria-label="Prioridade dos próximos itens" className="flex gap-1.5">
                            {PRIORIDADES.map((p) => {
                                const ativo = prioridade === p
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        role="radio"
                                        aria-checked={ativo}
                                        onClick={() => setPrioridade(p)}
                                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                                            ativo
                                                ? 'border-[#079C9C] bg-white text-[#079C9C] shadow-sm'
                                                : 'border-transparent bg-white/60 text-slate-500 hover:bg-white'
                                        }`}
                                    >
                                        <span className={`size-1.5 rounded-full ${COR_PRIORIDADE[p].dot}`} />
                                        {p}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Lista (rola) */}
                <div className="min-h-[140px] flex-1 overflow-y-auto px-5 py-4">
                    {itens.length === 0 ? (
                        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-center">
                            <div className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                <ClipboardList className="size-5" />
                            </div>
                            <p className="text-sm font-medium text-slate-600">Sua lista está vazia</p>
                            <p className="max-w-[300px] text-xs text-slate-400">
                                Dica: cole várias linhas de uma vez no campo de nome e cada linha vira um item.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-700">
                                    Na lista ({itens.length})
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setItens([])
                                        setNotasAbertas(new Set())
                                    }}
                                    className="text-xs font-medium text-slate-500 hover:text-red-600"
                                >
                                    Limpar tudo
                                </button>
                            </div>

                            <ul className="space-y-2">
                                {itens.map((item) => (
                                    <li
                                        key={item.key}
                                        className={`rounded-xl border border-l-4 border-slate-200 bg-white p-3 shadow-sm ${
                                            item.priority === 'Alta'
                                                ? 'border-l-red-500'
                                                : item.priority === 'Média'
                                                  ? 'border-l-amber-500'
                                                  : 'border-l-slate-300'
                                        }`}
                                    >
                                        {/* Linha 1: nome, quantidade, remover */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                value={item.name}
                                                onChange={(e) => atualizar(item.key, { name: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        nomeRef.current?.focus()
                                                    }
                                                }}
                                                aria-label="Nome do produto"
                                                className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold text-slate-900 outline-none focus:bg-slate-50 focus:ring-1 focus:ring-[#079C9C]"
                                            />

                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    type="button"
                                                    aria-label={`Diminuir ${item.name}`}
                                                    onClick={() =>
                                                        atualizar(item.key, { quantity: Math.max(1, item.quantity - 1) })
                                                    }
                                                    className={`${stepperClass} size-7`}
                                                >
                                                    <Minus className="size-3.5" />
                                                </button>
                                                <span className="min-w-[2.75rem] text-center text-sm font-semibold text-[#079C9C]">
                                                    {item.quantity}
                                                    {item.unit ? ` ${item.unit}` : ''}
                                                </span>
                                                <button
                                                    type="button"
                                                    aria-label={`Aumentar ${item.name}`}
                                                    onClick={() => atualizar(item.key, { quantity: item.quantity + 1 })}
                                                    className={`${stepperClass} size-7`}
                                                >
                                                    <Plus className="size-3.5" />
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                aria-label={`Remover ${item.name}`}
                                                onClick={() => remover(item.key)}
                                                className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        </div>

                                        {/* Linha 2: chips que alternam ao toque */}
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1.5">
                                            <button
                                                type="button"
                                                title="Toque para mudar a prioridade"
                                                onClick={() =>
                                                    atualizar(item.key, { priority: proximo(PRIORIDADES, item.priority) })
                                                }
                                                className={`rounded-md px-2 py-0.5 text-xs font-medium transition active:scale-95 ${
                                                    COR_PRIORIDADE[item.priority]?.chip ?? 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {item.priority}
                                            </button>
                                            <button
                                                type="button"
                                                title="Toque para mudar o status"
                                                onClick={() =>
                                                    atualizar(item.key, { status: proximo(STATUS, item.status) })
                                                }
                                                className={`rounded-md px-2 py-0.5 text-xs font-medium transition active:scale-95 ${
                                                    COR_STATUS[item.status] ?? 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {item.status}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => alternarNota(item.key)}
                                                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition ${
                                                    item.notes || notasAbertas.has(item.key)
                                                        ? 'bg-[#079C9C]/10 text-[#079C9C]'
                                                        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                                }`}
                                            >
                                                <StickyNote className="size-3.5" />
                                                {item.notes ? 'Nota' : 'Adicionar nota'}
                                            </button>
                                        </div>

                                        {notasAbertas.has(item.key) && (
                                            <input
                                                value={item.notes ?? ''}
                                                onChange={(e) => atualizar(item.key, { notes: e.target.value })}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        nomeRef.current?.focus()
                                                    }
                                                }}
                                                autoFocus
                                                placeholder="Observações deste item..."
                                                className={`${inputClass} mt-2`}
                                            />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {errorMessage && (
                        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {errorMessage}
                        </p>
                    )}
                </div>

                {/* Rodapé fixo */}
                <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
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
                        type="button"
                        onClick={handleSalvar}
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
            </DialogContent>
        </Dialog>
    )
}