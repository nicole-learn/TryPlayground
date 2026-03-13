"use client";

import { useMemo, useRef } from "react";
import { FolderDialog } from "./folder-dialog";
import { GenerationPanel } from "./generation-panel";
import { LibraryGrid } from "./library-grid";
import { LocalSettingsDialog } from "./local-settings-dialog";
import { ModelSidebar } from "./model-sidebar";
import { FolderSidebar } from "./folder-sidebar";
import { RecentRunsList } from "./recent-runs-list";
import { StudioTopBar } from "./studio-top-bar";
import { useStudioApp } from "../use-studio-app";

export function StudioPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const studio = useStudioApp();

  const selectedFolderName = useMemo(
    () => studio.selectedFolder?.name ?? null,
    [studio.selectedFolder]
  );

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_30%),linear-gradient(180deg,#070b12_0%,#0c111a_100%)] text-white">
        <StudioTopBar
          hasFalKey={studio.hasFalKey}
          gridDensity={studio.gridDensity}
          onGridDensityChange={studio.setGridDensity}
          onOpenSettings={() => studio.setSettingsOpen(true)}
          onOpenUpload={() => fileInputRef.current?.click()}
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            studio.uploadFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />

        <div className="mx-auto grid max-w-[1700px] gap-5 px-4 py-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
          <div className="lg:sticky lg:top-[112px] lg:self-start">
            <ModelSidebar
              models={studio.models}
              sections={studio.modelSections}
              selectedModelId={studio.selectedModelId}
              onSelectModel={studio.setSelectedModelId}
            />
          </div>

          <div className="space-y-5">
            <GenerationPanel
              draft={studio.currentDraft}
              hasFalKey={studio.hasFalKey}
              model={studio.selectedModel}
              onAddReferences={studio.addReferences}
              onGenerate={studio.generate}
              onRemoveReference={studio.removeReference}
              onUpdateDraft={studio.updateDraft}
            />

            <RecentRunsList runs={studio.runs} onReuseRun={studio.reuseRun} />

            <LibraryGrid
              density={studio.gridDensity}
              folders={studio.folders}
              items={studio.filteredItems}
              selectedFolderName={selectedFolderName}
              onDeleteItem={studio.deleteItem}
              onReuseItem={studio.reuseItem}
              onSetItemFolderIds={studio.setItemFolderIds}
            />
          </div>

          <div className="xl:sticky xl:top-[112px] xl:self-start">
            <FolderSidebar
              allCount={studio.allCount}
              folders={studio.folders}
              folderCounts={studio.folderCounts}
              selectedFolderId={studio.selectedFolderId}
              onCreateFolder={studio.openCreateFolder}
              onDeleteFolder={studio.deleteFolder}
              onRenameFolder={studio.openRenameFolder}
              onSelectFolder={studio.setSelectedFolderId}
            />
          </div>
        </div>
      </div>

      <LocalSettingsDialog
        open={studio.settingsOpen}
        initialValues={studio.settings}
        onClose={() => studio.setSettingsOpen(false)}
        onSave={studio.saveSettings}
      />

      <FolderDialog
        open={studio.folderEditorOpen}
        mode={studio.folderEditorMode}
        value={studio.folderEditorValue}
        onValueChange={studio.setFolderEditorValue}
        onClose={() => studio.setFolderEditorOpen(false)}
        onSave={studio.saveFolder}
      />
    </>
  );
}
