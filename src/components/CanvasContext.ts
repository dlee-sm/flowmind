import { createContext } from 'react'

/**
 * Shared context passed from Canvas to all custom node components.
 * Using a context avoids threading callbacks through `data` (which would
 * disappear on undo/redo when nodes are rebuilt from the store snapshot).
 */
export interface CanvasContextValue {
  deleteNode: (id: string) => void
}

export const CanvasContext = createContext<CanvasContextValue>({
  deleteNode: () => {},
})
