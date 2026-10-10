'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addFornecedorNaComparacao,
  addItens,
  createFornecedor,
  getComparacao,
  listFornecedores,
  removeFornecedorDaComparacao,
  removeItem,
  setPreco as salvarPreco,
  updateFornecedor,
  updateItem,
} from '../services/comparacaoService'
import type {
  ComparacaoCompleta,
  Fornecedor,
  NovoFornecedor,
  NovoItemComparacao,
} from '../types'

export function useComparacao(id: string) {
  const [dados, setDados] = useState<ComparacaoCompleta | null>(null)
  const [todosFornecedores, setTodosFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setError(null)
    try {
      const [completa, fornecedores] = await Promise.all([
        getComparacao(id),
        listFornecedores(),
      ])
      setDados(completa)
      setTodosFornecedores(fornecedores)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a comparação')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  // fornecedores cadastrados que ainda não estão nesta comparação
  const fornecedoresDisponiveis = useMemo(() => {
    const participantes = new Set(dados?.fornecedores.map((f) => f.id))
    return todosFornecedores.filter((f) => !participantes.has(f.id))
  }, [dados, todosFornecedores])

  // ---------- preços (atualiza a tela sem recarregar tudo) ----------

  const definirPreco = async (itemId: string, fornecedorId: string, valor: number | null) => {
    const preco = await salvarPreco(itemId, fornecedorId, valor)

    setDados((prev) => {
      if (!prev) return prev
      const semAntigo = prev.precos.filter(
        (p) => !(p.item_id === itemId && p.supplier_id === fornecedorId)
      )
      return { ...prev, precos: preco ? [...semAntigo, preco] : semAntigo }
    })
  }

  // ---------- fornecedores ----------

  const adicionarFornecedor = async (fornecedorId: string) => {
    await addFornecedorNaComparacao(id, fornecedorId)
    await carregar()
  }

  // cadastra um fornecedor novo e já coloca nesta comparação
  const criarEAdicionarFornecedor = async (f: NovoFornecedor) => {
    const novo = await createFornecedor(f)
    await addFornecedorNaComparacao(id, novo.id)
    await carregar()
    return novo
  }

  const editarFornecedor = async (fornecedorId: string, f: NovoFornecedor) => {
    await updateFornecedor(fornecedorId, f)
    await carregar()
  }

  const removerFornecedor = async (fornecedorId: string) => {
    await removeFornecedorDaComparacao(
      id,
      fornecedorId,
      (dados?.itens ?? []).map((i) => i.id)
    )
    await carregar()
  }

  // ---------- itens ----------

  const adicionarItens = async (novos: NovoItemComparacao[]) => {
    const proxima = (dados?.itens.reduce((max, i) => Math.max(max, i.position), -1) ?? -1) + 1
    await addItens(id, novos, proxima)
    await carregar()
  }

  const alterarQuantidade = async (itemId: string, quantity: number) => {
    if (!(quantity > 0)) return
    await updateItem(itemId, { quantity })
    setDados((prev) =>
      prev
        ? { ...prev, itens: prev.itens.map((i) => (i.id === itemId ? { ...i, quantity } : i)) }
        : prev
    )
  }

  const removerItem = async (itemId: string) => {
    await removeItem(itemId)
    setDados((prev) =>
      prev
        ? {
            ...prev,
            itens: prev.itens.filter((i) => i.id !== itemId),
            precos: prev.precos.filter((p) => p.item_id !== itemId),
          }
        : prev
    )
  }

  return {
    comparacao: dados?.comparacao ?? null,
    itens: dados?.itens ?? [],
    fornecedores: dados?.fornecedores ?? [],
    precos: dados?.precos ?? [],
    fornecedoresDisponiveis,
    loading,
    error,
    definirPreco,
    adicionarFornecedor,
    criarEAdicionarFornecedor,
    editarFornecedor,
    removerFornecedor,
    adicionarItens,
    alterarQuantidade,
    removerItem,
    recarregar: carregar,
  }
}