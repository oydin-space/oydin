export type AttachmentKind = "photo" | "screenshot";
export type PendingAttachment = { file: File; kind: AttachmentKind };

let pending: PendingAttachment | null = null;

/** Передаёт файл со смежного экрана (меню «+» дока) в чат: один слот в памяти модуля. */
export function setPendingAttachment(file: File, kind: AttachmentKind): void {
  pending = { file, kind };
}

/** Забирает вложение и очищает слот. */
export function takePendingAttachment(): PendingAttachment | null {
  const taken = pending;
  pending = null;
  return taken;
}
