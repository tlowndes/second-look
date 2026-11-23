import { hostedKeyAvailable } from "@/lib/server/claude";

export const dynamic = "force-dynamic";

/** Tells the page whether free hosted runs exist, so it knows when to ask for a key up front. */
export function GET() {
  return Response.json({ hosted: hostedKeyAvailable() });
}
