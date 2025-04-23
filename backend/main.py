from flask import Flask, jsonify, render_template, request
import json
import os
from backend.llm_summary import generate_summary

app = Flask(
    __name__,
    template_folder="../frontend/templates",
    static_folder="../frontend/static"
)

# Load default/mock data
with open("backend/data/alerts.json") as f:
    default_alerts = json.load(f)
with open("backend/data/changes.json") as f:
    default_changes = json.load(f)
with open("backend/data/cmdb.json") as f:
    default_cmdb = json.load(f)

def build_alert_timeline(alerts):
    return sorted(alerts, key=lambda x: x["timestamp"])

@app.route("/")
def index():
    return render_template("index.html")

# GET uses default/mock data
@app.route("/api/rca", methods=["GET"])
def get_rca():
    llm_output = generate_summary(default_alerts, default_changes, default_cmdb)
    return jsonify({
        "root_cause": llm_output.strip(),
        "category": "AI-Powered Analysis",
        "timeline": build_alert_timeline(default_alerts)
    })

# POST accepts dynamic input
@app.route("/api/rca", methods=["POST"])
def post_rca():
    data = request.get_json()
    alerts = data.get("alerts", [])
    changes = data.get("changes", [])
    cmdb = data.get("cmdb", {})
    llm_output = generate_summary(alerts, changes, cmdb)
    return jsonify({
        "root_cause": llm_output.strip(),
        "category": "AI-Powered Analysis",
        "timeline": build_alert_timeline(alerts)
    })

@app.route("/api/cmdb", methods=["GET"])
def get_cmdb():
    return jsonify(default_cmdb)

if __name__ == "__main__":
    app.run(debug=True)