"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { z } from "zod"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu email")
  .email("Email inválido")

const resetSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "Informe o código recebido")
      .regex(/^\d{6,10}$/, "O código tem apenas números (6 dígitos)"),
    password: z
      .string()
      .min(1, "Crie uma nova senha")
      .min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  })

type Etapa = "email" | "codigo" | "pronto"
type Campo = "email" | "code" | "password" | "confirmPassword"
type CampoErros = Partial<Record<Campo, string>>

const ESPERA_REENVIO = 60 // o Supabase só aceita um novo pedido após 60s

function traduzErro(message: string) {
  const m = message.toLowerCase()
  if (m.includes("expired") || m.includes("invalid"))
    return "Código inválido ou expirado. Confira os números ou peça um novo"
  if (m.includes("different from the old"))
    return "A nova senha precisa ser diferente da anterior"
  if (m.includes("rate limit") || m.includes("too many") || m.includes("seconds"))
    return "Muitas tentativas. Aguarde um pouco e tente de novo"
  if (m.includes("password") && m.includes("weak"))
    return "Senha muito fraca. Use letras, números e símbolos"
  return message
}

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [etapa, setEtapa] = useState<Etapa>("email")
  const [email, setEmail] = useState("")
  const [codigoValidado, setCodigoValidado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<CampoErros>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [espera, setEspera] = useState(0)

  // contagem regressiva do botão "Reenviar código"
  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  const limpar = () => {
    setError(null)
    setInfo(null)
    setFieldErrors({})
  }

  async function enviarCodigo(emailDestino: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(emailDestino)
    if (error) throw new Error(error.message)
    setEspera(ESPERA_REENVIO)
  }

  // etapa 1: pedir o código
  async function handleEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    limpar()

    const parsed = emailSchema.safeParse(
      new FormData(e.currentTarget).get("email")
    )
    if (!parsed.success) {
      setFieldErrors({ email: parsed.error.issues[0].message })
      return
    }

    setLoading(true)
    try {
      await enviarCodigo(parsed.data)
      setEmail(parsed.data)
      setEtapa("codigo")
    } catch (err) {
      setError(traduzErro(err instanceof Error ? err.message : ""))
    } finally {
      setLoading(false)
    }
  }

  async function reenviar() {
    if (loading || espera > 0) return
    limpar()
    setLoading(true)
    try {
      await enviarCodigo(email)
      setInfo("Enviamos um novo código para o seu email.")
    } catch (err) {
      setError(traduzErro(err instanceof Error ? err.message : ""))
    } finally {
      setLoading(false)
    }
  }

  // etapa 2: validar o código e definir a nova senha
  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    limpar()

    const formData = new FormData(e.currentTarget)
    const parsed = resetSchema.safeParse({
      code: formData.get("code"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    })

    if (!parsed.success) {
      const erros = parsed.error.flatten().fieldErrors
      setFieldErrors({
        code: erros.code?.[0],
        password: erros.password?.[0],
        confirmPassword: erros.confirmPassword?.[0],
      })
      return
    }

    setLoading(true)
    try {
      // o código só vale uma vez: se a senha falhar depois, não valida de novo
      if (!codigoValidado) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          email,
          token: parsed.data.code,
          type: "recovery",
        })
        if (otpError) throw new Error(otpError.message)
        setCodigoValidado(true)
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: parsed.data.password,
      })
      if (updateError) throw new Error(updateError.message)

      // encerra a sessão aberta pelo código: a pessoa entra com a nova senha
      await supabase.auth.signOut()
      setEtapa("pronto")
    } catch (err) {
      setError(traduzErro(err instanceof Error ? err.message : ""))
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    "h-11 focus-visible:border-[#079C9C] focus-visible:ring-[#079C9C]/20"

  const erroCampo = (campo: Campo) =>
    fieldErrors[campo] && (
      <p id={`${campo}-erro`} className="text-xs text-destructive">
        {fieldErrors[campo]}
      </p>
    )

  const botaoClass =
    "h-11 w-full gap-2 bg-[#079C9C] text-base font-medium text-white shadow-sm hover:bg-[#079C9C]/90 active:bg-[#079C9C]/80"

  const alertaErro = error && (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{error}</span>
    </div>
  )

  const alertaInfo = info && (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
    >
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      <span>{info}</span>
    </div>
  )

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col gap-6 md:max-w-4xl",
        className
      )}
      {...props}
    >
      <Card className="overflow-hidden border-slate-200 p-0 shadow-lg">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-6 md:p-10">
            {/* ETAPA 1: email */}
            {etapa === "email" && (
              <form onSubmit={handleEmail} noValidate>
                <FieldGroup>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-3xl font-bold text-slate-900">
                      Esqueceu a senha?
                    </h1>
                    <p className="text-balance text-sm text-muted-foreground">
                      Informe seu email e enviaremos um código para criar uma
                      nova senha
                    </p>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="voce@exemplo.com"
                      autoComplete="email"
                      autoFocus
                      required
                      disabled={loading}
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={
                        fieldErrors.email ? "email-erro" : undefined
                      }
                      className={inputClass}
                    />
                    {erroCampo("email")}
                  </Field>

                  {alertaErro}

                  <Field>
                    <Button type="submit" disabled={loading} className={botaoClass}>
                      {loading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Enviar código"
                      )}
                    </Button>
                    <FieldDescription className="text-center">
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-1 font-medium text-[#079C9C] underline-offset-2 hover:underline"
                      >
                        <ArrowLeft className="size-3.5" />
                        Voltar para o login
                      </Link>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </form>
            )}

            {/* ETAPA 2: código + nova senha */}
            {etapa === "codigo" && (
              <form onSubmit={handleReset} noValidate>
                <FieldGroup>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-3xl font-bold text-slate-900">
                      Verifique seu email
                    </h1>
                    <p className="text-balance text-sm text-muted-foreground">
                      Enviamos um código para{" "}
                      <strong className="text-slate-700">{email}</strong>.
                      Digite-o abaixo e crie a nova senha.
                    </p>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="code">Código</FieldLabel>
                    <Input
                      id="code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      maxLength={10}
                      autoFocus
                      required
                      disabled={loading || codigoValidado}
                      aria-invalid={!!fieldErrors.code}
                      aria-describedby={fieldErrors.code ? "code-erro" : undefined}
                      className={`${inputClass} text-center text-lg font-semibold tracking-[0.4em]`}
                    />
                    {erroCampo("code")}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="password">Nova senha</FieldLabel>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo de 6 caracteres"
                        autoComplete="new-password"
                        required
                        disabled={loading}
                        aria-invalid={!!fieldErrors.password}
                        aria-describedby={
                          fieldErrors.password ? "password-erro" : undefined
                        }
                        className={`${inputClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? "Ocultar senha" : "Mostrar senha"
                        }
                        aria-pressed={showPassword}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 transition hover:text-[#079C9C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#079C9C]"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    {erroCampo("password")}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="confirm-password">
                      Confirme a nova senha
                    </FieldLabel>
                    <Input
                      id="confirm-password"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      disabled={loading}
                      aria-invalid={!!fieldErrors.confirmPassword}
                      aria-describedby={
                        fieldErrors.confirmPassword
                          ? "confirmPassword-erro"
                          : undefined
                      }
                      className={inputClass}
                    />
                    {erroCampo("confirmPassword")}
                  </Field>

                  {alertaErro}
                  {alertaInfo}

                  <Field>
                    <Button type="submit" disabled={loading} className={botaoClass}>
                      {loading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Redefinir senha"
                      )}
                    </Button>

                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          limpar()
                          setCodigoValidado(false)
                          setEtapa("email")
                        }}
                        disabled={loading}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
                      >
                        <ArrowLeft className="size-3.5" />
                        Trocar email
                      </button>

                      {!codigoValidado && (
                        <button
                          type="button"
                          onClick={reenviar}
                          disabled={loading || espera > 0}
                          className="font-medium text-[#079C9C] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                        >
                          {espera > 0
                            ? `Reenviar código (${espera}s)`
                            : "Reenviar código"}
                        </button>
                      )}
                    </div>
                  </Field>
                </FieldGroup>
              </form>
            )}

            {/* ETAPA 3: pronto */}
            {etapa === "pronto" && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-8" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Senha alterada!
                </h1>
                <p className="text-balance text-sm text-muted-foreground">
                  Sua senha foi redefinida com sucesso. Entre com a nova senha.
                </p>
                <Button
                  type="button"
                  onClick={() => router.replace("/login")}
                  className={`${botaoClass} mt-2`}
                >
                  Ir para o login
                </Button>
              </div>
            )}
          </div>

          <div className="relative hidden bg-[#079C9C] md:block">
            <img
              src="/pango.png"
              alt=""
              className="absolute inset-0 h-full w-full object-contain object-center p-4 dark:brightness-[0.2] dark:grayscale"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-[#079C9C] via-[#079C9C]/80 to-transparent p-6 pt-16 text-white">
              <p className="text-lg font-semibold">Recupere seu acesso</p>
              <p className="mt-1 text-sm text-white/80">
                Lista de produtos, catálogo e cotações num só lugar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}