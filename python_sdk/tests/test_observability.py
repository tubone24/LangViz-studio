def test_import():
    from langviz_studio.observability import GraphObservability
    obs = GraphObservability()
    assert obs.graph_id is not None