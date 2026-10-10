"use client"

import { useState } from "react"
import Link from "next/link"
import type { Provider } from "@supabase/supabase-js"
import { z } from "zod"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu email").email("Email inválido"),
  password: z
    .string()
    .min(1, "Informe sua senha")
    .min(6, "A senha deve ter pelo menos 6 caracteres"),
})

type CampoErros = { email?: string; password?: string }

type LoginFormProps = React.ComponentProps<"div"> & {
  redirectTo?: string
}

function traduzErro(message: string) {
  switch (message) {
    case "Invalid login credentials":
      return "Email ou senha incorretos"
    case "Email not confirmed":
      return "Confirme seu email antes de entrar"
    case "Too many requests":
      return "Muitas tentativas. Aguarde um pouco e tente de novo"
    default:
      return message
  }
}

export function LoginForm({
  className,
  redirectTo = "/dashboard",
  ...props
}: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<CampoErros>({})
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const ocupado = loading || oauthLoading !== null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (ocupado) return

    setError(null)
    setFieldErrors({})

    const formData = new FormData(e.currentTarget)
    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    })

    if (!parsed.success) {
      const erros = parsed.error.flatten().fieldErrors
      setFieldErrors({
        email: erros.email?.[0],
        password: erros.password?.[0],
      })
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword(parsed.data)

    if (error) {
      setError(traduzErro(error.message))
      setLoading(false)
      return
    }

    // mantém o loading ligado até a navegação terminar
    window.location.assign(redirectTo)
  }

  async function handleOAuth(provider: Provider) {
    if (ocupado) return

    setError(null)
    setFieldErrors({})
    setOauthLoading(provider)

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${redirectTo}` },
    })

    if (error) {
      setError(traduzErro(error.message))
      setOauthLoading(null)
    }
  }

  const iconeOAuth = (provider: Provider, svg: React.ReactNode) =>
    oauthLoading === provider ? <Loader2 className="size-4 animate-spin" /> : svg

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden border-slate-200 p-0 shadow-lg">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-10" onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-3xl font-bold text-slate-900">
                  Bem-vindo de volta
                </h1>
                <p className="text-balance text-sm text-muted-foreground">
                  Entre na sua conta para continuar
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
                  disabled={ocupado}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? "email-erro" : undefined}
                  className="h-11 focus-visible:border-[#079C9C] focus-visible:ring-[#079C9C]/20"
                />
                {fieldErrors.email && (
                  <p id="email-erro" className="text-xs text-destructive">
                    {fieldErrors.email}
                  </p>
                )}
              </Field>

              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Senha</FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="ml-auto text-sm text-[#079C9C] underline-offset-2 hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>

                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={ocupado}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={
                      fieldErrors.password ? "password-erro" : undefined
                    }
                    className="h-11 pr-11 focus-visible:border-[#079C9C] focus-visible:ring-[#079C9C]/20"
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
                {fieldErrors.password && (
                  <p id="password-erro" className="text-xs text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
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

              <Field>
                <Button
                  type="submit"
                  disabled={ocupado}
                  className="h-11 w-full gap-2 bg-[#079C9C] text-base font-medium text-white shadow-sm hover:bg-[#079C9C]/90 active:bg-[#079C9C]/80"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </Field>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Ou continue com
              </FieldSeparator>

              <Field className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  type="button"
                  disabled={ocupado}
                  onClick={() => handleOAuth("apple")}
                  className="h-11"
                >
                  {iconeOAuth(
                    "apple",
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path
                        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                  <span className="sr-only">Entrar com Apple</span>
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  disabled={ocupado}
                  onClick={() => handleOAuth("google")}
                  className="h-11"
                >
                  {iconeOAuth(
                    "google",
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path
                        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                  <span className="sr-only">Entrar com Google</span>
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  disabled={ocupado}
                  onClick={() => handleOAuth("facebook")}
                  className="h-11"
                >
                  {iconeOAuth(
                    "facebook",
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path
                        d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                  <span className="sr-only">Entrar com Meta</span>
                </Button>
              </Field>

              <FieldDescription className="text-center">
                Não tem uma conta?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-[#079C9C] underline-offset-2 hover:underline"
                >
                  Cadastre-se
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>

          <div className="relative hidden bg-[#079C9C] md:block">
  <img
    src="/pango.png"
    alt=""
    className="absolute inset-0 h-full w-full object-contain object-center dark:brightness-[0.2] dark:grayscale"
  />
  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-[#079C9C] via-[#079C9C]/80 to-transparent p-8 pt-16 text-white">
    <p className="text-xl font-semibold">Compras sob controle</p>
    <p className="mt-1 text-sm text-white/80">
      Lista de produtos, catálogo e cotações num só lugar.
    </p>
  </div>
</div>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center">
        Ao continuar, você concorda com os{" "}
        <Link href="#">Termos de Serviço</Link> e a{" "}
        <Link href="#">Política de Privacidade</Link>.
      </FieldDescription>
    </div>
  )
}