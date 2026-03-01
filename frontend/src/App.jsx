import { useEffect, useState } from 'react';

const initialForm = { name: '', email: '', city: '' };

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // no-op
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/users');
      setUsers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function startEdit(user) {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email, city: user.city });
  }

  function cancelEdit() {
    setEditingId('');
    setForm(initialForm);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editingId) {
        await request(`/api/users/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        await request('/api/users', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      cancelEdit();
      await loadUsers();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function removeUser(userId) {
    if (!window.confirm('Delete this user?')) return;
    setLoading(true);
    setError('');
    try {
      await request(`/api/users/${userId}`, { method: 'DELETE' });
      await loadUsers();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>Users CRUD</h1>

      <form className="card form" onSubmit={onSubmit}>
        <h2>{editingId ? 'Edit User' : 'Create User'}</h2>
        <label>
          Name
          <input name="name" value={form.name} onChange={onChange} required minLength={2} />
        </label>
        <label>
          Email
          <input name="email" value={form.email} onChange={onChange} type="email" required />
        </label>
        <label>
          City
          <input name="city" value={form.city} onChange={onChange} />
        </label>
        <div className="actions">
          <button type="submit" disabled={loading}>{editingId ? 'Update' : 'Create'}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={cancelEdit} disabled={loading}>Cancel</button>
          )}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="list-head">
          <h2>Users</h2>
          <button onClick={loadUsers} className="secondary" disabled={loading}>Refresh</button>
        </div>

        {users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>City</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.city || '-'}</td>
                  <td>
                    <button className="small" onClick={() => startEdit(user)}>Edit</button>
                    <button className="small danger" onClick={() => removeUser(user.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
