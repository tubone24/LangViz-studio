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
    compiled = workflow.compile()

    initial_state = {}
    result = await compiled.ainvoke(initial_state)
    print("=== Workflow finished ===")
    print("Final State:", result)

if __name__ == "__main__":
    asyncio.run(main())
