export const dynamic = "force-dynamic";

/**
 * Tab icon, read per request so the same build shows which server a tab is on:
 * amber on Render (which sets RENDER=true), green on a local server.
 */
export function GET() {
  const color = process.env.RENDER ? "#f59e0b" : "#16a34a";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="${color}"/>
<text x="32" y="46" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="700" text-anchor="middle" fill="#fff">B</text>
</svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
}
