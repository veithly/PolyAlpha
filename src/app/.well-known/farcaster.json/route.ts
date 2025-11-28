import minikitConfig from "../../../../minikit.config";

export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(minikitConfig, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}
