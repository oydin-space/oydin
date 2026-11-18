"use client";

import { Tabs as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex max-w-full gap-1 overflow-x-auto border-b border-border px-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "focus-ring motion-fast min-target relative shrink-0 whitespace-nowrap px-3 text-small font-medium text-muted-foreground transition-colors focus-visible:ring-inset data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-pill data-[state=active]:after:bg-foreground",
        className,
      )}
      {...props}
    />
  );
}
