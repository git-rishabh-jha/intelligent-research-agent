from fastapi import APIRouter
router = APIRouter(prefix="/arxiv", tags=["arXiv"])

@router.get("/")
def get_arxiv_papers():
    return [
        {
            "title": "Attention is All You Need",
            "authors": ["Vaswani et al."],
            "link": "https://arxiv.org/abs/1706.03762"
        },
        {
            "title": "BERT: Pre-training of Deep Bidirectional Transformers",
            "authors": ["Google AI"],
            "link": "https://arxiv.org/abs/1810.04805"
        }
    ]