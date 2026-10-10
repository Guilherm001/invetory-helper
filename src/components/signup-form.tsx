"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react"

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

const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Informe seu nome")
      .min(2, "Informe seu nome completo"),
    email: z.string().trim().min(1, "Informe seu email").email("Email inválido"),
    password: z
      .string()
      .min(1, "Crie uma senha")
      .min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  })

type Campo = "name" | "email" | "password" | "confirmPassword"
type CampoErros = Partial<Record<Campo, string>>

function traduzErro(message: string) {
  const m = message.toLowerCase()
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Já existe uma conta cadastrada com esse email"
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde um pouco e tente de novo"
  if (m.includes("password") && m.includes("weak"))
    return "Senha muito fraca. Use letras, números e símbolos"
  return message
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<CampoErros>({})
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    const form = event.currentTarget

    setError(null)
    setSuccess(null)
    setFieldErrors({})

    const formData = new FormData(form)
    const parsed = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    })

    if (!parsed.success) {
      const erros = parsed.error.flatten().fieldErrors
      setFieldErrors({
        name: erros.name?.[0],
        email: erros.email?.[0],
        password: erros.password?.[0],
        confirmPassword: erros.confirmPassword?.[0],
      })
      return
    }

    setLoading(true)

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { full_name: parsed.data.name },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (signupError) {
        setError(traduzErro(signupError.message))
        return
      }

      // email já cadastrado: o Supabase devolve usuário sem identidades
      if (data.user && data.user.identities?.length === 0) {
        setError("Já existe uma conta cadastrada com esse email")
        return
      }

      if (data.session) {
        router.replace("/dashboard")
        return
      }

      setSuccess("Cadastro criado! Confira seu email para confirmar a conta.")
      form.reset()
    } catch {
      setError("Não foi possível criar sua conta. Tente novamente.")
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
          <form className="p-6 md:p-10" onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-3xl font-bold text-slate-900">
                  Crie sua conta
                </h1>
                <p className="text-balance text-sm text-muted-foreground">
                  Preencha seus dados para começar
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="name">Nome e sobrenome</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Seu nome completo"
                  autoComplete="name"
                  autoFocus
                  required
                  disabled={loading}
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? "name-erro" : undefined}
                  className={inputClass}
                />
                {erroCampo("name")}
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? "email-erro" : undefined}
                  className={inputClass}
                />
                {erroCampo("email")}
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Senha</FieldLabel>
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
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
                  Confirme sua senha
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

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <Field>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full gap-2 bg-[#079C9C] text-base font-medium text-white shadow-sm hover:bg-[#079C9C]/90 active:bg-[#079C9C]/80"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    "Criar conta"
                  )}
                </Button>
                <FieldDescription className="px-2 text-center">
                  Já possui uma conta?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-[#079C9C] underline-offset-2 hover:underline"
                  >
                    Entrar
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>

          {/* painel lateral: só aparece em telas maiores */}
          <div className="relative hidden bg-[#079C9C] md:block">
            <img
              src="/pango.png"
              alt=""
              className="absolute inset-0 h-full w-full object-contain object-center p-4 dark:brightness-[0.2] dark:grayscale"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-[#079C9C] via-[#079C9C]/80 to-transparent p-6 pt-16 text-white">
              <p className="text-lg font-semibold">Comece agora</p>
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