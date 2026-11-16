import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try { await login(form.email, form.password); navigate('/'); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="card narrow">
      <h1>Вход</h1>
      <form onSubmit={submit} className="form">
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Пароль<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn">Войти</button>
      </form>
      <p className="muted">Нет аккаунта? <Link to="/register">Регистрация</Link></p>
    </div>
  );
}
