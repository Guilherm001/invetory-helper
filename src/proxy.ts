import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PROTEGIDAS = [
  "/dashboard",
  "/calculator",
  "/equipe",
  "/catalogo",
  "/comparar-precos",
  "/historico-precos",
  "/financeiro",
  "/loja",
  "/pedidos",
  "/orcamentos",
  "/produtos",
  "/fornecedores",
  "/cotacoes",
  "/pedidos-compra",
  "/relatorios",
  "/caixa",
]

// redireciona sem perder os cookies de sessão que o Supabase acabou de renovar
function redirecionar(
  request: NextRequest,
  response: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims() valida a assinatura do JWT localmente (sem chamada de rede
  // a cada clique) e renova a sessão quando o token está perto de expirar.
  // Se o projeto ainda usa a chave legada (HS256), ele cai automaticamente
  // para a validação via rede, então nada quebra.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims ?? null

  const { pathname } = request.nextUrl
  const isProtected = PROTEGIDAS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
  const isLoginPage = pathname === "/" // ajuste para a rota da sua tela de login

  // Sem login tentando acessar rota protegida -> manda para o login
  if (!user && isProtected) {
    return redirecionar(request, response, "/")
  }

  // Já logado abrindo a tela de login -> manda para o dashboard
  if (user && isLoginPage) {
    return redirecionar(request, response, "/dashboard")
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}