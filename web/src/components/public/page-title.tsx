/** Заголовок публичной страницы (в PageHeader липкая плашка не нужна). */
export function PublicTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-hero font-bold tracking-tight">{title}</h1>
      {hint ? <p className="mt-2 max-w-2xl text-body text-muted-foreground">{hint}</p> : null}
    </header>
  );
}
