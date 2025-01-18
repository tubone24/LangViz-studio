import threading
import asyncio
import httpx
from functools import wraps
from typing import Any, Dict, Optional, List, Callable
from uuid import uuid4

from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END

class _AsyncLoopThread(threading.Thread):
    """
    Create a thread that globally runs the event loop and observability is done independently of the main thread
    """
    def __init__(self):
        super().__init__(daemon=True)
        self.loop = asyncio.new_event_loop()

    def run(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def submit_coroutine(self, coro):
        asyncio.run_coroutine_threadsafe(coro, self.loop)

# Singleton instances are launched when modules are loaded
_loop_thread = _AsyncLoopThread()
_loop_thread.start()


def safe_serialize(obj):
    if isinstance(obj, dict):
        return {k: safe_serialize(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [safe_serialize(e) for e in obj]
    elif isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    else:
        return str(obj)


class GraphObservability:
    """
    Class for observing and visualizing the execution state of processing flows with graph structure.

    This class provides observability of a processing flow consisting of nodes and edges.
    It records data at the start and end of execution of each node and transitions between nodes (edges),
    send them in real time to the specified endpoints.

    Main functions: 1.
    - Define static graph structures (add_static_edge)
    - Recording of edges including conditional branches (on_condition_chosen)
    - Recording of execution state of nodes (on_node_start, on_node_end)
    - Recording of dynamic edges (on_edge)
    - Send execution logs asynchronously

    Attributes: graph_id (str): graph_id (str): graph_id (str)
        graph_id (str): ID uniquely identifying the graph
        endpoint (str): URL of the endpoint to which data is sent
        graph_name (str): Display name of the graph
        log_data (dict): dictionary that keeps execution logs for nodes and edges
        step_counter (int): counter of execution steps
        static_edges (List[Dict]): list of statically defined edges
        condition_choices (List[Dict]): history of condition branching choices

    Example:
        ```
        observer = GraphObservability(
            graph_id=“flow-1”,
            endpoint=“http://localhost:3000”,
            graph_name="data processing flow"
        )

        # Define static edges
        observer.add_static_edge(“start”, “process”, “condition_1”)

        # Record execution of a node
        observer.on_node_start(“start”, {“data”: “input”})
        observer.on_node_end(“start”, {“result”: “success”})

        # Record edges
        observer.on_edge(“start”, “process”)
        ```
    """
    def __init__(self, graph_id: Optional[str] = None,
                 endpoint: Optional[str] = None,
                 graph_name: Optional[str] = None):
        self.graph_id = graph_id or str(uuid4())
        self.endpoint = endpoint or "http://localhost:3000"
        self.graph_name = graph_name or self.graph_id

        self.log_data = {
            "nodes": {},   # nodeName -> [ {stepIndex, input, output}, ... ]
            "edges": []
        }
        self.step_counter = 0
        self.static_edges: List[Dict[str, Any]] = []
        self.condition_choices: List[Dict[str, Any]] = []

        self._graph_created = False

    # --- 静的エッジ関連 ---
    def add_static_edge(self, from_node: str, to_node: str, condition_key: Optional[str] = None):
        self.static_edges.append({
            "source": from_node,
            "target": to_node,
            "conditionKey": condition_key,
            "used_count": 0
        })

    def on_condition_chosen(self, from_node: str, condition_key: str, to_node: str):
        self.condition_choices.append({
            "from_node": from_node,
            "conditionKey": condition_key,
            "to_node": to_node
        })
        for edge in self.static_edges:
            if (edge["source"] == from_node
                    and edge["target"] == to_node
                    and edge["conditionKey"] == condition_key):
                edge["used_count"] += 1

    # --- ノード呼び出しログ ---
    def on_node_start(self, node_name: str, input_data: dict):
        if not self._graph_created and self.step_counter == 0:
            self._create_graph()
            self._graph_created = True

        self.step_counter += 1
        if node_name not in self.log_data["nodes"]:
            self.log_data["nodes"][node_name] = []
        self.log_data["nodes"][node_name].append({
            "stepIndex": self.step_counter,
            "input": input_data,
            "output": None
        })
        self._post_to_nextjs()

    def on_node_end(self, node_name: str, output_data: dict):
        if node_name in self.log_data["nodes"] and self.log_data["nodes"][node_name]:
            self.log_data["nodes"][node_name][-1]["output"] = output_data
        self._post_to_nextjs()

    def on_edge(self, from_node: str, to_node: str):
        self.log_data["edges"].append({
            "source": from_node,
            "target": to_node,
            "stepIndex": self.step_counter
        })
        self._post_to_nextjs()

    # --- get_log ---
    def get_log(self) -> Dict[str, Any]:
        combined_edges = []

        # static edges
        for edge in self.static_edges:
            combined_edges.append({
                "source": edge["source"],
                "target": edge["target"],
                "conditionKey": edge["conditionKey"],
                "used_count": edge["used_count"],
                "stepIndex": -1
            })

        # dynamic edges
        for e in self.log_data["edges"]:
            combined_edges.append({
                "source": e["source"],
                "target": e["target"],
                "stepIndex": e.get("stepIndex", -1),
                "conditionKey": None,
                "used_count": 0
            })
        return {
            "graphId": self.graph_id,
            "nodes": self.log_data["nodes"],
            "edges": combined_edges
        }

    # --- 非同期POST (httpx + asyncio) ---
    def _create_graph(self):
        # fire-and-forget
        _loop_thread.submit_coroutine(self._do_create_graph())

    def _post_to_nextjs(self):
        # fire-and-forget
        _loop_thread.submit_coroutine(self._do_post_ingest())

    async def _do_create_graph(self):
        payload = safe_serialize({"graphId": self.graph_id, "name": self.graph_name})
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(f"{self.endpoint}/api/graph/start",
                                         json=payload, timeout=3)
                resp.raise_for_status()
        except Exception as e:
            print(f"[GraphObservability] POST (create_graph) failed: {e}")

    async def _do_post_ingest(self):
        payload = safe_serialize(self.get_log())
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(f"{self.endpoint}/api/graph/ingest",
                                         json=payload, timeout=3)
                resp.raise_for_status()
        except Exception as e:
            print(f"[GraphObservability] POST (ingest) failed: {e}")


class ObservabilityStateGraph(StateGraph):
    """
    Class that manages a graph structure for visualizing the state transitions of a processing flow.

    This class represents the state of the processing flow at runtime as a graph,
    It maintains and manages the execution state and transition history of each node.
    This class defines a wrapper for hooking LangViz observability into LangGraph's StateGraph, and can be defined in the same way as using LangGraph's StateGraph.

    example:
    ```
    from typing import Any, Dict, List, Optional, Annotated, TypedDict, Union
    from langchain_core.agents import AgentAction, AgentFinish
    from langchain_core.runnables import RunnableConfig
    from langgraph.graph import END, StateGraph
    from langchain_core.messages import BaseMessage
    from operator import add
    from langgraph.checkpoint.memory import MemorySaver
    from langviz_studio.observability import GraphObservability, ObservabilityStateGraph

    class AgentState(TypedDict):
        messages: Annotated[List[BaseMessage], add]
        intermediate_steps: Annotated[List[tuple[AgentAction, str]], add]
        agent_outcome: Union[AgentAction, AgentFinish, None]


    obs = GraphObservability()
    async def run_start(state: AgentState, config: Optional[RunnableConfig] = None) -> Dict[str, Any]:
        # Inmplement the function here
        pass
    async def run_end(state: AgentState, config: Optional[RunnableConfig] = None) -> Dict[str, Any]:
        # Inmplement the function here
        pass
    async def run_agent(state: AgentState, config: Optional[RunnableConfig] = None) -> Dict[str, Any]:
        # Inmplement the function here
        pass
    async def run_tool(state: AgentState, config: Optional[RunnableConfig] = None) -> Dict[str, Any]:
        # Inmplement the function here
        pass
    def should_continue(state: AgentState) -> str:
        if isinstance(state["agent_outcome"], AgentFinish):
            return "end"
        return "continue"
    workflow = ObservabilityStateGraph(obs=obs, state_type=AgentState)
    memory = MemorySaver()
    workflow.add_node("start", run_start)
    workflow.add_node("agent", run_agent)
    workflow.add_node("tool", run_tool)
    workflow.add_node("end", run_end)
    workflow.set_entry_point("start")
    workflow.add_edge("start", "agent")
    mapping = {"continue": "tool", "end": "end"}
    workflow.add_conditional_edges("agent", should_continue, mapping)
    workflow.add_edge("tool", "agent")
    workflow.add_edge("end", END)
    final_state = workflow.compile(checkpointer=memory)
    final_state.ainvoke()
    ```

    """
    def __init__(self, obs: GraphObservability, state_type, *args, **kwargs):
        super().__init__(state_type)
        self.obs = obs

    def add_node(self, node_name: str, node_fn: Callable):
        wrapped_fn = self._wrap_node(node_name, node_fn)
        super().add_node(node_name, wrapped_fn)

    def add_edge(self, from_node: str, to_node: str):
        self.obs.add_static_edge(from_node, to_node, condition_key=None)
        return super().add_edge(from_node, to_node)

    def add_conditional_edges(self, from_node: str, condition_fn: Callable, mapping: Dict[str, str]):
        for k, v in mapping.items():
            self.obs.add_static_edge(from_node, v, condition_key=k)

        def wrapped_condition_fn(state):
            chosen_key = condition_fn(state)
            to_node = mapping[chosen_key]
            self.obs.on_condition_chosen(from_node, chosen_key, to_node)
            return chosen_key

        return super().add_conditional_edges(from_node, wrapped_condition_fn, mapping)

    def _wrap_node(self, node_name: str, node_fn: Callable):
        @wraps(node_fn)
        async def wrapper(state: Dict[str, Any], config: Optional[RunnableConfig] = None):
            self.obs.on_node_start(node_name, dict(state))
            output = await node_fn(state, config)
            self.obs.on_node_end(node_name, dict(output))
            return output
        return wrapper
