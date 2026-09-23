// `server-only` throws when imported outside a React Server Component, which
// is the whole point of it — and which would fail every service test on the
// import line. Vitest aliases it here instead.
export {}
