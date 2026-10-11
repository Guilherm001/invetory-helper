'use client'

import { useEffect, useState } from 'react'
import { FileDown, Loader2, Printer, Receipt, Share2 } from 'lucide-react'
import type { DocumentoResumo, ItemDocumento } from '../services/documentosService'
import { imprimirDocumento } from '../lib/impressao'
import { gerarDocumentoPdf, precarregarPdf } from '../lib/gerarDocumentoPdf'

type Formato = 'cupom' | 'a4' | 'pdf'

const botaoClass =
  'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:opacity-50'

export default function BotoesImpressao({
  carregar,
  desabilitado = false,
  centralizar = false,
}: {
  // devolve o documento e os itens (já carregados ou buscados na hora)
  carregar: () => Promise<{ doc: DocumentoResumo; itens: ItemDocumento[] }>
  desabilitado?: boolean
  centralizar?: boolean
}) {
  const [ocupado, setOcupado] = useState<Formato | null>(null)
  const [erro, setErro] = useState('')

  // carrega a biblioteca do PDF antes do clique (necessário para compartilhar no iPhone)
  useEffect(() => {
    precarregarPdf()
  }, [])

  const executar = async (formato: Formato) => {
    setOcupado(formato)
    setErro('')
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

  const bloqueado = desabilitado || ocupado !== null

  const icone = (formato: Formato, Icone: typeof Printer) =>
    ocupado === formato ? <Loader2 className="size-4 animate-spin" /> : <Icone className="size-4" />

  return (
    <div className={`flex flex-wrap items-center gap-2 ${centralizar ? 'justify-center' : 'justify-end'}`}>
      <button type="button" onClick={() => executar('cupom')} disabled={bloqueado} className={botaoClass}>
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

      {erro && (
        <p className={`w-full text-xs text-red-600 ${centralizar ? 'text-center' : 'text-right'}`}>
          {erro}
        </p>
      )}
    </div>
  )
}