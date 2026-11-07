import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

/** The "Initiate login URI" in the WorkOS dashboard. */
export async function GET() {
  redirect(await getSignInUrl());
}
