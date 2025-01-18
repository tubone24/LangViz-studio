# LangViz-Studio

LangViz-Studio is an observability toolkit for [LangGraph](https://pypi.org/project/langgraph/) workflows. 

<img src="https://github.com/tubone24/LangViz-studio/blob/main/images/logo.png?raw=true" width="30%" alt="logo"/>

It enables you to track the execution states, node transitions, and conditional edges of your state-based flows or agent pipelines in real-time, sending all data asynchronously to a customizable endpoint (e.g., a Next.js server) for visualization.

## Key Features

- GraphObservability
  - Automatically records and sends node start/end events, edge transitions, and conditional branch usage. 
  - Maintains a unique graphId (UUID by default) and an optional friendly graph_name. 
  - Sends data to a configured endpoint (http://localhost:3000 by default).

- ObservabilityStateGraph
  - A subclass of langgraph.graph.StateGraph that automatically wraps node functions and edge definitions so all observability data is captured with no extra code. 
  - Just use add_node(...), add_edge(...), add_conditional_edges(...) as normal, and your graph’s runtime states will be sent in real-time for visualization.

- Asynchronous and Non-blocking
  - Uses an internal background thread running an asyncio event loop to POST updates via httpx.AsyncClient, ensuring minimal impact on your main workflow thread.

## Installation

```bash
pip install langviz-studio
```

(Also ensure you have installed langgraph and other dependencies like langchain_core, if applicable.)

## Usage

Below is a minimal example showing how to use LangViz-Studio with [LangGraph](https://pypi.org/project/langgraph/).
In this example, we define two simple asynchronous node functions (run_start and run_end) and connect them in a StateGraph. Observability logs are sent automatically.

```python
import asyncio
from langviz_studio.observability import GraphObservability, ObservabilityStateGraph

async def run_start(state, config=None):
    print("=== [start] node invoked ===")
    state["msg"] = "Hello from start!"
    return state

async def run_end(state, config=None):
    print("=== [end] node invoked ===")
    state["result"] = "Done"
    return state

async def main():
    # 1. Set your Observability
    obs = GraphObservability(
        graph_name="MyExampleGraph"
    )

    # 2. Using ObservabilityStateGraph instead of StateGraph
    workflow = ObservabilityStateGraph(obs, state_type=dict)

    # 3. Nodes are added in the same manner as StateGraph
    workflow.add_node("start", run_start)
    workflow.add_node("end", run_end)
    # Edges / Conditional edges are also added in the same manner as StateGraph
    workflow.add_edge("start", "end")

    workflow.set_entry_point("start")

    # 4) Compile the graph
    compiled = workflow.compile()

    initial_state = {}
    # 5) Run the workflow
    result = await compiled.ainvoke(initial_state)
    print("=== Workflow finished ===")
    print("Final State:", result)

if __name__ == "__main__":
    asyncio.run(main())
```

## Server-Side Visualization

By default, GraphObservability calls two endpoints on your server:

- POST /api/graph/start — triggered once when the first node starts, to initialize a new graph record.
- POST /api/graph/ingest — triggered after every node start/end or edge creation, sending updates.

## How it Works Internally
1. A background thread holds an asyncio event loop (via _AsyncLoopThread), so we can await httpx.AsyncClient.post(...) without blocking the main process or requiring the user to manage async.

2. Each node start/end or edge creation calls a short, synchronous method (_post_to_nextjs) which enqueues a coroutine in the background event loop to do an HTTP POST.

3. This ensures minimal overhead and “fire-and-forget” updates to your server.

## License
MIT License. See [LICENSE](./LICENSE) for details.

## Contributing
Pull requests and issues are welcome! If you have suggestions or find bugs, please open an issue or submit a PR on the GitHub repository.