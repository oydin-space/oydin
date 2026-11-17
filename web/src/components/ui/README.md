# Oydin UI kit

Единственный источник визуального языка. Живой просмотр: `/kit` (светлая и тёмная тема, все состояния; в навигации нет, `noindex`).

## Правила

1. Экраны собираются **только** из компонентов этого каталога (`import { … } from "@/components/ui"`).
2. На экранах нет собственных цветов, радиусов, теней и размеров шрифта: только токены из `src/app/globals.css`
   (`bg-card`, `text-muted-foreground`, `rounded-card`, `text-body`, `shadow-overlay`, `min-h-row`, …). Hex/rgb вне `globals.css` запрещены.
3. Нужного компонента нет — добавьте его сюда и покажите на `/kit`, а не рисуйте разметку на странице.
4. Деньги: целые минимальные единицы валюты (сум / центы). Показ — `AmountText`, ввод — `MoneyInput`, форматирование — `formatMoney`.
5. Статус никогда не только цветом: `Badge` с текстом, знак ±, иконка в баннерах.
6. Цели нажатия ≥44px, фокус виден (`focus-ring`), анимации 120/180/240 мс; при reduced-motion — fade ≤80 мс без transform.
7. Загрузка — скелетоны (`aria-hidden`, контейнер `aria-busy`), без count-up у денег. Вложенные листы запрещены.
8. Логотипы интеграций — из `public/logos`; нет файла — монограмма `LogoTile`. Выдуманные знаки и эмодзи запрещены.
   Интеграции без рабочего кода — статус `coming-soon` (неактивная карточка).

## Состав

Атомы: `Text`, `Icon`, `Button`/`IconButton`, `Spinner`, `Skeleton*`, `Badge`, `Chip`, `Avatar`, `Switch`/`Checkbox`/`RadioItem`, `Sparkline`, `DateChip`, `AmountText`.
Молекулы: `Input`, `Textarea`, `MoneyInput`, `Select`, `SegmentedControl`, `ChoiceControl`, `OtpInput`, `FilterBar`, `ListRow`, `Tooltip`, `Tabs`, `ProgressBar/Ring`, `EnvelopeProgress`, `StatusBanner`, `FeedbackNotice`, `VoiceButton`, `Composer`, `LogoTile`.
Организмы: `Card`/`PastelCard`/`PlainCard`, `StatTile`, `MetricCard`, `EvidenceCard`, `CashChart`, `ListGroup`, `Sheet`/`Dialog`/`TaskSheet`, `StateView`/`EmptyState`/`ErrorState`, `PageHeader`, `Section`, `AppHeader`, `TabBar`, `Sidebar`, `FAB`, `BusinessSwitcher`.
Тосты: `Toaster` + `toast()` из sonner.

`components/shared/*` — тонкие реэкспорты для старых импортов; новые экраны импортируют из `@/components/ui`.
