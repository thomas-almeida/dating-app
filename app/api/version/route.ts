// A versão entra no código no build: cada deploy responde a sua, e o app compara com a dele.
export function GET() {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_DEPLOYMENT_ID ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
