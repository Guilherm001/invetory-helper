'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { Button } from '../../../../components/ui/button'

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// nomes aceitos para cada coluna (já sem acento e minúsculos)
const ALIASES: Record<string, string[]> = {
  code: ['codigo', 'cod', 'codproduto', 'codigoproduto'],
  barcode: ['codigodebarra', 'codigodebarras', 'codbarra', 'codbarras', 'ean', 'gtin'],
  name: ['descricao', 'produto', 'nome'],
  unit: ['embalagem', 'unidade', 'un', 'emb'],
  price: ['precoavista', 'precoavis', 'preco', 'avista'],
  stock: ['estoque', 'saldo', 'qtdestoque'],
}

function pick(row: Record<string, unknown>, field: string) {
  for (const key of Object.keys(row)) {
    if (ALIASES[field].includes(norm(key))) return row[key]
  }
  return undefined
}

function toNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') return v
  let s = String(v).replace(/[^\d,.-]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.') // 1.234,56 -> 1234.56
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const toText = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim())

export default function ImportarCatalogo({ onDone }: { onDone?: () => void }) {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setStatus('Lendo planilha...')

    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Não autenticado')

      const wb = XLSX.read(await file.arrayBuffer())
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets[wb.SheetNames[0]]
      )

      const agora = new Date().toISOString()
      const items = rows
        .map((r) => ({
          user_id: auth.user!.id,
          code: toText(pick(r, 'code')),
          barcode: toText(pick(r, 'barcode')) || null,
          name: toText(pick(r, 'name')),
          unit: toText(pick(r, 'unit')).toUpperCase() || null,
          price: toNumber(pick(r, 'price')),
          stock: toNumber(pick(r, 'stock')),
          updated_at: agora,
        }))
        .filter((i) => i.code && i.name)

      const unicos = [...new Map(items.map((i) => [i.code, i])).values()]

      if (unicos.length === 0) {
        setStatus('Nenhum item válido. Confira os nomes das colunas da planilha.')
        return
      }

      const TAMANHO = 1000
      for (let i = 0; i < unicos.length; i += TAMANHO) {
        const { error } = await supabase
          .from('catalog_items')
          .upsert(unicos.slice(i, i + TAMANHO), { onConflict: 'user_id,code' })
        if (error) throw new Error(error.message)
        setStatus(`Importando... ${Math.min(i + TAMANHO, unicos.length)} de ${unicos.length}`)
      }

      setStatus(`Pronto: ${unicos.length} itens importados.`)
      onDone?.()
    } catch (err) {
      setStatus(err instanceof Error ? `Erro: ${err.message}` : 'Erro ao importar')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <Button asChild variant="outline" disabled={loading}>
        <label className="cursor-pointer">
          {loading ? 'Importando...' : 'Importar planilha (Excel/CSV)'}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            disabled={loading}
            onChange={handleFile}
          />
        </label>
      </Button>
      {status && <p className="text-sm text-gray-600">{status}</p>}
    </div>
  )
}