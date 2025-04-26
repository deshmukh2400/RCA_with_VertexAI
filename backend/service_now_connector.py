import requests
from requests.auth import HTTPBasicAuth
import json

class ServiceNowConnection:
    instance = "https://dev265570.service-now.com"
    username = "admin"
    password = "tvpl82*@IRVH"

    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    def get_incident_data(self, incident_number):
        query_url = f"{self.instance}/api/now/table/incident"
        params = {"sysparm_query": f"number={incident_number}", "sysparm_limit": 1}
        response = requests.get(query_url, auth=(self.username, self.password), headers=self.headers, params=params)
        if response.status_code != 200:
            raise Exception("Failed to fetch incident")
        data = response.json()

        if not data["result"]:
            return {"error": "Incident not found"}

        incident = data["result"][0]
        incident_sys_id = incident["sys_id"]
        ci_sys_id = incident.get("cmdb_ci", {}).get("value")

        if not ci_sys_id:
            return {"incident_details": incident, "affected_cis": [], "outage_details": []}

        related_cis = self.get_related_cis(ci_sys_id, set())
        related_cis.add(ci_sys_id)

        outages = self.get_outages(related_cis)

        return {
            "incident_details": incident,
            "affected_cis": list(related_cis),
            "outage_details": outages
        }

    def get_related_cis(self, ci_sys_id, visited):
        if ci_sys_id in visited:
            return visited
        visited.add(ci_sys_id)

        url = f"{self.instance}/api/now/table/cmdb_rel_ci"
        params = {
            "sysparm_query": f"parent={ci_sys_id}^ORchild={ci_sys_id}",
            "sysparm_fields": "parent,child,parent.sys_id,child.sys_id",
            "sysparm_limit": 100
        }
        response = requests.get(url, auth=(self.username, self.password), headers=self.headers, params=params)
        if response.status_code != 200:
            return visited

        for rel in response.json()["result"]:
            parent_id = rel.get("parent", {}).get("value")
            child_id = rel.get("child", {}).get("value")
            if parent_id and parent_id != ci_sys_id:
                self.get_related_cis(parent_id, visited)
            if child_id and child_id != ci_sys_id:
                self.get_related_cis(child_id, visited)
        return visited

    def get_outages(self, ci_ids):
        if not ci_ids:
            return []

        id_list = ",".join(ci_ids)
        url = f"{self.instance}/api/now/table/cmdb_ci_outage"
        params = {
            "sysparm_query": f"ciIN{id_list}^type=Planned",
            "sysparm_limit": "100"
        }
        response = requests.get(url, auth=(self.username, self.password), headers=self.headers, params=params)
        if response.status_code != 200:
            return []

        return response.json().get("result", [])

    def fetch_ci_relationships(self):
        url = f"{self.instance}/api/now/table/cmdb_rel_ci"
        params = {
            "sysparm_fields": "parent.name,child.name",
            "sysparm_limit": 1000
        }
        response = requests.get(url, auth=(self.username, self.password), headers=self.headers, params=params)
        if response.status_code != 200:
            raise Exception("Failed to fetch relationships")

        data = response.json().get("result", [])
        cmdb = {}

        for rel in data:
            parent = rel.get("parent.name")
            child = rel.get("child.name")
            if not parent or not child:
                continue

            cmdb.setdefault(child, {"depends_on": []})
            cmdb[child]["depends_on"].append(parent)

            cmdb.setdefault(parent, {"depends_on": []})  # Ensure parent appears too

        return cmdb