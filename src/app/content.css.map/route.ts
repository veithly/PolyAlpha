export const dynamic = "force-static";

export function GET() {
  return new Response(
    JSON.stringify({
      version: 3,
      sources: [],
      names: [],
      mappings: "",
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    }
  );
}
