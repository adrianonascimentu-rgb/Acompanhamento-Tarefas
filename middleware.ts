import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Permitir acesso livre se as chaves do Supabase não estiverem configuradas (essencial para configurar o app)
  const isSupabaseConfigured = 
    supabaseUrl && 
    /^https?:\/\//.test(supabaseUrl) &&
    supabaseUrl !== 'https://placeholder-url.supabase.co' &&
    supabaseAnonKey && 
    supabaseAnonKey !== 'placeholder-key'

  if (!isSupabaseConfigured) {
    return response
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Validação de perfil no servidor caso haja sessão ativa via cookie SSR
    if (request.nextUrl.pathname.startsWith('/admin') && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, type')
        .eq('id', user.id)
        .maybeSingle()

      const userRole = (profile?.type || profile?.role || 'user').toLowerCase()
      const ownerEmail = (process.env.OWNER_EMAIL || process.env.NEXT_PUBLIC_OWNER_EMAIL || '').trim().toLowerCase()
      const isOwner = !!(ownerEmail && user.email && user.email.toLowerCase() === ownerEmail)
      
      if (userRole !== 'admin' && !isOwner) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
  } catch (error) {
    console.error('Middleware execution error:', error)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
