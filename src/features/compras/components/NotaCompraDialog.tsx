'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Receipt } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { empresaIdAtual, registrarNota } from '../services/notasService'
import { NOTA_VAZIA, notaPreenchida, validarNota, type NotaRascunho } from '../lib/notaRascunho'
import { numeroPedido } from '../lib/compras'
import NotaFiscalCampos from './NotaFiscalCampos'

interface Alvo {
  id: string
  numero: number
  fornecedor_nome: string
}

function Conteudo({
  pedido,
  onFechar,
  onSujo,
  onSalvo,
}: {
  pedido: Alvo
  onFechar: () => void
  onSujo: (sujo: boolean) => void
  onSalvo: () => void
}) {
  const [nota, setNota] = useState<NotaRascunho>(NOTA_VAZIA)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [erroEmpresa, setErroEmpresa] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let cancelado = false
    empresaIdAtual()
      .then((id) => {
        if (!cancelado) setEmpresaId(id)
      })
      .catch((e) => {
        if (!cancelado)
          setErroEmpresa(e instanceof Error ? e.message : 'Não foi possível preparar o envio')
      })
    return () => {
      cancelado = true
    }
  }, [])

  const preenchida = notaPreenchida(nota)
  useEffect(() => {
    onSujo(preenchida)
  }, [preenchida, onSujo])

  const salvar = async () => {
    setErro('')
    if (!preenchida) {
      setErro('Preencha os dados da nota ou anexe um arquivo.')
      return
    }
    const v = validarNota(nota)
    if (!v.ok) {
      setErro(v.erro)
      return
    }

    setSalvando(true)
    try {
      await registrarNota(pedido.id, v.dados)
      onSalvo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar a nota')
      setSalvando(false)
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Receipt className="size-6 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">Adicionar nota fiscal</DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              Pedido {numeroPedido(pedido.numero)} · {pedido.fornecedor_nome}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <NotaFiscalCampos
          nota={nota}
          setNota={setNota}
          pedidoId={pedido.id}
          empresaId={empresaId}
          erroEmpresa={erroEmpresa}
        />
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
        <div className="flex justify-end gap-3 px-6 py-3.5">
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
            onClick={salvar}
            disabled={salvando}
            className="min-w-36 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {salvando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar nota'
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

export default function NotaCompraDialog({
  pedido,
  aberto,
  onClose,
  onSalvo,
}: {
  pedido: Alvo
  aberto: boolean
  onClose: () => void
  onSalvo: () => void
}) {
  const sujo = useRef(false)
  const marcarSujo = useCallback((v: boolean) => {
    sujo.current = v
  }, [])

  const fechar = () => {
    if (sujo.current && !window.confirm('Descartar os dados da nota?')) return
    onClose()
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[640px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100"
      >
        {aberto && (
          <Conteudo pedido={pedido} onFechar={fechar} onSujo={marcarSujo} onSalvo={onSalvo} />
        )}
      </DialogContent>
    </Dialog>
  )
}