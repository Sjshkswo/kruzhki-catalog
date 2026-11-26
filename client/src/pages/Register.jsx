import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return setError('Пароль — минимум 6 символов');
    try { await register(form); navigate('/'); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="card narrow">
      <h1>Регистрация</h1>
      <form onSubmit={submit} className="form">
        <label>ФИО<input name="full_name" value={form.full_name} onChange={change} required /></label>
        <label>Email<input name="email" type="email" value={form.email} onChange={change} required /></label>
        <label>Телефон<input name="phone" value={form.phone} onChange={change} /></label>
        <label>Пароль<input name="password" type="password" value={form.password} onChange={change} required /></label>
        <p className="muted">Вы регистрируетесь как родитель. Чтобы вести кружок, после регистрации подайте заявку организатора в профиле: её проверит администратор.</p>
        {error && <p className="error">{error}</p>}
        <button className="btn">Зарегистрироваться</button>
      </form>
      <p className="muted">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
    </div>
  );
}
