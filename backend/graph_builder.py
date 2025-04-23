import json
import networkx as nx

class GraphBuilder:
    def __init__(self, cmdb_source):
        """
        cmdb_source: either a path to a JSON file or a dict of CMDB data
        """
        if isinstance(cmdb_source, str):
            with open(cmdb_source, 'r') as f:
                self.cmdb = json.load(f)
        else:
            self.cmdb = cmdb_source
        self.graph = nx.DiGraph()

    def build_graph(self):
        """
        Build a directed graph where nodes are CIs and
        edges represent 'depends_on' relationships.
        """
        for ci, props in self.cmdb.items():
            # Add node with any metadata except 'depends_on'
            meta = {k: v for k, v in props.items() if k != 'depends_on'}
            self.graph.add_node(ci, **meta)

            # Add one edge per dependency
            for dep in props.get('depends_on', []):
                self.graph.add_edge(ci, dep, type='depends_on')
        return self.graph

    def get_graph(self):
        return self.graph

    def get_neighbors(self, node_id):
        return list(self.graph.successors(node_id))


def build_relationship_graph(cmdb_data):
    """
    Convenience function: takes a CMDB dict and returns
    a NetworkX DiGraph of dependencies.
    """
    builder = GraphBuilder(cmdb_data)
    return builder.build_graph()