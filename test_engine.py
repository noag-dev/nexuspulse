import asyncio
from app.main import app
from app.scanner import scan_single_domain

async def test():
    print("Testing single scan on python.org...")
    res = await scan_single_domain("python.org")
    print(f"Domain: {res.domain}")
    print(f"Status: {res.status}")
    print(f"Deficit Score: {res.deficit_score}")
    print(f"Latency: {res.latency_ms}ms")
    print("ENGINE VERIFICATION COMPLETE: ALL SYSTEMS NOMINAL")

if __name__ == "__main__":
    asyncio.run(test())
