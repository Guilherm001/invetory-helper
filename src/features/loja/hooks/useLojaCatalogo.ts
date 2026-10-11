'use client'

import { useEffect, useState } from 'react'
import { buscarProdutos, type ProdutoLoja } from '../services/lojaCatalogoService'

interface Resultado {
  chave: string // a busca que gerou estes itens
  itens: ProdutoLoja[]
  total: number
  paginas: number
}

export function useLojaCatalogo() {
  const [termo, setTermo] = useState('')
  const [termoBusca, setTermoBusca] = useState('')
  const [soComEstoque, setSoComEstoque] = useState(false)
  const [res, setRes] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregandoMais, setCarregandoMais] = useState(false)

  const chave = `${termoBusca}|${soComEstoque ? 1 : 0}`

  // espera a pessoa parar de digitar
  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(termo), 250)
    return () => clearTimeout(t)
  }, [termo])

  useEffect(() => {
    let cancelado = false
    buscarProdutos({ termo: termoBusca, pagina: 0, soComEstoque })
      .then((r) => {
        if (cancelado) return
        setRes({ chave, itens: r.itens, total: r.total, paginas: 1 })
        setErro(null)
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : 'Erro ao buscar os produtos')
      })
    return () => {
      cancelado = true
    }
  }, [chave, termoBusca, soComEstoque])

  const carregarMais = async () => {
    if (!res || res.chave !== chave || carregandoMais) return
    setCarregandoMais(true)
    try {
      const r = await buscarProdutos({ termo: termoBusca, pagina: res.paginas, soComEstoque })
      setRes((atual) =>
        atual && atual.chave === chave
          ? {
              ...atual,
              itens: [...atual.itens, ...r.itens],
              // se não veio nada, o total real é o que já está na tela
              total: r.itens.length > 0 ? r.total : atual.itens.length,
              paginas: atual.paginas + 1,
            }
          : atual
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar mais produtos')
    } finally {
      setCarregandoMais(false)
    }
  }

  // o produto que o Enter deve escolher: o primeiro resultado do que está digitado
  const primeiroResultado = async (): Promise<ProdutoLoja | null> => {
    if (!termo.trim()) return null

    // a lista na tela já é desta busca: o primeiro item dela é o resultado
    if (res && res.chave === chave && termoBusca === termo) return res.itens[0] ?? null

    // senão busca agora, sem esperar a pausa da digitação (leitor de código de barras)
    const r = await buscarProdutos({ termo, pagina: 0, soComEstoque })
    return r.itens[0] ?? null
  }

  return {
    termo,
    setTermo,
    buscarAgora: () => setTermoBusca(termo), // Enter na página do catálogo
    primeiroResultado, // Enter na janela de venda
    soComEstoque,
    alternarEstoque: () => setSoComEstoque((v) => !v),
    itens: res?.itens ?? [],
    total: res?.total ?? 0,
    carregando: res === null && erro === null,
    atualizando: res !== null && res.chave !== chave, // mostra o resultado antigo esmaecido
    emDia: res !== null && res.chave === chave && termoBusca === termo, // a lista é do que está digitado
    temMais: res !== null && res.itens.length < res.total,
    carregandoMais,
    carregarMais,
    erro,
  }
}