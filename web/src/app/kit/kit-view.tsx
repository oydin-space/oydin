"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BarChart3, Home, MessageCircle, Settings, Trash2, Wallet } from "lucide-react";
import {
  AmountText, AppHeader, Avatar, Badge, BusinessSwitcher, Button, CashChart, Card, Checkbox, ChoiceControl, Chip, Composer, DateChip,
  Dialog, EmptyState, EnvelopeProgress, ErrorState, EvidenceCard, FAB, FeedbackNotice, FilterBar, IconButton, Input, ListGroup, ListRow,
  LogoTile, MetricCard, MoneyInput, OtpInput, PageHeader, PastelCard, ProgressBar, ProgressRing, RadioGroup, RadioItem, Section,
  SegmentedControl, Select, Sheet, Sidebar, Skeleton, SkeletonCard, SkeletonChart, SkeletonList, SkeletonText, Sparkline, Spinner,
  StateView, StatTile, StatusBanner, Switch, TabBar, Tabs, TabsContent, TabsList, TabsTrigger, TaskSheet, Text, Textarea, Toaster,
  Tooltip, TooltipProvider, VoiceButton, type VoiceState,
} from "@/components/ui";

const NAV = [
  { href: "#home", label: "Главная", icon: Home, active: true },
  { href: "#money", label: "Деньги", icon: Wallet },
  { href: "#chat", label: "Чат", icon: MessageCircle },
  { href: "#more", label: "Ещё", icon: Settings },
];

const PASTELS = ["butter", "mint", "lavender", "peach", "sky", "rose"] as const;
const POINTS = [
  { date: "01.06", actual: 4_000_000_00 }, { date: "08.06", actual: 3_200_000_00 }, { date: "15.06", actual: 3_900_000_00, forecast: 3_900_000_00 },
  { date: "22.06", forecast: 2_100_000_00 }, { date: "29.06", forecast: -300_000_00 },
];

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Section title={title} className="scroll-mt-16 border-t border-border pt-6">
      <div id={id} className="flex flex-col gap-4">{children}</div>
    </Section>
  );
}

export function KitView() {
  const [dark, setDark] = useState(false);
  const [amount, setAmount] = useState<number | null>(3_000_000_00);
  const [seg, setSeg] = useState("week");
  const [filter, setFilter] = useState("all");
  const [otp, setOtp] = useState("12");
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<VoiceState>("idle");
  const [sheet, setSheet] = useState(false);
  const [task, setTask] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [sel, setSel] = useState<string | undefined>();
  const [sw, setSw] = useState(true);
  const [chk, setChk] = useState(false);
  const [state, setState] = useState<"loading" | "error" | "empty" | "ready">("ready");

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
  };

  return (
    <TooltipProvider>
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 pb-28 md:pb-12">
        <AppHeader title="Oydin UI kit" trailing={<Button size="sm" variant="secondary" onClick={toggle}>{dark ? "Светлая тема" : "Тёмная тема"}</Button>} />
        <PageHeader title="UI kit" hint="Все компоненты во всех состояниях. Экраны собираются только из них." />

        <Block id="type" title="Текст и деньги">
          <Text variant="hero">Hero 34/40</Text><Text variant="page" weight="bold">Page 28/34</Text><Text variant="section">Section 20/28</Text>
          <Text>Body 17/24</Text><Text variant="secondary" tone="muted">Secondary 14/20</Text><Text variant="caption" tone="muted">Caption 12/16</Text>
          <div className="flex flex-wrap gap-4">
            <AmountText value={1_250_000_00} /><AmountText value={-480_000_00} signed tone="auto" /><AmountText value={3_200_000_000_00} mode="compact" />
            <AmountText value={12_345_00} currency="USD" /><AmountText value={null} missingReason="Нет данных за период" />
          </div>
        </Block>

        <Block id="buttons" title="Кнопки">
          <div className="flex flex-wrap gap-2">
            <Button>Основная</Button><Button variant="secondary">Вторичная</Button><Button variant="ghost">Текстовая</Button>
            <Button variant="destructive" icon={Trash2}>Удалить</Button><Button loading>Сохраняем</Button><Button disabled>Недоступна</Button>
            <Button size="sm">Малая</Button><Button size="lg">Крупная</Button>
          </div>
          <div className="flex gap-2"><Tooltip content="Настройки"><IconButton label="Настройки" icon={Settings} /></Tooltip><IconButton label="Статистика" icon={BarChart3} pressed /></div>
          <div className="flex items-center gap-4"><Spinner variant="logo" label="Загрузка" /><Spinner variant="ring" size={24} label="Загрузка" /></div>
        </Block>

        <Block id="inputs" title="Поля">
          <Input label="Название" placeholder="Кофейня на Чиланзаре" hint="Как увидят сотрудники" />
          <Input label="Email" type="email" defaultValue="oops" error="Похоже на опечатку: добавьте @ и домен" />
          <Input label="Поиск" type="search" disabled defaultValue="Недоступно" />
          <Textarea label="Комментарий" placeholder="Необязательно" />
          <MoneyInput label="Сумма" value={amount} onValueChange={setAmount} currency="UZS" hint="Можно писать «3 млн» или «500к»" />
          <MoneyInput label="Сумма в долларах" value={null} onValueChange={() => {}} currency="USD" error="Введите сумму больше нуля" />
          <Select label="Категория" value={sel} onValueChange={setSel} placeholder="Выберите" options={[{ value: "rent", label: "Аренда" }, { value: "stock", label: "Закупки" }, { value: "pay", label: "Зарплаты" }]} />
          <SegmentedControl label="Период" value={seg} onValueChange={setSeg} options={[{ value: "week", label: "Неделя" }, { value: "month", label: "Месяц" }, { value: "year", label: "Год" }]} />
          <ChoiceControl kind="switch" label="Напоминать о платежах" description="Раз в день утром" checked={sw} onCheckedChange={setSw} />
          <ChoiceControl kind="checkbox" label="Не целевая операция" checked={chk} onCheckedChange={setChk} />
          <RadioGroup defaultValue="a"><ChoiceControl kind="radio" label="Каждую неделю" value="a" /><ChoiceControl kind="radio" label="Раз в месяц" value="b" /><ChoiceControl kind="radio" label="Недоступно" value="c" disabled /></RadioGroup>
          <div className="flex gap-4"><Switch aria-label="Пример" /><Checkbox aria-label="Пример" /><RadioGroup><RadioItem value="x" aria-label="Пример" /></RadioGroup></div>
          <OtpInput value={otp} onValueChange={setOtp} />
          <OtpInput value="123" onValueChange={() => {}} error="Код не подошёл. Осталось 3 попытки" />
        </Block>

        <Block id="status" title="Статусы, чипы, прогресс">
          <div className="flex flex-wrap gap-2"><Badge>Нейтрально</Badge><Badge tone="positive">Оплачено</Badge><Badge tone="caution">Скоро срок</Badge><Badge tone="negative">Просрочено</Badge><Badge tone="coming-soon">Скоро</Badge></div>
          <div className="flex flex-wrap gap-2"><Chip selected>Выбран</Chip><Chip onSelect={() => {}}>Не выбран</Chip><Chip onRemove={() => {}}>Аренда</Chip></div>
          <FilterBar label="Фильтр" value={filter} onValueChange={setFilter} options={[{ value: "all", label: "Все" }, { value: "in", label: "Доходы" }, { value: "out", label: "Расходы" }]} />
          <div className="flex items-center gap-4"><DateChip date="2026-06-15" label="Срок" /><Avatar name="Алия Каримова" /><Avatar name="Bob" size={32} /></div>
          <ProgressBar value={0.4} label="Загрузка файла" /><ProgressRing value={0.65} label="Готовность" />
          <EnvelopeProgress label="Резерв на налоги" saved={4_200_000_00} target={10_000_000_00} />
          <StatusBanner kind="info" title="Курс обновлён">Источник: ЦБ Узбекистана</StatusBanner>
          <StatusBanner kind="success" title="Импорт завершён" /><StatusBanner kind="warning" title="Курс устарел" /><StatusBanner kind="error" title="Не удалось подключить">Проверьте ключ</StatusBanner>
          <FeedbackNotice>Сохранено в 14:32</FeedbackNotice><FeedbackNotice kind="error">Не сохранено</FeedbackNotice>
        </Block>

        <Block id="cards" title="Карточки">
          <div className="grid grid-cols-2 gap-2">{PASTELS.map((t) => <PastelCard key={t} tone={t}><Text variant="secondary">{t}</Text></PastelCard>)}</div>
          <Card title="Простая карточка" description="Плоская рамка, без тени" footer="Подвал">Содержимое</Card>
          <div className="grid grid-cols-2 gap-2"><StatTile label="Выручка" value={12_400_000_00} delta={800_000_00} deltaLabel="к прошлой неделе" trend={[3, 4, 3, 6, 7, 6, 9]} /><StatTile tint="peach" label="Расходы" value={null} /></div>
          <MetricCard label="Касса сегодня" value={4_200_000_00} period="на 15 июня" explanation="Остаток на счетах минус обязательные платежи." source="Счета: Kapital, касса" updatedAt="обновлено 14:30" onDetails={() => toast("Разбор расчёта")} tint="butter" />
          <Sparkline values={[1, 3, 2, 5, 4, 7]} color="var(--sky-deep)" className="w-full" />
          <EvidenceCard claim="Касса может уйти в минус 29 июня" confidence={{ label: "Средняя уверенность", tone: "caution" }} source="Основано на 3 операциях" items={[{ id: "1", label: "Аренда", date: "2026-06-25", amount: -3_000_000_00 }, { id: "2", label: "Поставщик А", date: "2026-06-27", amount: -1_200_000_00 }]} />
          <CashChart label="Динамика денег за июнь, прогноз пунктиром" points={POINTS} />
        </Block>

        <Block id="lists" title="Списки и интеграции">
          <ListGroup header="Операции" footer="Сегодня">
            <ListRow title="Аренда" subtitle="Расход · 15 июня" trailing={<AmountText value={-3_000_000_00} signed />} onClick={() => {}} />
            <ListRow title="Выручка" subtitle="Доход" trailing={<AmountText value={1_500_000_00} signed />} status={<Badge tone="positive">Подтверждено</Badge>} chevron />
            <ListRow title="Без действия" />
          </ListGroup>
          <div className="grid gap-2 md:grid-cols-2">
            <LogoTile logo="telegram" name="Telegram" description="Бот и дайджест" status="connected" onClick={() => {}} />
            <LogoTile logo="google-sheets" name="Google Sheets" description="Экспорт таблиц" status="available" onClick={() => {}} />
            <LogoTile logo="csv" name="CSV / Excel" description="Импорт и экспорт" status="available" onClick={() => {}} />
            <LogoTile logo="1c" name="1С" description="Файл 1CClientBankExchange" status="available" onClick={() => {}} />
            <LogoTile logo="api" name="REST API" status="available" />
            <LogoTile logo="webhooks" name="Webhooks" status="available" />
            <LogoTile logo="payme" name="Payme" status="coming-soon" />
            <LogoTile logo="click" name="Click" status="coming-soon" />
            <LogoTile logo="uzum" name="Uzum" status="coming-soon" />
            <LogoTile logo="moysklad" name="Мой склад" status="coming-soon" />
            <LogoTile logo="billz" name="Billz" status="coming-soon" />
            <LogoTile logo="didox" name="Didox" status="coming-soon" />
            <LogoTile logo="faktura" name="Faktura" status="coming-soon" />
            <LogoTile logo="hamkorbank" name="Hamkorbank" status="coming-soon" />
            <LogoTile logo="kapitalbank" name="Kapitalbank" status="coming-soon" />
            <LogoTile logo="tbc" name="TBC" status="coming-soon" />
          </div>
        </Block>

        <Block id="states" title="Состояния данных">
          <SegmentedControl label="Состояние" value={state} onValueChange={setState} options={[{ value: "loading", label: "Загрузка" }, { value: "error", label: "Ошибка" }, { value: "empty", label: "Пусто" }]} />
          <Button size="sm" variant="ghost" onClick={() => setState("ready")}>Показать готово</Button>
          <StateView status={state} error="нет сети" onRetry={() => setState("loading")} empty={{ title: "Операций пока нет", hint: "Добавьте первую голосом", action: <Button size="sm">Добавить</Button> }}><Card>Данные загружены</Card></StateView>
          <ErrorState message="сервер не отвечает" onRetry={() => {}} /><EmptyState title="Ничего не найдено" hint="Измените фильтр" />
          <div aria-busy="true" className="flex flex-col gap-3"><Skeleton className="h-6 w-1/2" /><SkeletonText /><SkeletonList rows={2} /><SkeletonCard /><SkeletonChart /></div>
        </Block>

        <Block id="overlays" title="Слои, вкладки, голос">
          <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setSheet(true)}>Лист</Button><Button variant="secondary" onClick={() => setTask(true)}>Задача</Button><Button variant="secondary" onClick={() => setDialog(true)}>Диалог</Button><Button variant="secondary" onClick={() => toast.success("Операция сохранена")}>Тост</Button></div>
          <Sheet open={sheet} onOpenChange={setSheet} title="Выбор организации" description="Переключение не теряет данные">Содержимое листа</Sheet>
          <TaskSheet open={task} onOpenChange={setTask} title="Новая операция" dirty submitLabel="Сохранить" onSubmit={() => setTask(false)}><MoneyInput label="Сумма" value={amount} onValueChange={setAmount} currency="UZS" /></TaskSheet>
          <Dialog open={dialog} onOpenChange={setDialog} title="Удалить операцию?" description="Это действие нельзя отменить" footer={<Button variant="destructive" className="flex-1" onClick={() => setDialog(false)}>Удалить</Button>} />
          <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">Операции</TabsTrigger><TabsTrigger value="b">Обязательства</TabsTrigger></TabsList><TabsContent value="a" className="py-3">Первая вкладка</TabsContent><TabsContent value="b" className="py-3">Вторая вкладка</TabsContent></Tabs>
          <div className="flex items-center gap-4">{(["idle", "recording", "processing", "disabled"] as const).map((s) => <VoiceButton key={s} state={s} onPress={() => setVoice(voice === "recording" ? "idle" : "recording")} />)}</div>
          <Composer value={text} onValueChange={setText} onSend={() => setText("")} voice={voice} onVoice={() => setVoice(voice === "recording" ? "processing" : "recording")} />
        </Block>

        <Block id="nav" title="Навигация">
          <BusinessSwitcher name="Кофейня Чиланзар" role="Владелец" onClick={() => setSheet(true)} />
          <div className="hidden md:block"><Sidebar items={NAV} header={<Text variant="section">Oydin</Text>} className="flex w-full rounded-card border" /></div>
          <Text variant="secondary" tone="muted">На телефоне внизу — TabBar (4 пункта) и FAB.</Text>
        </Block>

        <TabBar items={NAV} />
        <FAB label="Добавить операцию" onClick={() => setTask(true)} />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
