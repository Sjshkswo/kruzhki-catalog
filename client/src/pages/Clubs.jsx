import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ClubCard from '../components/ClubCard.jsx';

export default function Clubs() {
  const [params, setParams] = useSearchParams();
  const [clubs, setClubs] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const age = params.get('age') || '';
  const free = params.get('free') === 'true';

  useEffect(() => { api('/categories').then(setCats).catch(() => {}); }, []);

  // Каждый раз, когда меняются фильтры, запрашиваем каталог заново
  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    if (age) qs.set('age', age);
    if (free) qs.set('free', 'true');
    api('/clubs?' + qs.toString())
      .then((d) => { setClubs(d); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, category, age, free]);

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  return (
    <>
      <h1>Каталог кружков</h1>
      <div className="filters card">
        <input placeholder="Название…" value={search} onChange={(e) => set('search', e.target.value)} />
        <select value={category} onChange={(e) => set('category', e.target.value)}>
          <option value="">Все категории</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="number" min="0" max="99" placeholder="Возраст" value={age} onChange={(e) => set('age', e.target.value)} />
        <label className="check">
          <input type="checkbox" checked={free} onChange={(e) => set('free', e.target.checked ? 'true' : '')} /> Бесплатные
        </label>
        <button className="btn btn-light" onClick={() => setParams({})}>Сбросить</button>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? <p>Загрузка…</p> : clubs.length === 0 ? <p className="muted">Ничего не найдено. Измените фильтры.</p> : (
        <div className="grid">{clubs.map((c) => <ClubCard key={c.id} club={c} />)}</div>
      )}
    </>
  );
}
