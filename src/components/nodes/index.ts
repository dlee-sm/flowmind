import ProcessNode  from './ProcessNode'
import DecisionNode from './DecisionNode'
import StartEndNode from './StartEndNode'
import SwimlaneNode from './SwimlaneNode'
import MindMapNode  from './MindMapNode'

export { ProcessNode, DecisionNode, StartEndNode, SwimlaneNode, MindMapNode }

/**
 * nodeTypes map — pass directly to <ReactFlow nodeTypes={nodeTypes} />.
 * Keys must match the `type` field on FlowNode / React Flow Node objects.
 */
export const nodeTypes = {
  process:  ProcessNode,
  decision: DecisionNode,
  startEnd: StartEndNode,
  swimlane: SwimlaneNode,
  mindmap:  MindMapNode,
} as const
