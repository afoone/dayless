import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const EXCLUDED_API_PREFIXES = ['/api/auth/', '/api/register', '/api/invitations/accept/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const isExcluded = EXCLUDED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (isExcluded) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || 'dayless-ai-secret-change-in-production',
  })

  if (!token?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const response = NextResponse.next()
  response.headers.set('x-auth-user-id', String(token.id))
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
