'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  AlertCircle,
  Barcode,
  Camera,
  CheckCircle2,
  FileCode,
  FileText,
  Loader2,
  Paperclip,
  X,
} from 'lucide-react'
import { formatarCnpj, formatarCpf } from '@/features/clientes/lib/documentos'
import {
  UF_POR_CODIGO,
  formatarChave,
  lerChave,
  lerXmlNfe,
  limparChave,
  mesAnoDaChave,
} from '../lib/nfe'
import { MAX_ANEXOS, type NotaRascunho } from '../lib/notaRascunho'
import { enviarArquivo } from '../services/notasService'

const inputClass =
  'w-full rounded-lg border bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

const botaoClass =
  'flex items-center justify-center gap-2 rounded-lg border border-[#079C9C] bg-white px-3 py-2.5 text-sm font-semibold text-[#079C9C] transition hover:bg-[#079C9C]/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'

const fmtDoc = (d: string) => (d.length <= 11 ? formatarCpf(d) : formatarCnpj(d))

const tamanho = (b: number) =>
  b >= 1_048_576
    ? `${(b / 1_048_576).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(b / 1024))} KB`

export default function NotaFiscalCampos({
  nota,
  setNota,
  pedidoId,
  empresaId,
  erroEmpresa,
  acaoXml,
}: {
  nota: NotaRascunho
  setNota: Dispatch<SetStateAction<NotaRascunho>>
  pedidoId: string
  empresaId: string | null
  erroEmpresa?: string
  acaoXml?: React.ReactNode // aparece logo depois de importar um XML
}) {
  const [aviso, setAviso] = useState('')
  const [erroXml, setErroXml] = useState('')
  const camera = useRef<HTMLInputElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const xmlRef = useRef<HTMLInputElement>(null)

  // sempre a lista mais recente, mesmo dentro de funções assíncronas
  const anexosRef = useRef(nota.anexos)
  anexosRef.current = nota.anexos

  useEffect(
    () => () => {
      anexosRef.current.forEach((a) => a.previa && URL.revokeObjectURL(a.previa))
    },
    []
  )

  const pronto = !!empresaId
  const chaveCompleta = nota.chave.length === 44
  const dadosChave = chaveCompleta ? lerChave(nota.chave) : null

  const mudarChave = (valor: string) => {
    const chave = limparChave(valor)
    const d = chave.length === 44 ? lerChave(chave) : null
    setNota((p) => ({
      ...p,
      chave,
      ...(d
        ? { numero: String(d.numero), serie: String(d.serie), emitenteDoc: d.emitente }
        : {}),
    }))
  }

  const anexar = async (arquivos: File[]) => {
    if (!empresaId || arquivos.length === 0) return
    setAviso('')

    const vagas = MAX_ANEXOS - anexosRef.current.length
    if (vagas <= 0) {
      setAviso(`Máximo de ${MAX_ANEXOS} arquivos por nota.`)
      return
    }
    if (arquivos.length > vagas)
      setAviso(`Só cabem mais ${vagas} ${vagas === 1 ? 'arquivo' : 'arquivos'}: o resto foi ignorado.`)

    await Promise.all(
      arquivos.slice(0, vagas).map(async (f) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const previa = f.type.startsWith('image/') ? URL.createObjectURL(f) : null

        setNota((p) => ({
          ...p,
          anexos: [
            ...p.anexos,
            { id, nome: f.name, tipo: f.type, tamanho: f.size, previa, estado: 'enviando' },
          ],
        }))

        try {
          const enviado = await enviarArquivo({ empresaId, pedidoId, arquivo: f })
          setNota((p) => ({
            ...p,
            anexos: p.anexos.map((a) =>
              a.id === id ? { ...a, estado: 'ok', arquivo: enviado, tamanho: enviado.tamanho } : a
            ),
          }))
        } catch (e) {
          setNota((p) => ({
            ...p,
            anexos: p.anexos.map((a) =>
              a.id === id
                ? { ...a, estado: 'erro', erro: e instanceof Error ? e.message : 'Erro ao enviar' }
                : a
            ),
          }))
        }
      })
    )
  }

  const importarXml = async (arquivo: File) => {
    setErroXml('')
    try {
      if (arquivo.size > 2_000_000) throw new Error('XML grande demais (limite de 2 MB).')
      const x = lerXmlNfe(await arquivo.text())

      setNota((p) => ({
        ...p,
        chave: x.chave,
        numero: String(x.numero),
        serie: String(x.serie),
        emissao: x.emissao ?? p.emissao,
        valor: x.valor.toFixed(2).replace('.', ','),
        emitenteDoc: x.emitenteDoc,
        emitenteNome: x.emitenteNome,
        xml: x,
      }))

      // guarda o próprio XML junto com os anexos
      await anexar([arquivo])
    } catch (e) {
      setErroXml(e instanceof Error ? e.message : 'Não foi possível ler o XML.')
    }
  }

  const removerAnexo = (id: string) => {
    const alvo = nota.anexos.find((a) => a.id === id)
    if (alvo?.previa) URL.revokeObjectURL(alvo.previa)
    setNota((p) => ({ ...p, anexos: p.anexos.filter((a) => a.id !== id) }))
  }

  return (
    <div className="space-y-4">
      {erroEmpresa && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {erroEmpresa}
        </p>
      )}

      {/* anexos */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">Foto, PDF ou XML da nota</p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button type="button" disabled={!pronto} onClick={() => camera.current?.click()} className={botaoClass}>
            <Camera className="size-4" />
            Tirar foto
          </button>
          <button type="button" disabled={!pronto} onClick={() => arquivoRef.current?.click()} className={botaoClass}>
            <Paperclip className="size-4" />
            Escolher arquivo
          </button>
          <button
            type="button"
            disabled={!pronto}
            onClick={() => xmlRef.current?.click()}
            className={`${botaoClass} col-span-2 sm:col-span-1`}
          >
            <FileCode className="size-4" />
            Importar XML
          </button>
        </div>

        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = Array.from(e.target.files ?? [])
            e.target.value = ''
            anexar(f)
          }}
        />
        <input
          ref={arquivoRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const f = Array.from(e.target.files ?? [])
            e.target.value = ''
            anexar(f)
          }}
        />
        <input
          ref={xmlRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) importarXml(f)
          }}
        />

        {aviso && <p className="text-xs text-amber-600">{aviso}</p>}
        {erroXml && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-red-600">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {erroXml}
          </p>
        )}

        {nota.xml && (
          <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            XML importado: {nota.xml.itens.length} {nota.xml.itens.length === 1 ? 'item' : 'itens'}
            {nota.xml.duplicatas.length > 0 &&
              ` e ${nota.xml.duplicatas.length} ${nota.xml.duplicatas.length === 1 ? 'vencimento' : 'vencimentos'}`}
            . Os campos abaixo foram preenchidos.
          </p>
        )}
         {nota.xml && acaoXml}
        {nota.xml?.autorizada === false && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            Este XML não consta como nota autorizada. Confirme com o fornecedor.
          </p>
        )}

        {nota.anexos.length > 0 && (
          <ul className="space-y-2">
            {nota.anexos.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2"
              >
                {a.previa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.previa} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                    {a.tipo.includes('xml') ? (
                      <FileCode className="size-6" />
                    ) : (
                      <FileText className="size-6" />
                    )}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{a.nome}</p>
                  {a.estado === 'enviando' && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Loader2 className="size-3 animate-spin" />
                      Enviando...
                    </p>
                  )}
                  {a.estado === 'ok' && (
                    <p className="text-xs text-emerald-600">Enviado · {tamanho(a.tamanho)}</p>
                  )}
                  {a.estado === 'erro' && <p className="text-xs text-red-600">{a.erro}</p>}
                </div>

                <button
                  type="button"
                  aria-label={`Remover ${a.nome}`}
                  onClick={() => removerAnexo(a.id)}
                  className="shrink-0 rounded-md p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* chave */}
      <div className="space-y-1.5">
        <label htmlFor="nf-chave" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Barcode className="size-4 text-[#079C9C]" />
          Chave de acesso
        </label>
        <input
          id="nf-chave"
          value={formatarChave(nota.chave)}
          onChange={(e) => mudarChave(e.target.value)}
          onKeyDown={(e) => {
            // o leitor de código de barras termina com Enter: segue para o valor
            if (e.key === 'Enter') {
              e.preventDefault()
              document.getElementById('nf-valor')?.focus()
            }
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Bipe o código de barras da nota ou digite os 44 números"
          className={`${inputClass} font-mono text-sm ${
            chaveCompleta && !dadosChave ? 'border-red-400' : 'border-slate-200'
          }`}
        />

        {nota.chave.length === 0 ? (
          <p className="text-xs text-slate-400">Com a chave, o número e o emitente se preenchem sozinhos.</p>
        ) : !chaveCompleta ? (
          <p className="text-xs text-slate-500">{nota.chave.length} de 44 caracteres</p>
        ) : !dadosChave ? (
          <p className="text-xs text-red-600">Chave inválida. Confira os números.</p>
        ) : (
          <p className="text-xs text-emerald-600">
            Chave válida · nota {dadosChave.numero}, série {dadosChave.serie} ·{' '}
            {UF_POR_CODIGO[dadosChave.uf] ?? `UF ${dadosChave.uf}`} · {mesAnoDaChave(dadosChave.anoMes)}
            {dadosChave.modelo !== '55' && (
              <span className="text-amber-600">
                {' '}
                · atenção: modelo {dadosChave.modelo} (a NF-e é 55)
              </span>
            )}
          </p>
        )}
      </div>

      {/* dados */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <label htmlFor="nf-numero" className="block text-sm font-semibold text-slate-700">
            Número
          </label>
          <input
            id="nf-numero"
            value={nota.numero}
            onChange={(e) =>
              setNota((p) => ({ ...p, numero: e.target.value.replace(/\D/g, '').slice(0, 9) }))
            }
            readOnly={!!dadosChave}
            inputMode="numeric"
            autoComplete="off"
            className={`${inputClass} border-slate-200 ${dadosChave ? 'bg-slate-50 text-slate-500' : ''}`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="nf-serie" className="block text-sm font-semibold text-slate-700">
            Série
          </label>
          <input
            id="nf-serie"
            value={nota.serie}
            onChange={(e) =>
              setNota((p) => ({ ...p, serie: e.target.value.replace(/\D/g, '').slice(0, 3) }))
            }
            readOnly={!!dadosChave}
            inputMode="numeric"
            autoComplete="off"
            className={`${inputClass} border-slate-200 ${dadosChave ? 'bg-slate-50 text-slate-500' : ''}`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="nf-emissao" className="block text-sm font-semibold text-slate-700">
            Emissão
          </label>
          <input
            id="nf-emissao"
            type="date"
            value={nota.emissao}
            onChange={(e) => setNota((p) => ({ ...p, emissao: e.target.value }))}
            className={`${inputClass} border-slate-200`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="nf-valor" className="block text-sm font-semibold text-slate-700">
            Valor da nota (R$)
          </label>
          <input
            id="nf-valor"
            value={nota.valor}
            onChange={(e) => setNota((p) => ({ ...p, valor: e.target.value }))}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            className={`${inputClass} border-slate-200`}
          />
        </div>
      </div>

      {(nota.emitenteNome || nota.emitenteDoc) && (
        <p className="text-xs text-slate-500">
          Emitente: {nota.emitenteNome || 'CNPJ'}
          {nota.emitenteDoc ? ` · ${fmtDoc(nota.emitenteDoc)}` : ''}
        </p>
      )}

      <input
        value={nota.observacao}
        onChange={(e) => setNota((p) => ({ ...p, observacao: e.target.value }))}
        maxLength={500}
        placeholder="Observação sobre a nota (opcional)"
        aria-label="Observação sobre a nota"
        className={`${inputClass} border-slate-200`}
      />
    </div>
  )
}