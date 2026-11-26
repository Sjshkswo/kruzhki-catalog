import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, WEEKDAYS, formatPrice, categoryStyle, bannerBg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { waLink } from '../config.js';

export default function ClubDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [club, setClub] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ child_id: '', phone: '', comment: '' });
  const [children, setChildren] = useState([]);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = () => api(`/clubs/${id}`).then(setClub).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (user) {
      api('/children').then(setChildren).catch((e) => setMsg({ type: 'error', text: e.message }));
    }
  }, [user?.id, user?.role]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    try {
      const body = {
        club_id: Number(id),
        child_id: Number(form.child_id),
        phone: form.phone,
        comment: form.comment,
      };
      await api('/registrations', { method: 'POST', body });
      setMsg({ type: 'ok', text: 'Заявка отправлена! Следите за статусом в разделе «Мои заявки».' });
      setForm({ child_id: '', phone: '', comment: '' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!club) return <p>Загрузка…</p>;

  return (
    <div className="detail">
      <div>
        <div className="detail-banner" style={bannerBg(club.category_name)}>
          <span className="detail-emoji">{categoryStyle(club.category_name).emoji}</span>
          <div>
            <span className="tag tag-white">{club.category_name}</span>
            <h1>{club.title}</h1>
          </div>
        </div>
        <p className="lead">{club.description || 'Описание пока не добавлено.'}</p>
        <ul className="info">
          <li><b>Возраст:</b> {club.age_min}–{club.age_max} лет</li>
          <li><b>Стоимость:</b> {formatPrice(club.price)}</li>
          <li><b>Адрес:</b> {club.address || '—'}</li>
          <li><b>Организатор:</b> {club.organizer_name}</li>
          <li><b>Контакты:</b> {club.organizer_phone || '—'}, {club.organizer_email}</li>
          <li><b>Свободных мест:</b> {club.free_seats} из {club.capacity}</li>
        </ul>
        <h3>Расписание</h3>
        {club.schedule.length === 0 ? <p className="muted">Расписание уточняйте у организатора.</p> : (
          <ul className="info">{club.schedule.map((s) => <li key={s.id}>{WEEKDAYS[s.weekday]}: {s.start_time}–{s.end_time}</li>)}</ul>
        )}
      </div>

      <aside className="card">
        <h3>Записаться</h3>
        {!user && <p>Чтобы записаться, <Link to="/login">войдите</Link> или <Link to="/register">зарегистрируйтесь</Link>.</p>}
        {user && user.id === club.organizer_id && <p className="muted">Это ваш кружок: записываться в него нельзя.</p>}
        {user && user.id !== club.organizer_id && (
          club.free_seats <= 0 ? <p className="bad">Свободных мест нет.</p> :
          children.length === 0 ? (
            <p className="muted">Сначала добавьте профиль ребёнка в разделе <Link to="/my-children">«Мои дети»</Link>.</p>
          ) : (
            <form onSubmit={submit} className="form">
              <label>Ребёнок
                  <select name="child_id" value={form.child_id} onChange={change} required>
                    <option value="">Выберите ребёнка</option>
                    {children.map((child) => <option key={child.id} value={child.id}>{child.full_name} — {String(child.birth_date).slice(0, 10)}</option>)}
                  </select>
              </label>
              <label>Телефон<input name="phone" value={form.phone} onChange={change} placeholder="+7 700 000 00 00" required /></label>
              <label>Комментарий<textarea name="comment" value={form.comment} onChange={change} rows="3" /></label>
              <button className="btn" disabled={!form.child_id}>Отправить заявку</button>
            </form>
          )
        )}
        {msg.text && <p className={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</p>}
        <a className="btn btn-wa" href={waLink(`Здравствуйте! Интересует кружок «${club.title}».`)} target="_blank" rel="noopener noreferrer">
          💬 Спросить в WhatsApp
        </a>
      </aside>
    </div>
  );
}
