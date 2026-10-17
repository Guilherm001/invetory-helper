'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, MapPin } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import {
  atualizarEndereco,
  criarEndereco,
  type DadosEndereco,
  type EnderecoCliente,
} from '../services/fichaService'
import { UFS, formatarCep, soDigitos } from '../lib/documentos'

interface Form {
  apelido: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  codMunicipio: string
  observacao: string
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

function Campo({
  id,
  label,
  dica,
  className = '',
  children,
}: {
  id: string
  label: string
  dica?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      {children}
      {dica && <p className="text-xs text-slate-400">{dica}</p>}
    </div>
  )
}

const vazio = (s: string) => (s.trim() === '' ? null : s.trim())

function Conteudo({
  clienteId,
  endereco,
  onClose,
  onSalvo,
}: {
  clienteId: string
  endereco: EnderecoCliente | null
  onClose: () => void
  onSalvo: () => void
}) {
  const [f, setF] = useState<Form>({
    apelido: endereco?.apelido ?? '',
    cep: endereco?.cep ?? '',
    logradouro: endereco?.logradouro ?? '',
    numero: endereco?.numero ?? '',
    complemento: endereco?.complemento ?? '',
    bairro: endereco?.bairro ?? '',
    municipio: endereco?.municipio ?? '',
    uf: endereco?.uf ?? '',
    codMunicipio: endereco?.cod_municipio ?? '',
    observacao: endereco?.observacao ?? '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [cepStatus, setCepStatus] = useState<'' | 'buscando' | 'ok' | 'falhou'>('')
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => () => ctrl.current?.abort(), [])

  const set = <K extends keyof Form>(campo: K, valor: Form[K]) =>
    setF((p) => ({ ...p, [campo]: valor }))

  const buscarCep = async (cep: string) => {
    ctrl.current?.abort()
    const atual = new AbortController()
    ctrl.current = atual
    const limite = setTimeout(() => atual.abort(), 8000)
    setCepStatus('buscando')
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: atual.signal })
      if (!r.ok) throw new Error('http')
      const d = (await r.json()) as {
        erro?: boolean | string
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
        ibge?: string
      }
      if (ctrl.current !== atual) return
      if (d.erro) {
        setCepStatus('falhou')
        return
      }
      setF((p) => ({
        ...p,
        logradouro: (d.logradouro || p.logradouro).slice(0, 60),
        bairro: (d.bairro || p.bairro).slice(0, 60),
        municipio: (d.localidade || p.municipio).slice(0, 60),
        uf: d.uf || p.uf,
        codMunicipio: d.ibge || p.codMunicipio,
      }))
      setCepStatus('ok')
    } catch {
      if (ctrl.current === atual) setCepStatus('falhou')
    } finally {
      clearTimeout(limite)
    }
  }

  const mudarCep = (valor: string) => {
    const cep = soDigitos(valor).slice(0, 8)
    set('cep', cep)
    if (cep.length === 8) buscarCep(cep)
    else {
      ctrl.current?.abort()
      setCepStatus('')
    }
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salvando) return

    const problema =
      f.apelido.trim().length < 2
        ? ['apelido', 'Dê um nome para o endereço (ex: Casa da Rua das Flores).']
        : !/^\d{8}$/.test(f.cep)
          ? ['cep', 'Informe o CEP (8 números).']
          : f.logradouro.trim().length < 2
            ? ['logradouro', 'Informe a rua.']
            : !f.numero.trim()
              ? ['numero', 'Informe o número (ou S/N).']
              : f.bairro.trim().length < 2
                ? ['bairro', 'Informe o bairro.']
                : f.municipio.trim().length < 2
                  ? ['municipio', 'Informe o município.']
                  : !UFS.includes(f.uf)
                    ? ['uf', 'Escolha a UF.']
                    : f.codMunicipio && !/^\d{7}$/.test(f.codMunicipio)
                      ? ['codMunicipio', 'O código do IBGE tem 7 números.']
                      : null

    if (problema) {
      setErro(problema[1])
      document.getElementById(`end-${problema[0]}`)?.focus()
      return
    }

    const dados: DadosEndereco = {
      apelido: f.apelido.trim(),
      cep: f.cep,
      logradouro: f.logradouro.trim(),
      numero: f.numero.trim(),
      complemento: vazio(f.complemento),
      bairro: f.bairro.trim(),
      municipio: f.municipio.trim(),
      uf: f.uf,
      cod_municipio: vazio(f.codMunicipio),
      observacao: vazio(f.observacao),
    }

    setSalvando(true)
    setErro('')
    try {
      if (endereco) await atualizarEndereco(endereco.id, dados)
      else await criarEndereco(clienteId, dados)
      onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o endereço')
      setSalvando(false)
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <MapPin className="size-6 text-white" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              {endereco ? 'Editar endereço' : 'Novo endereço'}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/80">
              Para entregas em outros locais deste cliente
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={salvar} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-6">
            <Campo id="end-apelido" label="Nome do endereço" className="sm:col-span-6" dica="Ex: Casa da Rua das Flores, Apartamento 2">
              <input
                id="end-apelido"
                value={f.apelido}
                onChange={(e) => set('apelido', e.target.value)}
                maxLength={60}
                autoFocus
                autoComplete="off"
                className={inputClass}
              />
            </Campo>

            <Campo id="end-cep" label="CEP" className="sm:col-span-2">
              <input
                id="end-cep"
                value={formatarCep(f.cep)}
                onChange={(e) => mudarCep(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="00000-000"
                className={inputClass}
              />
              {cepStatus === 'buscando' && (
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Loader2 className="size-3 animate-spin" />
                  Buscando...
                </p>
              )}
              {cepStatus === 'ok' && <p className="text-xs text-emerald-600">Preenchido pelo CEP</p>}
              {cepStatus === 'falhou' && (
                <p className="text-xs text-amber-600">Não achei esse CEP. Preencha à mão.</p>
              )}
            </Campo>

            <Campo id="end-logradouro" label="Rua" className="sm:col-span-4">
              <input
                id="end-logradouro"
                value={f.logradouro}
                onChange={(e) => set('logradouro', e.target.value)}
                maxLength={60}
                autoComplete="off"
                className={inputClass}
              />
            </Campo>

            <Campo id="end-numero" label="Número" className="sm:col-span-2">
              <input
                id="end-numero"
                value={f.numero}
                onChange={(e) => set('numero', e.target.value)}
                maxLength={60}
                autoComplete="off"
                placeholder="ou S/N"
                className={inputClass}
              />
            </Campo>

            <Campo id="end-complemento" label="Complemento" className="sm:col-span-4">
              <input
                id="end-complemento"
                value={f.complemento}
                onChange={(e) => set('complemento', e.target.value)}
                maxLength={60}
                autoComplete="off"
                className={inputClass}
              />
            </Campo>

            <Campo id="end-bairro" label="Bairro" className="sm:col-span-3">
              <input
                id="end-bairro"
                value={f.bairro}
                onChange={(e) => set('bairro', e.target.value)}
                maxLength={60}
                autoComplete="off"
                className={inputClass}
              />
            </Campo>

            <Campo id="end-municipio" label="Município" className="sm:col-span-3">
              <input
                id="end-municipio"
                value={f.municipio}
                onChange={(e) => set('municipio', e.target.value)}
                maxLength={60}
                autoComplete="off"
                className={inputClass}
              />
            </Campo>

            <Campo id="end-uf" label="UF" className="sm:col-span-2">
              <select
                id="end-uf"
                value={f.uf}
                onChange={(e) => set('uf', e.target.value)}
                className={inputClass}
              >
                <option value="">Escolha</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id="end-codMunicipio" label="Código IBGE" className="sm:col-span-4" dica="Vem do CEP. Tem 7 números.">
              <input
                id="end-codMunicipio"
                value={f.codMunicipio}
                onChange={(e) => set('codMunicipio', soDigitos(e.target.value).slice(0, 7))}
                inputMode="numeric"
                autoComplete="off"
                className={inputClass}
              />
            </Campo>

            <Campo id="end-observacao" label="Observações" className="sm:col-span-6" dica="Ponto de referência, quem recebe, horário...">
              <textarea
                id="end-observacao"
                value={f.observacao}
                onChange={(e) => set('observacao', e.target.value)}
                rows={2}
                maxLength={300}
                className={`${inputClass} resize-none`}
              />
            </Campo>
          </div>
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
            <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="min-w-40 gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
            >
              {salvando && <Loader2 className="size-4 animate-spin" />}
              {endereco ? 'Salvar alterações' : 'Cadastrar endereço'}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function EnderecoDialog({
  open,
  clienteId,
  endereco,
  onClose,
  onSalvo,
}: {
  open: boolean
  clienteId: string
  endereco: EnderecoCliente | null
  onClose: () => void
  onSalvo: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[620px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        {open && (
          <Conteudo
            key={endereco?.id ?? 'novo'}
            clienteId={clienteId}
            endereco={endereco}
            onClose={onClose}
            onSalvo={onSalvo}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}