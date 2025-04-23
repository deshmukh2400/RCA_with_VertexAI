import json
import networkx as nx

class GraphBuilder:
    def __init__(self, cmdb_file):
        self.cmdb_file = cmdb_file
        self.graph = nx.DiGraph()

    def load_cmdb_data(self):
        with open(self.cmdb_file, 'r') as file:
            data = json.load(file)
        return data

    def build_graph(self):
        cmdb_data = self.load_cmdb_data()
        cis = cmdb_data.get("cis", [])
        relationships = cmdb_data.get("relationships", [])

        # Add nodes
        for ci in cis:
            self.graph.add_node(ci["id"], **ci)

        # Add relationships as edges
        for rel in relationships:
            source = rel["source"]
            target = rel["target"]
            rel_type = rel.get("relationship_type", "depends_on")
            self.graph.add_edge(source, target, type=rel_type)

        return self.graph

    def get_graph(self):
        return self.graph

    def get_node(self, node_id):
        return self.graph.nodes.get(node_id, None)

    def get_neighbors(self, node_id):
        return list(self.graph.successors(node_id))