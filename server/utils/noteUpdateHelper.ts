export function buildNoteUpdateData(
  existingNote: { content: string; isPinned: boolean },
  incomingNote: { content: string; isPinned: boolean }
): { shouldUpdate: boolean; data: Record<string, any> } {
  const contentChanged = existingNote.content !== incomingNote.content;
  const isPinnedChanged = existingNote.isPinned !== incomingNote.isPinned;

  if (!contentChanged && !isPinnedChanged) {
    return { shouldUpdate: false, data: {} };
  }

  return {
    shouldUpdate: true,
    data: {
      content: incomingNote.content,
      isPinned: incomingNote.isPinned,
      version: { increment: 1 },
      ...(contentChanged ? { updatedAt: new Date() } : {}),
    },
  };
}
