export default {
  // Controls
  'op': 'Op:',
  'alg': 'Algorithm:',
  'speed': 'Speed:',
  'chunkTitle': 'Ring: equals GPU count / Tree: configurable',
  'chunkLock.ring': 'Fixed to GPU count to clearly show how each chunk circulates through the ring',
  'chunkLock.onePerGpu': 'Fixed to GPU count to clearly show one chunk per GPU mapping',
  'speedReset': 'Reset speed (100%)',
  'play': 'Play',
  'prev': 'Prev',
  'step': 'Step',
  'reset': 'Reset',

  // Sidebar
  'hideDetails': 'Hide details \u25BE',
  'showDetails': 'Show details \u25B4',
  'visualization': '{title} Visualization',
  'goal': 'Goal',
  'gpuChunkCount': '{G} GPUs \u00D7 {C} chunks',
  'more': '[Details]',
  'progress': 'Progress',
  'stepProgress': '{current} / {total} steps',
  'phaseStart': '{phase} start',
  'stepLabel': 'Step {n}:',
  'xferDone': '{n} transfers done',
  'xferWaiting': '{n} transfers waiting',
  'xferProgress': '{n} transfers in progress',
  'complete': '{title} Complete!',
  'idleMsg': 'Press \u25B6 Play or \u25B6| Step to begin!',
  'moreItems': '... and {n} more',

  // Phase descriptions - AllReduce Ring
  'phase.scatterReduce': '1. Scatter-Reduce',
  'phase.scatterReduceDesc': 'Accumulate received values \u2192 {n} steps',
  'phase.allGather': '2. AllGather',
  'phase.allGatherDesc': 'Copy completed sums \u2192 {n} steps',

  // Phase descriptions - AllReduce Naive
  'phase.reduceToGpu0': '1. Reduce (All \u2192 GPU 0)',
  'phase.reduceToGpu0Desc': 'All GPUs \u2192 GPU 0 \u2192 1 step',
  'phase.broadcastFromGpu0': '2. Broadcast (GPU 0 \u2192 All)',
  'phase.broadcastFromGpu0Desc': 'GPU 0 \u2192 All GPUs \u2192 1 step',

  // Phase descriptions - AllReduce Tree
  'phase.reduceBottomUp': '1. Reduce (Bottom \u2192 Up)',
  'phase.reduceBottomUpDesc': 'Children \u2192 parent aggregation',
  'phase.broadcastTopDown': '2. Broadcast (Top \u2192 Down)',
  'phase.broadcastTopDownDesc': 'Root \u2192 children copy',

  // Broadcast
  'phase.broadcastTree': 'Broadcast (Top \u2192 Down)',
  'phase.broadcastTreeDesc': 'Root to children propagation \u2192 {n} steps',
  'phase.broadcastNaive': 'Broadcast (GPU 0 \u2192 All)',
  'phase.broadcastNaiveDesc': 'GPU 0 to all GPUs simultaneously \u2192 1 step',

  // Reduce
  'phase.reduceTree': 'Reduce (Bottom \u2192 Up)',
  'phase.reduceTreeDesc': 'Leaf to root aggregation \u2192 {n} steps',
  'phase.reduceNaive': 'Reduce (All \u2192 GPU 0)',
  'phase.reduceNaiveDesc': 'All GPUs \u2192 GPU 0 aggregation \u2192 1 step',

  // AllGather
  'phase.ringAllGatherDesc': 'Circular copy along ring \u2192 {n} steps',

  // ReduceScatter
  'phase.ringReduceScatterDesc': 'Per-chunk sum & distribute along ring \u2192 {n} steps',

  // AllToAll
  'phase.allToAllDesc': 'Personalized exchange between all GPUs \u2192 1 step',

  // Gather
  'phase.gatherTitle': 'Gather (All \u2192 GPU 0)',
  'phase.gatherDesc': 'Collect each GPU\'s chunk to GPU 0 \u2192 1 step',

  // Scatter
  'phase.scatterTitle': 'Scatter (GPU 0 \u2192 All)',
  'phase.scatterDesc': 'Distribute GPU 0\'s chunks to each GPU \u2192 1 step',

  // Canvas / Renderer
  'canvas.dblClickReset': 'Double-click: reset',
  'canvas.initVal': 'init',
  'canvas.done': 'Done!',
  'canvas.summing': 'summing',
  'canvas.replace': 'replace',
  'canvas.fullReplace': 'Full data replace',

  // HUD
  'hud.template': '<b>{title}</b>: {desc} | Goal: {goal} [{G} GPU \u00D7 {C} chunk] <a class="ml" id="hudMoreLink">[Details]</a>',

  // Goal Modal
  'modal.goalTitle': '{title} Goal',
  'modal.gpuHas': '<b>{G} GPUs</b> each with <b>{C} chunks</b>.',
  'modal.initialData': 'Initial data per GPU:',
  'modal.targetState': 'Target state:',
  'modal.restIrrelevant': '(rest irrelevant)',
  'modal.andMore': '... and {n} more',
  'modal.usage': 'Usage:',

  // Op descriptions
  'allreduce.desc': 'Sums values across all GPUs, then distributes the result equally to every GPU. Combines Reduce + Broadcast into one operation.',
  'allreduce.usecase': 'Core operation for gradient synchronization across all GPUs in distributed training.',
  'allreduce.goal': 'Sum all GPU values ({S}) and distribute to all GPUs',
  'allreduce.detail': 'All cells on all GPUs = {S}',

  'broadcast.desc': 'Copies one GPU\'s (Root) data identically to all other GPUs.',
  'broadcast.usecase': 'Used for model parameter initialization, hyperparameter sharing, or propagating updated models from a central server.',
  'broadcast.goal': 'Copy Root (GPU 0) data to all GPUs',
  'broadcast.detail': 'All GPUs = GPU 0 initial [{vals}]',

  'reduce.desc': 'Aggregates all GPU data to a single GPU (Root). Corresponds to the first half of AllReduce.',
  'reduce.usecase': 'Used for loss aggregation to a single node for logging, or gradient collection in parameter server architectures.',
  'reduce.goal': 'Sum all GPU values to Root (GPU 0)',
  'reduce.detail': 'All cells on GPU 0 = {S}',

  'allgather.desc': 'Each GPU collects unique data chunks from all other GPUs to assemble the complete dataset.',
  'allgather.usecase': 'Used in model parallelism to combine partial results, or in FSDP/ZeRO to restore parameters before forward pass.',
  'allgather.goal': 'Collect each GPU\'s unique data to all GPUs',
  'allgather.detail': 'All GPUs = [{vals}]',

  'reducescatter.desc': 'Sums all GPU data, then distributes result chunks across GPUs. Ring: GPU g holds chunk (g+1)%{G}.',
  'reducescatter.usecase': 'Core FSDP/ZeRO operation: sum gradients while each GPU receives only its parameter shard, saving memory.',
  'reducescatter.goal': 'Sum and distribute results across GPUs',
  'reducescatter.detail': 'Each GPU holds sum ({S}) for its assigned chunk',

  'alltoall.desc': 'Each GPU sends different data to every other GPU. Effectively transposes the data matrix.',
  'alltoall.usecase': 'Used in MoE models for token-to-expert routing, or tensor parallelism for dimension redistribution.',
  'alltoall.goal': 'Each GPU sends unique data to every other GPU',
  'alltoall.detail': 'GPU g chunk c = original GPU c chunk g',

  'gather.desc': 'Collects unique data from each GPU to a single GPU (Root). Reverse of Scatter.',
  'gather.usecase': 'Used for assembling distributed inference results or collecting distributed embeddings at a single node.',
  'gather.goal': 'Collect all GPU data to Root (GPU 0)',
  'gather.detail': 'GPU 0 = [{vals}]',

  'scatter.desc': 'Distributes Root GPU\'s data to each GPU. Reverse of Gather.',
  'scatter.usecase': 'Used for distributing datasets across GPUs, or splitting batches into micro-batches for pipeline parallelism.',
  'scatter.goal': 'Distribute Root (GPU 0) data to each GPU',
  'scatter.detail': 'GPU i chunk i = {detail}',
};
