/**
 * Mitigates CVE GHSA-2w69-qvjg-hvjx — React Router XSS via Open Redirects.
 *
 * @remix-run/router <=1.23.1 does not validate redirect targets, allowing
 * `javascript:` and other dangerous URL schemes to be passed through
 * `navigate()` / `<Navigate>` and executed as XSS payloads.
 *
 * These helpers enforce that any navigation target is a safe, same-origin
 * relative path before the router processes it.
 */

const SAFE_PATH_RE = /^\/[^/\\]/;
const ALLOWED_RELATIVE_PATHS = new Set(["/", "/login", "/signup", "/onboarding", "/accept-invite"]);

/**
 * Returns true only if `url` is a safe relative path:
 *  - Starts with exactly one `/` (not `//` which becomes protocol-relative)
 *  - Does not contain a protocol (no `:` before a `/`)
 */
export function isSafeRedirectPath(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  // Reject absolute URLs and protocol-relative URLs
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) return false;
  if (url.startsWith("//")) return false;
  // Must start with a single forward slash followed by a non-slash character,
  // OR be exactly "/"
  return url === "/" || SAFE_PATH_RE.test(url);
}

/**
 * Returns `url` if it is a safe relative path; otherwise returns `fallback`.
 * Use this whenever a redirect target comes from an untrusted source (e.g.
 * query parameters, localStorage, or external API responses).
 *
 * @example
 *   const to = sanitizeRedirectPath(searchParams.get("redirect"), "/");
 *   navigate(to, { replace: true });
 */
export function sanitizeRedirectPath(url: string | null | undefined, fallback = "/"): string {
  if (!url) return fallback;
  return isSafeRedirectPath(url) ? url : fallback;
}
