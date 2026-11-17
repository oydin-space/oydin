import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Плагины и компоненты вынесены на уровень модуля, чтобы таблицы не пересоздавались при каждом рендере.
const PLUGINS = [remarkGfm];
const COMPONENTS = {
  table: (p: React.ComponentProps<"table">) => (
    <div className="my-2 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm" {...p} />
    </div>
  ),
  th: (p: React.ComponentProps<"th">) => <th className="bg-muted px-3 py-1.5 text-left font-medium" {...p} />,
  td: (p: React.ComponentProps<"td">) => <td className="border-t border-border px-3 py-1.5" {...p} />,
  a: (p: React.ComponentProps<"a">) => <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...p} />,
  ul: (p: React.ComponentProps<"ul">) => <ul className="my-1.5 list-disc space-y-0.5 pl-5" {...p} />,
  ol: (p: React.ComponentProps<"ol">) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5" {...p} />,
  p: (p: React.ComponentProps<"p">) => <p className="my-1.5 first:mt-0 last:mb-0" {...p} />,
};

export function RichText({ children }: { children: string }) {
  return (
    <div className="text-[0.95rem] leading-relaxed [&_strong]:font-semibold">
      <ReactMarkdown remarkPlugins={PLUGINS} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
