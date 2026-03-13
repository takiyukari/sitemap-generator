import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {

  const basicAuth = request.headers.get("authorization")

  const user = "yuco"
  const password = "p@ssw0rd"

  const validAuth =
    "Basic " + Buffer.from(`${user}:${password}`).toString("base64")

  if (basicAuth !== validAuth) {
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Secure Area"',
      },
    })
  }

  return NextResponse.next()
}
