'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
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
import { mesmaUnidade } from '../lib/unidades'
import { NOTA_VAZIA, notaPreenchida, validarNota, type NotaRascunho } from '../lib/notaRascunho'
import NotaFiscalCampos from './NotaFiscalCampos'

export interface PedidoParaReceber {
  id: string
  numero: number
  fornecedor_nome: string
}

/* ---------- helpers ---------- */

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

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

function montarAviso(r: ResultadoRecebimento) {
  const situacao = r.completo
    ? 'recebido por completo'
    : r.encerrou
      ? 'encerrado com o que chegou'
      : 'recebimento parcial registrado'

  const partes = [`Pedido ${numeroPedido(r.numero)}: ${situacao} (por ${r.recebido_por}).`]
  if (r.sem_estoque.length > 0)
    partes.push(`Sem entrada no estoque, por não achar no catálogo: ${r.sem_estoque.join(', ')}.`)
  return partes.join(' ')
}

/* ---------- componentes pequenos ---------- */

type Tom = 'erro' | 'atencao' | 'info'

const TONS: Record<Tom, string> = {
  erro: 'border-red-200 bg-red-50 text-red-700',
  atencao: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-slate-200 bg-slate-50 text-slate-600',
}

function Aviso({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <p
      role={tom === 'erro' ? 'alert' : undefined}
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${TONS[tom]}`}
    >
      {tom !== 'info' && <AlertCircle className="mt-0.5 size-4 shrink-0" />}
      <span>{children}</span>
    </p>
  )
}

function Opcao({
  marcado,
  onChange,
  titulo,
  descricao,
}: {
  marcado: boolean
  onChange: (v: boolean) => void
  titulo: string
  descricao: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[#079C9C]"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{titulo}</span>
        <span className="block text-xs text-slate-500">{descricao}</span>
      </span>
    </label>
  )
}

function LinhaItem({
  item,
  q,
  valor,
  estoque,
  onChange,
}: {
  item: ItemAReceber
  q: number
  valor: string
  estoque: boolean
  onChange: (valor: string) => void
}) {
  const falta = faltaDe(item)
  const concluido = falta === 0
  const aMais = q > falta ? arredondar(q - falta) : 0
  const vaiFaltar = !concluido && q > 0 && q < falta ? arredondar(falta - q) : 0
  const un = item.unidade ? ` ${item.unidade}` : ''

  const irParaProximo = (atual: HTMLInputElement) => {
    const campos = Array.from(document.querySelectorAll<HTMLInputElement>('[data-chegou]')).filter(
      (el) => !el.disabled && el.offsetParent !== null
    )
    const proximo = campos[campos.indexOf(atual) + 1]
    if (proximo) proximo.focus()
    else atual.blur()
  }

  return (
    <li className={`flex items-center justify-between gap-4 py-3 ${concluido ? 'opacity-60' : ''}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{item.produto_nome}</p>
        <p className="text-xs text-slate-500">
          Pedido {numeroTexto(item.quantidade)}
          {un}
          {item.quantidade_recebida > 0 && `, recebido ${numeroTexto(item.quantidade_recebida)}`}
          {!concluido && `, falta ${numeroTexto(falta)}`}
        </p>
        {item.observacao?.trim() && (
          <p className="text-xs italic text-slate-500">Obs: {item.observacao.trim()}</p>
        )}
        {!item.produto_codigo && estoque && !concluido && (
          <p className="text-xs text-amber-700">Sem código do catálogo: não dá entrada no estoque.</p>
        )}
        {aMais > 0 && (
          <p className="text-xs text-amber-700">{numeroTexto(aMais)} a mais que o pedido</p>
        )}
        {vaiFaltar > 0 && (
          <p className="text-xs text-slate-600">Ainda faltam {numeroTexto(vaiFaltar)}</p>
        )}
      </div>

      {concluido ? (
        <span className="shrink-0 text-xs text-slate-500">Recebido por completo</span>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(numeroTexto(falta))}
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Tudo
          </button>
          <input
            aria-label={`Quantidade que chegou de ${item.produto_nome}`}
            data-chegou=""
            value={valor}
            onChange={(e) => onChange(e.target.value)}
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
            className="h-9 w-20 rounded-md border border-slate-300 bg-white text-center text-sm font-medium outline-none focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20"
          />
        </div>
      )}
    </li>
  )
}

/* ---------- conteúdo ---------- */

type AvisoXml = { tom: Tom; texto: string }

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
  const [avisosXml, setAvisosXml] = useState<AvisoXml[]>([])

  useEffect(() => {
    let cancelado = false
    itensAReceber(pedido.id)
      .then((l) => !cancelado && setItens(l))
      .catch(
        (e) =>
          !cancelado && setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar os itens')
      )
    return () => {
      cancelado = true
    }
  }, [pedido.id])

  useEffect(() => {
    let cancelado = false
    empresaIdAtual()
      .then((id) => !cancelado && setEmpresaId(id))
      .catch(
        (e) =>
          !cancelado &&
          setErroEmpresa(
            e instanceof Error ? e.message : 'Não foi possível preparar o envio de arquivos'
          )
      )
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
  const aindaFalta = linhas.filter((l) => l.falta - (l.q > 0 ? l.q : 0) > 0).length

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
      itens: linhas.filter((l) => l.q > 0).map((l) => ({ item_id: l.item.id, quantidade: l.q })),
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
    setAvisosXml([])
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
      const naoReconhecidos = daNota.filter((_, ni) => !usadas.has(ni)).map((n) => n.nome)
      const naoVieram = itens
        .filter((it, pi) => faltaDe(it) > 0 && !pares.has(pi))
        .map((it) => it.produto_nome)
      const preenchidos = Object.keys(novos).length

      setChegou((p) => ({ ...p, ...novos }))

      const avisos: AvisoXml[] = [
        preenchidos === 0
          ? { tom: 'atencao', texto: 'Nenhum item da nota foi reconhecido.' }
          : {
              tom: 'info',
              texto: `${plural(preenchidos, 'item preenchido', 'itens preenchidos')} com as quantidades da nota. Confira o que chegou de verdade antes de confirmar.`,
            },
      ]
      if (unidades.length > 0)
        avisos.push({
          tom: 'atencao',
          texto: `Unidade diferente entre o pedido e a nota. Confira a quantidade: ${listaCurta(unidades)}.`,
        })
      if (naoReconhecidos.length > 0)
        avisos.push({
          tom: 'atencao',
          texto: `${plural(naoReconhecidos.length, 'item da nota não foi reconhecido', 'itens da nota não foram reconhecidos')}: ${listaCurta(naoReconhecidos)}. Preencha à mão. Para o sistema reconhecer da próxima vez, o dono liga os itens em Notas fiscais do pedido.`,
        })
      if (naoVieram.length > 0)
        avisos.push({ tom: 'info', texto: `Não vieram na nota: ${listaCurta(naoVieram)}.` })
      if (jaRecebidos > 0)
        avisos.push({
          tom: 'info',
          texto: `${plural(jaRecebidos, 'item já tinha sido recebido por completo', 'itens já tinham sido recebidos por completo')}: não mudaram.`,
        })
      setAvisosXml(avisos)
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
      <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4 text-left">
        <DialogTitle className="text-lg font-semibold text-slate-900">
          Receber pedido {numeroPedido(pedido.numero)}
        </DialogTitle>
        <DialogDescription className="truncate text-sm text-slate-500">
          {pedido.fornecedor_nome}
        </DialogDescription>
      </DialogHeader>

      {notaPendente ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
            <Aviso tom="info">O recebimento foi registrado.</Aviso>
            <Aviso tom="atencao">A nota fiscal não foi salva: {notaPendente.erro}</Aviso>
            <p className="text-sm text-slate-500">
              Os arquivos da nota já foram enviados. Tente salvar a nota de novo.
            </p>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-6 py-3">
            <Button
              type="button"
              variant="outline"
              disabled={tentando}
              onClick={() =>
                onRecebido(`${notaPendente.aviso} Atenção: a nota fiscal não foi registrada.`)
              }
            >
              Fechar sem a nota
            </Button>
            <Button
              type="button"
              onClick={tentarNotaDeNovo}
              disabled={tentando}
              className="min-w-36 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
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
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
            {erroCarga ? (
              <Aviso tom="erro">{erroCarga}</Aviso>
            ) : itens === null ? (
              <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
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
                  <Button type="button" variant="outline" size="sm" onClick={chegouTudo}>
                    Chegou tudo
                  </Button>
                </div>

                <ul className="divide-y divide-slate-200 border-y border-slate-200">
                  {linhas.map(({ item, q }) => (
                    <LinhaItem
                      key={item.id}
                      item={item}
                      q={q}
                      valor={chegou[item.id] ?? ''}
                      estoque={estoque}
                      onChange={(v) => definir(item.id, v)}
                    />
                  ))}
                </ul>

                <div className="space-y-3">
                  <Opcao
                    marcado={estoque}
                    onChange={setEstoque}
                    titulo="Dar entrada no estoque"
                    descricao="Soma o que chegou no estoque do catálogo e guarda no histórico do item."
                  />
                  {conferidos > 0 && aindaFalta > 0 && (
                    <Opcao
                      marcado={encerrar}
                      onChange={setEncerrar}
                      titulo="Encerrar o pedido"
                      descricao="O que faltou não vem mais. O pedido fica como recebido."
                    />
                  )}
                </div>

                {/* nota fiscal */}
                <div className="rounded-md border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setNotaAberta((v) => !v)}
                    aria-expanded={notaAberta}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-800">Nota fiscal</span>
                      <span className="block text-xs text-slate-500">
                        {temNota ? 'Dados preenchidos' : 'Foto, chave ou XML da nota (opcional)'}
                      </span>
                    </span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-slate-400 transition ${
                        notaAberta ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* fica montado mesmo fechado, para não perder as miniaturas */}
                  <div className={notaAberta ? 'border-t border-slate-200 p-3' : 'hidden'}>
                    <NotaFiscalCampos
                      nota={nota}
                      setNota={setNota}
                      pedidoId={pedido.id}
                      empresaId={empresaId}
                      erroEmpresa={erroEmpresa}
                      acaoXml={
                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={usarQuantidadesDaNota}
                            disabled={preenchendo || !itens}
                            className="w-full gap-2"
                          >
                            {preenchendo && <Loader2 className="size-4 animate-spin" />}
                            Usar as quantidades da nota
                          </Button>

                          {avisosXml.map((a, i) => (
                            <Aviso key={i} tom={a.tom}>
                              {a.texto}
                            </Aviso>
                          ))}
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
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm"
                />
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200">
            {erro && (
              <div className="px-6 pt-3">
                <Aviso tom="erro">{erro}</Aviso>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 px-6 py-3">
              <p className="text-sm text-slate-500">
                {conferidos} de {plural(pendentes, 'item', 'itens')} conferidos
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={confirmar}
                  disabled={salvando || !itens || itens.length === 0}
                  className="min-w-44 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
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

/* ---------- dialog ---------- */

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
        className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[680px]"
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