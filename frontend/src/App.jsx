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

        <section className="section">
          <h2>Why GramSaarthi</h2>
          <p>
            GramSaarthi brings governance communication, service visibility, and
            village-level program awareness onto one public digital interface.
            It is designed for citizens, volunteers, and administrators to
            quickly understand priorities and service direction.
          </p>
        </section>

        <section className="section">
          <h2>Core Capabilities</h2>
          <div className="grid">
            <article className="tile">
              <h3>Service Clarity</h3>
              <p>
                Present schemes, initiatives, and announcements in clear,
                structured language for faster community adoption.
              </p>
            </article>
            <article className="tile">
              <h3>Data-Backed Planning</h3>
              <p>
                Build a foundation for tracking coverage, local priorities, and
                measurable outcomes across villages.
              </p>
            </article>
            <article className="tile">
              <h3>Public Trust Interface</h3>
              <p>
                Improve transparency with a modern, always-available public
                portal that communicates with consistency.
              </p>
            </article>
          </div>
        </section>

        <section className="section">
          <h2>Expected Impact</h2>
          <div className="metric-row">
            <div className="metric">
              <strong>24x7</strong>
              <span>Public availability</span>
            </div>
            <div className="metric">
              <strong>Single</strong>
              <span>Source of communication</span>
            </div>
            <div className="metric">
              <strong>Faster</strong>
              <span>Citizen information access</span>
            </div>
          </div>
        </section>

        <div className="status-box">
          <span>Backend Status</span>
          <strong>{health?.status ?? "checking"}</strong>
        </div>

        <p className="footnote">
          Deployment-ready with React frontend, Python FastAPI backend, and
          AWS EC2 CI/CD automation.
        </p>

        {error ? <p className="error">{error}</p> : null}
      </main>
    </div>
  );
}

export default App;
