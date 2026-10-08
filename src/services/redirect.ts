export function safeRedirect(value: unknown) {
  return typeof value === "string" && /^\/dashboard(?:[/?#]|$)/.test(value)
    ? value
    : "/dashboard";
}
