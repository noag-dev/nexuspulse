import asyncio
import re
import time
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any

class AuditResult(BaseModel):
    url: str
    domain: str
    status: str
    latency_ms: float = 0.0
    title: str = "N/A"
    description: str = "N/A"
    cms_tech: List[str] = []
    has_ssl: bool = False
    has_analytics: bool = False
    analytics_tools: List[str] = []
    has_meta_pixel: bool = False
    is_mobile_ready: bool = False
    emails_found: List[str] = []
    phones_found: List[str] = []
    deficit_score: int = 0
    pitch_hook: str = ""
    opportunities: List[str] = []

TECH_PATTERNS = {
    "WordPress": [r"wp-content", r"wp-includes", r"wordpress"],
    "Shopify": [r"cdn\.shopify\.com", r"shopify"],
    "Webflow": [r"assets\.website-files\.com", r"webflow"],
    "Squarespace": [r"squarespace\.com", r"static1\.squarespace\.com"],
    "Wix": [r"wix\.com", r"wixstatic\.com"],
    "Next.js": [r"/_next/", r"__NEXT_DATA__"],
    "React": [r"react", r"react-dom"],
    "HubSpot": [r"hs-scripts\.com", r"hubspot"],
}

ANALYTICS_PATTERNS = {
    "Google Analytics 4": [r"gtag\(['\"]config['\"],\s*['\"]G-[A-Z0-9]+['\"]", r"googletagmanager\.com/gtag/js\?id=G-"],
    "Google Tag Manager": [r"googletagmanager\.com/gtm\.js\?id=GTM-", r"GTM-[A-Z0-9]+"],
    "Meta / Facebook Pixel": [r"connect\.facebook\.net", r"fbq\(['\"]init['\"]"],
    "Hotjar": [r"static\.hotjar\.com"],
    "Segment": [r"cdn\.segment\.com/analytics\.js"],
}

async def scan_single_domain(raw_url: str) -> AuditResult:
    if not raw_url.startswith(("http://", "https://")):
        target_url = "https://" + raw_url
    else:
        target_url = raw_url
        
    parsed = urlparse(target_url)
    domain = parsed.netloc or raw_url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    start_time = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, verify=False) as client:
            resp = await client.get(target_url, headers=headers)
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 1)
            
            has_ssl = str(resp.url).startswith("https://")
            html_text = resp.text
            soup = BeautifulSoup(html_text, "html.parser")
            
            # Title & Meta Description
            title_tag = soup.find("title")
            title = title_tag.text.strip() if title_tag else "No Title"
            
            desc_tag = soup.find("meta", attrs={"name": re.compile(r"description", re.I)})
            description = desc_tag.get("content", "").strip() if desc_tag else "No Description"
            
            # Viewport check (Mobile readiness)
            viewport_tag = soup.find("meta", attrs={"name": re.compile(r"viewport", re.I)})
            is_mobile_ready = viewport_tag is not None
            
            # Detect Technologies
            detected_tech = []
            for tech, patterns in TECH_PATTERNS.items():
                for pat in patterns:
                    if re.search(pat, html_text, re.IGNORECASE):
                        if tech not in detected_tech:
                            detected_tech.append(tech)
                            
            # Detect Analytics & Tracking
            detected_analytics = []
            has_pixel = False
            for tool, patterns in ANALYTICS_PATTERNS.items():
                for pat in patterns:
                    if re.search(pat, html_text, re.IGNORECASE):
                        if tool not in detected_analytics:
                            detected_analytics.append(tool)
                        if "Meta" in tool:
                            has_pixel = True
                            
            has_analytics = len(detected_analytics) > 0
            
            # Contact scraping (emails & phones)
            email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
            emails = list(set(re.findall(email_pattern, html_text)))
            # Filter junk file extensions resembling emails
            valid_emails = [e for e in emails if not e.endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.js', '.css'))][:3]
            
            phone_pattern = r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}'
            phones = list(set(re.findall(phone_pattern, html_text)))
            valid_phones = [p.strip() for p in phones if len(p.strip()) >= 8][:2]

            # Calculate Deficit Score (0 - 100)
            # Higher score = more high-value problems to fix = PRIME CLIENT
            deficit_score = 10
            opportunities = []
            
            if not has_ssl:
                deficit_score += 35
                opportunities.append("Missing or Broken SSL Encryption (Insecure warning for visitors)")
            if not is_mobile_ready:
                deficit_score += 25
                opportunities.append("Missing Mobile Viewport optimization (Poor mobile conversion)")
            if not has_pixel:
                deficit_score += 20
                opportunities.append("No Meta / Retargeting Pixel installed (Losing ad ROI & repeat visitors)")
            if "Google Tag Manager" not in detected_analytics:
                deficit_score += 15
                opportunities.append("Missing Google Tag Manager infrastructure")
            if elapsed_ms > 1200:
                deficit_score += 15
                opportunities.append(f"Slow response latency ({elapsed_ms}ms) damaging SEO ranking")

            deficit_score = min(deficit_score, 100)

            # Generate Sales Hook Pitch
            primary_issue = opportunities[0] if opportunities else "Optimization of Conversion Funnel"
            pitch_hook = (
                f"Revenue leakage identified on {domain}: Missing {primary_issue}. "
                f"Audit identifies quick optimization to recapture unconverted traffic."
            )

            status_str = "Healthy (200 OK)" if resp.status_code == 200 else f"HTTP {resp.status_code}"
            if resp.status_code == 403:
                status_str = "WAF Protected (Cloudflare/Firewall)"
                opportunities.append("Enterprise firewall detected. Manual verification recommended.")
                deficit_score = 25

            return AuditResult(
                url=str(resp.url),
                domain=domain,
                status=status_str,
                latency_ms=elapsed_ms,
                title=title[:80],
                description=description[:160],
                cms_tech=detected_tech,
                has_ssl=has_ssl,
                has_analytics=has_analytics,
                analytics_tools=detected_analytics,
                has_meta_pixel=has_pixel,
                is_mobile_ready=is_mobile_ready,
                emails_found=valid_emails,
                phones_found=valid_phones,
                deficit_score=deficit_score,
                pitch_hook=pitch_hook,
                opportunities=opportunities
            )

    except Exception as e:
        err_msg = str(e)
        return AuditResult(
            url=target_url,
            domain=domain,
            status="Connection Filtered / Bot Shield",
            latency_ms=0.0,
            deficit_score=15,
            pitch_hook=f"Target {domain} enforces advanced network filtering or geo-restrictions.",
            opportunities=["Connection shielded by network policy or rate limit."]
        )

async def scan_domain_batch(urls: List[str]) -> List[AuditResult]:
    tasks = [scan_single_domain(u.strip()) for u in urls if u.strip()]
    return await asyncio.gather(*tasks)
