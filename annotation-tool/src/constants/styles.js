// ─── Global CSS ──────────────────────────────────────────────

export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #faf8f5; }
  input:focus, textarea:focus { border-color: #f59e0b !important; outline: none; }
  button { font-family: 'DM Mono', monospace; }
  button:hover { opacity: 0.88; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #f0ede8; }
  ::-webkit-scrollbar-thumb { background: #c0bbb5; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #a09a95; }
  input[type=range] { accent-color: #f59e0b; cursor: pointer; }
`;

// ─── Style Objects ───────────────────────────────────────────

export const S = {
  root: {
    fontFamily: "'DM Mono', 'Courier New', monospace",
    background: "#faf8f5",
    minHeight: "100vh",
    color: "#333333",
    fontSize: 14
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e5e5",
    borderRadius: 6,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
  },
  input: {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #d5d5d5",
    color: "#333333",
    padding: "8px 12px",
    borderRadius: 4,
    fontSize: 13,
    fontFamily: "'DM Mono', monospace",
    boxSizing: "border-box"
  },
  label: {
    fontSize: 11,
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    marginBottom: 6,
    display: "block",
    fontWeight: 500
  },
  pill: (c) => ({
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 4,
    fontSize: 12,
    background: c + "1a",
    color: c,
    border: `1px solid ${c}33`,
    fontWeight: 500
  }),
  tab: (a) => ({
    padding: "10px 20px",
    fontSize: 12,
    cursor: "pointer",
    border: "none",
    borderBottom: `3px solid ${a ? "#f59e0b" : "transparent"}`,
    background: "transparent",
    color: a ? "#f59e0b" : "#666666",
    letterSpacing: "1px",
    textTransform: "uppercase",
    fontWeight: a ? 500 : 400
  }),
  btn: (a, c = "#f59e0b") => ({
    padding: "7px 15px",
    fontSize: 12,
    cursor: "pointer",
    borderRadius: 4,
    border: `1px solid ${a ? c : "#d5d5d5"}`,
    background: a ? c + "1a" : "#ffffff",
    color: a ? c : "#666666",
    fontWeight: a ? 500 : 400
  }),
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.35)",
    backdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200
  },
  modal: {
    background: "#ffffff",
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    padding: 28,
    width: 540,
    maxHeight: "88vh",
    overflowY: "auto",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)"
  },
};
