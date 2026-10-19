'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { FileDown, Loader2, Printer, Receipt, Share2 } from 'lucide-react'
import type { DocumentoResumo, ItemDocumento } from '../services/documentosService'
import { enfileirarCupom, statusDaImpressao } from '../services/filaImpressaoService'
import { imprimirDocumento } from '../lib/impressao'
import { gerarDocumentoPdf, precarregarPdf } from '../lib/gerarDocumentoPdf'
import { CUPOM_PELO_SERVICO } from '../lib/empresa'

type Formato = 'cupom' | 'a4' | 'pdf'
type Aviso = { tom: 'info' | 'ok' | 'erro'; texto: string }

// o que quem usa o componente pode pedir (ex.: o caixa, pelo teclado)
export interface AcoesImpressao {
  cupom: () => void
  a4: () => void
  pdf: () => void
}

interface Props {
  // devolve o documento e os itens (já carregados ou buscados na hora)
  carregar: () => Promise<{ doc: DocumentoResumo; itens: ItemDocumento[] }>
  desabilitado?: boolean
  centralizar?: boolean
  semBotoes?: boolean // só mostra as mensagens; quem manda imprimir é quem usa o componente
}

const botaoClass =
  'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:opacity-50'

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

const corAviso: Record<Aviso['tom'], string> = {
  info: 'text-slate-500',
  ok: 'text-emerald-600',
  erro: 'text-red-600',
}

const BotoesImpressao = forwardRef<AcoesImpressao, Props>(function BotoesImpressao(
  { carregar, desabilitado = false, centralizar = false, semBotoes = false },
  ref
) {
  const [ocupado, setOcupado] = useState<Formato | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const montado = useRef(true)

  // carrega a biblioteca do PDF antes do clique (necessário para compartilhar no iPhone)
  useEffect(() => {
    precarregarPdf()
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  // A4 e PDF (e o cupom pelo navegador, se o serviço estiver desligado)
  const executar = async (formato: Formato) => {
    if (ocupado !== null) return
    setOcupado(formato)
    setErro('')
    setAviso(null)
    try {
      const { doc, itens } = await carregar()
      if (formato === 'pdf') await gerarDocumentoPdf(doc, itens)
      else imprimirDocumento(doc, itens, formato)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível imprimir')
    } finally {
      setOcupado(null)
    }
  }

  // cupom pela fila: o programa do computador da impressora imprime
  const acompanhar = async (idFila: string) => {
    for (let i = 0; i < 25 && montado.current; i++) {
      await esperar(1500)
      const s = await statusDaImpressao(idFila)

      if (s.status === 'impresso') {
        setAviso({ tom: 'ok', texto: 'Cupom impresso.' })
        return
      }
      if (s.status === 'erro') {
        setAviso({
          tom: 'erro',
          texto: `Não imprimiu: ${s.erro ?? 'erro na impressora'}. Peça o cupom de novo para tentar outra vez.`,
        })
        return
      }
      if (s.status === 'expirado') {
        setAviso({
          tom: 'erro',
          texto: 'O pedido de impressão expirou. Confira se o programa da impressora está ligado e tente de novo.',
        })
        return
      }
      if (s.status === 'pendente' && s.erro) {
        setAviso({ tom: 'info', texto: 'Tentando de novo...' })
      }
    }
    if (montado.current) {
      setAviso({
        tom: 'info',
        texto: 'Ainda na fila. Se não sair, confira se o programa da impressora está ligado.',
      })
    }
  }

  const imprimirCupom = async () => {
    if (ocupado !== null) return
    if (!CUPOM_PELO_SERVICO) {
      await executar('cupom')
      return
    }

    setOcupado('cupom')
    setErro('')
    setAviso(null)

    let idFila: string
    try {
      const { doc } = await carregar()
      idFila = await enfileirarCupom(doc.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar para a impressora')
      setOcupado(null)
      return
    }

    // o botão volta a funcionar; o andamento aparece no aviso
    setOcupado(null)
    setAviso({ tom: 'info', texto: 'Enviado para o balcão...' })
    try {
      await acompanhar(idFila)
    } catch (e) {
      if (montado.current) {
        setAviso({
          tom: 'erro',
          texto: e instanceof Error ? e.message : 'Não foi possível acompanhar a impressão',
        })
      }
    }
  }

  useImperativeHandle(ref, () => ({
    cupom: () => {
      void imprimirCupom()
    },
    a4: () => {
      void executar('a4')
    },
    pdf: () => {
      void executar('pdf')
    },
  }))

  const bloqueado = desabilitado || ocupado !== null

  const icone = (formato: Formato, Icone: typeof Printer) =>
    ocupado === formato ? <Loader2 className="size-4 animate-spin" /> : <Icone className="size-4" />

  const alinhamento = centralizar ? 'justify-center text-center' : 'justify-end text-right'

  return (
    <div className={`flex flex-wrap items-center gap-2 ${centralizar ? 'justify-center' : 'justify-end'}`}>
      {!semBotoes && (
        <>
          <button type="button" onClick={imprimirCupom} disabled={bloqueado} className={botaoClass}>
            {icone('cupom', Receipt)}
            Cupom
          </button>

          <button type="button" onClick={() => executar('a4')} disabled={bloqueado} className={botaoClass}>
            {icone('a4', Printer)}
            A4
          </button>

          <button type="button" onClick={() => executar('pdf')} disabled={bloqueado} className={botaoClass}>
            {ocupado === 'pdf' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Share2 className="size-4 sm:hidden" />
                <FileDown className="hidden size-4 sm:block" />
              </>
            )}
            PDF
          </button>
        </>
      )}

      {ocupado !== null && semBotoes && (
        <p className={`flex w-full items-center gap-2 text-xs text-slate-400 ${alinhamento}`}>
          <Loader2 className="size-3.5 animate-spin" />
          Preparando...
        </p>
      )}
      {erro && <p className={`w-full text-xs text-red-400 ${alinhamento}`}>{erro}</p>}
      {aviso && (
        <p className={`w-full text-xs font-medium ${semBotoes ? 'text-slate-300' : corAviso[aviso.tom]} ${alinhamento}`}>
          {aviso.texto}
        </p>
      )}
    </div>
  )
})

export default BotoesImpressao