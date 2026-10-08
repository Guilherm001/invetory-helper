"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome completo"),
    email: z.string().trim().email("Informe um email válido"),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  })

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const formData = new FormData(event.currentTarget)
    const parsed = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
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
        setError(
          signupError.message === "User already registered"
            ? "Já existe uma conta cadastrada com esse email"
            : signupError.message
        )
        return
      }

      if (data.session) {
        router.replace("/dashboard")
        return
      }

      setSuccess("Cadastro criado. Confira seu email para confirmar a conta.")
    } catch {
      setError("Não foi possível criar sua conta. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Crie sua conta</CardTitle>
        <CardDescription>
          Insira suas informações abaixo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nome e sobrenome</FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Seu nome completo"
                autoComplete="name"
                required
                disabled={loading}
              />
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
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirme sua senha
              </FieldLabel>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {success && (
              <p role="status" className="text-sm text-green-700">
                {success}
              </p>
            )}

            <Field>
              <Button type="submit" disabled={loading}>
                {loading ? "Criando conta..." : "Criar conta"}
              </Button>
              <FieldDescription className="px-2 text-center">
                Já possui uma conta? <Link href="/login">Entrar</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
