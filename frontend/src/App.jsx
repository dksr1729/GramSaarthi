import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function App() {
  const [branding, setBranding] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [brandingRes, healthRes] = await Promise.all([
          fetch(`${API_BASE_URL}/branding`),
          fetch(`${API_BASE_URL}/health`),
        ]);

        if (!brandingRes.ok || !healthRes.ok) {
          throw new Error("Unable to fetch backend data");
        }

        const brandingData = await brandingRes.json();
        const healthData = await healthRes.json();

        setBranding(brandingData);
        setHealth(healthData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    }

    loadData();
  }, []);

  return (
    <div className="page">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <main className="card">
        <p className="kicker">Public Platform</p>
        <h1>{branding?.name ?? "GramSaarthi"}</h1>
        <p className="tagline">{branding?.tagline ?? "Loading vision..."}</p>
        <p className="description">
          {branding?.description ??
            "Connecting communities with transparent digital governance."}
        </p>

        <div className="status-box">
          <span>Backend Status</span>
          <strong>{health?.status ?? "checking"}</strong>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </main>
    </div>
  );
}

export default App;
