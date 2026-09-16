import {
  runtimeSupportCookie,
  trustedRuntimeTenantHost,
} from "@/lib/service-app/runtime-session";

const headers = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
};

export async function POST(request: Request) {
  const host = trustedRuntimeTenantHost(request);
  const origin = request.headers.get("origin");
  const sameOrigin = host !== null && origin === `https://${host}`;
  if (!sameOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json(
      { error: "same-origin request required" },
      { status: 403, headers },
    );
  }
  return new Response(null, {
    status: 303,
    headers: {
      ...headers,
      location: "/",
      "set-cookie": runtimeSupportCookie("", 0),
    },
  });
}
