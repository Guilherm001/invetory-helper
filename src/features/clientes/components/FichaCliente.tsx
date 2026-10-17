'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Building2,
  Loader2,
  Pencil,
  User,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { alternarAtivoCliente, obterCliente, type Cliente } from '../services/clientesService'
import { fichaFinanceira, type FichaFinanceira } from '../services/fichaService'
import { formatarDocumento } from '../lib/documentos'
import { reais } from '../lib/formatar'
import ClienteDialog from './ClienteDialog'
import TabDados from './TabDados'
import TabEnderecos from './TabEnderecos'
import TabPedidos from './TabPedidos'
import TabFinanceiro from './TabFinanceiro'

type Aba = 'dados' | 'enderecos' | 'pedidos' | 'financeiro'

const ABAS: [Aba, string][] = [
  ['dados', 'Dados'],
  ['enderecos', 'Endereços'],
  ['pedidos', 'Pedidos'],
  ['financeiro', 'Financeiro'],
]

export default function FichaCliente({ id }: { id: string }) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [ficha, setFicha] = useState<FichaFinanceira | null>(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<Aba>('dados')
  const [editando, setEditando] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([obterCliente(id), fichaFinanceira(id)])
      if (!c) {
        setErro('Cliente não encontrado.')
        return
      }
      setCliente(c)
      setFicha(f)
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o cliente')
    }
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  const alternarAtivo = async () => {
    if (!cliente) return
    const desativando = cliente.ativo
    const devendo = (ficha?.saldos.devendo ?? 0) > 0

    const msg = desativando
      ? `Desativar ${cliente.nome}? Ele deixa de aparecer para novos pedidos e orçamentos, mas o histórico e os saldos continuam.${
          devendo ? ` Atenção: ele ainda deve ${reais(ficha!.saldos.devendo)}.` : ''
        }`
      : `Reativar ${cliente.nome}?`
    if (!window.confirm(msg)) return

    setOcupado(true)
    setErro('')
    try {
      await alternarAtivoCliente(cliente.id, !cliente.ativo)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar o cliente')
    } finally {
      setOcupado(false)
    }
  }

  const voltar = (
    <Link
      href="/clientes"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#079C9C]"
    >
      <ArrowLeft className="size-4" />
      Todos os clientes
    </Link>
  )

  if (!cliente || !ficha) {
    return (
      <div className="space-y-4 py-8">
        {voltar}
        {erro ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {erro}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Carregando cliente...
          </p>
        )}
      </div>
    )
  }

  const pj = cliente.tipo === 'juridica'
  const Icone = pj ? Building2 : User
  const { saldos } = ficha

  return (
    <div className="w-full space-y-5 pb-16">
      <div className="mt-7 space-y-3">
        {voltar}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#079C9C]/10 text-[#079C9C]">
              <Icone className="size-6" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-2xl font-bold md:text-3xl">{cliente.nome}</h3>
              <p className="text-sm text-slate-500">
                {pj ? 'CNPJ' : 'CPF'} {formatarDocumento(cliente.tipo, cliente.documento)}
              </p>
              {!cliente.ativo && (
                <span className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  Cliente inativo
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditando(true)}
              className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              <Pencil className="size-4" />
              Editar dados
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={alternarAtivo}
              disabled={ocupado}
              className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              {ocupado ? (
                <Loader2 className="size-4 animate-spin" />
              ) : cliente.ativo ? (
                <Archive className="size-4" />
              ) : (
                <ArchiveRestore className="size-4" />
              )}
              {cliente.ativo ? 'Desativar' : 'Reativar'}
            </Button>
          </div>
        </div>

        {/* resumo financeiro sempre à vista */}
        <div className="grid grid-cols-3 gap-2 md:max-w-xl">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Crédito</p>
            <p className="text-base font-bold text-emerald-700 md:text-lg">{reais(saldos.credito)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Deve</p>
            <p className={`text-base font-bold md:text-lg ${saldos.devendo > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {reais(saldos.devendo)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Vencido</p>
            <p className={`text-base font-bold md:text-lg ${saldos.vencido > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {reais(saldos.vencido)}
            </p>
          </div>
        </div>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
      )}

      {/* abas */}
      <div
        role="tablist"
        aria-label="Seções da ficha"
        className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
      >
        {ABAS.map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
              aba === valor ? 'bg-white text-[#079C9C] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'dados' && <TabDados cliente={cliente} />}
      {aba === 'enderecos' && <TabEnderecos cliente={cliente} />}
      {aba === 'pedidos' && <TabPedidos clienteId={cliente.id} />}
      {aba === 'financeiro' && (
        <TabFinanceiro clienteId={cliente.id} ficha={ficha} onMudou={carregar} />
      )}

      <ClienteDialog
        open={editando}
        cliente={cliente}
        onClose={() => setEditando(false)}
        onSalvo={() => {
          setEditando(false)
          carregar()
        }}
      />
    </div>
  )
}