/** Source-of-truth key shape. Plural keys use "|" forms: one|few|many (ru), one|other (uz, en); chosen by `count`. */
export const ru = {
  // nav
  "nav.pulse": "Пульс",
  "nav.operations": "Операции",
  "nav.forecast": "Прогноз",
  "nav.obligations": "Обязательства",
  "nav.envelopes": "Конверты",
  "nav.chat": "Помощник",
  "nav.settings": "Настройки",
  "nav.team": "Команда",
  "nav.integrations": "Интеграции",
  "nav.more": "Ещё",

  // common
  "common.save": "Сохранить",
  "common.cancel": "Отмена",
  "common.delete": "Удалить",
  "common.edit": "Изменить",
  "common.add": "Добавить",
  "common.close": "Закрыть",
  "common.back": "Назад",
  "common.next": "Далее",
  "common.done": "Готово",
  "common.confirm": "Подтвердить",
  "common.retry": "Повторить",
  "common.search": "Поиск",
  "common.filter": "Фильтр",
  "common.export": "Экспорт",
  "common.import": "Импорт",
  "common.share": "Поделиться",
  "common.today": "Сегодня",
  "common.yesterday": "Вчера",
  "common.language": "Язык",
  "common.currency": "Валюта",
  "common.amount": "Сумма",
  "common.date": "Дата",
  "common.category": "Категория",
  "common.comment": "Комментарий",
  "common.items": "{count} запись|{count} записи|{count} записей",
  "common.days": "{count} день|{count} дня|{count} дней",

  // states
  "state.loading": "Загружаем…",
  "state.empty.title": "Пока ничего нет",
  "state.empty.hint": "Здесь появятся данные, когда вы добавите первую запись.",
  "state.error.title": "Не получилось загрузить",
  "state.error.hint": "Проверьте соединение и попробуйте ещё раз.",
  "state.offline.title": "Нет соединения",
  "state.offline.hint": "Показываем сохранённые данные. Изменения отправятся, когда сеть вернётся.",
  "state.forbidden": "Нет доступа к этому разделу",
  "state.saved": "Сохранено",

  // auth
  "auth.title": "Вход в Oydin",
  "auth.phone": "Номер телефона",
  "auth.sendCode": "Получить код",
  "auth.code": "Код из сообщения",
  "auth.codeSent": "Мы отправили код на {phone}",
  "auth.resend": "Отправить ещё раз через {seconds} с",
  "auth.invalidCode": "Неверный код. Попробуйте ещё раз.",
  "auth.telegram": "Войти через Telegram",
  "auth.logout": "Выйти",
  "auth.terms": "Продолжая, вы принимаете условия сервиса и политику конфиденциальности.",

  // onboarding
  "onboarding.welcome": "Добро пожаловать",
  "onboarding.business.title": "Расскажите о бизнесе",
  "onboarding.business.name": "Название бизнеса",
  "onboarding.business.type": "Чем вы занимаетесь",
  "onboarding.balance.title": "Сколько денег сейчас",
  "onboarding.balance.hint": "Примерно — позже уточните.",
  "onboarding.obligations.title": "Что нужно оплатить в ближайшее время",
  "onboarding.step": "Шаг {current} из {total}",
  "onboarding.finish": "Открыть пульс",

  // pulse
  "pulse.title": "Пульс бизнеса",
  "pulse.balance": "Сейчас на счетах",
  "pulse.runway": "Денег хватит на {count} день|Денег хватит на {count} дня|Денег хватит на {count} дней",
  "pulse.income": "Приход",
  "pulse.expense": "Расход",
  "pulse.upcoming": "Ближайшие платежи",
  "pulse.attention": "Требует внимания",
  "pulse.allGood": "Всё в порядке",
  "pulse.gap": "Не хватает {amount} к {date}",

  // operations
  "operations.title": "Операции",
  "operations.add": "Добавить операцию",
  "operations.income": "Приход",
  "operations.expense": "Расход",
  "operations.transfer": "Перевод",
  "operations.empty": "Операций пока нет",
  "operations.voice": "Продиктуйте операцию",
  "operations.counterparty": "Контрагент",
  "operations.account": "Счёт",
  "operations.deleted": "Операция удалена",

  // forecast
  "forecast.title": "Прогноз",
  "forecast.horizon": "Горизонт",
  "forecast.horizon.days": "{count} день|{count} дня|{count} дней",
  "forecast.lowest": "Минимальный остаток",
  "forecast.safe": "Денег хватает на весь период",
  "forecast.risk": "Возможен кассовый разрыв {date}",
  "forecast.scenario": "Что если",

  // obligations
  "obligations.title": "Обязательства",
  "obligations.add": "Добавить обязательство",
  "obligations.dueDate": "Срок оплаты",
  "obligations.overdue": "Просрочено",
  "obligations.paid": "Оплачено",
  "obligations.pending": "Ожидает оплаты",
  "obligations.markPaid": "Отметить оплаченным",
  "obligations.recurring": "Повторяется",
  "obligations.empty": "Обязательств нет",

  // envelopes
  "envelopes.title": "Конверты",
  "envelopes.add": "Создать конверт",
  "envelopes.target": "Цель",
  "envelopes.saved": "Отложено",
  "envelopes.left": "Осталось {amount}",
  "envelopes.topUp": "Пополнить",
  "envelopes.empty": "Конвертов пока нет",

  // chat
  "chat.title": "Помощник",
  "chat.placeholder": "Спросите о деньгах бизнеса…",
  "chat.send": "Отправить",
  "chat.thinking": "Думаю…",
  "chat.suggest.runway": "На сколько хватит денег?",
  "chat.suggest.expenses": "Куда ушли деньги за неделю?",
  "chat.evidence": "На чём основан ответ",
  "chat.disclaimer": "Помощник может ошибаться. Проверяйте важные суммы.",

  // settings
  "settings.title": "Настройки",
  "settings.profile": "Профиль",
  "settings.business": "Бизнес",
  "settings.notifications": "Уведомления",
  "settings.theme": "Тема",
  "settings.theme.light": "Светлая",
  "settings.theme.dark": "Тёмная",
  "settings.theme.system": "Как в системе",
  "settings.dangerZone": "Опасная зона",

  // team
  "team.title": "Команда",
  "team.invite": "Пригласить",
  "team.role": "Роль",
  "team.role.owner": "Владелец",
  "team.role.accountant": "Бухгалтер",
  "team.role.seller": "Продавец",
  "team.remove": "Убрать из команды",
  "team.members": "{count} участник|{count} участника|{count} участников",

  // integrations
  "integrations.title": "Интеграции",
  "integrations.connect": "Подключить",
  "integrations.connected": "Подключено",
  "integrations.disconnect": "Отключить",
  "integrations.comingSoon": "Скоро",
  "integrations.import.hint": "Загрузите выписку из банка или файл Excel.",

  // pricing
  "pricing.title": "Тарифы",
  "pricing.free": "Бесплатно",
  "pricing.perMonth": "{price} в месяц",
  "pricing.choose": "Выбрать тариф",
  "pricing.current": "Ваш тариф",
  "pricing.trial": "{count} день бесплатно|{count} дня бесплатно|{count} дней бесплатно",

  // legal
  "legal.terms": "Условия использования",
  "legal.privacy": "Политика конфиденциальности",
  "legal.offer": "Публичная оферта",
  "legal.contact": "Связаться с нами",

  // landing
  "landing.hero.title": "Ваши деньги под присмотром",
  "landing.hero.subtitle": "Oydin каждую ночь сверяет остатки, платежи и долги и подсказывает следующий шаг.",
  "landing.cta.open": "Открыть в браузере",
  "landing.cta.telegram": "Открыть в Telegram",
  "landing.manifesto": "Манифест",
  "landing.footer.rights": "Все права защищены",
} as const

export type Key = keyof typeof ru
export type Dict = { readonly [K in Key]: string }
