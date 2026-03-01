import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TOKEN_KEY = "gramsaarthi_token";

const ROLE_OPTIONS = [
  { label: "Panchayat Officer", value: "PANCHAYAT_OFFICER" },
  { label: "District Admin", value: "DISTRICT_ADMIN" },
  { label: "Rural User", value: "RURAL_USER" },
];

async function apiRequest(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.detail || "Request failed");
  }

  return data;
}

function HomeContent({ branding, health, error }) {
  return (
    <>
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
          It is designed for citizens, volunteers, and administrators to quickly
          understand priorities and service direction.
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
              Improve transparency with a modern, always-available public portal
              that communicates with consistency.
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
        Deployment-ready with React frontend, Python FastAPI backend, AWS EC2,
        and DynamoDB integration.
      </p>

      {error ? <p className="error">{error}</p> : null}
    </>
  );
}

function App() {
  const [page, setPage] = useState("home");
  const [mode, setMode] = useState("login");
  const [branding, setBranding] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [me, setMe] = useState(null);
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [role, setRole] = useState("RURAL_USER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const roleLabel = useMemo(
    () => ROLE_OPTIONS.find((item) => item.value === me?.role)?.label || me?.role,
    [me]
  );

  useEffect(() => {
    async function loadPublicData() {
      try {
        const [brandingData, healthData] = await Promise.all([
          apiRequest("/branding"),
          apiRequest("/health"),
        ]);

        setBranding(brandingData);
        setHealth(healthData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    }

    loadPublicData();
  }, []);

  useEffect(() => {
    async function loadMe() {
      if (!token) {
        setMe(null);
        return;
      }

      try {
        const user = await apiRequest("/auth/me", { token });
        setMe(user);
        setNewFullName(user.full_name);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setMe(null);
      }
    }

    loadMe();
  }, [token]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthMessage("");
    setAuthLoading(true);

    try {
      if (mode === "register") {
        await apiRequest("/auth/register", {
          method: "POST",
          body: { role, full_name: fullName, email, password },
        });
        setAuthMessage("Registration successful. Please login.");
        setMode("login");
        setPassword("");
      } else {
        const data = await apiRequest("/auth/login", {
          method: "POST",
          body: { role, email, password },
        });
        localStorage.setItem(TOKEN_KEY, data.access_token);
        setToken(data.access_token);
        setAuthMessage("Login successful.");
      }
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleProfileUpdate(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");

    try {
      const body = {};
      if (newFullName && newFullName !== me?.full_name) {
        body.full_name = newFullName;
      }
      if (newPassword) {
        body.password = newPassword;
      }

      const updated = await apiRequest("/auth/me", {
        method: "PUT",
        body,
        token,
      });
      setMe(updated);
      setNewPassword("");
      setAuthMessage("Profile updated successfully.");
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : "Update failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm("Delete your account permanently?")) {
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");

    try {
      await apiRequest("/auth/me", { method: "DELETE", token });
      localStorage.removeItem(TOKEN_KEY);
      setToken("");
      setMe(null);
      setAuthMessage("Account deleted.");
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setMe(null);
    setAuthMessage("Logged out.");
  }

  return (
    <div className="page">
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />

      <main className="card">
        <nav className="navbar">
          <button
            className={`nav-btn ${page === "home" ? "active" : ""}`}
            onClick={() => setPage("home")}
          >
            Home
          </button>
          <button
            className={`nav-btn ${page === "auth" ? "active" : ""}`}
            onClick={() => setPage("auth")}
          >
            Login / Register
          </button>
          {me ? (
            <div className="nav-user">
              <span>{me.full_name}</span>
              <button className="mini-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : null}
        </nav>

        {page === "home" ? (
          <HomeContent branding={branding} health={health} error={error} />
        ) : (
          <section className="auth-wrap">
            <p className="kicker">Secure Access</p>
            <h1>Role-Based Access</h1>
            <p className="tagline">Choose your role and continue.</p>

            <div className="mode-switch">
              <button
                className={`mini-btn ${mode === "login" ? "active" : ""}`}
                onClick={() => setMode("login")}
              >
                Login
              </button>
              <button
                className={`mini-btn ${mode === "register" ? "active" : ""}`}
                onClick={() => setMode("register")}
              >
                Register
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label>
                Role
                <select value={role} onChange={(event) => setRole(event.target.value)}>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {mode === "register" ? (
                <label>
                  Full Name
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </label>
              ) : null}

              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                />
              </label>

              <button className="submit-btn" type="submit" disabled={authLoading}>
                {authLoading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
              </button>
            </form>

            {me ? (
              <section className="profile-panel">
                <h2>Your Profile</h2>
                <p>
                  Signed in as <strong>{roleLabel}</strong>
                </p>
                <p className="small-line">{me.email}</p>

                <form className="auth-form" onSubmit={handleProfileUpdate}>
                  <label>
                    Full Name
                    <input
                      value={newFullName}
                      onChange={(event) => setNewFullName(event.target.value)}
                      placeholder="Update full name"
                    />
                  </label>
                  <label>
                    New Password
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Leave blank to keep current password"
                    />
                  </label>
                  <button className="submit-btn" type="submit" disabled={authLoading}>
                    Update Profile
                  </button>
                </form>

                <button className="danger-btn" onClick={handleDeleteAccount} disabled={authLoading}>
                  Delete Account
                </button>
              </section>
            ) : null}

            {authMessage ? <p className="status-msg">{authMessage}</p> : null}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
