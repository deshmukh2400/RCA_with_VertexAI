import requests
from requests.auth import HTTPBasicAuth
from flask import jsonify
import json

class ServiceNowConnection:
    instance = "https://dev265570.service-now.com"
    username = "admin"
    password = "tvpl82*@IRVH"

    headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
    }
    # incident_number = 'INC0010003'

    def get_incident_data(self, incident_number):
        query_url = f"{self.instance}/api/now/table/incident"
        params = {"sysparm_query": f"number={incident_number}", "sysparm_limit": 1}
        
 
        response = requests.get(query_url, auth=(self.username, self.password), headers=self.headers, params=params)
        data = response.json()
 
        if response.status_code == 200 and data["result"]:
            incident_sys_id = data["result"][0]["sys_id"]
 
        # Headers
        headers = {
            "Accept": "application/json"
        }
 
        # Step 1: Get CI from the incident
        incident_url = f"{self.instance}/api/now/table/incident/{incident_sys_id}"
        incident_resp = requests.get(incident_url, auth=(self.username, self.password), headers=self.headers)
        ci_sys_id = incident_resp.json()['result'].get('cmdb_ci', {}).get('value')
        incident_details = incident_resp.json()
        
        if not ci_sys_id:
            print("No CI linked to this incident.")
            exit()
        
        complete_ci_list = []
        exact_outages = []
 
    #    Step 2: Get related CIs from cmdb_rel_ci
    

        complete_ci_list.extend(self.get_related_cis(ci_sys_id, complete_ci_list))
        complete_ci_list.append(ci_sys_id)
        complete_ci_list_final = list(dict.fromkeys(complete_ci_list))
        
        # Step 3: Check for outages in related CIs
        if complete_ci_list_final: 
        
        # Query parameters
            PARAMS = {
                'sysparm_query': f"ciIN{complete_ci_list_final}^type=Planned",
                'sysparm_limit': '10000'
            }
            outage_url = f"{self.instance}/api/now/table/cmdb_ci_outage"
            outage_resp = requests.get(outage_url, auth=(self.username, self.password), headers=self.headers,  params=PARAMS)
            outages = outage_resp.json()['result']
        
            if outages:
                print("Outages found in related CIs:")
                related_outages = [out['number'] for out in outages]

                outage_map = {out['cmdb_ci']['value']: out for out in outages}
                for ci_id in complete_ci_list_final:
                    if ci_id in outage_map:
                        exact_outages.append(outage_map[ci_id])
                
            else:
                print("No outages in related CIs.")
        else:
            print("No related CIs found.")
        
        output = {
            "incident_details": f'{incident_details}',
            "affected_cis": tuple(complete_ci_list_final),
            "outage_details": f'{exact_outages}'
        }
        return output
            
    def get_related_cis(self, ci_sys_id, complete_ci_list):
        rel_url = f"{self.instance}/api/now/table/cmdb_rel_ci?sysparm_query=parent={ci_sys_id}"
        rel_resp = requests.get(rel_url, auth=(self.username, self.password), headers=self.headers)
        related_cis = [rel['child']['value'] for rel in rel_resp.json()['result']]
        if related_cis:
            complete_ci_list.extend(related_cis)
            for related_ci in related_cis:
                self.get_related_cis(related_ci, complete_ci_list)
        return complete_ci_list

    def post_incident_work_notes(self, incident_number, comment_text):
        query_url = f"{self.instance}/api/now/table/incident"
        params = {"sysparm_query": f"number={incident_number}", "sysparm_limit": 1}
        headers = {"Accept": "application/json"}
        
        response = requests.get(query_url, auth=(self.username, self.password), headers=headers, params=params)
        data = response.json()
        
        if response.status_code == 200 and data["result"]:
            incident_sys_id = data["result"][0]["sys_id"]

        # URL to the incident record
        url = f"{self.instance}/api/now/table/incident/{incident_sys_id}"
        
        
        # Payload to add a comment to 'work_notes' or 'comments'
        payload = {
            "work_notes": comment_text  # use "work_notes" if you want it to be private/internal
        }
        
        # Send PATCH request
        response = requests.patch(url, auth=(self.username, self.password),  headers=self.headers, json=payload)
        
        # Print response
        if response.status_code == 200:
            print("Comment added successfully.")
        else:
            print("Failed to add comment:", response.status_code, response.text)

    def get_business_services(self):
        url = f"{self.instance}/api/now/table/cmdb_ci_service"
        response = requests.get(url, auth=(self.username, self.password), headers=self.headers)
        response.raise_for_status()
        return response.json()['result']

    def get_relationships(self):
        url = f"{self.instance}/api/now/table/cmdb_rel_ci"
        response = requests.get(url, auth=(self.username, self.password), headers=self.headers)
        response.raise_for_status()
        return response.json()['result']

    def build_service_hierarchy(self, services, relationships):
        hierarchy = {}
        service_map = {s['sys_id']: s['name'] for s in services}

        for rel in relationships:
            parent_id = rel.get('parent', {}).get('value')
            child_id = rel.get('child', {}).get('value')

            if parent_id in service_map and child_id in service_map:
                parent_name = service_map[parent_id]
                child_name = service_map[child_id]
                hierarchy.setdefault(parent_name, []).append(child_name)
        
        return hierarchy

    
    


# --- Fetch CI Relationships ---
    def fetch_ci_relationships(self):
        TABLE = "cmdb_rel_ci"
        FIELDS = "parent,child,parent.name,parent.sys_id,child.name,child.sys_id"
        url = f"{self.instance}/api/now/table/{TABLE}"
        params = {
            'sysparm_fields': FIELDS
        }


        print(f"Fetching CI relationships from {url} ...")

        response = requests.get(
            url,
            auth=(self.username, self.password),
            headers=self.headers,
            params=params
        )

        if response.status_code != 200:
            raise Exception(f"Failed to fetch data: {response.status_code} {response.text}")

        data = response.json()["result"]
        json_formatted_data= json.dumps(data, indent=2)
        # print(f"{json_formatted_data}")
        print(f"Fetched {len(data)} relationships.")

        # Build dependency map: { "ci_name": { depends_on: [list of ci_names] } }
        cmdb = {}
        for rel in data:
            # parent = rel.get("parent", {}).get("name")
            parent = rel.get("parent.name")
            # child = rel.get("child", {}).get("name")
            # print(f"Fetched Parent {parent}.")
            child = rel.get("child.name")
            # child = rel.get("child", {}).get("name")
            # print(f"Fetched Child {child}.")
            if not parent or not child:
                continue

            if child not in cmdb:
                cmdb[child] = {"used_by": []}
            cmdb[child]["used_by"].append(parent)

            # Ensure parent is in the graph too
            if parent not in cmdb:
                cmdb[parent] = {"used_by": []}

        output = {
            "cmdb_service_relationship": f'{cmdb}'
        }
        return output