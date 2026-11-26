import { createContext, useContext, useState, useEffect } from 'react';

const dict = {
  ru: {
    logo: 'Кружки',
    catalog: 'Каталог',
    myChildren: 'Мои дети',
    myRegistrations: 'Мои заявки',
    favorites: 'Избранное',
    myClubs: 'Мои кружки',
    organizerRegistrations: 'Заявки',
    adminPanel: 'Админ-панель',
    login: 'Войти',
    register: 'Регистрация',
    logout: 'Выйти',
    profile: 'Профиль',
    privacy: 'Политика конфиденциальности',
    footerText: 'Каталог детских кружков и секций · Казахстан',

    // Каталог
    catalogTitle: 'Каталог кружков и секций',
    searchPlaceholder: 'Поиск по названию или описанию...',
    allCategories: 'Все категории',
    allDistricts: 'Все районы',
    allDays: 'Любой день недели',
    allTimes: 'Любое время',
    morning: 'Утро (до 12:00)',
    afternoon: 'День (12:00–17:00)',
    evening: 'Вечер (после 17:00)',
    agePlaceholder: 'Возраст',
    onlyFree: 'Бесплатные',
    hasSeatsOnly: 'Есть места',
    freeTrialOnly: 'Пробное занятие',
    sortBy: 'Сортировка',
    sortNewest: 'Сначала новые',
    sortPriceAsc: 'Сначала доступные по цене',
    sortRating: 'По рейтингу отзывов',
    resetFilters: 'Сбросить',
    nearMe: 'Рядом со мной',
    showMap: 'Показать на карте',
    showList: 'Показать списком',
    emptyCatalog: 'Кружки не найдены. Попробуйте изменить параметры поиска.',
    prevPage: '← Назад',
    nextPage: 'Вперёд →',
    pageOf: 'Страница',

    // Карточка кружка
    free: 'Бесплатно',
    month: 'мес',
    lesson: 'занятие',
    course: 'курс',
    freeTrialBadge: 'Пробное бесплатно',
    freeSeats: 'Свободно мест',
    noSeats: 'Мест нет (в очередь)',
    details: 'Подробнее →',
    yearsOld: 'лет',

    // Статусы
    statusPending: 'Ожидает рассмотрения',
    statusConfirmed: 'Подтверждена ✅',
    statusRejected: 'Отклонена',
    statusCancelled: 'Отменена',
    statusWaitlist: 'В очереди',
    statusRemoved: 'Выбыл',
    statusExpired: 'Истёк срок',
    statusCancelledByOrg: 'Отменена организатором',
    statusCancelledBySys: 'Отменена системой',

    // Карточка кружка / детали
    enroll: 'Записаться',
    joinWaitlist: 'Встать в очередь',
    chooseChild: 'Выберите ребёнка',
    needRegisterChild: 'Сначала добавьте ребёнка в разделе «Мои дети»',
    commentPlaceholder: 'Ваш комментарий или вопрос организатору...',
    reviewsTitle: 'Отзывы родителей',
    noReviews: 'Пока нет отзывов.',
    ratingFrom3: 'Рейтинг рассчитывается при наличии от 3 отзывов',
    leaveReview: 'Оставить отзыв',
    ratingLabel: 'Оценка (1–5)',
    reviewText: 'Текст отзыва (от 10 до 1000 символов)',
    submitReview: 'Отправить отзыв',
    organizerReply: 'Ответ организатора',
    replyToReview: 'Ответить на отзыв',
    replyPlaceholder: 'Ответ родителям...',
    sendReply: 'Отправить ответ',
  },
  kz: {
    logo: 'Үйірмелер',
    catalog: 'Каталог',
    myChildren: 'Менің балаларым',
    myRegistrations: 'Менің өтінімдерім',
    favorites: 'Таңдаулылар',
    myClubs: 'Менің үйірмелерім',
    organizerRegistrations: 'Өтінімдер',
    adminPanel: 'Әкімші панелі',
    login: 'Кіру',
    register: 'Тіркелу',
    logout: 'Шығу',
    profile: 'Профиль',
    privacy: 'Құпиялылық саясаты',
    footerText: 'Балалар үйірмелері мен секцияларының каталогы · Қазақстан',

    // Каталог
    catalogTitle: 'Үйірмелер мен секциялар каталогы',
    searchPlaceholder: 'Атауы немесе сипаттамасы бойынша іздеу...',
    allCategories: 'Барлық санаттар',
    allDistricts: 'Барлық аудандар',
    allDays: 'Кез келген күн',
    allTimes: 'Кез келген уақыт',
    morning: 'Таңертең (12:00-ге дейін)',
    afternoon: 'Күндіз (12:00–17:00)',
    evening: 'Кешкі (17:00-ден кейін)',
    agePlaceholder: 'Жасы',
    onlyFree: 'Тегін',
    hasSeatsOnly: 'Орын бар',
    freeTrialOnly: 'Сынақ сабағы',
    sortBy: 'Сұрыптау',
    sortNewest: 'Алдымен жаңалары',
    sortPriceAsc: 'Бағасы бойынша (өсу)',
    sortRating: 'Рейтинг бойынша',
    resetFilters: 'Тазарту',
    nearMe: 'Маған жақын',
    showMap: 'Картада көрсету',
    showList: 'Тізім түрінде',
    emptyCatalog: 'Үйірмелер табылмады. Сүзгілерді өзгертіп көріңіз.',
    prevPage: '← Артқа',
    nextPage: 'Алға →',
    pageOf: 'Бет',

    // Карточка кружка
    free: 'Тегін',
    month: 'ай',
    lesson: 'сабақ',
    course: 'курс',
    freeTrialBadge: 'Сынақ сабағы тегін',
    freeSeats: 'Бос орын',
    noSeats: 'Орын жоқ (кезекке)',
    details: 'Толығырақ →',
    yearsOld: 'жас',

    // Статусы
    statusPending: 'Қаралуда',
    statusConfirmed: 'Расталды ✅',
    statusRejected: 'Қабылданбады',
    statusCancelled: 'Бас тартылды',
    statusWaitlist: 'Кезекте',
    statusRemoved: 'Шығарылды',
    statusExpired: 'Мерзімі өтті',
    statusCancelledByOrg: 'Ұйымдастырушы бұзды',
    statusCancelledBySys: 'Жүйе бұзды',

    // Карточка кружка / детали
    enroll: 'Жазылу',
    joinWaitlist: 'Кезекке тұру',
    chooseChild: 'Баланы таңдаңыз',
    needRegisterChild: 'Алдымен «Менің балаларым» бөлімінде бала профилін қосыңыз',
    commentPlaceholder: 'Ұйымдастырушыға сұрақ немесе түсініктеме...',
    reviewsTitle: 'Ата-аналардың пікірлері',
    noReviews: 'Әзірше пікірлер жоқ.',
    ratingFrom3: 'Рейтинг 3 пікір жиналғанда есептеледі',
    leaveReview: 'Пікір қалдыру',
    ratingLabel: 'Бағалау (1–5)',
    reviewText: 'Пікір мәтіні (10-нан 1000 таңбаға дейін)',
    submitReview: 'Пікірді жіберу',
    organizerReply: 'Ұйымдастырушының жауабы',
    replyToReview: 'Пікірге жауап беру',
    replyPlaceholder: 'Ата-анаға жауап...',
    sendReply: 'Жауапты жіберу',
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'ru');

  const toggleLang = (l) => {
    const next = l || (lang === 'ru' ? 'kz' : 'ru');
    setLang(next);
    localStorage.setItem('app_lang', next);
  };

  const t = (key) => dict[lang]?.[key] || dict.ru[key] || key;

  return (
    <LanguageContext.Provider value={{ lang, setLang: toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useI18n = () => useContext(LanguageContext);
