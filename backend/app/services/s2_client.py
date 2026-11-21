import asyncio
import hashlib
import logging
import os
import re
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.core.schema import S2Paper

logger = logging.getLogger(__name__)

S2_BASE = "https://api.semanticscholar.org/graph/v1"
OPENALEX_BASE = "https://api.openalex.org"
ARXIV_BASE = "https://export.arxiv.org/api/query"
DEFAULT_USER_AGENT = "ScholarGraph/1.0 (mailto:ramillahrushikesh@gmail.com)"


class S2Client:
    def __init__(self):
        self._s2_api_key = getattr(settings, "S2_API_KEY", "") or os.getenv("S2_API_KEY", "")
        self._openalex_api_key = getattr(settings, "OPENALEX_API_KEY", "") or os.getenv("OPENALEX_API_KEY", "")
        self._headers = {"x-api-key": self._s2_api_key} if self._s2_api_key else {}
        self._timeout = 30.0
        self._fast_timeout = 8.0

    @property
    def _oa_headers(self) -> dict:
        headers = {
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "application/json",
        }
        if self._openalex_api_key:
            headers["Authorization"] = f"Bearer {self._openalex_api_key}"
        return headers

    def _to_paper(self, data: dict) -> Optional[S2Paper]:
        if not data or not data.get("paperId"):
            return None
        try:
            return S2Paper(**data)
        except Exception as e:
            logger.debug(f"Failed to parse S2Paper from S2 data: {e}")
            return None

    def _reconstruct_abstract(self, inverted_index: Optional[dict]) -> Optional[str]:
        if not inverted_index or not isinstance(inverted_index, dict):
            return None
        try:
            word_pos = []
            for word, positions in inverted_index.items():
                if not isinstance(positions, list):
                    continue
                for pos in positions:
                    word_pos.append((pos, word))
            if not word_pos:
                return None
            word_pos.sort(key=lambda x: x[0])
            return " ".join(w for _, w in word_pos)
        except Exception:
            return None

    def _extract_corpus_id(self, raw_id: str) -> int:
        if not raw_id:
            return 0
        digits = "".join(c for c in raw_id.split("/")[-1] if c.isdigit())
        if digits:
            try:
                return int(digits)
            except ValueError:
                pass
        return int(hashlib.md5(raw_id.encode("utf-8")).hexdigest()[:8], 16)

    def _openalex_work_to_dict(self, work: dict) -> Optional[dict]:
        if not work:
            return None
        paper_id = work.get("id") or ""
        if not paper_id:
            return None

        abstract = self._reconstruct_abstract(work.get("abstract_inverted_index"))

        authors = []
        for a in work.get("authorships", []):
            if not isinstance(a, dict):
                continue
            auth_info = a.get("author") or {}
            name = auth_info.get("display_name") or a.get("raw_author_name") or "Unknown"
            author_id = auth_info.get("id")
            authors.append({"name": name, "authorId": author_id})

        venue = None
        primary_loc = work.get("primary_location") or {}
        if isinstance(primary_loc, dict):
            source = primary_loc.get("source") or {}
            if isinstance(source, dict):
                venue = source.get("display_name")

        oa = work.get("open_access") or {}
        oa_pdf = {"url": oa.get("oa_url")} if isinstance(oa, dict) and oa.get("oa_url") else None

        corpus_id = self._extract_corpus_id(paper_id)

        return {
            "paperId": paper_id,
            "corpusId": corpus_id,
            "title": work.get("title") or "Untitled",
            "abstract": abstract,
            "year": work.get("publication_year"),
            "citationCount": work.get("cited_by_count", 0),
            "influentialCitationCount": 0,
            "authors": authors,
            "venue": venue,
            "openAccessPdf": oa_pdf,
            "isOpenAccess": oa.get("is_oa") if isinstance(oa, dict) else None,
            "url": work.get("id"),
        }

    def _openalex_work_to_s2paper(self, work: dict) -> Optional[S2Paper]:
        data = self._openalex_work_to_dict(work)
        if not data:
            return None
        try:
            return S2Paper(**data)
        except Exception as e:
            logger.debug(f"Failed to instantiate S2Paper from OpenAlex work: {e}")
            return None

    async def search_papers(
        self,
        query: str,
        year: str = None,
        publication_types: list = None,
        open_access_pdf: bool = None,
        venue: list = None,
        fields_of_study: list = None,
        fields: list = None,
        publication_date_or_year: str = None,
        min_citation_count: int = None,
        limit: int = 10,
        bulk: bool = False,
        sort: str = None,
        match_title: bool = False,
    ) -> List[S2Paper]:
        # 1. Attempt Semantic Scholar first
        try:
            papers = await self._search_s2(
                query=query,
                year=year,
                publication_types=publication_types,
                open_access_pdf=open_access_pdf,
                venue=venue,
                fields_of_study=fields_of_study,
                fields=fields,
                publication_date_or_year=publication_date_or_year,
                min_citation_count=min_citation_count,
                limit=limit,
                bulk=bulk,
                sort=sort,
                match_title=match_title,
            )
            if papers:
                return papers
        except Exception as e:
            logger.warning(
                f"Semantic Scholar search unavailable ({type(e).__name__}: {e}); "
                "falling back to OpenAlex / arXiv federated search"
            )

        # 2. Attempt OpenAlex search
        target_limit = 1 if match_title else min(max(limit, 1), 100)
        try:
            papers = await self._search_openalex(
                query=query,
                year=year or publication_date_or_year,
                open_access_pdf=open_access_pdf,
                min_citation_count=min_citation_count,
                limit=target_limit,
                sort=sort,
                match_title=match_title,
            )
            if papers:
                return papers[:target_limit]
        except Exception as e:
            logger.warning(
                f"OpenAlex search failed ({type(e).__name__}: {e}); "
                "falling back to arXiv"
            )

        # 3. Federated fallback to arXiv + OpenAlex entity enrichment
        try:
            papers = await self._search_arxiv(
                query=query,
                year=year or publication_date_or_year,
                min_citation_count=min_citation_count,
                limit=target_limit,
                match_title=match_title,
            )
            if papers:
                return papers[:target_limit]
        except Exception as e:
            logger.error(f"arXiv retrieval failed ({type(e).__name__}: {e})")

        return []

    async def _search_s2(
        self,
        query: str,
        year: str = None,
        publication_types: list = None,
        open_access_pdf: bool = None,
        venue: list = None,
        fields_of_study: list = None,
        fields: list = None,
        publication_date_or_year: str = None,
        min_citation_count: int = None,
        limit: int = 10,
        bulk: bool = False,
        sort: str = None,
        match_title: bool = False,
    ) -> List[S2Paper]:
        if fields is None:
            fields = ["paperId", "title", "abstract", "year", "authors", "citationCount"]

        params: dict = {
            "query": query,
            "fields": ",".join(fields),
            "limit": 1 if match_title else min(limit, 100),
        }
        if year:
            params["year"] = year
        if publication_types:
            params["publicationTypes"] = ",".join(publication_types)
        if venue:
            params["venue"] = ",".join(venue)
        if fields_of_study:
            params["fieldsOfStudy"] = ",".join(fields_of_study)
        if publication_date_or_year:
            params["publicationDateOrYear"] = publication_date_or_year
        if min_citation_count is not None:
            params["minCitationCount"] = min_citation_count
        if sort:
            params["sort"] = sort

        timeout = self._fast_timeout if not self._headers else self._timeout
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                f"{S2_BASE}/paper/search",
                params=params,
                headers=self._headers,
            )
            resp.raise_for_status()

        papers = [self._to_paper(item) for item in resp.json().get("data", [])]
        return [p for p in papers if p is not None]

    async def _search_openalex(
        self,
        query: str,
        year: Optional[str] = None,
        open_access_pdf: Optional[bool] = None,
        min_citation_count: Optional[int] = None,
        limit: int = 10,
        sort: Optional[str] = None,
        match_title: bool = False,
    ) -> List[S2Paper]:
        params: dict = {
            "search": query,
            "per_page": min(max(limit, 1), 100),
        }
        filters = []
        if open_access_pdf:
            filters.append("is_oa:true")
        if year:
            filters.append(f"publication_year:{year}")
        if min_citation_count is not None:
            filters.append(f"cited_by_count:>={min_citation_count}")
        if filters:
            params["filter"] = ",".join(filters)

        if sort:
            if "citation" in sort.lower():
                params["sort"] = "cited_by_count:desc"
            elif "year" in sort.lower() or "date" in sort.lower():
                params["sort"] = "publication_date:desc"

        async with httpx.AsyncClient(headers=self._oa_headers, timeout=self._fast_timeout) as client:
            resp = await client.get(f"{OPENALEX_BASE}/works", params=params)
            resp.raise_for_status()
            data = resp.json()

        works = data.get("results", [])
        papers = [self._openalex_work_to_s2paper(w) for w in works]
        return [p for p in papers if p is not None]

    async def _search_arxiv(
        self,
        query: str,
        year: Optional[str] = None,
        min_citation_count: Optional[int] = None,
        limit: int = 10,
        match_title: bool = False,
    ) -> List[S2Paper]:
        clean = query.strip().replace('"', "")
        phrase_q = urllib.parse.quote(f'ti:"{clean}" OR all:"{clean}"')
        url = f"{ARXIV_BASE}?search_query={phrase_q}&max_results={max(limit, 3)}&sortBy=relevance"

        async with httpx.AsyncClient(headers={"User-Agent": DEFAULT_USER_AGENT}, timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url)
            root = ET.fromstring(resp.text)
            entries = root.findall("{http://www.w3.org/2005/Atom}entry")

            if not entries:
                kw_q = urllib.parse.quote(f"all:{clean}")
                url2 = f"{ARXIV_BASE}?search_query={kw_q}&max_results={max(limit, 3)}&sortBy=relevance"
                resp2 = await client.get(url2)
                root = ET.fromstring(resp2.text)
                entries = root.findall("{http://www.w3.org/2005/Atom}entry")

            async def enrich_entry(entry) -> Optional[S2Paper]:
                raw_id = entry.find("{http://www.w3.org/2005/Atom}id").text.strip()
                match = re.search(r"arxiv\.org/abs/([^/]+)", raw_id)
                aid = match.group(1) if match else raw_id
                clean_aid = re.sub(r"v\d+$", "", aid)

                # Attempt OpenAlex work lookup by arXiv ID for citations and canonical data
                try:
                    oa_resp = await client.get(
                        f"{OPENALEX_BASE}/works/https://arxiv.org/abs/{clean_aid}",
                        headers=self._oa_headers,
                        timeout=5.0,
                    )
                    if oa_resp.status_code == 200:
                        paper = self._openalex_work_to_s2paper(oa_resp.json())
                        if paper:
                            return paper
                except Exception:
                    pass

                # Fallback to arXiv entry fields
                title = entry.find("{http://www.w3.org/2005/Atom}title").text.strip().replace("\n", " ")
                summary = entry.find("{http://www.w3.org/2005/Atom}summary").text.strip().replace("\n", " ")
                published = entry.find("{http://www.w3.org/2005/Atom}published").text.strip()
                pub_year = int(published[:4]) if published else None

                authors = []
                for a in entry.findall("{http://www.w3.org/2005/Atom}author"):
                    name = a.find("{http://www.w3.org/2005/Atom}name")
                    if name is not None and name.text:
                        authors.append({"name": name.text.strip(), "authorId": None})

                return S2Paper(
                    paperId=f"ARXIV:{clean_aid}",
                    corpusId=self._extract_corpus_id(clean_aid),
                    title=title,
                    abstract=summary,
                    year=pub_year,
                    citationCount=0,
                    authors=authors,
                    venue="arXiv",
                    openAccessPdf={"url": f"https://arxiv.org/pdf/{clean_aid}.pdf"},
                    isOpenAccess=True,
                    url=f"https://arxiv.org/abs/{clean_aid}",
                )

            tasks = [enrich_entry(e) for e in entries[:limit]]
            papers = await asyncio.gather(*tasks)

        valid_papers = [p for p in papers if p is not None]
        # Apply local filters if needed
        if min_citation_count is not None:
            valid_papers = [p for p in valid_papers if (p.citationCount or 0) >= min_citation_count]
        if year:
            try:
                target_year = int(year)
                valid_papers = [p for p in valid_papers if p.year == target_year]
            except ValueError:
                pass

        return valid_papers

    async def _resolve_openalex_id(self, client: httpx.AsyncClient, paper_id: str) -> Optional[str]:
        if not paper_id:
            return None
        paper_id = paper_id.strip()
        if paper_id.startswith("https://openalex.org/"):
            return paper_id.split("/")[-1]
        if paper_id.startswith("W") and paper_id[1:].isdigit():
            return paper_id
        if paper_id.startswith("ARXIV:"):
            arxiv_id = paper_id[6:]
            clean_aid = re.sub(r"v\d+$", "", arxiv_id)
            try:
                resp = await client.get(
                    f"{OPENALEX_BASE}/works/https://arxiv.org/abs/{clean_aid}",
                    headers=self._oa_headers,
                    timeout=5.0,
                )
                if resp.status_code == 200:
                    return resp.json().get("id", "").split("/")[-1]
            except Exception:
                pass
        if paper_id.startswith("10.") or "doi.org" in paper_id:
            try:
                resp = await client.get(
                    f"{OPENALEX_BASE}/works/{paper_id}",
                    headers=self._oa_headers,
                    timeout=5.0,
                )
                if resp.status_code == 200:
                    return resp.json().get("id", "").split("/")[-1]
            except Exception:
                pass
        return None

    async def get_paper_citations(
        self,
        paper_id: str,
        fields: list = None,
        limit: int = 1000,
    ) -> List[dict]:
        # 1. Try S2
        try:
            if fields is None:
                fields = [
                    "paperId", "corpusId", "title", "abstract", "authors",
                    "year", "citationCount", "influentialCitationCount",
                ]
            params = {
                "fields": ",".join(f"citingPaper.{f}" for f in fields),
                "limit": min(limit, 1000),
            }
            timeout = self._fast_timeout if not self._headers else self._timeout
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(
                    f"{S2_BASE}/paper/{paper_id}/citations",
                    params=params,
                    headers=self._headers,
                )
                resp.raise_for_status()

            return [
                item["citingPaper"]
                for item in resp.json().get("data", [])
                if item.get("citingPaper")
            ]
        except Exception as e:
            logger.warning(
                f"S2 get_paper_citations failed ({type(e).__name__}: {e}); "
                "falling back to OpenAlex"
            )

        # 2. Fall back to OpenAlex
        try:
            async with httpx.AsyncClient(headers=self._oa_headers, timeout=self._timeout) as client:
                oa_id = await self._resolve_openalex_id(client, paper_id)
                if not oa_id:
                    oa_id = paper_id.split("/")[-1]

                resp = await client.get(
                    f"{OPENALEX_BASE}/works",
                    params={"filter": f"cites:{oa_id}", "per_page": min(limit, 100)},
                )
                resp.raise_for_status()
                data = resp.json()
                results = [
                    self._openalex_work_to_dict(w)
                    for w in data.get("results", [])
                ]
                return [r for r in results if r is not None]
        except Exception as e:
            logger.error(f"OpenAlex get_paper_citations failed ({type(e).__name__}: {e})")
            return []

    async def get_paper_references(
        self,
        paper_id: str,
        fields: list = None,
        limit: int = 1000,
    ) -> List[dict]:
        # 1. Try S2
        try:
            if fields is None:
                fields = [
                    "paperId", "corpusId", "title", "abstract", "authors",
                    "year", "citationCount", "influentialCitationCount",
                ]
            params = {
                "fields": ",".join(f"citedPaper.{f}" for f in fields),
                "limit": min(limit, 1000),
            }
            timeout = self._fast_timeout if not self._headers else self._timeout
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(
                    f"{S2_BASE}/paper/{paper_id}/references",
                    params=params,
                    headers=self._headers,
                )
                resp.raise_for_status()

            return [
                item["citedPaper"]
                for item in resp.json().get("data", [])
                if item.get("citedPaper")
            ]
        except Exception as e:
            logger.warning(
                f"S2 get_paper_references failed ({type(e).__name__}: {e}); "
                "falling back to OpenAlex"
            )

        # 2. Fall back to OpenAlex
        try:
            async with httpx.AsyncClient(headers=self._oa_headers, timeout=self._timeout) as client:
                oa_id = await self._resolve_openalex_id(client, paper_id)
                if not oa_id:
                    oa_id = paper_id.split("/")[-1]

                work_resp = await client.get(f"{OPENALEX_BASE}/works/{oa_id}")
                work_resp.raise_for_status()
                ref_urls = work_resp.json().get("referenced_works", [])
                if not ref_urls:
                    return []

                target_refs = ref_urls[:min(limit, 50)]
                ref_ids = "|".join(r.split("/")[-1] for r in target_refs)
                batch_resp = await client.get(
                    f"{OPENALEX_BASE}/works",
                    params={"filter": f"openalex:{ref_ids}", "per_page": len(target_refs)},
                )
                batch_resp.raise_for_status()
                results = [
                    self._openalex_work_to_dict(w)
                    for w in batch_resp.json().get("results", [])
                ]
                return [r for r in results if r is not None]
        except Exception as e:
            logger.error(f"OpenAlex get_paper_references failed ({type(e).__name__}: {e})")
            return []
