import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const ROLES = ["District Admin", "Rural User", "Panchayat Officer"];

const ROLE_PAGES = {
  "District Admin": {
    title: "District Admin Command Center",
    tagline: "Monitor district-level performance, priorities, and escalations.",
    capabilities: [
      {
        heading: "Scheme Oversight",
        body: "Review implementation status across multiple panchayats and track target completion.",
      },
      {
        heading: "Resource Allocation",
        body: "Prioritize funds and field teams using visible metrics and current service demand.",
      },
      {
        heading: "Issue Escalation",
        body: "Identify critical bottlenecks and push resolution workflows with clear accountability.",
      },
    ],
  },
  "Rural User": {
    title: "Rural User Home",
    tagline: "Access village services, updates, and announcements in one place.",
    capabilities: [
      {
        heading: "Service Discovery",
        body: "Find active schemes, eligibility details, and nearby service points quickly.",
      },
      {
        heading: "Local Updates",
        body: "Stay informed on panchayat notices, health camps, and welfare timelines.",
      },
      {
        heading: "Simple Participation",
        body: "Share local concerns and follow updates for requests raised in your community.",
      },
    ],
  },
  "Panchayat Officer": {
    title: "Panchayat Officer Workspace",
    tagline: "Plan local execution and keep communities informed with reliable updates.",
    capabilities: [
      {
        heading: "Village Planning",
        body: "Track local priorities and organize initiatives aligned to district goals.",
      },
      {
        heading: "Public Communication",
        body: "Publish timely and clear announcements for citizens with a consistent format.",
      },
      {
        heading: "Program Tracking",
        body: "Maintain activity status and progress snapshots for transparent governance.",
      },
    ],
  },
};

function App() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    login_id: "",
    password: "",
    role: "District Admin",
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
        setHealth({ status: "failed" });
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
          : { login_id: form.login_id, password: form.password, role: form.role };

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
    const pageConfig = ROLE_PAGES[authUser.role] ?? ROLE_PAGES["Rural User"];

    return (
      <div className="page">
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <main className="card">
          <p className="kicker">{authUser.role}</p>
          <h1>{pageConfig.title}</h1>
          <p className="tagline">{pageConfig.tagline}</p>
          <p className="description">
            Welcome, {authUser.name}. Your login ID is {authUser.login_id}.
          </p>

          <section className="section">
            <h2>Role Capabilities</h2>
            <div className="grid">
              {pageConfig.capabilities.map((item) => (
                <article className="tile" key={item.heading}>
                  <h3>{item.heading}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
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
        <p className="tagline">Register and login with role-specific access.</p>

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
            Login ID (Email)
            <input
              type="email"
              value={form.login_id}
              onChange={(e) => updateField("login_id", e.target.value)}
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

        {success ? <p className="success">{success}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </main>
    </div>
  );
}

export default App;
