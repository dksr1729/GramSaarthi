import { useEffect, useMemo, useRef, useState } from "react";

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
const isBrowser = typeof window !== "undefined";
const isLocalHost =
  isBrowser &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const hasUnsafeApiHost =
  /localhost|127\.0\.0\.1|:8000/.test(rawApiBaseUrl) ||
  rawApiBaseUrl.includes("0.0.0.0");
const API_BASE_URL = !rawApiBaseUrl || (!isLocalHost && hasUnsafeApiHost) ? "/api" : rawApiBaseUrl;
const ROLES = ["District Admin", "Rural User", "Panchayat Officer"];
const MAX_FILTERS = 5;

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
    promptHint: "Ask me for district-level summaries, bottlenecks, and priority actions.",
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
    promptHint: "Ask me about schemes, eligibility, and local announcements in simple language.",
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
    promptHint: "Ask me to draft notices, summarize field updates, and plan weekly actions.",
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

  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatError, setChatError] = useState("");
  const [showChatFilters, setShowChatFilters] = useState(false);
  const [chatFilters, setChatFilters] = useState([]);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [metadataFilters, setMetadataFilters] = useState([]);

  const chatEndRef = useRef(null);

  const pageConfig = useMemo(() => {
    if (!authUser) {
      return null;
    }
    return ROLE_PAGES[authUser.role] ?? ROLE_PAGES["Rural User"];
  }, [authUser]);

  async function parseApiResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    if (contentType.includes("application/json")) {
      try {
        return rawText ? JSON.parse(rawText) : {};
      } catch {
        return { detail: "Invalid JSON returned by server." };
      }
    }

    return { detail: rawText || "Non-JSON response returned by server." };
  }

  useEffect(() => {
    async function loadHealth() {
      try {
        const healthRes = await fetch(`${API_BASE_URL}/health`);
        const healthData = await parseApiResponse(healthRes);
        if (!healthRes.ok) {
          throw new Error(healthData.detail || "Unable to fetch backend data");
        }
        setHealth(healthData);
      } catch (err) {
        setHealth({ status: "failed" });
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    }

    loadHealth();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isStreaming]);

  useEffect(() => {
    if (!authUser) {
      setChatMessages([]);
      setChatInput("");
      setChatError("");
      setShowChatFilters(false);
      setChatFilters([]);
      setUploadFile(null);
      setUploadError("");
      setUploadSuccess("");
      setShowFilters(false);
      setMetadataFilters([]);
      return;
    }

    const hint =
      ROLE_PAGES[authUser.role]?.promptHint ??
      "Ask me anything related to GramSaarthi workflows.";

    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "assistant",
        text: `Hello ${authUser.name}. I am your GramSaarthi AI assistant. ${hint}`,
      },
    ]);
    setChatInput("");
    setChatError("");
    setShowChatFilters(false);
    setChatFilters([]);
    setUploadFile(null);
    setUploadError("");
    setUploadSuccess("");
    setShowFilters(false);
    setMetadataFilters([]);
  }, [authUser]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateFilterRow(index, field, value) {
    setMetadataFilters((prev) =>
      prev.map((item, rowIndex) => (rowIndex === index ? { ...item, [field]: value } : item)),
    );
  }

  function addFilterRow() {
    setMetadataFilters((prev) =>
      prev.length >= MAX_FILTERS ? prev : [...prev, { key: "", value: "" }],
    );
  }

  function removeFilterRow(index) {
    setMetadataFilters((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }

  function buildFilterPayload() {
    const payload = {};

    for (const pair of metadataFilters) {
      const key = pair.key.trim();
      const value = pair.value.trim();

      if (!key && !value) {
        continue;
      }

      if (!key || !value) {
        throw new Error("For filters, both key and value are required.");
      }

      payload[key] = value;
    }

    return payload;
  }

  function buildBedrockSafeHistory(messages) {
    const normalized = messages
      .slice(-8)
      .map((item) => ({
        role: item.sender === "assistant" ? "assistant" : "user",
        content: item.text,
      }))
      .filter((item) => item.content && item.content.trim().length > 0);

    const firstUserIndex = normalized.findIndex((item) => item.role === "user");
    if (firstUserIndex === -1) {
      return [];
    }

    return normalized.slice(firstUserIndex);
  }

  function updateChatFilterRow(index, field, value) {
    setChatFilters((prev) =>
      prev.map((item, rowIndex) => (rowIndex === index ? { ...item, [field]: value } : item)),
    );
  }

  function addChatFilterRow() {
    setChatFilters((prev) =>
      prev.length >= MAX_FILTERS ? prev : [...prev, { key: "", value: "" }],
    );
  }

  function removeChatFilterRow(index) {
    setChatFilters((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }

  function buildChatFilterPayload() {
    const payload = {};
    for (const pair of chatFilters) {
      const key = pair.key.trim();
      const value = pair.value.trim();

      if (!key && !value) {
        continue;
      }

      if (!key || !value) {
        throw new Error("For chat filters, both key and value are required.");
      }

      payload[key] = value;
    }
    return payload;
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
      const data = await parseApiResponse(response);

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

  async function handleChatSend(event) {
    event.preventDefault();

    const message = chatInput.trim();
    if (!message || isStreaming || !authUser) {
      return;
    }

    setChatError("");
    setChatInput("");

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    const nextMessages = [
      ...chatMessages,
      { id: userMessageId, sender: "user", text: message },
      { id: assistantMessageId, sender: "assistant", text: "" },
    ];

    setChatMessages(nextMessages);
    setIsStreaming(true);

    try {
      const ragFilters = buildChatFilterPayload();
      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: authUser.role,
          name: authUser.name,
          message,
          history: buildBedrockSafeHistory(chatMessages),
          rag_filters: ragFilters,
        }),
      });

      if (!response.ok || !response.body) {
        const data = await parseApiResponse(response);
        throw new Error(data.detail || "Unable to connect to chatbot service");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          const line = chunk
            .split("\n")
            .find((entry) => entry.startsWith("data:"));
          if (!line) {
            continue;
          }

          const payloadText = line.slice(5).trim();
          if (!payloadText) {
            continue;
          }

          const packet = JSON.parse(payloadText);
          if (packet.type === "delta") {
            setChatMessages((prev) =>
              prev.map((entry) =>
                entry.id === assistantMessageId
                  ? { ...entry, text: `${entry.text}${packet.text || ""}` }
                  : entry,
              ),
            );
          }

          if (packet.type === "error") {
            throw new Error(packet.message || "Chatbot streaming failed");
          }
        }
      }
    } catch (err) {
      setChatMessages((prev) =>
        prev.map((entry) =>
          entry.id === assistantMessageId
            ? {
                ...entry,
                text:
                  entry.text ||
                  "I could not generate a response. Please verify backend Bedrock configuration.",
              }
            : entry,
        ),
      );
      setChatError(err instanceof Error ? err.message : "Streaming failed");
    } finally {
      setIsStreaming(false);
    }
  }

  async function handlePdfIngestion(event) {
    event.preventDefault();

    if (!authUser || authUser.role !== "District Admin") {
      return;
    }

    if (!uploadFile) {
      setUploadError("Please select a PDF file to upload.");
      setUploadSuccess("");
      return;
    }

    setUploadError("");
    setUploadSuccess("");
    setUploadLoading(true);

    try {
      const filterPayload = buildFilterPayload();
      const formData = new FormData();
      formData.append("role", authUser.role);
      formData.append("name", authUser.name);
      formData.append("file", uploadFile);
      formData.append("filters", JSON.stringify(filterPayload));

      const response = await fetch(`${API_BASE_URL}/ingestion/pdf`, {
        method: "POST",
        body: formData,
      });

      const data = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(data.detail || "PDF ingestion failed");
      }

      setUploadSuccess(
        `${data.message}. Indexed ${data.chunks_indexed} chunks into ${data.index_name}.`,
      );
      setUploadFile(null);
      setShowFilters(false);
      setMetadataFilters([]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "PDF ingestion failed");
    } finally {
      setUploadLoading(false);
    }
  }

  function handleLogout() {
    setAuthUser(null);
    setSuccess("");
    setError("");
    setChatError("");
    setUploadError("");
    setUploadSuccess("");
    setChatMessages([]);
    setIsStreaming(false);
    setForm((prev) => ({ ...prev, password: "" }));
    setMode("login");
  }

  if (authUser && pageConfig) {
    return (
      <div className="page">
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <main className="card app-shell">
          <section className="left-pane">
            <p className="kicker">{authUser.role}</p>
            <h1>{pageConfig.title}</h1>
            <p className="tagline">{pageConfig.tagline}</p>
            <p className="description">
              Welcome, {authUser.name}. Your login ID is {authUser.login_id}.
            </p>

            <section className="section">
              {authUser.role === "District Admin" ? (
                <article className="ingestion-card">
                  <h2>Document Ingestion (AOSS)</h2>
                  <p className="ingestion-help">
                    Upload a PDF. Then use Add Filter to attach up to 5 metadata tags.
                  </p>

                  <form className="ingestion-form" onSubmit={handlePdfIngestion}>
                    <label>
                      PDF File
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(event) => {
                          const selected = event.target.files?.[0] ?? null;
                          setUploadFile(selected);
                          setShowFilters(false);
                          setMetadataFilters([]);
                        }}
                        required
                      />
                    </label>

                    {uploadFile ? (
                      <button
                        className="add-filter-btn"
                        type="button"
                        onClick={() => {
                          setShowFilters(true);
                          if (!metadataFilters.length) {
                            setMetadataFilters([{ key: "", value: "" }]);
                          }
                        }}
                      >
                        Add Filter
                      </button>
                    ) : null}

                    {showFilters ? (
                      <div className="filters-block">
                        <div className="filters-head">
                          <h3>Metadata Filters (Optional)</h3>
                          <button
                            className="add-filter-btn"
                            type="button"
                            onClick={addFilterRow}
                            disabled={metadataFilters.length >= MAX_FILTERS}
                          >
                            Add Another
                          </button>
                        </div>

                        <div className="filters-grid">
                          {metadataFilters.map((pair, index) => (
                            <div className="filter-row" key={`filter-${index}`}>
                              <input
                                type="text"
                                placeholder="key"
                                value={pair.key}
                                onChange={(event) => updateFilterRow(index, "key", event.target.value)}
                              />
                              <input
                                type="text"
                                placeholder="value"
                                value={pair.value}
                                onChange={(event) => updateFilterRow(index, "value", event.target.value)}
                              />
                              <button
                                className="remove-filter-btn"
                                type="button"
                                onClick={() => removeFilterRow(index)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <button className="submit-btn" type="submit" disabled={uploadLoading}>
                      {uploadLoading ? "Uploading..." : "Upload and Ingest"}
                    </button>
                  </form>

                  {uploadSuccess ? <p className="success upload-status">{uploadSuccess}</p> : null}
                  {uploadError ? <p className="error upload-status">{uploadError}</p> : null}
                </article>
              ) : null}

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
          </section>

          <section className="chat-shell" aria-label="AI chatbot panel">
            <div className="chat-head">
              <div>
                <p className="chat-kicker">AI Chatbot</p>
                <h2>Nova Assistant</h2>
              </div>
              <span className={isStreaming ? "streaming-pill active" : "streaming-pill"}>
                {isStreaming ? "Streaming" : "Idle"}
              </span>
            </div>

            <div className="chat-filter-box">
              <div className="chat-filter-head">
                <h3>RAG Filters (Optional)</h3>
                <button
                  className="add-filter-btn"
                  type="button"
                  onClick={() => {
                    setShowChatFilters(true);
                    if (!chatFilters.length) {
                      setChatFilters([{ key: "", value: "" }]);
                    }
                  }}
                >
                  Add Filter
                </button>
              </div>

              {showChatFilters ? (
                <div className="filters-grid">
                  {chatFilters.map((pair, index) => (
                    <div className="filter-row" key={`chat-filter-${index}`}>
                      <input
                        type="text"
                        placeholder="key"
                        value={pair.key}
                        onChange={(event) => updateChatFilterRow(index, "key", event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="value"
                        value={pair.value}
                        onChange={(event) => updateChatFilterRow(index, "value", event.target.value)}
                      />
                      <button
                        className="remove-filter-btn"
                        type="button"
                        onClick={() => removeChatFilterRow(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    className="add-filter-btn"
                    type="button"
                    onClick={addChatFilterRow}
                    disabled={chatFilters.length >= MAX_FILTERS}
                  >
                    Add Another
                  </button>
                </div>
              ) : null}
            </div>

            <div className="chat-stream" role="log" aria-live="polite">
              {chatMessages.map((message) => (
                <article
                  key={message.id}
                  className={
                    message.sender === "assistant" ? "bubble assistant-bubble" : "bubble user-bubble"
                  }
                >
                  <p>{message.text || (isStreaming ? "Thinking..." : "")}</p>
                </article>
              ))}
              <div ref={chatEndRef} />
            </div>

            {chatError ? <p className="error chat-error">{chatError}</p> : null}

            <form className="chat-compose" onSubmit={handleChatSend}>
              <input
                type="text"
                placeholder="Ask GramSaarthi AI anything..."
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                disabled={isStreaming}
              />
              <button className="submit-btn" disabled={isStreaming || !chatInput.trim()} type="submit">
                {isStreaming ? "Receiving..." : "Send"}
              </button>
            </form>
          </section>
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
            <select value={form.role} onChange={(e) => updateField("role", e.target.value)}>
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
