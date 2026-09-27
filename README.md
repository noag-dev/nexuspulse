# NexusPulse // Autonomous B2B Intelligence & Revenue Leak Radar

NexusPulse is an institutional-grade, automated intelligence engine designed to detect commercial and conversion bottlenecks across digital business infrastructure.

## Core Capabilities
- **Parallel Asynchronous Deep Inspection:** Scans domain SSL, server response latencies, and conversion infrastructure.
- **Conversion Pixel & Analytics Detection:** Identifies missing Google Analytics 4, Google Tag Manager, and Meta Retargeting Pixels.
- **Automated Deficit Scoring (0-100):** Mathematically rates the commercial vulnerability of target domains.
- **Instant Printable Executive Audits:** Generates client-ready PDF technical diagnostic reports.
- **High-Conversion Outreach Generation:** Synthesizes pinpoint sales hooks ready for automated or manual prospecting.

## Architecture
- **Backend:** FastAPI, Uvicorn, HTTPX Async Engine, BeautifulSoup4
- **Frontend:** Modern Dark-Mode UI, Tailwind CSS, Vanilla JS
- **Deployment:** Render / Docker ready with `render.yaml`

## Running Locally
```bash
git clone https://github.com/noag-dev/nexuspulse.git
cd nexuspulse
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Open `http://localhost:8000` in your browser.
