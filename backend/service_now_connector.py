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
        # Step 1: Fetch Incident
        query_url = f"{self.instance}/api/now/table/incident"
        params = {"sysparm_query": f"number={incident_number}", "sysparm_limit": 1}
        response = requests.get(query_url, auth=(self.username, self.password), headers=self.headers, params=params)
        data = response.json()

        if response.status_code != 200 or not data["result"]:
            raise Exception("Incident not found or API error")

        incident_sys_id = data["result"][0]["sys_id"]
        incident_data = self._get_record_by_sys_id("incident", incident_sys_id)
        ci_sys_id = incident_data.get("cmdb_ci", {}).get("value")

        if not ci_sys_id:
            return {
                "incident_details": incident_data,
                "affected_cis": [],
                "outage_details": [],
                "cmdb": {}
            }

        # Step 2: Traverse Related CIs
        complete_ci_list = []
        self._collect_related_cis(ci_sys_id, complete_ci_list)
        complete_ci_list.append(ci_sys_id)
        unique_cis = list(set(complete_ci_list))

        # Step 3: Correlate Outages
        outages = self._get_outages_for_cis(unique_cis)

        # Step 4: Build Dependency Map
        cmdb_map = self._build_dependency_map()

        return {
            "incident_details": incident_data,
            "affected_cis": unique_cis,
            "outage_details": outages,
            "cmdb": cmdb_map
        }

    def _get_record_by_sys_id(self, table, sys_id):
        url = f"{self.instance}/api/now/table/{table}/{sys_id}"
        response = requests.get(url, auth=(self.username, self.password), headers=self.headers)
        return response.json().get('result', {})

    def _collect_related_cis(self, ci_sys_id, collected):
        url = f"{self.instance}/api/now/table/cmdb_rel_ci?sysparm_query=parent={ci_sys_id}"
        resp = requests.get(url, auth=(self.username, self.password), headers=self.headers)
        rels = resp.json().get('result', [])
        children = [rel['child']['value'] for rel in rels if rel.get('child')]
        for child_id in children:
            if child_id not in collected:
                collected.append(child_id)
                self._collect_related_cis(child_id, collected)

    def _get_outages_for_cis(self, ci_ids):
        if not ci_ids:
            return []
        ci_query = ",".join(ci_ids)
        params = {
            'sysparm_query': f"ciIN{ci_query}^type=Planned",
            'sysparm_limit': '10000'
        }
        url = f"{self.instance}/api/now/table/cmdb_ci_outage"
        response = requests.get(url, auth=(self.username, self.password), headers=self.headers, params=params)
        outages = response.json().get('result', [])
        return outages

    def _build_dependency_map(self):
        url = f"{self.instance}/api/now/table/cmdb_rel_ci"
        params = {'sysparm_fields': 'parent.name,parent.sys_id,child.name,child.sys_id'}
        response = requests.get(url, auth=(self.username, self.password), headers=self.headers, params=params)
        rels = response.json().get('result', [])

        cmdb = {}
        for rel in rels:
            parent = rel.get("parent.name")
            child = rel.get("child.name")
            if not parent or not child:
                continue

            cmdb.setdefault(parent, {"depends_on": [], "used_by": []})
            cmdb.setdefault(child, {"depends_on": [], "used_by": []})

            cmdb[parent]["depends_on"].append(child)
            cmdb[child]["used_by"].append(parent)

        return cmdb