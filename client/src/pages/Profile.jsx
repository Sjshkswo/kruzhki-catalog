import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const ROLES = { participant: 'Участник', organizer: 'Организатор', admin: 'Администратор' };

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ full_name: user.full_name, phone: user.phone || '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/profile', { method: 'PUT', body: form });
      setUser(d.user);
      setMsg({ type: 'ok', text: 'Сохранено' });
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  return (
    <div className="card narrow">
      <h1>Профиль</h1>
      <p className="muted">{user.email} · {ROLES[user.role]}</p>
      <form onSubmit={submit} className="form">
        <label>ФИО<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
        <label>Телефон<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        {msg.text && <p className={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</p>}
        <button className="btn">Сохранить</button>
      </form>
    </div>
  );
}
