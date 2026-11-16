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
  const [form, setForm] = useState({ participant_name: '', participant_birth_year: '', phone: '', comment: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = () => api(`/clubs/${id}`).then(setClub).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    try {
      await api('/registrations', { method: 'POST', body: { ...form, club_id: Number(id) } });
      setMsg({ type: 'ok', text: 'Заявка отправлена! Следите за статусом в разделе «Мои заявки».' });
      setForm({ participant_name: '', participant_birth_year: '', phone: '', comment: '' });
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
        {user && user.role !== 'participant' && <p className="muted">Запись доступна только участникам.</p>}
        {user?.role === 'participant' && (club.free_seats <= 0 ? <p className="bad">Свободных мест нет.</p> : (
          <form onSubmit={submit} className="form">
            <label>Имя участника<input name="participant_name" value={form.participant_name} onChange={change} required /></label>
            <label>Год рождения<input name="participant_birth_year" type="number" value={form.participant_birth_year} onChange={change} required /></label>
            <label>Телефон<input name="phone" value={form.phone} onChange={change} placeholder="+7 700 000 00 00" required /></label>
            <label>Комментарий<textarea name="comment" value={form.comment} onChange={change} rows="3" /></label>
            <button className="btn">Отправить заявку</button>
          </form>
        ))}
        {msg.text && <p className={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</p>}
        <a className="btn btn-wa" href={waLink(`Здравствуйте! Интересует кружок «${club.title}».`)} target="_blank" rel="noopener noreferrer">
          💬 Спросить в WhatsApp
        </a>
      </aside>
    </div>
  );
}
