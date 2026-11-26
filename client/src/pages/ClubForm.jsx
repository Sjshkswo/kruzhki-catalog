import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, WEEKDAYS } from '../api.js';

const empty = { title: '', category_id: '', description: '', age_min: 5, age_max: 12, price: 0, address: '', capacity: 10, is_active: true, schedule: [] };

export default function ClubForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/categories').then(setCats);
    if (id) api(`/organizer/clubs/${id}`).then((c) => setForm({ ...c, price: Number(c.price) })).catch((e) => setError(e.message));
  }, [id]);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const setSlot = (i, key, value) =>
    setForm({ ...form, schedule: form.schedule.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)) });
  const addSlot = () => setForm({ ...form, schedule: [...form.schedule, { weekday: 1, start_time: '16:00', end_time: '17:30' }] });
  const removeSlot = (i) => setForm({ ...form, schedule: form.schedule.filter((_, idx) => idx !== i) });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const body = {
        ...form,
        category_id: Number(form.category_id),
        age_min: Number(form.age_min), age_max: Number(form.age_max),
        price: Number(form.price), capacity: Number(form.capacity),
        schedule: form.schedule.map((s) => ({ ...s, weekday: Number(s.weekday) })),
      };
      if (id) await api(`/organizer/clubs/${id}`, { method: 'PUT', body });
      else await api('/organizer/clubs', { method: 'POST', body });
      navigate('/organizer/clubs');
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="card narrow wide">
      <h1>{id ? 'Редактирование кружка' : 'Новый кружок'}</h1>
      <p className="muted">Новый кружок и изменения названия, описания или возраста проверяет администратор, и до одобрения в каталоге его не видно. Цену, расписание и места можно менять без проверки.</p>
      <form onSubmit={submit} className="form">
        <label>Название<input name="title" value={form.title} onChange={change} required /></label>
        <label>Категория
          <select name="category_id" value={form.category_id} onChange={change} required>
            <option value="">— выберите —</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Описание<textarea name="description" rows="4" value={form.description} onChange={change} /></label>
        <div className="grid-2">
          <label>Возраст от<input name="age_min" type="number" min="0" value={form.age_min} onChange={change} /></label>
          <label>Возраст до<input name="age_max" type="number" min="0" value={form.age_max} onChange={change} /></label>
          <label>Цена в месяц (0 — бесплатно)<input name="price" type="number" min="0" value={form.price} onChange={change} /></label>
          <label>Всего мест<input name="capacity" type="number" min="1" value={form.capacity} onChange={change} /></label>
        </div>
        <label>Адрес<input name="address" value={form.address} onChange={change} /></label>

        <h3>Расписание</h3>
        {form.schedule.map((s, i) => (
          <div key={i} className="slot">
            <select value={s.weekday} onChange={(e) => setSlot(i, 'weekday', e.target.value)}>
              {WEEKDAYS.slice(1).map((d, idx) => <option key={d} value={idx + 1}>{d}</option>)}
            </select>
            <input type="time" value={s.start_time} onChange={(e) => setSlot(i, 'start_time', e.target.value)} />
            <input type="time" value={s.end_time} onChange={(e) => setSlot(i, 'end_time', e.target.value)} />
            <button type="button" className="btn btn-small btn-danger" onClick={() => removeSlot(i)}>×</button>
          </div>
        ))}
        <button type="button" className="btn btn-light btn-small" onClick={addSlot}>+ Добавить занятие</button>

        {id && (
          <label className="check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Набор открыт</label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn">Сохранить</button>
      </form>
    </div>
  );
}
