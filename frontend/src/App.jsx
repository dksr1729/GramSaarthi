import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const ROLES = ["citizen", "volunteer", "admin"];

function App() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "citizen",
  });
  const [authUser, setAuthUser] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadHealth() {
      try {
        const healthRes = await fetch(`${API_BASE_URL}/health`);
        if (!healthRes.ok) {
          throw new Error("Unable to fetch backend data");
        }
        const healthData = await healthRes.json();
        setHealth(healthData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    }

    loadHealth();
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const payload =
        mode === "register"
          ? form
          : { email: form.email, password: form.password, role: form.role };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      setAuthUser(data);
      setSuccess(data.message || "Success");

      if (mode === "register") {
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setAuthUser(null);
    setSuccess("");
    setError("");
    setForm((prev) => ({ ...prev, password: "" }));
    setMode("login");
  }

  if (authUser) {
    return (
      <div className="page">
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <main className="card">
          <p className="kicker">GramSaarthi Home</p>
          <h1>Welcome, {authUser.name}</h1>
          <p className="tagline">
            Signed in as <strong>{authUser.role}</strong>
          </p>
          <p className="description">
            GramSaarthi brings governance communication, service visibility, and
            village-level program awareness into one simple public platform.
          </p>

          <section className="section">
            <h2>Why GramSaarthi</h2>
            <p>
              Citizens, volunteers, and administrators can access a consistent
              digital space to understand local initiatives, priorities, and
              public service updates.
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
                  Build a foundation for tracking local priorities and measuring
                  outcomes for village-level governance.
                </p>
              </article>
              <article className="tile">
                <h3>Public Trust Interface</h3>
                <p>
                  Improve transparency through a modern portal available anytime
                  for public communication and updates.
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

          <button className="submit-btn logout-btn" onClick={handleLogout} type="button">
            Logout
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <main className="card">
        <p className="kicker">GramSaarthi Access</p>
        <h1>Be a part of the change</h1>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "tab active" : "tab"}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === "register" ? "tab active" : "tab"}
            onClick={() => setMode("register")}
            type="button"
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              required
              minLength={4}
            />
          </label>

          <label>
            Role
            <select
              value={form.role}
              onChange={(e) => updateField("role", e.target.value)}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <button className="submit-btn" disabled={loading} type="submit">
            {loading
              ? "Please wait..."
              : mode === "register"
              ? "Create account"
              : "Login"}
          </button>
        </form>

        <div className="status-box">
          <span>Backend Status</span>
          <strong>{health?.status ?? "checking"}</strong>
        </div>

        {authUser ? (
          <div className="user-box">
            <strong>Current User</strong>
            <p>
              {authUser.name} ({authUser.role})
            </p>
            <small>{authUser.email}</small>
          </div>
        ) : null}

        {success ? <p className="success">{success}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </main>
    </div>
  );
}

export default App;
