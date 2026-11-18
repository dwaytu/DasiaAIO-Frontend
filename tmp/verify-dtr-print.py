"""Verify the actual Chromium export from the isolated DTR browser scenario."""

import json
import re
from pathlib import Path

from pypdf import PdfReader


folder = Path("output/playwright/final-acceptance-2026-10-27/operational").resolve()
pdf = folder / "print-dtr-a4-landscape.pdf"
pages = PdfReader(pdf).pages
assert len(pages) > 1, "The fixture must span multiple printed pages"

rows = []
page_results = []
for page in pages:
    page_text = page.extract_text()
    width, height = (float(page.mediabox.width), float(page.mediabox.height))
    assert abs(width - 841.89) < 2 and abs(height - 595.28) < 2, (width, height)
    assert re.search(r"GUARD\s+SITE\s+SCHEDULED\s+CHECK IN\s+CHECK OUT", page_text)
    page_rows = [int(n) for n in re.findall(r"(?m)^Guard (\d+)\b", page_text)]
    assert len(re.findall(r"\bcompleted\b", page_text)) == len(page_rows)
    rows.extend(page_rows)
    page_results.append({"widthPoints": width, "heightPoints": height, "rows": page_rows})

assert rows == list(range(1, 51)), rows
assert "Reporting period:" in pages[0].extract_text()
last_page = pages[-1].extract_text()
for label in ("Prepared by", "Reviewed by", "Received by"):
    assert label in last_page, label
assert last_page.count("Signature / Date") == 3

result = {"passed": True, "pdfPath": str(pdf), "rowCount": len(rows), "pages": page_results}
(folder / "dtr-pdf-verification.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(f"Verified {len(rows)} rows across {len(pages)} A4 landscape pages with repeating headers and three signatures.")
