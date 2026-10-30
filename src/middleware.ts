import { NextResponse, type NextRequest } from "next/server";

/**
 * Ochrana heslem pro nasazení na internet. Když je nastavené APP_PASSWORD,
 * prohlížeč si vyžádá přihlášení (jméno libovolné, heslo = APP_PASSWORD).
 */
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }

  return new NextResponse("Pro vstup do Outreach CRM je potřeba heslo.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Outreach CRM", charset="UTF-8"' },
  });
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
