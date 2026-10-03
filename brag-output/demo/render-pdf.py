from pathlib import Path
import fitz
assets=Path(__file__).resolve().parents[1]/'composition/assets'
doc=fitz.open(assets/'demo-report.pdf')
for i in range(min(2,len(doc))):
 doc[i].get_pixmap(matrix=fitz.Matrix(2,2)).save(str(assets/f'report-page-{i+1}.png'))
print(f'Rendered {min(2,len(doc))} pages from actual application PDF renderer')
