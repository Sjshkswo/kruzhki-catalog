import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, categoryStyle, bannerBg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import ClubCard from '../components/ClubCard.jsx';

const STEPS = [
  { icon: '🔍', title: 'Найдите', text: 'Ищите по названию, возрасту ребёнка, категории и цене.' },
  { icon: '📝', title: 'Запишитесь', text: 'Заполните короткую форму: заявка уйдёт организатору.' },
  { icon: '✅', title: 'Получите ответ', text: 'Следите за статусом заявки в личном кабинете.' },
];

export default function Home() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [all, setAll] = useState(0);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api('/clubs').then((d) => { setClubs(d.slice(0, 6)); setAll(d.length); }).catch((e) => setError(e.message));
    api('/categories').then(setCats).catch(() => {});
  }, []);

  const search = (e) => { e.preventDefault(); navigate(`/clubs?search=${encodeURIComponent(q)}`); };

  return (
    <>
      <section className="hero">
        <span className="float f1">⚽</span><span className="float f2">🎨</span>
        <span className="float f3">🎵</span><span className="float f4">💻</span>
        <span className="float f5">💃</span><span className="float f6">🌍</span>
        <h1>Найдите кружок, который <span className="accent">зажжёт</span> интерес ребёнка</h1>
        <p>Каталог секций и кружков с онлайн-записью: от футбола до программирования.</p>
        <form onSubmit={search} className="search-row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Например: футбол, рисование, английский…" />
          <button className="btn btn-accent">Найти</button>
        </form>
        <div className="hero-stats">
          <div><b>{all}</b><span>кружков</span></div>
          <div><b>{cats.length}</b><span>категорий</span></div>
          <div><b>1 мин</b><span>на запись</span></div>
        </div>
      </section>

      {error && <p className="error banner-error">{error}</p>}

      <h2 className="section-title">Выберите направление</h2>
      <div className="cat-grid">
        {cats.map((c) => {
          const st = categoryStyle(c.name);
          return (
            <Link key={c.id} to={`/clubs?category=${c.id}`} className="cat-tile" style={bannerBg(c.name)}>
              <span className="cat-emoji">{st.emoji}</span>
              <span>{c.name}</span>
            </Link>
          );
        })}
      </div>

      <h2 className="section-title">Как это работает</h2>
      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={s.title} className="step">
            <div className="step-icon">{s.icon}</div>
            <h3>{i + 1}. {s.title}</h3>
            <p className="muted">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="row-between">
        <h2 className="section-title">Новые кружки</h2>
        <Link to="/clubs" className="more">Весь каталог →</Link>
      </div>
      <div className="grid">{clubs.map((c) => <ClubCard key={c.id} club={c} />)}</div>

      {!user && (
        <section className="cta">
          <div>
            <h2>Ведёте кружок или секцию?</h2>
            <p>Зарегистрируйтесь как организатор: опубликуйте занятия и принимайте заявки онлайн.</p>
          </div>
          <Link to="/register" className="btn btn-accent">Стать организатором</Link>
        </section>
      )}
    </>
  );
}
