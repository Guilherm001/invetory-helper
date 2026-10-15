'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Building2, CheckCircle2, Loader2, User } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import {
  atualizarCliente,
  criarCliente,
  type Cliente,
  type DadosCliente,
  type IndIE,
  type TipoCliente,
} from '../services/clientesService'
import {
  IND_IE,
  UFS,
  cnpjValido,
  cpfValido,
  formatarCep,
  formatarCnpj,
  formatarCpf,
  formatarTelefone,
  limparCnpj,
  limparCpf,
  pendenciasFiscais,
  soAlfanum,
  soDigitos,
} from '../lib/documentos'

// ---------- formulário ----------

interface Form {
  tipo: TipoCliente
  nome: string
  nomeFantasia: string
  documento: string
  rg: string
  nascimento: string
  contato: string
  indIe: '' | '1' | '2' | '9'
  ie: string
  im: string
  consumidorFinal: boolean
  email: string
  telefone: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  codMunicipio: string
  uf: string
  observacao: string
}

type Erros = Partial<Record<keyof Form, string>>

const t = (s: string | null | undefined) => s ?? ''

function inicial(c: Cliente | null, nomeInicial: string): Form {
  if (!c) {
    return {
      tipo: 'fisica',
      nome: nomeInicial,
      nomeFantasia: '',
      documento: '',
      rg: '',
      nascimento: '',
      contato: '',
      indIe: '9',
      ie: '',
      im: '',
      consumidorFinal: true,
      email: '',
      telefone: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      municipio: '',
      codMunicipio: '',
      uf: '',
      observacao: '',
    }
  }
  return {
    tipo: c.tipo,
    nome: c.nome,
    nomeFantasia: t(c.nome_fantasia),
    documento: c.documento,
    rg: t(c.rg),
    nascimento: t(c.data_nascimento),
    contato: t(c.contato),
    indIe: String(c.ind_ie) as Form['indIe'],
    ie: t(c.ie),
    im: t(c.im),
    consumidorFinal: c.consumidor_final,
    email: t(c.email),
    telefone: t(c.telefone),
    cep: t(c.cep),
    logradouro: t(c.logradouro),
    numero: t(c.numero),
    complemento: t(c.complemento),
    bairro: t(c.bairro),
    municipio: t(c.municipio),
    codMunicipio: t(c.cod_municipio),
    uf: t(c.uf),
    observacao: t(c.observacao),
  }
}

const vazio = (s: string) => {
  const x = s.trim()
  return x === '' ? null : x
}

function paraDados(f: Form): DadosCliente {
  const pj = f.tipo === 'juridica'
  const ind = Number(f.indIe || 9) as IndIE

  return {
    tipo: f.tipo,
    nome: f.nome.trim().replace(/\s+/g, ' '),
    nome_fantasia: pj ? vazio(f.nomeFantasia) : null,
    documento: f.documento,
    rg: pj ? null : vazio(f.rg),
    data_nascimento: pj ? null : vazio(f.nascimento),
    contato: pj ? vazio(f.contato) : null,
    ind_ie: ind,
    ie: ind === 1 ? vazio(f.ie) : null,
    im: pj ? vazio(f.im) : null,
    // SUFRAMA não é usado (não se aplica em São Paulo): segue vazio no cadastro
    suframa: null,
    consumidor_final: f.consumidorFinal,
    email: vazio(f.email)?.toLowerCase() ?? null,
    telefone: vazio(f.telefone),
    cep: vazio(f.cep),
    logradouro: vazio(f.logradouro),
    numero: vazio(f.numero),
    complemento: vazio(f.complemento),
    bairro: vazio(f.bairro),
    municipio: vazio(f.municipio),
    cod_municipio: vazio(f.codMunicipio),
    uf: vazio(f.uf),
    observacao: vazio(f.observacao),
  }
}

// ordem em que os campos aparecem (o cursor vai para o primeiro com erro)
const ORDEM: (keyof Form)[] = [
  'nome',
  'documento',
  'indIe',
  'ie',
  'email',
  'telefone',
  'cep',
  'logradouro',
  'numero',
  'bairro',
  'municipio',
  'uf',
  'codMunicipio',
]

function validar(f: Form): Erros {
  const e: Erros = {}
  const pj = f.tipo === 'juridica'

  if (f.nome.trim().length < 2) e.nome = pj ? 'Informe a razão social' : 'Informe o nome completo'

  if (!f.documento) {
    e.documento = pj ? 'Informe o CNPJ' : 'Informe o CPF'
  } else if (pj ? !cnpjValido(f.documento) : !cpfValido(f.documento)) {
    e.documento = pj
      ? 'CNPJ inválido. Confira os caracteres.'
      : 'CPF inválido. Confira os números.'
  }

  if (pj && !f.indIe) e.indIe = 'Escolha a situação da inscrição estadual'
  if (f.indIe === '1' && !/^[A-Z0-9]{2,14}$/.test(f.ie))
    e.ie = 'Informe a inscrição estadual (de 2 a 14 caracteres)'

  const email = f.email.trim()
  if (email && (email.length > 60 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)))
    e.email = 'E-mail inválido'

  if (f.telefone && !/^\d{10,11}$/.test(f.telefone)) e.telefone = 'Telefone com DDD (10 ou 11 números)'

  // se começou a preencher o endereço, ele precisa ficar completo
  const temEndereco = [
    f.cep,
    f.logradouro,
    f.numero,
    f.complemento,
    f.bairro,
    f.municipio,
    f.uf,
    f.codMunicipio,
  ].some((v) => v.trim() !== '')

  if (temEndereco) {
    if (!/^\d{8}$/.test(f.cep)) e.cep = 'CEP com 8 números'
    if (f.logradouro.trim().length < 2) e.logradouro = 'Informe a rua'
    if (!f.numero.trim()) e.numero = 'Informe o número (ou S/N)'
    if (f.bairro.trim().length < 2) e.bairro = 'Informe o bairro'
    if (f.municipio.trim().length < 2) e.municipio = 'Informe o município'
    if (!UFS.includes(f.uf)) e.uf = 'Escolha a UF'
  }
  if (f.codMunicipio && !/^\d{7}$/.test(f.codMunicipio))
    e.codMunicipio = 'O código do IBGE tem 7 números'

  return e
}

// ---------- visual ----------

const inputClass =
  'w-full rounded-lg border bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

const borda = (erro?: string) => (erro ? 'border-red-400' : 'border-slate-200')

function Campo({
  id,
  label,
  erro,
  dica,
  obrigatorio,
  className = '',
  children,
}: {
  id: string
  label: string
  erro?: string
  dica?: string
  obrigatorio?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
        {obrigatorio && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {erro ? (
        <p className="text-xs text-red-600">{erro}</p>
      ) : (
        dica && <p className="text-xs text-slate-400">{dica}</p>
      )}
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="border-b border-slate-100 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </h4>
      {children}
    </section>
  )
}

// ---------- conteúdo (só existe enquanto a janela está aberta) ----------

function Conteudo({
  cliente,
  nomeInicial,
  onClose,
  onSalvo,
}: {
  cliente: Cliente | null
  nomeInicial: string
  onClose: () => void
  onSalvo: (c: Cliente) => void
}) {
  const [f, setF] = useState<Form>(() => inicial(cliente, nomeInicial))
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [cepStatus, setCepStatus] = useState<'' | 'buscando' | 'ok' | 'naoachou' | 'erro'>('')
  const cepCtrl = useRef<AbortController | null>(null)

  const pj = f.tipo === 'juridica'
  const editando = cliente !== null

  useEffect(() => () => cepCtrl.current?.abort(), [])

  const set = <K extends keyof Form>(campo: K, valor: Form[K]) => {
    setF((p) => ({ ...p, [campo]: valor }))
    if (erros[campo]) setErros((p) => ({ ...p, [campo]: undefined }))
  }

  const trocarTipo = (tipo: TipoCliente) => {
    if (editando || tipo === f.tipo) return
    setF((p) => ({
      ...p,
      tipo,
      documento: '',
      indIe: tipo === 'fisica' ? '9' : '',
      ie: '',
      consumidorFinal: tipo === 'fisica',
    }))
    setErros({})
  }

  const escolherIe = (valor: '1' | '2' | '9') => {
    setF((p) => ({ ...p, indIe: valor, ie: valor === '1' ? p.ie : '' }))
    setErros((p) => ({ ...p, indIe: undefined, ie: undefined }))
  }

  // CEP completo: busca rua, bairro, município, UF e código IBGE
  const buscarCep = async (cep: string) => {
    cepCtrl.current?.abort()
    const ctrl = new AbortController()
    cepCtrl.current = ctrl
    const limite = setTimeout(() => ctrl.abort(), 8000)

    setCepStatus('buscando')
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal })
      if (!r.ok) throw new Error('http')
      const d = (await r.json()) as {
        erro?: boolean | string
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
        ibge?: string
      }
      if (cepCtrl.current !== ctrl) return // chegou uma busca mais nova

      if (d.erro) {
        setCepStatus('naoachou')
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
      setErros((p) => ({
        ...p,
        cep: undefined,
        logradouro: undefined,
        bairro: undefined,
        municipio: undefined,
        uf: undefined,
        codMunicipio: undefined,
      }))
      setCepStatus('ok')
    } catch {
      if (cepCtrl.current === ctrl) setCepStatus('erro')
    } finally {
      clearTimeout(limite)
    }
  }

  const mudarCep = (valor: string) => {
    const cep = soDigitos(valor).slice(0, 8)
    set('cep', cep)
    if (cep.length === 8) buscarCep(cep)
    else {
      cepCtrl.current?.abort()
      setCepStatus('')
    }
  }

  const pendencias = pendenciasFiscais({
    cep: f.cep,
    logradouro: f.logradouro.trim(),
    numero: f.numero.trim(),
    bairro: f.bairro.trim(),
    municipio: f.municipio.trim(),
    uf: f.uf,
    cod_municipio: f.codMunicipio,
  })

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salvando) return

    const novos = validar(f)
    setErros(novos)

    const primeiro = ORDEM.find((c) => novos[c])
    if (primeiro || Object.keys(novos).length > 0) {
      setErroGeral('Corrija os campos destacados.')
      if (primeiro) document.getElementById(`cli-${primeiro}`)?.focus()
      return
    }

    setSalvando(true)
    setErroGeral('')
    try {
      const dados = paraDados(f)
      const salvo = cliente
        ? await atualizarCliente(cliente.id, dados)
        : await criarCliente(dados)
      onSalvo(salvo)
    } catch (err) {
      setErroGeral(err instanceof Error ? err.message : 'Não foi possível salvar o cliente')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <DialogHeader className="shrink-0 bg-[#079C9C] px-6 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            {pj ? <Building2 className="size-6 text-white" /> : <User className="size-6 text-white" />}
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-bold text-white">
              {editando ? 'Editar cliente' : 'Novo cliente'}
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-white/80">
              {editando
                ? cliente.nome
                : 'Dados completos para emitir nota fiscal (DANFE) no futuro'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={salvar} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* tipo */}
          <div role="radiogroup" aria-label="Tipo de cliente" className="grid grid-cols-2 gap-2">
            {(
              [
                ['fisica', 'Pessoa física', User],
                ['juridica', 'Pessoa jurídica', Building2],
              ] as const
            ).map(([valor, rotulo, Icone]) => {
              const ativo = f.tipo === valor
              return (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  disabled={editando && !ativo}
                  onClick={() => trocarTipo(valor)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    ativo
                      ? 'border-[#079C9C] bg-[#079C9C]/10 text-[#079C9C]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icone className="size-5" />
                  {rotulo}
                </button>
              )
            })}
          </div>
          {editando && (
            <p className="-mt-3 text-xs text-slate-400">
              O tipo não muda depois de salvo. Para trocar, cadastre um novo cliente.
            </p>
          )}

          {/* identificação */}
          <Secao titulo={pj ? 'Dados da empresa' : 'Dados pessoais'}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                id="cli-nome"
                label={pj ? 'Razão social' : 'Nome completo'}
                obrigatorio
                erro={erros.nome}
                dica="Máximo de 60 caracteres, como a nota fiscal exige"
                className="sm:col-span-2"
              >
                <input
                  id="cli-nome"
                  value={f.nome}
                  onChange={(e) => set('nome', e.target.value)}
                  maxLength={60}
                  autoFocus={!editando}
                  autoComplete="off"
                  className={`${inputClass} ${borda(erros.nome)}`}
                />
              </Campo>

              {pj && (
                <Campo id="cli-nomeFantasia" label="Nome fantasia" className="sm:col-span-2">
                  <input
                    id="cli-nomeFantasia"
                    value={f.nomeFantasia}
                    onChange={(e) => set('nomeFantasia', e.target.value)}
                    maxLength={60}
                    autoComplete="off"
                    className={`${inputClass} ${borda()}`}
                  />
                </Campo>
              )}

              <Campo
                id="cli-documento"
                label={pj ? 'CNPJ' : 'CPF'}
                obrigatorio
                erro={erros.documento}
                dica={pj ? 'Aceita o CNPJ novo, com letras' : undefined}
              >
                <input
                  id="cli-documento"
                  value={pj ? formatarCnpj(f.documento) : formatarCpf(f.documento)}
                  onChange={(e) =>
                    set('documento', pj ? limparCnpj(e.target.value) : limparCpf(e.target.value))
                  }
                  inputMode={pj ? 'text' : 'numeric'}
                  autoComplete="off"
                  placeholder={pj ? '00.000.000/0000-00' : '000.000.000-00'}
                  className={`${inputClass} ${borda(erros.documento)}`}
                />
              </Campo>

              {pj ? (
                <Campo id="cli-contato" label="Pessoa de contato">
                  <input
                    id="cli-contato"
                    value={f.contato}
                    onChange={(e) => set('contato', e.target.value)}
                    maxLength={60}
                    autoComplete="off"
                    className={`${inputClass} ${borda()}`}
                  />
                </Campo>
              ) : (
                <Campo id="cli-rg" label="RG">
                  <input
                    id="cli-rg"
                    value={f.rg}
                    onChange={(e) => set('rg', e.target.value)}
                    maxLength={20}
                    autoComplete="off"
                    className={`${inputClass} ${borda()}`}
                  />
                </Campo>
              )}

              {!pj && (
                <Campo id="cli-nascimento" label="Data de nascimento">
                  <input
                    id="cli-nascimento"
                    type="date"
                    value={f.nascimento}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => set('nascimento', e.target.value)}
                    className={`${inputClass} ${borda()}`}
                  />
                </Campo>
              )}
            </div>
          </Secao>

          {/* fiscal */}
          <Secao titulo="Dados fiscais">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-slate-700">
                Inscrição estadual{pj && <span className="text-red-500"> *</span>}
              </p>
              <div
                id="cli-indIe"
                role="radiogroup"
                aria-label="Situação da inscrição estadual"
                className="grid gap-2 sm:grid-cols-3"
              >
                {IND_IE.map((o) => {
                  const ativo = f.indIe === o.valor
                  return (
                    <button
                      key={o.valor}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => escolherIe(o.valor)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition ${
                        ativo
                          ? 'border-[#079C9C] bg-[#079C9C]/10'
                          : `${borda(erros.indIe)} bg-white hover:bg-slate-50`
                      }`}
                    >
                      <span
                        className={`block text-sm font-semibold ${
                          ativo ? 'text-[#079C9C]' : 'text-slate-700'
                        }`}
                      >
                        {o.titulo}
                      </span>
                      <span className="block text-xs text-slate-500">{o.desc}</span>
                    </button>
                  )
                })}
              </div>
              {erros.indIe ? (
                <p className="text-xs text-red-600">{erros.indIe}</p>
              ) : (
                <p className="text-xs text-slate-400">
                  Em dúvida? Pergunte ao cliente ou ao contador: isso define como a nota é emitida.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {f.indIe === '1' && (
                <Campo
                  id="cli-ie"
                  label="Inscrição estadual (IE)"
                  obrigatorio
                  erro={erros.ie}
                  dica="O número não é conferido por estado"
                >
                  <input
                    id="cli-ie"
                    value={f.ie}
                    onChange={(e) => set('ie', soAlfanum(e.target.value).slice(0, 14))}
                    autoComplete="off"
                    className={`${inputClass} ${borda(erros.ie)}`}
                  />
                </Campo>
              )}

              {pj && (
                <Campo id="cli-im" label="Inscrição municipal">
                  <input
                    id="cli-im"
                    value={f.im}
                    onChange={(e) => set('im', e.target.value)}
                    maxLength={15}
                    autoComplete="off"
                    className={`${inputClass} ${borda()}`}
                  />
                </Campo>
              )}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={f.consumidorFinal}
              onClick={() => set('consumidorFinal', !f.consumidorFinal)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                f.consumidorFinal
                  ? 'border-[#079C9C] bg-[#079C9C]/10'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span>
                <span className="block text-sm font-semibold text-slate-700">Consumidor final</span>
                <span className="block text-xs text-slate-500">
                  Marque se o cliente é o destinatário final do produto (não vai revender)
                </span>
              </span>
              <span
                className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
                  f.consumidorFinal ? 'bg-[#079C9C]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`size-5 rounded-full bg-white shadow transition ${
                    f.consumidorFinal ? 'translate-x-5' : ''
                  }`}
                />
              </span>
            </button>
          </Secao>

          {/* contato */}
          <Secao titulo="Contato">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="cli-telefone" label="Telefone" erro={erros.telefone}>
                <input
                  id="cli-telefone"
                  value={formatarTelefone(f.telefone)}
                  onChange={(e) => set('telefone', soDigitos(e.target.value).slice(0, 11))}
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="(00) 00000-0000"
                  className={`${inputClass} ${borda(erros.telefone)}`}
                />
              </Campo>
              <Campo
                id="cli-email"
                label="E-mail"
                erro={erros.email}
                dica="A nota fiscal pode ser enviada para ele"
              >
                <input
                  id="cli-email"
                  type="email"
                  value={f.email}
                  onChange={(e) => set('email', e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                  className={`${inputClass} ${borda(erros.email)}`}
                />
              </Campo>
            </div>
          </Secao>

          {/* endereço */}
          <Secao titulo="Endereço">
            <div className="grid gap-3 sm:grid-cols-6">
              <Campo id="cli-cep" label="CEP" erro={erros.cep} className="sm:col-span-2">
                <input
                  id="cli-cep"
                  value={formatarCep(f.cep)}
                  onChange={(e) => mudarCep(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="00000-000"
                  className={`${inputClass} ${borda(erros.cep)}`}
                />
                {cepStatus === 'buscando' && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Loader2 className="size-3 animate-spin" />
                    Buscando endereço...
                  </p>
                )}
                {cepStatus === 'ok' && (
                  <p className="text-xs text-emerald-600">Endereço preenchido pelo CEP</p>
                )}
                {cepStatus === 'naoachou' && (
                  <p className="text-xs text-amber-600">CEP não encontrado. Preencha à mão.</p>
                )}
                {cepStatus === 'erro' && (
                  <p className="text-xs text-amber-600">
                    Não deu para consultar o CEP agora. Preencha à mão.
                  </p>
                )}
              </Campo>

              <Campo
                id="cli-logradouro"
                label="Rua / logradouro"
                erro={erros.logradouro}
                className="sm:col-span-4"
              >
                <input
                  id="cli-logradouro"
                  value={f.logradouro}
                  onChange={(e) => set('logradouro', e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                  className={`${inputClass} ${borda(erros.logradouro)}`}
                />
              </Campo>

              <Campo id="cli-numero" label="Número" erro={erros.numero} className="sm:col-span-2">
                <input
                  id="cli-numero"
                  value={f.numero}
                  onChange={(e) => set('numero', e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                  placeholder="ou S/N"
                  className={`${inputClass} ${borda(erros.numero)}`}
                />
              </Campo>

              <Campo id="cli-complemento" label="Complemento" className="sm:col-span-4">
                <input
                  id="cli-complemento"
                  value={f.complemento}
                  onChange={(e) => set('complemento', e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                  className={`${inputClass} ${borda()}`}
                />
              </Campo>

              <Campo id="cli-bairro" label="Bairro" erro={erros.bairro} className="sm:col-span-3">
                <input
                  id="cli-bairro"
                  value={f.bairro}
                  onChange={(e) => set('bairro', e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                  className={`${inputClass} ${borda(erros.bairro)}`}
                />
              </Campo>

              <Campo
                id="cli-municipio"
                label="Município"
                erro={erros.municipio}
                className="sm:col-span-3"
              >
                <input
                  id="cli-municipio"
                  value={f.municipio}
                  onChange={(e) => set('municipio', e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                  className={`${inputClass} ${borda(erros.municipio)}`}
                />
              </Campo>

              <Campo id="cli-uf" label="UF" erro={erros.uf} className="sm:col-span-2">
                <select
                  id="cli-uf"
                  value={f.uf}
                  onChange={(e) => set('uf', e.target.value)}
                  className={`${inputClass} ${borda(erros.uf)}`}
                >
                  <option value="">Escolha</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo
                id="cli-codMunicipio"
                label="Código IBGE do município"
                erro={erros.codMunicipio}
                dica="Vem do CEP. Tem 7 números."
                className="sm:col-span-4"
              >
                <input
                  id="cli-codMunicipio"
                  value={f.codMunicipio}
                  onChange={(e) => set('codMunicipio', soDigitos(e.target.value).slice(0, 7))}
                  inputMode="numeric"
                  autoComplete="off"
                  className={`${inputClass} ${borda(erros.codMunicipio)}`}
                />
              </Campo>
            </div>
          </Secao>

          <Secao titulo="Observações">
            <textarea
              id="cli-observacao"
              value={f.observacao}
              onChange={(e) => set('observacao', e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Anotações internas sobre o cliente (não saem na nota)"
              aria-label="Observações"
              className={`${inputClass} ${borda()} resize-none`}
            />
          </Secao>

          {/* o que falta para a nota */}
          {pendencias.length === 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              Cadastro completo para emissão de nota fiscal.
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                Para emitir nota fiscal ainda falta: <strong>{pendencias.join(', ')}</strong>. Dá
                para salvar assim e completar depois.
              </span>
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50">
          {erroGeral && (
            <p
              role="alert"
              className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-600"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {erroGeral}
            </p>
          )}
          <div className="flex justify-end gap-3 px-6 py-3.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={salvando}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="min-w-40 gap-2 bg-[#079C9C] text-white shadow-sm hover:bg-[#079C9C]/90"
            >
              {salvando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : editando ? (
                'Salvar alterações'
              ) : (
                'Cadastrar cliente'
              )}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}

// ---------- janela ----------

export default function ClienteDialog({
  open,
  cliente,
  nomeInicial = '',
  onClose,
  onSalvo,
}: {
  open: boolean
  cliente: Cliente | null // null = novo cliente
  nomeInicial?: string
  onClose: () => void
  onSalvo: (c: Cliente) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[3%] flex max-h-[94dvh] translate-y-0 flex-col gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-[720px] [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100">
        {open && (
          <Conteudo
            key={cliente?.id ?? 'novo'}
            cliente={cliente}
            nomeInicial={nomeInicial}
            onClose={onClose}
            onSalvo={onSalvo}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
