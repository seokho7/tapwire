import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router";

export default function Load() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const filePath = params.get("file");

  useEffect(() => {
    if (!filePath) {
      setStatus("error");
      setErrorMsg("file parameter missing");
      return;
    }

    fetch(`/api/session/load-file?path=${encodeURIComponent(filePath)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        // Loaded successfully, redirect to main view
        navigate("/", { replace: true });
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message);
      });
  }, [filePath, navigate]);

  if (status === "error") {
    return (
      <div style={{ padding: 32, color: "var(--text-primary)" }}>
        <h2>Load Failed</h2>
        <p style={{ color: "var(--text-danger, #e55)" }}>{errorMsg}</p>
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          File: {filePath ?? "(none)"}
        </p>
        <button
          onClick={() => navigate("/", { replace: true })}
          style={{
            marginTop: 12,
            padding: "6px 16px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Go to Main
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, color: "var(--text-secondary)" }}>
      Loading {filePath}...
    </div>
  );
}
