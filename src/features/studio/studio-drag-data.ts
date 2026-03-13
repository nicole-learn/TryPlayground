const STUDIO_ITEM_DRAG_DATA_TYPE = "application/vnd.vydelabs.items";

export function isStudioItemDrag(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes(STUDIO_ITEM_DRAG_DATA_TYPE);
}

export function parseDraggedLibraryItemIds(dataTransfer: DataTransfer) {
  const rawValue = dataTransfer.getData(STUDIO_ITEM_DRAG_DATA_TYPE);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  } catch {
    return [];
  }
}

export function setDraggedLibraryItemIds(
  dataTransfer: DataTransfer,
  itemIds: string[]
) {
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(
    STUDIO_ITEM_DRAG_DATA_TYPE,
    JSON.stringify(itemIds.filter(Boolean))
  );
}
