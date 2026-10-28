import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

// Gate 1 = access code (session with empty codename). Gate 2 = member login (full session).
const OPEN = ["/login", "/api/auth/gate", "/api/auth/logout"];
const PUBLIC = ["/api/manifest", "/api/icon"];
const GATE2 = ["/login/member", "/api/auth/member"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Manifest and icons are fetched by the browser without cookies and must stay public.
  if (PUBLIC.includes(pathname)) return NextResponse.next();
  const session = await verifyToken(req.cookies.get(COOKIE_NAME)?.value);
  const redirect = (to: string) => NextResponse.redirect(new URL(to, req.url));
  const deny = () =>
    pathname.startsWith("/api/") ? NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) : redirect("/login");

  if (!session) return OPEN.includes(pathname) ? NextResponse.next() : deny();

  if (!session.codename) {
    if (OPEN.includes(pathname) || GATE2.includes(pathname)) return NextResponse.next();
    return pathname.startsWith("/api/") ? deny() : redirect("/login/member");
  }

  if (pathname === "/login" || pathname === "/login/member") return redirect("/");
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|.*\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
