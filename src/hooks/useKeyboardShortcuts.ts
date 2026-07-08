import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { downloadTerraformZip } from '@/graph/terraform'
import { redoDesign, undoDesign, useGraphStore } from '@/store/useGraphStore'

/** True when the user is typing in a form control (skip global shortcuts). */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

/**
 * Global keyboard shortcuts (ADR 0028). Mounted once inside the ReactFlowProvider
 * so `R` (fit view) can reach the flow instance. All bindings are suppressed
 * while a form control is focused, except that no shortcut here uses a bare
 * printable key that would collide with typing (guarded by `isEditableTarget`).
 *
 * | Key                       | Action                         |
 * | ------------------------- | ------------------------------ |
 * | Ctrl/Cmd+Z                | undo                           |
 * | Ctrl/Cmd+Shift+Z, Ctrl+Y  | redo                           |
 * | Ctrl/Cmd+D                | duplicate selected node        |
 * | Delete / Backspace        | delete selection               |
 * | Escape                    | close menu/modal, else deselect|
 * | R                         | fit view                       |
 * | S                         | start / stop traffic sim       |
 * | E                         | export Terraform (.tf zip)     |
 * | ?                         | toggle shortcut help           |
 */
export function useKeyboardShortcuts() {
  const rf = useReactFlow()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const store = useGraphStore.getState()
      const key = e.key
      const lower = key.toLowerCase()

      // Escape is the one binding allowed to fire from anywhere — it closes the
      // context menu / help modal even if focus is inside a field.
      if (key === 'Escape') {
        if (store.contextMenu) store.setContextMenu(null)
        else if (store.showShortcutHelp) store.setShortcutHelp(false)
        else store.setSelected(null)
        return
      }

      if (isEditableTarget(e.target)) return

      // Modifier combos (undo/redo/duplicate).
      if (e.ctrlKey || e.metaKey) {
        if (lower === 'z') {
          e.preventDefault()
          if (e.shiftKey) redoDesign()
          else undoDesign()
        } else if (lower === 'y') {
          e.preventDefault()
          redoDesign()
        } else if (lower === 'd') {
          e.preventDefault()
          if (store.selectedNodeId) store.duplicateNode(store.selectedNodeId)
        }
        return
      }

      // Bare keys.
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault()
        store.deleteSelection()
        return
      }
      if (key === '?') {
        e.preventDefault()
        store.setShortcutHelp(!store.showShortcutHelp)
        return
      }
      switch (lower) {
        case 'r':
          e.preventDefault()
          void rf.fitView({ duration: 300 })
          break
        case 's':
          e.preventDefault()
          if (store.simulation) store.stopSimulation()
          else store.runSimulation()
          break
        case 'e':
          e.preventDefault()
          void downloadTerraformZip(store.nodes, store.edges)
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rf])
}
