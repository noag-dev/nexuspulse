import io
import csv
from typing import List
from fastapi import FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os

from app.scanner import scan_domain_batch, scan_single_domain, AuditResult

app = FastAPI(title="NexusPulse Intelligence Engine", version="1.0.0")

# Mount Static Files
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

class ScanRequest(BaseModel):
    domains: List[str]

class SingleScanRequest(BaseModel):
    url: str

@app.get("/")
async def serve_index():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "NexusPulse Engine Online. Static UI pending."}

@app.post("/api/scan", response_model=List[AuditResult])
async def run_scan(request: ScanRequest):
    if not request.domains:
        raise HTTPException(status_code=400, detail="Domain list cannot be empty.")
    # Limit batch to 25 at a time for stability
    targets = request.domains[:25]
    results = await scan_domain_batch(targets)
    return results

@app.post("/api/scan-single", response_model=AuditResult)
async def run_single_scan(request: SingleScanRequest):
    if not request.url:
        raise HTTPException(status_code=400, detail="Target URL required.")
    return await scan_single_domain(request.url)

@app.post("/api/export-csv")
async def export_csv(results: List[AuditResult]):
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Domain", "Status", "Latency (ms)", "Title", "CMS/Tech", 
        "SSL Enabled", "Analytics Installed", "Meta Pixel", 
        "Mobile Ready", "Emails", "Phones", "Deficit Score", 
        "Primary Opportunities", "Automated Pitch Hook"
    ])
    
    for r in results:
        writer.writerow([
            r.domain,
            r.status,
            r.latency_ms,
            r.title,
            ", ".join(r.cms_tech),
            "YES" if r.has_ssl else "NO",
            ", ".join(r.analytics_tools) if r.analytics_tools else "NONE",
            "YES" if r.has_meta_pixel else "NO",
            "YES" if r.is_mobile_ready else "NO",
            ", ".join(r.emails_found),
            ", ".join(r.phones_found),
            f"{r.deficit_score}/100",
            " | ".join(r.opportunities),
            r.pitch_hook
        ])
        
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=nexuspulse_intelligence_report.csv"
    return response

@app.get("/api/presets")
async def get_presets():
    return {
        "presets": [
            {
                "category": "High-Ticket Commercial Contracting",
                "domains": ["angieslist.com", "houzz.com", "buildertrend.com", "porch.com"]
            },
            {
                "category": "Private Healthcare & Aesthetic Clinics",
                "domains": ["realself.com", "zocdoc.com", "treatwell.co.uk"]
            },
            {
                "category": "Boutique E-commerce & Direct-to-Consumer",
                "domains": ["allbirds.com", "gymshark.com", "glossier.com"]
            }
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
