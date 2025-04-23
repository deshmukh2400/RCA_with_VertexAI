import os
import openai

# Azure OpenAI settings
openai.api_type    = "azure"
openai.api_base    = os.getenv("AZURE_OPENAI_ENDPOINT")
openai.api_version = "2023-05-15"
openai.api_key     = os.getenv("AZURE_OPENAI_KEY")

DEPLOYMENT_NAME = os.getenv("AZURE_DEPLOYMENT_NAME", "gpt-35-turbo")

def format_alerts(alerts):
    return "\n".join(
        f"- [{a['timestamp']}] {a['ci']} - {a.get('type','alert')} - {a['message']}"
        for a in alerts
    )

def format_changes(changes):
    return "\n".join(
        f"- [{c['timestamp']}] {c['ci']} - {c.get('change', c.get('description',''))}"
        for c in changes
    )

def format_cmdb(cmdb):
    lines = []
    for ci, props in cmdb.items():
        for dep in props.get("depends_on", []):
            lines.append(f"{ci} --> {dep}")
    return "\n".join(lines)

def generate_summary(alerts, changes, cmdb):
    alert_text  = format_alerts(alerts)
    change_text = format_changes(changes)
    cmdb_text   = format_cmdb(cmdb)

    prompt = f"""
You are an expert SRE AI assistant helping diagnose IT infrastructure issues.

1. Timeline of Alerts:
{alert_text}

2. Recent Changes:
{change_text}

3. CI Dependency Graph (top-down):
{cmdb_text}

Please analyze and answer:
- What is the most probable root cause of the issue?
- Is it linked to a recent change? Or is it an infrastructure failure?
- What evidence supports this?
- Which systems are impacted, and how?

Respond concisely and professionally.
"""

    response = openai.ChatCompletion.create(
        engine=DEPLOYMENT_NAME,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        temperature=0.3
    )
    return response.choices[0].message["content"]