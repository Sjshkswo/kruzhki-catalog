import { useEffect, useState } from 'react';
import { api, ROLE_LABELS } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const APP_STATUS = { pending: 'На рассмотрении', approved: 'Одобрена', rejected: 'Отклонена' };

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ full_name: user.full_name, phone: user.phone || '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  // заявка на роль организатора (R-1)
  const [app, setApp] = useState(null);
  const [appForm, setAppForm] = useState({ org_name: '', bin: '', phone: '', social_url: '' });
  const [appMsg, setAppMsg] = useState({ type: '', text: '' });
  const loadApp = () => api('/profile/organizer-application').then((d) => setApp(d && d.id ? d : null)).catch(() => {});
  useEffect(() => { if (user.role === 'parent') loadApp(); }, [user.role]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/profile', { method: 'PUT', body: form });
      setUser(d.user);
      setMsg({ type: 'ok', text: 'Сохранено' });
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  };

  const sendApp = async (e) => {
    e.preventDefault();
    setAppMsg({ type: '', text: '' });
    try {
      await api('/profile/organizer-application', { method: 'POST', body: appForm });
      setAppMsg({ type: 'ok', text: 'Заявка отправлена. Администратор рассмотрит её и сообщит результат здесь.' });
      loadApp();
    } catch (err) { setAppMsg({ type: 'error', text: err.message }); }
  };

  const ch = (setter, f) => (e) => setter({ ...f, [e.target.name]: e.target.value });

  return (
    <div className="card narrow">
      <h1>Профиль</h1>
      <p className="muted">{user.email} · {ROLE_LABELS[user.role]}</p>
      <form onSubmit={submit} className="form">
        <label>ФИО<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
        <label>Телефон<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        {msg.text && <p className={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</p>}
        <button className="btn">Сохранить</button>
      </form>

      {user.role === 'parent' && (
        <>
          <h2 style={{ marginTop: 28 }}>Стать организатором</h2>
          {app && (
            <p className={app.status === 'approved' ? 'ok' : app.status === 'rejected' ? 'error' : 'muted'}>
              Последняя заявка «{app.org_name}»: {APP_STATUS[app.status]}
              {app.status === 'rejected' && app.admin_comment ? `. Причина: ${app.admin_comment}` : ''}
            </p>
          )}
          {appMsg.text && <p className={appMsg.type === 'ok' ? 'ok' : 'error'}>{appMsg.text}</p>}
          {(!app || app.status !== 'pending') && (
            <form onSubmit={sendApp} className="form">
              <p className="muted">Чтобы публиковать кружки, нужна проверка администратора.</p>
              <label>Название организации<input name="org_name" value={appForm.org_name} onChange={ch(setAppForm, appForm)} required /></label>
              <label>БИН / ИИН (12 цифр)<input name="bin" value={appForm.bin} onChange={ch(setAppForm, appForm)} inputMode="numeric" maxLength={12} required /></label>
              <label>Телефон<input name="phone" value={appForm.phone} onChange={ch(setAppForm, appForm)} required /></label>
              <label>Ссылка на соцсети или сайт<input name="social_url" value={appForm.social_url} onChange={ch(setAppForm, appForm)} /></label>
              <button className="btn btn-light">Отправить заявку</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
