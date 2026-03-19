from PyPDF2 import PdfReader
def extract_text_from_pdf(filepath: str) -> str:
    reader = PdfReader(filepath)
    text = ""

    for page in reader.pages:
        text += page.extract_text() or ""

    return text