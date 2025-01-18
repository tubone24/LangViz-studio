# [example_workflow.py](example_workflow.py)

This example demonstrates how to use LangViz-Studio with LangGraph to visualize a simple workflow in real-time.

LangViz-Studio automatically records and sends node start/end events, edge transitions, and conditional branch usage to a configured endpoint (http://localhost:3000 by default).

And also, LangViz-Studio do not callback LangChain, it just sends data on LangGraph's runtime states.

```bash
pip install langviz-studio
pip install langgraph

python example_workflow.py
```