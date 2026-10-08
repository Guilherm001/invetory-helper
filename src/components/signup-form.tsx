"use client"

import { useState } from "react"
import { useRouter } from "next/router"

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

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Crie sua conta</CardTitle>
        <CardDescription>
          Insira suas informações abaixo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nome e sobrenome</FieldLabel>
              <Input id="name" type="text" placeholder="John Doe" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
              />
              <FieldDescription>
                
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input id="password" type="password" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirme sua senha
              </FieldLabel>
              <Input id="confirm-password" type="password" required />
            </Field>
            <FieldGroup>
              <Field>
                <Button type="submit">Criar conta</Button>
                <FieldDescription className="px-6 text-center">
                  Já possui uma conta? <a href="#">Sign in</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
