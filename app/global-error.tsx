"use client"

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#07060A",
          color: "#F7F4ED",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, marginBottom: 12 }}>Something broke badly</h1>
          <p style={{ color: "#A3A0B0", marginBottom: 24 }}>
            The whole page failed to load. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 48,
              padding: "0 24px",
              borderRadius: 999,
              border: "none",
              background: "#FF5A1F",
              color: "#07060A",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
