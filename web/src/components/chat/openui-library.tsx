"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createLibrary, defineComponent, type ElementNode } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { Minus, Plus } from "lucide-react";
import {
  Button,
  Card,
  CashChart as KitCashChart,
  EvidenceCard as KitEvidenceCard,
  IconButton,
  Input,
  ListGroup,
  ListRow,
  Money,
  MoneyInput,
  PastelCard,
  ProgressBar,
  SegmentedControl,
  StatusBanner,
  Text,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { evaluate, parseFormula, type Expr } from "./formula";
import { useChatT } from "./chat-t";

/*
 * Библиотека OpenUI поверх кита. Порядок аргументов — контракт с backend/ai/ui.py (COMPONENTS):
 * сервер проверяет и заземляет ту же сигнатуру, клиент лишь рисует.
 */

// ── контексты ─────────────────────────────────────────────────────────────

/** Кнопки Actions отправляют подсказку обратно в чат. */
export const AskContext = createContext<((prompt: string) => void) | null>(null);

/** Сохранённые значения полей калькулятора (страница инструмента); без провайдера — локальное состояние. */
export const ToolValuesContext = createContext<{ values: Record<string, number>; onChange: (values: Record<string, number>) => void } | null>(null);

interface CalcState {
  values: Record<string, number>;
  set: (name: string, value: number) => void;
}
const CalcContext = createContext<CalcState | null>(null);

function useCalc(): CalcState {
  const v = useContext(CalcContext);
  return v ?? { values: {}, set: () => undefined };
}

function useMoneyLocale() {
  const { locale } = useI18n();
  return locale as "ru" | "uz" | "en";
}

const asNodes = (v: unknown): ElementNode[] => (Array.isArray(v) ? (v as ElementNode[]).filter((n) => n && typeof n === "object" && "props" in n) : []);

// ── отображение ──────────────────────────────────────────────────────────

const TextBlock = defineComponent({
  name: "TextBlock",
  description: "Paragraph of text. variant: body | title | muted.",
  props: z.object({ text: z.string(), variant: z.enum(["body", "title", "muted"]).optional() }),
  component: ({ props }) => (
    <Text
      variant={props.variant === "title" ? "section" : "body"}
      weight={props.variant === "title" ? "semibold" : "regular"}
      tone={props.variant === "muted" ? "muted" : "default"}
      className="whitespace-pre-line"
    >
      {props.text}
    </Text>
  ),
});

const StatCard = defineComponent({
  name: "StatCard",
  description: "Single key amount in minor units with a label.",
  props: z.object({
    label: z.string(),
    amount: z.number(),
    hint: z.string().optional(),
    tone: z.enum(["butter", "mint", "lavender", "peach", "sky", "rose"]).optional(),
  }),
  component: function StatCardView({ props }) {
    const locale = useMoneyLocale();
    return (
      <PastelCard tone={props.tone ?? "lavender"}>
        <Text variant="secondary" tone="muted">
          {props.label}
        </Text>
        <Text as="div" variant="page" weight="semibold">
          <Money value={props.amount} locale={locale} mode="compact" />
        </Text>
        {props.hint && (
          <Text variant="secondary" tone="muted">
            {props.hint}
          </Text>
        )}
      </PastelCard>
    );
  },
});

const EvidenceItem = defineComponent({
  name: "EvidenceItem",
  description: "One operation backing a claim.",
  props: z.object({ label: z.string(), date: z.string(), amount: z.number() }),
  component: () => null,
});

const EvidenceCard = defineComponent({
  name: "EvidenceCard",
  description: "A claim with the operations that support it.",
  props: z.object({ claim: z.string(), items: z.array(EvidenceItem.ref), source: z.string().optional() }),
  component: ({ props }) => {
    const items = asNodes(props.items).map((n, i) => ({
      id: String(i),
      label: String(n.props.label ?? ""),
      date: String(n.props.date ?? ""),
      amount: Number(n.props.amount ?? 0),
    }));
    return <KitEvidenceCard claim={props.claim} items={items} source={props.source} />;
  },
});

const ListItem = defineComponent({
  name: "ListItem",
  description: "Row with title, optional amount and subtitle.",
  props: z.object({ title: z.string(), amount: z.number().optional(), subtitle: z.string().optional() }),
  component: function ListItemView({ props }) {
    const locale = useMoneyLocale();
    return (
      <ListRow
        title={props.title}
        subtitle={props.subtitle}
        trailing={props.amount == null ? undefined : <Money value={props.amount} locale={locale} />}
      />
    );
  },
});

const List = defineComponent({
  name: "List",
  description: "Grouped rows.",
  props: z.object({ items: z.array(ListItem.ref), title: z.string().optional() }),
  component: ({ props, renderNode }) => <ListGroup header={props.title}>{renderNode(props.items)}</ListGroup>,
});

const Table = defineComponent({
  name: "Table",
  description: "Small table: column headers and rows of string or number cells.",
  props: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.union([z.string(), z.number()]))) }),
  component: ({ props }) => (
    // В ките нет Table: семантическая таблица с ячейками Text, прокрутка по ширине на 375px.
    <Card className="overflow-x-auto p-0">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {props.columns.map((c, i) => (
              <th key={i} scope="col" className="border-b border-border px-3 py-2 text-left">
                <Text as="span" variant="caption" tone="muted" weight="medium">
                  {c}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, r) => (
            <tr key={r} className="border-b border-border last:border-0">
              {row.map((cell, c) => (
                <td key={c} className={typeof cell === "number" ? "px-3 py-2 text-right tabular-nums" : "px-3 py-2"}>
                  <Text as="span" variant="secondary">
                    {typeof cell === "number" ? cell.toLocaleString("ru-RU") : cell}
                  </Text>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  ),
});

const CashChart = defineComponent({
  name: "CashChart",
  description: "Line of balance over time: labels (dates) and values in minor units.",
  props: z.object({ title: z.string(), labels: z.array(z.string()), values: z.array(z.number()) }),
  component: ({ props }) => {
    const points = props.labels.slice(0, props.values.length).map((date, i) => ({ date, actual: props.values[i] }));
    return (
      <Card title={props.title}>
        <KitCashChart points={points} label={props.title} height={180} />
      </Card>
    );
  },
});

const Progress = defineComponent({
  name: "Progress",
  description: "Progress toward a target amount.",
  props: z.object({ label: z.string(), value: z.number(), max: z.number() }),
  component: function ProgressView({ props }) {
    const locale = useMoneyLocale();
    const pct = props.max > 0 ? Math.max(0, Math.min(100, (props.value / props.max) * 100)) : 0;
    return (
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <Text variant="secondary" weight="medium">
            {props.label}
          </Text>
          <Text as="span" variant="secondary" tone="muted">
            <Money value={props.value} locale={locale} mode="compact" /> / <Money value={props.max} locale={locale} mode="compact" />
          </Text>
        </div>
        <ProgressBar value={pct} label={props.label} className="mt-2" />
      </Card>
    );
  },
});

const Callout = defineComponent({
  name: "Callout",
  description: "Highlighted note. kind: info | success | warning | error.",
  props: z.object({ title: z.string(), text: z.string().optional(), kind: z.enum(["info", "success", "warning", "error"]).optional() }),
  component: ({ props }) => (
    <StatusBanner kind={props.kind ?? "info"} title={props.title}>
      {props.text}
    </StatusBanner>
  ),
});

const ActionButton = defineComponent({
  name: "ActionButton",
  description: "Follow-up question the user can tap.",
  props: z.object({ label: z.string(), prompt: z.string() }),
  component: function ActionButtonView({ props }) {
    const ask = useContext(AskContext);
    return (
      <Button variant="secondary" size="sm" disabled={!ask} onClick={() => ask?.(props.prompt)}>
        {props.label}
      </Button>
    );
  },
});

const Actions = defineComponent({
  name: "Actions",
  description: "Row of follow-up buttons.",
  props: z.object({ buttons: z.array(ActionButton.ref) }),
  component: ({ props, renderNode }) => <div className="flex flex-wrap gap-2">{renderNode(props.buttons)}</div>,
});

// ── калькулятор ──────────────────────────────────────────────────────────

const MoneyField = defineComponent({
  name: "MoneyField",
  description: "Money input in minor units.",
  props: z.object({ name: z.string(), label: z.string(), value: z.number() }),
  component: function MoneyFieldView({ props }) {
    const calc = useCalc();
    const locale = useMoneyLocale();
    return (
      <MoneyInput
        label={props.label}
        currency="UZS"
        locale={locale}
        value={calc.values[props.name] ?? props.value}
        onValueChange={(v) => calc.set(props.name, v ?? 0)}
      />
    );
  },
});

const NumberField = defineComponent({
  name: "NumberField",
  description: "Plain number input with optional unit.",
  props: z.object({ name: z.string(), label: z.string(), value: z.number(), unit: z.string().optional() }),
  component: function NumberFieldView({ props }) {
    const calc = useCalc();
    const value = calc.values[props.name] ?? props.value;
    return (
      <Input
        type="number"
        inputMode="decimal"
        label={props.label}
        value={Number.isFinite(value) ? value : ""}
        trailing={props.unit ? <Text as="span" variant="secondary" tone="muted">{props.unit}</Text> : undefined}
        onChange={(e) => {
          const n = Number(e.target.value);
          calc.set(props.name, e.target.value === "" || !Number.isFinite(n) ? 0 : n);
        }}
      />
    );
  },
});

const SliderField = defineComponent({
  name: "SliderField",
  description: "Bounded number with step buttons.",
  props: z.object({ name: z.string(), label: z.string(), value: z.number(), min: z.number(), max: z.number(), step: z.number().optional() }),
  component: function SliderFieldView({ props }) {
    // В ките нет Slider: −/+ IconButton вокруг числового Input, значение зажато в [min, max].
    const calc = useCalc();
    const t = useChatT();
    const step = props.step && props.step > 0 ? props.step : 1;
    const value = calc.values[props.name] ?? props.value;
    const set = (v: number) => calc.set(props.name, Math.max(props.min, Math.min(props.max, Math.round(v / step) * step)));
    return (
      <div className="flex items-end gap-2">
        <IconButton icon={Minus} label={t("chat.ui.decrease")} variant="secondary" disabled={value <= props.min} onClick={() => set(value - step)} />
        <Input
          type="number"
          inputMode="decimal"
          className="flex-1"
          label={props.label}
          min={props.min}
          max={props.max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(n)) calc.set(props.name, Math.max(props.min, Math.min(props.max, n)));
          }}
        />
        <IconButton icon={Plus} label={t("chat.ui.increase")} variant="secondary" disabled={value >= props.max} onClick={() => set(value + step)} />
      </div>
    );
  },
});

const ChoiceField = defineComponent({
  name: "ChoiceField",
  description: "Pick one option; each option maps to a number.",
  props: z.object({ name: z.string(), label: z.string(), options: z.array(z.string()), values: z.array(z.number()), value: z.number() }),
  component: function ChoiceFieldView({ props }) {
    const calc = useCalc();
    const current = calc.values[props.name] ?? props.value;
    const index = Math.max(0, props.values.indexOf(current));
    return (
      <SegmentedControl
        label={props.label}
        options={props.options.map((label, i) => ({ value: String(i), label }))}
        value={String(index)}
        onValueChange={(v) => calc.set(props.name, props.values[Number(v)] ?? props.value)}
      />
    );
  },
});

type OutputFormat = "money" | "number" | "percent" | "days" | "months";

function OutputValue({ value, format }: { value: number | null; format: OutputFormat }) {
  const t = useChatT();
  const locale = useMoneyLocale();
  if (value === null) return <Text as="span" tone="muted">{t("chat.ui.noData")}</Text>;
  if (format === "money") return <Money value={Math.round(value)} locale={locale} />;
  const n = Math.round(value * 100) / 100;
  if (format === "percent") return <>{`${n.toLocaleString(locale)}\u00a0%`}</>;
  if (format === "days") return <>{t("chat.ui.days", { count: Math.round(value) })}</>;
  if (format === "months") return <>{t("chat.ui.months", { count: Math.round(value) })}</>;
  return <>{n.toLocaleString(locale)}</>;
}

const Output = defineComponent({
  name: "Output",
  description: "Computed result: formula over input names with + - * / ( ) min max round.",
  props: z.object({ label: z.string(), formula: z.string(), format: z.enum(["money", "number", "percent", "days", "months"]).optional() }),
  component: function OutputView({ props }) {
    const calc = useCalc();
    const tree = useMemo<Expr | null>(() => {
      try {
        return parseFormula(props.formula);
      } catch {
        return null;
      }
    }, [props.formula]);
    const value = tree ? evaluate(tree, calc.values) : null;
    return (
      <ListRow
        title={props.label}
        trailing={
          <Text as="span" weight="semibold" className="tabular-nums">
            <OutputValue value={value} format={props.format ?? "number"} />
          </Text>
        }
      />
    );
  },
});

function defaults(inputs: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of asNodes(inputs)) {
    const name = n.props.name;
    const value = Number(n.props.value);
    if (typeof name === "string" && Number.isFinite(value)) out[name] = value;
  }
  return out;
}

function CalculatorBody({ inputs, children }: { inputs: unknown; children: ReactNode }) {
  const external = useContext(ToolValuesContext);
  const base = useMemo(() => defaults(inputs), [inputs]);
  const [local, setLocal] = useState<Record<string, number>>({});
  const overrides = external ? external.values : local;
  // Только известные поля: сохранённые значения от старой версии спеки не просачиваются в формулы.
  const values = useMemo(() => {
    const merged = { ...base };
    for (const k of Object.keys(base)) if (Number.isFinite(overrides[k])) merged[k] = overrides[k];
    return merged;
  }, [base, overrides]);
  const state = useMemo<CalcState>(
    () => ({
      values,
      set: (name, value) => {
        const next = { ...values, [name]: value };
        if (external) external.onChange(next);
        else setLocal(next);
      },
    }),
    [values, external],
  );
  return <CalcContext.Provider value={state}>{children}</CalcContext.Provider>;
}

const Calculator = defineComponent({
  name: "Calculator",
  description: "Interactive calculator: inputs and live outputs.",
  props: z.object({
    title: z.string(),
    inputs: z.array(z.union([MoneyField.ref, NumberField.ref, SliderField.ref, ChoiceField.ref])),
    outputs: z.array(Output.ref),
    note: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <Card title={props.title} description={props.note}>
      <CalculatorBody inputs={props.inputs}>
        <div className="grid gap-3 sm:grid-cols-2">{renderNode(props.inputs)}</div>
        <ListGroup className="mt-4">{renderNode(props.outputs)}</ListGroup>
      </CalculatorBody>
    </Card>
  ),
});

const Stack = defineComponent({
  name: "Stack",
  description: "Vertical stack of blocks; always the root.",
  props: z.object({
    children: z.array(
      z.union([
        TextBlock.ref,
        StatCard.ref,
        EvidenceCard.ref,
        List.ref,
        Table.ref,
        CashChart.ref,
        Progress.ref,
        Callout.ref,
        Actions.ref,
        Calculator.ref,
      ]),
    ),
  }),
  component: ({ props, renderNode }) => <div className="flex flex-col gap-3">{renderNode(props.children)}</div>,
});

export const oydinLibrary = createLibrary({
  root: "Stack",
  components: [
    Stack,
    TextBlock,
    StatCard,
    EvidenceCard,
    EvidenceItem,
    List,
    ListItem,
    Table,
    CashChart,
    Progress,
    Callout,
    Actions,
    ActionButton,
    Calculator,
    MoneyField,
    NumberField,
    SliderField,
    ChoiceField,
    Output,
  ],
});
