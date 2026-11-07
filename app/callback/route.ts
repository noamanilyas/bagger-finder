import { handleAuth } from "@workos-inc/authkit-nextjs";

// In the container the request's own host is not the public one, so redirects use the configured address.
const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;

export const GET = handleAuth(redirectUri ? { baseURL: new URL(redirectUri).origin } : {});
