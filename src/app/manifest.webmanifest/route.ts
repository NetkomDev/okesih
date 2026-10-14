import dashboardManifest from "@/lib/pwa-manifest";

// Use an ordinary route: Next's file-based manifest overrides nested layout
// metadata, which otherwise makes POS and KDS install the dashboard app.
export const dynamic = "force-static";

export function GET() {
  return Response.json(dashboardManifest(), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
