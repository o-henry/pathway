type BrowserAttachmentRecord = {
  id: string;
  name: string;
  path: string;
  text: string;
};

const browserAttachmentStore = new Map<string, BrowserAttachmentRecord>();

export function setBrowserAttachment(record: BrowserAttachmentRecord) {
  browserAttachmentStore.set(record.id, record);
}

export function getBrowserAttachment(id: string): BrowserAttachmentRecord | null {
  return browserAttachmentStore.get(id) ?? null;
}

export function removeBrowserAttachment(id: string) {
  browserAttachmentStore.delete(id);
}

export function clearBrowserAttachments(ids?: string[]) {
  if (!ids) {
    browserAttachmentStore.clear();
    return;
  }
  ids.forEach((id) => {
    browserAttachmentStore.delete(id);
  });
}
