"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { sortStudioFoldersByOrder } from "./studio-folder-order";
import type { StudioFolder } from "./types";

const FOLDER_DRAG_THRESHOLD_PX = 4;

interface FolderDragSession {
  active: boolean;
  currentY: number;
  folderId: string;
  initialIds: string[];
  overlayHeight: number;
  overlayLeft: number;
  overlayWidth: number;
  pointerId: number;
  pointerOffsetY: number;
  previewIds: string[];
  startY: number;
}

interface UseFolderReorderParams {
  folders: StudioFolder[];
  onReorderFolders: (orderedFolderIds: string[]) => void;
}

export function useFolderReorder({
  folders,
  onReorderFolders,
}: UseFolderReorderParams) {
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const previousRowTopsRef = useRef(new Map<string, number>());
  const dragSessionRef = useRef<FolderDragSession | null>(null);
  const suppressFolderClickRef = useRef(false);
  const [dragSession, setDragSession] = useState<FolderDragSession | null>(null);

  const sortedFolders = useMemo(() => sortStudioFoldersByOrder(folders), [folders]);
  const folderMap = useMemo(
    () => new Map(sortedFolders.map((folder) => [folder.id, folder])),
    [sortedFolders]
  );

  const displayedFolders = useMemo(() => {
    const orderedIds = dragSession?.previewIds;
    if (!orderedIds) {
      return sortedFolders;
    }

    return orderedIds
      .map((folderId) => folderMap.get(folderId))
      .filter((folder): folder is StudioFolder => Boolean(folder));
  }, [dragSession?.previewIds, folderMap, sortedFolders]);

  useEffect(() => {
    dragSessionRef.current = dragSession;
  }, [dragSession]);

  useEffect(() => {
    if (!dragSession?.active) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [dragSession?.active]);

  useLayoutEffect(() => {
    const nextTops = new Map<string, number>();

    for (const folder of displayedFolders) {
      const node = rowRefs.current.get(folder.id);
      if (!node) {
        continue;
      }

      const nextTop = node.getBoundingClientRect().top;
      nextTops.set(folder.id, nextTop);

      const previousTop = previousRowTopsRef.current.get(folder.id);
      if (
        previousTop === undefined ||
        Math.abs(previousTop - nextTop) < 1 ||
        dragSession?.folderId === folder.id
      ) {
        continue;
      }

      node.style.transition = "none";
      node.style.transform = `translateY(${previousTop - nextTop}px)`;

      window.requestAnimationFrame(() => {
        node.style.transition =
          "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)";
        node.style.transform = "";

        window.setTimeout(() => {
          if (rowRefs.current.get(folder.id) === node) {
            node.style.transition = "";
          }
        }, 200);
      });
    }

    previousRowTopsRef.current = nextTops;
  }, [displayedFolders, dragSession?.folderId]);

  useEffect(() => {
    if (!dragSession) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragSessionRef.current?.pointerId) {
        return;
      }

      setDragSession((current) => {
        if (!current || current.pointerId !== event.pointerId) {
          return current;
        }

        const movedEnough =
          Math.abs(event.clientY - current.startY) >= FOLDER_DRAG_THRESHOLD_PX;
        const nextActive = current.active || movedEnough;
        if (!nextActive) {
          return {
            ...current,
            currentY: event.clientY,
          };
        }

        event.preventDefault();

        const orderedWithoutDragged = current.previewIds.filter(
          (folderId) => folderId !== current.folderId
        );
        const draggedCenterY =
          event.clientY - current.pointerOffsetY + current.overlayHeight / 2;

        let insertIndex = orderedWithoutDragged.length;
        for (let index = 0; index < orderedWithoutDragged.length; index += 1) {
          const node = rowRefs.current.get(orderedWithoutDragged[index]);
          if (!node) {
            continue;
          }

          const rect = node.getBoundingClientRect();
          const rowCenterY = rect.top + rect.height / 2;
          if (draggedCenterY < rowCenterY) {
            insertIndex = index;
            break;
          }
        }

        const nextPreviewIds = [...orderedWithoutDragged];
        nextPreviewIds.splice(insertIndex, 0, current.folderId);

        return {
          ...current,
          active: true,
          currentY: event.clientY,
          previewIds: nextPreviewIds,
        };
      });
    };

    const finishDrag = (pointerId: number, commit: boolean) => {
      const current = dragSessionRef.current;
      if (!current || current.pointerId !== pointerId) {
        return;
      }

      const didDrag = current.active;
      const didReorder =
        didDrag &&
        current.previewIds.length === current.initialIds.length &&
        current.previewIds.some(
          (folderId, index) => folderId !== current.initialIds[index]
        );

      setDragSession(null);

      if (didDrag) {
        suppressFolderClickRef.current = true;
        window.setTimeout(() => {
          suppressFolderClickRef.current = false;
        }, 0);
      }

      if (commit && didReorder) {
        onReorderFolders(current.previewIds);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      finishDrag(event.pointerId, true);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      finishDrag(event.pointerId, false);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [dragSession, onReorderFolders]);

  const registerRowNode = (folderId: string, node: HTMLDivElement | null) => {
    if (node) {
      rowRefs.current.set(folderId, node);
      return;
    }

    rowRefs.current.delete(folderId);
  };

  const startFolderDrag = (
    folderId: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) {
      return;
    }

    const eventTarget = event.target as HTMLElement | null;
    if (eventTarget?.closest("[data-folder-menu-root]")) {
      return;
    }

    const node = rowRefs.current.get(folderId);
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const orderedIds = sortedFolders.map((folder) => folder.id);
    suppressFolderClickRef.current = false;

    setDragSession({
      active: false,
      currentY: event.clientY,
      folderId,
      initialIds: orderedIds,
      overlayHeight: rect.height,
      overlayLeft: rect.left,
      overlayWidth: rect.width,
      pointerId: event.pointerId,
      pointerOffsetY: event.clientY - rect.top,
      previewIds: orderedIds,
      startY: event.clientY,
    });
  };

  const shouldSuppressFolderClick = () => suppressFolderClickRef.current;

  return {
    displayedFolders,
    dragSession,
    folderMap,
    registerRowNode,
    shouldSuppressFolderClick,
    sortedFolders,
    startFolderDrag,
  };
}
