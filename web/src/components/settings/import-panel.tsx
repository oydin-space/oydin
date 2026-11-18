"use client";

import { Check, CircleAlert, CircleCheck, Columns3, Copy, FileSpreadsheet, FileText, FileUp, ListChecks, RotateCcw, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { AmountText, Badge, Button, ChoiceControl, FeedbackNotice, Icon, ListGroup, ListRow, PlainCard, Select, SkeletonList, StatusBanner } from "@/components/ui";
import {
  commitImport,
  type ImportJob,
  type ImportRow,
  listAccounts,
  MAPPING_FIELDS,
  MAX_UPLOAD_BYTES,
  type MappingField,
  patchImport,
  uploadImport,
} from "@/lib/settings-api";
import { useResource } from "./use-resource";
import { useST } from "./use-st";

const FIXED_KINDS: ImportJob["kind"][] = ["1c_bank", "commerceml"];
const isField = (v: string): v is MappingField => MAPPING_FIELDS.some((f) => f === v);

function PreviewRow({ row }: { row: ImportRow }) {
  const { t, locale, formatDate } = useST();
  const bad = row.errors.length > 0;
  const fields = row.errors.map((f) => (isField(f) ? t(`settings.field.${f}`) : f)).join(", ");
  return (
    <ListRow
      title={row.draft.counterparty || t("settings.import.noCounterparty")}
      leading={<Icon icon={bad ? CircleAlert : row.duplicate ? Copy : CircleCheck} size={20} className="text-muted-foreground" />}
      subtitle={bad ? t("settings.import.rowErrIn", { fields }) : [row.draft.date ? formatDate(row.draft.date) : null, row.draft.category].filter(Boolean).join(" · ")}
      status={
        <Badge tone={bad ? "negative" : row.duplicate ? "caution" : "positive"}>
          {bad ? t("settings.import.rowErr") : row.duplicate ? t("settings.import.rowDup") : t("settings.import.rowOk")}
        </Badge>
      }
      trailing={row.draft.amount == null ? undefined : <AmountText value={row.draft.direction === "out" ? -row.draft.amount : row.draft.amount} locale={locale} signed tone="auto" />}
    />
  );
}

export function ImportPanel() {
  const { t, err } = useST();
  const accounts = useResource(listAccounts);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState("");
  const [job, setJob] = useState<ImportJob | null>(null);
  const [mapping, setMapping] = useState<Record<string, MappingField>>({});
  const [skipDup, setSkipDup] = useState(true);
  const [busy, setBusy] = useState<"upload" | "map" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const tooBig = !!file && file.size > MAX_UPLOAD_BYTES;

  async function run<T>(kind: NonNullable<typeof busy>, action: () => Promise<T>): Promise<T | null> {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      return await action();
    } catch (x) {
      setError(err(x));
      return null;
    } finally {
      setBusy(null);
    }
  }

  function accept(next: ImportJob) {
    setJob(next);
    setMapping(next.mapping);
  }

  async function upload() {
    if (!file || tooBig) return;
    const next = await run("upload", () => uploadImport(file, accountId ? Number(accountId) : undefined));
    if (next) accept(next);
  }

  async function applyMapping() {
    if (!job) return;
    const next = await run("map", () => patchImport(job.id, { mapping }));
    if (next) {
      accept(next);
      setNotice(t("settings.import.mappingApplied"));
    }
  }

  async function commit() {
    if (!job) return;
    const next = await run("commit", () => commitImport(job.id, skipDup));
    if (next) setJob(next);
  }

  function reset() {
    setJob(null);
    setFile(null);
    setError(null);
    setNotice(null);
  }

  if (job?.status === "committed") {
    return (
      <StatusBanner kind="success" title={t("settings.import.done", { count: job.created_count })} action={<Button size="sm" variant="secondary" icon={RotateCcw} onClick={reset}>{t("settings.import.again")}</Button>}>
        {t("settings.import.doneHint")}
      </StatusBanner>
    );
  }

  if (!job) {
    return (
      <PlainCard title={<span className="inline-flex items-center gap-2"><Icon icon={FileSpreadsheet} size={20} />{t("settings.import.title")}</span>} description={t("settings.import.formats")}>
        <div className="flex flex-col gap-3">
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            accept=".csv,.xlsx,.txt,.xml"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex min-w-0 flex-col items-start gap-2">
            <Button variant="secondary" icon={FileUp} onClick={() => fileInput.current?.click()}>
              {t("settings.import.pick")}
            </Button>
            <p className="min-w-0 max-w-full break-words text-small text-muted-foreground">{file ? file.name : t("settings.import.limit")}</p>
            {tooBig ? <FeedbackNotice kind="error">{t("settings.import.tooBig")}</FeedbackNotice> : null}
          </div>
          {accounts.data && accounts.data.length > 0 ? (
            <Select
              label={t("settings.import.account")}
              value={accountId}
              onValueChange={setAccountId}
              placeholder={t("settings.import.accountAuto")}
              options={accounts.data.map((a) => ({ value: String(a.id), label: a.name }))}
            />
          ) : null}
          {error ? <FeedbackNotice kind="error">{error}</FeedbackNotice> : null}
          <div>
            <Button icon={Upload} loading={busy === "upload"} disabled={!file || tooBig} onClick={upload}>
              {busy === "upload" ? t("settings.import.uploading") : t("settings.import.upload")}
            </Button>
          </div>
        </div>
      </PlainCard>
    );
  }

  const fixed = FIXED_KINDS.includes(job.kind);
  const options = MAPPING_FIELDS.map((f) => ({ value: f, label: t(`settings.field.${f}`) }));

  return (
    <div className="flex flex-col gap-4">
      <PlainCard title={<span className="inline-flex items-center gap-2"><Icon icon={FileText} size={20} />{t("settings.import.file", { name: job.filename })}</span>} description={t("settings.import.rows", { count: job.total_rows })}>
        {fixed ? (
          <p className="text-small text-muted-foreground">{t("settings.import.fixedFormat")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-small text-muted-foreground">{t("settings.import.mappingHint")}</p>
            <Badge tone={job.mapping_confidence >= 0.7 ? "positive" : "caution"}>{job.mapping_confidence >= 0.7 ? t("settings.import.confidenceHigh") : t("settings.import.confidenceLow")}</Badge>
            <div className="grid gap-3 sm:grid-cols-2">
              {job.columns.map((c) => (
                <Select
                  key={c}
                  label={c}
                  value={mapping[c] ?? "skip"}
                  onValueChange={(v) => setMapping((m) => ({ ...m, [c]: isField(v) ? v : "skip" }))}
                  options={options}
                />
              ))}
            </div>
            <div>
              <Button variant="secondary" icon={Columns3} loading={busy === "map"} onClick={applyMapping}>
                {t("settings.import.applyMapping")}
              </Button>
            </div>
          </div>
        )}
      </PlainCard>

      <section className="flex flex-col gap-2" aria-labelledby="imp-prev">
        <h2 id="imp-prev" className="flex items-center gap-2 text-title font-semibold"><Icon icon={ListChecks} size={20} />{t("settings.import.previewTitle")}</h2>
        <p className="text-small text-muted-foreground">{t("settings.import.previewNote")}</p>
        {busy === "map" ? (
          <SkeletonList rows={3} />
        ) : (
          <ListGroup>
            {job.preview.map((r) => (
              <PreviewRow key={r.row} row={r} />
            ))}
          </ListGroup>
        )}
      </section>

      <ChoiceControl kind="switch" label={t("settings.import.skipDup")} description={t("settings.import.skipDupHint")} checked={skipDup} onCheckedChange={setSkipDup} />
      {notice ? <FeedbackNotice>{notice}</FeedbackNotice> : null}
      {error ? <FeedbackNotice kind="error">{error}</FeedbackNotice> : null}
      <div className="flex flex-wrap gap-2">
        <Button icon={Check} loading={busy === "commit"} onClick={commit}>
          {t("settings.import.commit")}
        </Button>
        <Button variant="ghost" icon={X} onClick={reset}>
          {t("settings.common.cancel")}
        </Button>
      </div>
    </div>
  );
}
