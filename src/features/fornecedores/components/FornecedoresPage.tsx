'use client'

import { useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Clock,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../components/ui/alert-dialog'
import { useFornecedores } from '../hooks/useFornecedores'
import {
  alternarAtivo,
  atualizarFornecedor,
  criarFornecedor,
  excluirFornecedor,
  usoDoFornecedor,
} from '../services/fornecedoresService'
import type { FornecedorCompleto, NovoFornecedorCompleto, UsoFornecedor } from '../types'
import {
  formatarDocumento,
  formatarTelefone,
  linkTelefone,
  linkWhatsApp,
  soDigitos,
  tipoDocumento,
} from '../utils/formatos'
import FornecedorFormDialog from './FornecedorFormDialog'

type Filtro = 'ativos' | 'inativos' | 'todos'

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const linkClass = 'text-slate-700 underline-offset-2 hover:text-[#079C9C] hover:underline'

export default function FornecedoresPage() {
  const { fornecedores, loading, error, recarregar } = useFornecedores()

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('ativos')
  const [form, setForm] = useState<{ aberto: boolean; fornecedor: FornecedorCompleto | null }>({
    aberto: false,
    fornecedor: null,
  })
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState('')
  const [paraExcluir, setParaExcluir] = useState<{
    f: FornecedorCompleto
    uso: UsoFornecedor | null
    falhou: boolean
  } | null>(null)

  const contagem = useMemo(
    () => ({
      ativos: fornecedores.filter((f) => f.ativo).length,
      inativos: fornecedores.filter((f) => !f.ativo).length,
      todos: fornecedores.length,
    }),
    [fornecedores]
  )

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim())
    const palavras = termo.split(/\s+/).filter(Boolean)
    const digitos = soDigitos(busca)

    return fornecedores.filter((f) => {
      if (filtro === 'ativos' && !f.ativo) return false
      if (filtro === 'inativos' && f.ativo) return false
      if (palavras.length === 0) return true

      const texto = normalizar(
        [
          f.name,
          f.razao_social,
          f.representante,
          f.endereco,
          f.notes,
          ...f.emails,
          ...f.telefones.map((t) => t.rotulo),
        ]
          .filter(Boolean)
          .join(' ')
      )
      const porTexto = palavras.every((p) => texto.includes(p))
      const porNumero =
        digitos.length >= 3 &&
        [f.documento ?? '', ...f.telefones.map((t) => t.numero)].some((n) => n.includes(digitos))

      return porTexto || porNumero
    })
  }, [fornecedores, busca, filtro])

  const salvar = async (dados: NovoFornecedorCompleto) => {
    if (form.fornecedor) await atualizarFornecedor(form.fornecedor.id, dados, form.fornecedor.contact)
    else await criarFornecedor(dados)
    await recarregar()
  }

  const alternar = async (f: FornecedorCompleto) => {
    setOcupado(f.id)
    setErroAcao('')
    try {
      await alternarAtivo(f.id, !f.ativo)
      await recarregar()
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível alterar o fornecedor')
    } finally {
      setOcupado(null)
    }
  }

  const pedirExclusao = (f: FornecedorCompleto) => {
    setParaExcluir({ f, uso: null, falhou: false })
    usoDoFornecedor(f.id)
      .then((uso) =>
        setParaExcluir((atual) => (atual && atual.f.id === f.id ? { ...atual, uso } : atual))
      )
      .catch(() =>
        setParaExcluir((atual) => (atual && atual.f.id === f.id ? { ...atual, falhou: true } : atual))
      )
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    setErroAcao('')
    try {
      await excluirFornecedor(paraExcluir.f.id)
      await recarregar()
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível excluir')
    }
  }

  const desativarEmVezDeExcluir = async () => {
    if (!paraExcluir) return
    const f = paraExcluir.f
    setParaExcluir(null)
    await alternar(f)
  }

  const filtros: [Filtro, string][] = [
    ['ativos', 'Ativos'],
    ['inativos', 'Inativos'],
    ['todos', 'Todos'],
  ]

  const temUso = !!paraExcluir?.uso && (paraExcluir.uso.comparacoes > 0 || paraExcluir.uso.precos > 0)

  return (
    <div className="w-full pb-16">
      <div className="mt-7 flex flex-col gap-4 py-4 md:flex-row md:items-end md:justify-between">
        <article>
          <h3 className="text-2xl font-bold md:text-3xl">Fornecedores</h3>
          <p className="text-sm text-gray-400">
            Cadastro dos seus fornecedores. Eles ficam disponíveis para as comparações e cotações.
          </p>
        </article>

        <Button
          onClick={() => setForm({ aberto: true, fornecedor: null })}
          className="gap-2 bg-[#079C9C] px-5 py-5 text-white hover:bg-[#079C9C]/90"
        >
          <Plus className="size-5" />
          Novo fornecedor
        </Button>
      </div>

      {/* Busca e filtros */}
      <div className="space-y-3">
        <div className="relative md:max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ, telefone ou e-mail"
            aria-label="Buscar fornecedor"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
          />
          {busca && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <div role="radiogroup" aria-label="Filtrar" className="flex flex-wrap gap-2">
          {filtros.map(([valor, rotulo]) => {
            const ativo = filtro === valor
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setFiltro(valor)}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  ativo
                    ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {rotulo}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    ativo ? 'bg-[#079C9C]/15' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {contagem[valor]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {(error || erroAcao) && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error || erroAcao}
        </p>
      )}

      {/* Lista */}
      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">Carregando fornecedores...</p>
      ) : fornecedores.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#079C9C]/10 text-[#079C9C]">
            <Truck className="size-6" />
          </div>
          <p className="text-base font-semibold text-slate-700">Nenhum fornecedor ainda</p>
          <p className="max-w-sm text-sm text-slate-500">
            Cadastre os fornecedores com contato, prazo e observações para usar nas comparações.
          </p>
          <Button
            onClick={() => setForm({ aberto: true, fornecedor: null })}
            className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            <Plus className="size-4" />
            Cadastrar o primeiro
          </Button>
        </div>
      ) : visiveis.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
          Nenhum fornecedor encontrado.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {visiveis.map((f) => {
            const doc = f.documento
            return (
              <li
                key={f.id}
                className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
                  f.ativo ? '' : 'opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-bold text-slate-900">{f.name}</span>
                      {!f.ativo && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          inativo
                        </span>
                      )}
                    </p>
                    {f.razao_social && (
                      <p className="truncate text-sm text-slate-500" title={f.razao_social}>
                        {f.razao_social}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {doc && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {tipoDocumento(doc)} {formatarDocumento(doc)}
                        </span>
                      )}
                      {f.lead_time_days != null && (
                        <span className="flex items-center gap-1 rounded-md bg-[#079C9C]/10 px-2 py-0.5 text-xs font-semibold text-[#079C9C]">
                          <Clock className="size-3" />
                          {f.lead_time_days === 0
                            ? 'Entrega no mesmo dia'
                            : `Entrega em ${f.lead_time_days} ${f.lead_time_days === 1 ? 'dia' : 'dias'}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      title="Editar"
                      aria-label={`Editar ${f.name}`}
                      onClick={() => setForm({ aberto: true, fornecedor: f })}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                    >
                      <Pencil className="size-[18px]" />
                    </button>
                    <button
                      type="button"
                      title={f.ativo ? 'Desativar' : 'Reativar'}
                      aria-label={`${f.ativo ? 'Desativar' : 'Reativar'} ${f.name}`}
                      disabled={ocupado === f.id}
                      onClick={() => alternar(f)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                    >
                      {ocupado === f.id ? (
                        <Loader2 className="size-[18px] animate-spin" />
                      ) : f.ativo ? (
                        <Archive className="size-[18px]" />
                      ) : (
                        <ArchiveRestore className="size-[18px]" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Excluir"
                      aria-label={`Excluir ${f.name}`}
                      onClick={() => pedirExclusao(f)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-[18px]" />
                    </button>
                  </div>
                </div>

                {/* contatos */}
                {(f.representante || f.telefones.length > 0 || f.emails.length > 0) && (
                  <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                    {f.representante && (
                      <li className="flex items-center gap-2 text-slate-600">
                        <User className="size-4 shrink-0 text-slate-400" />
                        {f.representante}
                      </li>
                    )}

                    {f.telefones.map((t, i) => {
                      const zap = t.whatsapp ? linkWhatsApp(t.numero) : null
                      return (
                        <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <Phone className="size-4 shrink-0 text-slate-400" />
                          <a href={linkTelefone(t.numero)} className={linkClass}>
                            {formatarTelefone(t.numero)}
                          </a>
                          {t.rotulo && <span className="text-xs text-slate-400">{t.rotulo}</span>}
                          {zap && (
                            <a
                              href={zap}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              <MessageCircle className="size-3" />
                              WhatsApp
                            </a>
                          )}
                        </li>
                      )
                    })}

                    {f.emails.map((m) => (
                      <li key={m} className="flex items-center gap-2">
                        <Mail className="size-4 shrink-0 text-slate-400" />
                        <a href={`mailto:${m}`} className={`${linkClass} min-w-0 truncate`}>
                          {m}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {f.endereco && (
                  <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 whitespace-pre-wrap">{f.endereco}</span>
                  </p>
                )}

                {f.notes && (
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {f.notes}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <FornecedorFormDialog
        open={form.aberto}
        fornecedor={form.fornecedor}
        onClose={() => setForm((d) => ({ ...d, aberto: false }))}
        onSalvar={salvar}
      />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Tem certeza que deseja excluir <strong>{paraExcluir?.f.name}</strong>?
                </p>

                {paraExcluir && paraExcluir.uso === null && !paraExcluir.falhou && (
                  <p className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="size-4 animate-spin" />
                    Conferindo onde ele é usado...
                  </p>
                )}

                {paraExcluir?.falhou && (
                  <p className="text-amber-700">
                    Não consegui conferir se ele aparece em comparações. Se aparecer, os preços dele
                    serão apagados.
                  </p>
                )}

                {temUso && paraExcluir?.uso && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                    Ele aparece em <strong>{paraExcluir.uso.comparacoes}</strong>{' '}
                    {paraExcluir.uso.comparacoes === 1 ? 'comparação' : 'comparações'} e tem{' '}
                    <strong>{paraExcluir.uso.precos}</strong>{' '}
                    {paraExcluir.uso.precos === 1 ? 'preço registrado' : 'preços registrados'}.
                    Excluir apaga tudo isso e muda o histórico de preços. Desativar é mais seguro:
                    ele some das listas e o histórico fica.
                  </p>
                )}

                {paraExcluir?.uso && !temUso && (
                  <p>Nenhuma comparação usa este fornecedor. Essa ação não poderá ser desfeita.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {paraExcluir?.f.ativo && (temUso || paraExcluir.falhou) && (
              <Button type="button" variant="outline" onClick={desativarEmVezDeExcluir}>
                Desativar
              </Button>
            )}
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}