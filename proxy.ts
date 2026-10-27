import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

const PUBLIC = ["/login", "/api/auth/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifyToken(req.cookies.get(COOKIE_NAME)?.value);

  if (!session && !PUBLIC.includes(pathname)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session && pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
  if (session && session.role !== "ADMIN" && pathname.startsWith("/radar")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
