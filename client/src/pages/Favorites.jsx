import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ClubCard from '../components/ClubCard.jsx';
import { useI18n } from '../i18n';

export default function Favorites() {
  const { t } = useI18n();
  const [clubs, setClubs] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    api('/favorites')
      .then((data) => {
        setClubs(Array.isArray(data) ? data : (data.items || []));
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleFavChange = (clubId, isFav) => {
    if (!isFav) {
      setClubs(prev => (prev || []).filter(c => c.id !== clubId));
    }
  };

  if (!clubs) return <p className="container">{error || 'Загрузка избранного…'}</p>;

  return (
    <>
      <h1>❤️ {t('favorites')}</h1>
      {error && <p className="error">{error}</p>}
      {clubs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p className="muted" style={{ fontSize: '18px', marginBottom: '16px' }}>
            В вашем списке избранного пока ничего нет.
          </p>
          <Link to="/clubs" className="btn">
            Перейти в каталог кружков
          </Link>
        </div>
      ) : (
        <div className="grid">
          {clubs.map((c) => (
            <ClubCard
              key={c.id}
              club={c}
              initialIsFav={true}
              onFavChange={handleFavChange}
            />
          ))}
        </div>
      )}
    </>
  );
}
