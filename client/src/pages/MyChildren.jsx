import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function MyChildren() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ full_name: '', birth_date: '', gender: '', consent: false });
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  const load = () => api('/children').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(editing ? `/children/${editing}` : '/children', {
        method: editing ? 'PUT' : 'POST',
        body: form
      });
      setForm({ full_name: '', birth_date: '', gender: '', consent: false });
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Удалить профиль ребёнка?')) return;
    try {
      await api(`/children/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card narrow wide">
      <h1>Мои дети</h1>
      <p className="muted">
        Добавьте профили ваших детей, чтобы быстро выбирать их при записи в кружки.
      </p>

      <form className="form" onSubmit={submit} style={{ marginTop: '16px', marginBottom: '24px' }}>
        <div className="grid-2">
          <label>
            ФИО ребёнка
            <input
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Иванов Дамир"
            />
          </label>
          <label>
            Дата рождения
            <input
              required
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </label>
        </div>

        <label>
          Пол (необязательно)
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">Не указывать</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </label>

        {!editing && (
          <label className="check">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => setForm({ ...form, consent: e.target.checked })}
              required
            />
            <span>
              Согласен(на) на <Link to="/privacy" target="_blank" style={{ textDecoration: 'underline' }}>обработку персональных данных</Link> ребёнка (S-1)
            </span>
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" disabled={!editing && !form.consent}>
            {editing ? 'Сохранить изменения' : '+ Добавить ребёнка'}
          </button>
          {editing && (
            <button
              type="button"
              className="btn btn-light"
              onClick={() => {
                setEditing(null);
                setForm({ full_name: '', birth_date: '', gender: '', consent: false });
              }}
            >
              Отмена
            </button>
          )}
        </div>
      </form>

      <h2>Сохранённые профили детей</h2>
      {items.length === 0 ? (
        <p className="muted">У вас пока нет добавленных детей.</p>
      ) : (
        <table className="table" style={{ marginTop: '12px' }}>
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Дата рождения</th>
              <th>Пол</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td><b>{x.full_name}</b></td>
                <td>{String(x.birth_date).slice(0, 10)}</td>
                <td>{x.gender === 'male' ? 'Мужской' : x.gender === 'female' ? 'Женский' : '—'}</td>
                <td className="actions">
                  <button
                    className="btn btn-small btn-light"
                    onClick={() => {
                      setEditing(x.id);
                      setForm({
                        full_name: x.full_name,
                        birth_date: String(x.birth_date).slice(0, 10),
                        gender: x.gender || '',
                        consent: true,
                      });
                    }}
                  >
                    Редактировать
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => remove(x.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
