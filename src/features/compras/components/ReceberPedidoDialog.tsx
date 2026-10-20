'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mesmaUnidade } from '../lib/unidades'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  PackageCheck,
  Receipt,
  ListChecks,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import SenhaVendedor from '@/features/loja/components/senhaVendedor'
import { numeroTexto } from '@/features/loja/lib/formatar'
import {
  itensAReceber,
  receberPedido,
  type ItemAReceber,
  type ResultadoRecebimento,
} from '../services/comprasService'
import {
  barcodesDosCodigos,
  empresaIdAtual,
  listarVinculos,
  registrarNota,
  type DadosNota,
} from '../services/notasService'
import { agruparItensNota, casar } from '../lib/casamento'
import { numeroPedido } from '../lib/compras'
import { NOTA_VAZIA, notaPreenchida, validarNota, type NotaRascunho } from '../lib/notaRascunho'
import NotaFiscalCampos from './NotaFiscalCampos'


export interface PedidoParaReceber {
  id: string
  numero: number
  fornecedor_nome: string
}

const arredondar = (n: number) => Math.round(n * 1000) / 1000

// vazio vale 0; inválido vale NaN
function lerQtd(texto: string | undefined) {
  const s = (texto ?? '').trim()
  if (s === '') return 0
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

const faltaDe = (i: ItemAReceber) => Math.max(0, arredondar(i.quantidade - i.quantidade_recebida))
const listaCurta = (nomes: string[]) =>
  nomes.length <= 4 ? nomes.join(', ') : `${nomes.slice(0, 4).join(', ')} e mais ${nomes.length - 4}`

function montarAviso(r: ResultadoRecebimento) {
  const situacao = r.completo
    ? 'recebido por completo'
    : r.encerrou
      ? 'encerrado com o que chegou'
      : 'recebimento parcial registrado'

  const partes = [`Pedido ${numeroPedido(r.numero)}: ${situacao} (por ${r.recebido_por}).`]
  if (r.sem_estoque.length > 0)
    partes.push(
      `Sem entrada no estoque, por não achar no catálogo: ${r.sem_estoque.join(', ')}.`
    )
  return partes.join(' ')
}

function Opcao({
  ativo,
  onChange,
  titulo,
  descricao,
}: {
  ativo: boolean
  onChange: () => void
  titulo: string
  descricao: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      onClick={onChange}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
        ativo ? 'border-[#079C9C] bg-[#079C9C]/10' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span>
        <span className="block text-sm font-semibold text-slate-700">{titulo}</span>
        <span className="block text-xs text-slate-500">{descricao}</span>
      </span>
      <span
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
          ativo ? 'bg-[#079C9C]' : 'bg-slate-300'
        }`}
      >
        <span
          className={`size-5 rounded-full bg-white shadow transition ${ativo ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  )
}

function Conteudo({
  pedido,
  ehDono,
  onFechar,
  onSujo,
  onRecebido,
}: {
  pedido: PedidoParaReceber
  ehDono: boolean
  onFechar: () => void
  onSujo: (sujo: boolean) => void
  onRecebido: (aviso: string) => void
}) {
  const [itens, setItens] = useState<ItemAReceber[] | null>(null)
  const [erroCarga, setErroCarga] = useState('')
  const [chegou, setChegou] = useState<Record<string, string>>({})
  const [estoque, setEstoque] = useState(true)
  const [encerrar, setEncerrar] = useState(false)
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pedindoSenha, setPedindoSenha] = useState(false)

  // nota fiscal (opcional)
  const [nota, setNota] = useState<NotaRascunho>(NOTA_VAZIA)
  const [notaAberta, setNotaAberta] = useState(false)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [erroEmpresa, setErroEmpresa] = useState('')
  const dadosNotaRef = useRef<DadosNota | null>(null)
  const [notaPendente, setNotaPendente] = useState<{
    dados: DadosNota
    erro: string
    aviso: string
  } | null>(null)
  const [tentando, setTentando] = useState(false)

    // preenchimento do "Chegou" pelas quantidades do XML
  const [preenchendo, setPreenchendo] = useState(false)
  const [resumoXml, setResumoXml] = useState<{
    preenchidos: number
    jaRecebidos: number
    naoReconhecidos: string[]
    naoVieram: string[]
    unidades: string[]
  } | null>(null)

  useEffect(() => {
    let cancelado = false
    itensAReceber(pedido.id)
      .then((l) => {
        if (!cancelado) setItens(l)
      })
      .catch((e) => {
        if (!cancelado) setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar os itens')
      })
    return () => {
      cancelado = true
    }
  }, [pedido.id])

  useEffect(() => {
    let cancelado = false
    empresaIdAtual()
      .then((id) => {
        if (!cancelado) setEmpresaId(id)
      })
      .catch((e) => {
        if (!cancelado)
          setErroEmpresa(e instanceof Error ? e.message : 'Não foi possível preparar o envio de arquivos')
      })
    return () => {
      cancelado = true
    }
  }, [])

  const linhas = (itens ?? []).map((item) => ({
    item,
    falta: faltaDe(item),
    q: lerQtd(chegou[item.id]),
  }))

  const invalido = linhas.find((l) => Number.isNaN(l.q) || l.q < 0)
  const pendentes = linhas.filter((l) => l.falta > 0).length
  const conferidos = linhas.filter((l) => l.q > 0).length
  // itens que ainda ficam faltando depois desta conferência
  const aindaFalta = linhas.filter(
    (l) => l.falta - (Number.isFinite(l.q) && l.q > 0 ? l.q : 0) > 0
  ).length

  const temNota = notaPreenchida(nota)
  const sujo = !notaPendente && (conferidos > 0 || obs.trim() !== '' || temNota)
  useEffect(() => {
    onSujo(sujo)
  }, [sujo, onSujo])

  const definir = (id: string, valor: string) => {
    setChegou((p) => ({ ...p, [id]: valor }))
    setErro('')
  }

  const chegouTudo = () =>
    setChegou(
      Object.fromEntries(linhas.filter((l) => l.falta > 0).map((l) => [l.item.id, numeroTexto(l.falta)]))
    )

  const irParaProximo = (atual: HTMLInputElement) => {
    const campos = Array.from(document.querySelectorAll<HTMLInputElement>('[data-chegou]')).filter(
      (el) => !el.disabled && el.offsetParent !== null
    )
    const proximo = campos[campos.indexOf(atual) + 1]
    if (proximo) proximo.focus()
    else atual.blur()
  }

  const validar = () => {
    setErro('')
    if (invalido) {
      setErro(`Quantidade inválida em ${invalido.item.produto_nome}.`)
      return false
    }
    if (conferidos === 0) {
      setErro('Informe quanto chegou de pelo menos um item.')
      return false
    }
    return true
  }

  // pin null = o dono (já identificado); com pin = o balcão, e a senha identifica quem recebeu
  const enviar = async (pin: string | null) => {
    const r = await receberPedido({
      pedidoId: pedido.id,
      itens: linhas
        .filter((l) => l.q > 0)
        .map((l) => ({ item_id: l.item.id, quantidade: l.q })),
      estoque,
      encerrar: encerrar && aindaFalta > 0,
      observacao: obs.trim(),
      vendedorId: null,
      pin,
    })

    const aviso = montarAviso(r)
    const dadosNota = dadosNotaRef.current

    // o recebimento já foi registrado: uma falha na nota não pode desfazê-lo nem ser repetida
    if (dadosNota) {
      try {
        await registrarNota(pedido.id, dadosNota)
      } catch (e) {
        setPedindoSenha(false)
        setSalvando(false)
        setNotaPendente({
          dados: dadosNota,
          erro: e instanceof Error ? e.message : 'Erro ao registrar a nota',
          aviso,
        })
        return
      }
    }

    onRecebido(dadosNota ? `${aviso} Nota fiscal registrada.` : aviso)
  }

    const usarQuantidadesDaNota = async () => {
    if (!nota.xml || !itens || preenchendo) return
    setPreenchendo(true)
    setResumoXml(null)
    setErro('')

    try {
      const [barcodes, vinculos] = await Promise.all([
        barcodesDosCodigos(itens.map((i) => i.produto_codigo ?? '').filter(Boolean)),
        listarVinculos(pedido.id).catch(() => []),
      ])

      const daNota = agruparItensNota(nota.xml.itens)
      const pares = casar(
        itens,
        daNota,
        barcodes,
        new Map(vinculos.map((v) => [v.nota_chave, v.alvo_chave] as const))
      )

      const novos: Record<string, string> = {}
      const unidades: string[] = []
      let jaRecebidos = 0

      pares.forEach(({ ni }, pi) => {
        const item = itens[pi]
        const n = daNota[ni]

        // o que já chegou por completo não recebe mais nada
        if (faltaDe(item) === 0) {
          jaRecebidos++
          return
        }

        novos[item.id] = numeroTexto(n.quantidade)

                if (n.unidade && item.unidade && !mesmaUnidade(n.unidade, item.unidade)) {
          unidades.push(`${item.produto_nome} (pedido em ${item.unidade}, nota em ${n.unidade})`)
        }
      })

      const usadas = new Set([...pares.values()].map((p) => p.ni))

      setChegou((p) => ({ ...p, ...novos }))
      setResumoXml({
        preenchidos: Object.keys(novos).length,
        jaRecebidos,
        naoReconhecidos: daNota.filter((_, ni) => !usadas.has(ni)).map((n) => n.nome),
        naoVieram: itens
          .filter((it, pi) => faltaDe(it) > 0 && !pares.has(pi))
          .map((it) => it.produto_nome),
        unidades,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível usar as quantidades da nota')
    } finally {
      setPreenchendo(false)
    }
  }
  const confirmar = async () => {
    if (!validar()) return

    // confere a nota antes de mexer no estoque
    dadosNotaRef.current = null
    if (temNota) {
      const v = validarNota(nota)
      if (!v.ok) {
        setNotaAberta(true)
        setErro(v.erro)
        return
      }
      dadosNotaRef.current = v.dados
    }

    // o balcão se identifica com a senha; o dono já está identificado
    if (!ehDono) {
      setPedindoSenha(true)
      return
    }

    setSalvando(true)
    try {
      await enviar(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar o recebimento')
      setSalvando(false)
    }
  }

  const tentarNotaDeNovo = async () => {
    if (!notaPendente || tentando) return
    setTentando(true)
    try {
      await registrarNota(pedido.id, notaPendente.dados)
      onRecebido(`${notaPendente.aviso} Nota fiscal registrada.`)
    } catch (e) {
      setNotaPendente({
        ...notaPendente,
        erro: e instanceof Error ? e.message : 'Erro ao registrar a nota',
      })
      setTentando(false)
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <PackageCheck className="size-6 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              Receber pedido {numeroPedido(pedido.numero)}
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              {pedido.fornecedor_nome}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {notaPendente ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-6">
            <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              O recebimento foi registrado.
            </p>
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>A nota fiscal não foi salva: {notaPendente.erro}</span>
            </p>
            <p className="text-sm text-slate-500">
              Os arquivos da nota já foram enviados. Tente salvar a nota de novo.
            </p>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onRecebido(`${notaPendente.aviso} Atenção: a nota fiscal não foi registrada.`)
              }
              disabled={tentando}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              Fechar sem a nota
            </Button>
            <Button
              type="button"
              onClick={tentarNotaDeNovo}
              disabled={tentando}
              className="min-w-40 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
            >
              {tentando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Tentar de novo'
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {erroCarga ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {erroCarga}
              </p>
            ) : itens === null ? (
              <p className="flex items-center gap-2 py-6 text-sm text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                Carregando itens...
              </p>
            ) : itens.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Este pedido não está mais aguardando recebimento.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Informe quanto chegou de cada item. O que não chegou fica pendente.
                  </p>
                  <button
                    type="button"
                    onClick={chegouTudo}
                    className="shrink-0 rounded-lg border border-[#079C9C] px-3 py-2 text-sm font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10 active:scale-95"
                  >
                    Chegou tudo
                  </button>
                </div>

                <ul className="space-y-2">
                  {linhas.map(({ item, falta, q }) => {
                    const concluido = falta === 0
                    const aMais = q > falta ? arredondar(q - falta) : 0
                    const vaiFaltar = !concluido && q >= 0 && q < falta ? arredondar(falta - q) : 0
                    const un = item.unidade ? ` ${item.unidade}` : ''

                    return (
                      <li
                        key={item.id}
                        className={`rounded-xl border p-3 shadow-sm ${
                          concluido
                            ? 'border-slate-200 bg-slate-50 opacity-70'
                            : q > 0
                              ? 'border-[#079C9C]/50 bg-[#079C9C]/5'
                              : 'border-slate-200 bg-white'
                        }`}
                      >
                        <p className="font-semibold text-slate-900">{item.produto_nome}</p>
                        <p className="text-xs text-slate-500">
                          Pedido {numeroTexto(item.quantidade)}
                          {un}
                          {item.quantidade_recebida > 0 &&
                            ` · já recebido ${numeroTexto(item.quantidade_recebida)}`}
                          {!concluido && ` · falta ${numeroTexto(falta)}`}
                        </p>
                        {item.observacao?.trim() && (
                          <p className="mt-0.5 text-xs italic text-slate-500">
                            obs: {item.observacao.trim()}
                          </p>
                        )}
                        {!item.produto_codigo && estoque && !concluido && (
                          <p className="mt-0.5 text-[11px] text-amber-600">
                            Sem código do catálogo: não dá entrada no estoque.
                          </p>
                        )}

                        {concluido ? (
                          <p className="mt-2 text-xs font-semibold text-emerald-600">
                            Recebido por completo
                          </p>
                        ) : (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label
                              htmlFor={`chegou-${item.id}`}
                              className="text-sm font-medium text-slate-600"
                            >
                              Chegou
                            </label>
                            <input
                              id={`chegou-${item.id}`}
                              data-chegou=""
                              value={chegou[item.id] ?? ''}
                              onChange={(e) => definir(item.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  irParaProximo(e.currentTarget)
                                }
                              }}
                              inputMode="decimal"
                              enterKeyHint="next"
                              placeholder="0"
                              className="h-10 w-24 rounded-lg border border-slate-200 bg-white text-center text-base font-semibold outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
                            />
                            <button
                              type="button"
                              onClick={() => definir(item.id, numeroTexto(falta))}
                              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                              Tudo ({numeroTexto(falta)})
                            </button>
                            {aMais > 0 && (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                +{numeroTexto(aMais)} a mais que o pedido
                              </span>
                            )}
                            {q > 0 && vaiFaltar > 0 && (
                              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                faltam {numeroTexto(vaiFaltar)}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <div className="space-y-2">
                  <Opcao
                    ativo={estoque}
                    onChange={() => setEstoque((v) => !v)}
                    titulo="Dar entrada no estoque"
                    descricao="Soma o que chegou no estoque do catálogo e guarda no histórico do item"
                  />

                  {conferidos > 0 && aindaFalta > 0 && (
                    <Opcao
                      ativo={encerrar}
                      onChange={() => setEncerrar((v) => !v)}
                      titulo="Encerrar o pedido"
                      descricao="O que faltou não vem mais. O pedido fica como recebido."
                    />
                  )}
                </div>

                {/* nota fiscal */}
                <div className="rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setNotaAberta((v) => !v)}
                    aria-expanded={notaAberta}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <Receipt className="size-5 shrink-0 text-[#079C9C]" />
                      <span>
                        <span className="block text-sm font-semibold text-slate-700">
                          Nota fiscal
                        </span>
                        <span className="block text-xs text-slate-500">
                          {temNota
                            ? 'Dados preenchidos'
                            : 'Foto, chave ou XML da nota (opcional)'}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      className={`size-5 shrink-0 text-slate-400 transition ${
                        notaAberta ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* fica montado mesmo fechado, para não perder as miniaturas */}
                  <div className={notaAberta ? 'border-t border-slate-100 p-3' : 'hidden'}>
                                        <NotaFiscalCampos
                      nota={nota}
                      setNota={setNota}
                      pedidoId={pedido.id}
                      empresaId={empresaId}
                      erroEmpresa={erroEmpresa}
                      acaoXml={
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={usarQuantidadesDaNota}
                            disabled={preenchendo || !itens}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#079C9C] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#079C9C]/90 active:scale-95 disabled:opacity-60"
                          >
                            {preenchendo ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <ListChecks className="size-4" />
                            )}
                            Usar as quantidades da nota
                          </button>

                          {resumoXml && (
                            <div className="space-y-1.5 text-xs">
                              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
                                {resumoXml.preenchidos === 0
                                  ? 'Nenhum item da nota foi reconhecido.'
                                  : `${resumoXml.preenchidos} ${
                                      resumoXml.preenchidos === 1 ? 'item preenchido' : 'itens preenchidos'
                                    } com as quantidades da nota. Confira o que chegou de verdade antes de confirmar.`}
                              </p>

                              {resumoXml.unidades.length > 0 && (
                                <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                                  Unidade diferente entre o pedido e a nota. Confira a quantidade:{' '}
                                  {listaCurta(resumoXml.unidades)}.
                                </p>
                              )}

                              {resumoXml.naoReconhecidos.length > 0 && (
                                <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                                  {resumoXml.naoReconhecidos.length}{' '}
                                  {resumoXml.naoReconhecidos.length === 1
                                    ? 'item da nota não foi reconhecido'
                                    : 'itens da nota não foram reconhecidos'}
                                  : {listaCurta(resumoXml.naoReconhecidos)}. Preencha à mão. Para o
                                  sistema reconhecer da próxima vez, o dono liga os itens em Notas
                                  fiscais do pedido.
                                </p>
                              )}

                              {resumoXml.naoVieram.length > 0 && (
                                <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                                  Não vieram na nota: {listaCurta(resumoXml.naoVieram)}.
                                </p>
                              )}

                              {resumoXml.jaRecebidos > 0 && (
                                <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                                  {resumoXml.jaRecebidos}{' '}
                                  {resumoXml.jaRecebidos === 1
                                    ? 'item já tinha sido recebido por completo'
                                    : 'itens já tinham sido recebidos por completo'}
                                  : não mudaram.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      }
                    />
                  </div>
                </div>

                <input
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  maxLength={500}
                  placeholder="Observação (ex: quem entregou, avaria)"
                  aria-label="Observação do recebimento"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
                />
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50">
            {erro && (
              <p
                role="alert"
                className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-600"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {erro}
              </p>
            )}
            <div className="flex items-center justify-between gap-3 px-6 py-3.5">
              <p className="text-sm text-slate-500">
                {conferidos} de {pendentes} {pendentes === 1 ? 'item' : 'itens'} conferidos
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onFechar}
                  disabled={salvando}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={confirmar}
                  disabled={salvando || !itens || itens.length === 0}
                  className="min-w-44 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    'Confirmar recebimento'
                  )}
                </Button>
              </div>
            </div>
          </div>

          {pedindoSenha && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
              <SenhaVendedor
                titulo="Digite a sua senha"
                descricao="Para registrar o recebimento no seu nome."
                textoBotao="Confirmar"
                onConfirmar={(pin) => enviar(pin)}
                onCancelar={() => setPedindoSenha(false)}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default function ReceberPedidoDialog({
  pedido,
  ehDono,
  onClose,
  onRecebido,
}: {
  pedido: PedidoParaReceber | null
  ehDono: boolean
  onClose: () => void
  onRecebido: (aviso: string) => void
}) {
  const sujo = useRef(false)
  const marcarSujo = useCallback((v: boolean) => {
    sujo.current = v
  }, [])

  const fechar = () => {
    if (sujo.current && !window.confirm('Descartar a conferência? O que você marcou será perdido.'))
      return
    onClose()
  }

  return (
    <Dialog open={!!pedido} onOpenChange={(o) => !o && fechar()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[680px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        {pedido && (
          <Conteudo
            key={pedido.id}
            pedido={pedido}
            ehDono={ehDono}
            onFechar={fechar}
            onSujo={marcarSujo}
            onRecebido={onRecebido}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}