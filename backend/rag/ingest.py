"""
Document Ingestion Pipeline for Compliance Knowledge Base.
Processes PDF and text documents, chunks them with metadata, and stores in ChromaDB.

Chunking Strategy:
- Chunk size: 1000 tokens (compliance docs need enough context per chunk)
- Overlap: 200 tokens (regulatory clauses often span paragraphs)
- Metadata: country, regulation_name, document_type, source_url, section_topic

Why these choices:
- Larger chunks preserve regulatory context (a clause reference in paragraph 2
  may depend on definitions in paragraph 1)
- Overlap ensures cross-paragraph requirements aren't split
- Rich metadata enables filtered retrieval (e.g., "only Germany + GDPR docs")
"""
import os
import json
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
import chromadb
from chromadb.config import Settings

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import (
    CHROMA_PERSIST_DIR,
    CHROMA_COLLECTION_NAME,
    EMBEDDING_MODEL,
)


# --- Metadata Schema ---
# Each document must have a metadata JSON sidecar file
# Example: gdpr_summary.pdf → gdpr_summary.metadata.json
# {
#     "country": "DE",
#     "regulation_name": "GDPR",
#     "document_type": "regulation_summary",  # regulation_summary | cloud_compliance | data_transfer | law_firm_guide
#     "source_url": "https://eur-lex.europa.eu/...",
#     "section_topics": ["data_residency", "cross_border_transfer", "consent"],
#     "year": 2024
# }


def load_metadata(doc_path: str) -> dict:
    """Load metadata sidecar JSON for a document."""
    metadata_path = doc_path.rsplit(".", 1)[0] + ".metadata.json"
    if os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            return json.load(f)
    # Default metadata if no sidecar found
    return {
        "country": "UNKNOWN",
        "regulation_name": "UNKNOWN",
        "document_type": "general",
        "source_url": "",
        "section_topics": [],
        "year": 2024,
    }


def load_documents(docs_dir: str) -> list:
    """Load all PDF and text documents from the compliance_docs directory."""
    documents = []
    docs_path = Path(docs_dir)

    for file_path in docs_path.glob("**/*"):
        if file_path.suffix == ".pdf":
            loader = PyPDFLoader(str(file_path))
            docs = loader.load()
        elif file_path.suffix in [".txt", ".md"]:
            loader = TextLoader(str(file_path))
            docs = loader.load()
        else:
            continue

        # Attach metadata to each document
        metadata = load_metadata(str(file_path))
        for doc in docs:
            doc.metadata.update(metadata)
            doc.metadata["source_file"] = file_path.name

        documents.extend(docs)
        print(f"  Loaded: {file_path.name} ({len(docs)} pages/sections)")

    return documents


def chunk_documents(documents: list) -> list:
    """
    Chunk documents with regulatory-aware splitting.
    Uses RecursiveCharacterTextSplitter with separators optimized for legal/compliance text.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=[
            "\n## ",       # Markdown headers (section breaks)
            "\nArticle ",  # Legal article breaks
            "\nSection ",  # Section breaks
            "\n\n",        # Paragraph breaks
            "\n",          # Line breaks
            ". ",          # Sentence breaks
            " ",           # Word breaks (last resort)
        ],
        length_function=len,
    )

    chunks = splitter.split_documents(documents)
    print(f"  Created {len(chunks)} chunks from {len(documents)} documents")
    return chunks


def create_chroma_collection(chunks: list):
    """Store chunks in ChromaDB with metadata for filtered retrieval."""
    # Initialize embedding model
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)

    # Initialize ChromaDB
    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

    # Delete existing collection if it exists (fresh ingest)
    try:
        client.delete_collection(CHROMA_COLLECTION_NAME)
        print("  Deleted existing collection")
    except Exception:
        pass

    collection = client.create_collection(
        name=CHROMA_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    # Prepare data for ChromaDB
    texts = [chunk.page_content for chunk in chunks]
    metadatas = []
    ids = []

    for i, chunk in enumerate(chunks):
        meta = {
            "country": chunk.metadata.get("country", "UNKNOWN"),
            "regulation_name": chunk.metadata.get("regulation_name", "UNKNOWN"),
            "document_type": chunk.metadata.get("document_type", "general"),
            "source_url": chunk.metadata.get("source_url", ""),
            "source_file": chunk.metadata.get("source_file", ""),
            "year": str(chunk.metadata.get("year", "2024")),
        }
        # ChromaDB doesn't support list values, so join section_topics
        topics = chunk.metadata.get("section_topics", [])
        if isinstance(topics, list):
            meta["section_topics"] = ",".join(topics)
        else:
            meta["section_topics"] = str(topics)

        metadatas.append(meta)
        ids.append(f"chunk_{i:05d}")

    # Embed and store in batches (ChromaDB has batch size limits)
    batch_size = 100
    for start in range(0, len(texts), batch_size):
        end = min(start + batch_size, len(texts))
        batch_embeddings = embeddings.embed_documents(texts[start:end])

        collection.add(
            ids=ids[start:end],
            documents=texts[start:end],
            embeddings=batch_embeddings,
            metadatas=metadatas[start:end],
        )
        print(f"  Stored batch {start // batch_size + 1} ({end}/{len(texts)} chunks)")

    print(f"\n✅ Ingestion complete: {len(texts)} chunks stored in ChromaDB")
    print(f"   Collection: {CHROMA_COLLECTION_NAME}")
    print(f"   Persist dir: {CHROMA_PERSIST_DIR}")

    return collection


def ingest_all():
    """Main ingestion pipeline."""
    docs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "compliance_docs")

    print("=" * 60)
    print("📄 Starting Document Ingestion Pipeline")
    print("=" * 60)

    if not os.path.exists(docs_dir):
        os.makedirs(docs_dir)
        print(f"\n⚠️  Created empty docs directory: {docs_dir}")
        print("   Please add compliance documents and their metadata JSON files.")
        print("   Then run this script again.")
        _create_sample_docs(docs_dir)
        return

    print(f"\n📁 Loading documents from: {docs_dir}")
    documents = load_documents(docs_dir)

    if not documents:
        print("\n⚠️  No documents found. Creating sample documents...")
        _create_sample_docs(docs_dir)
        documents = load_documents(docs_dir)

    print(f"\n✂️  Chunking {len(documents)} documents...")
    chunks = chunk_documents(documents)

    print(f"\n💾 Storing in ChromaDB...")
    create_chroma_collection(chunks)


def _create_sample_docs(docs_dir: str):
    """Create sample compliance documents for demo purposes."""
    samples = {
        "us_ccpa_summary.txt": {
            "content": """# California Consumer Privacy Act (CCPA/CPRA) - Summary for Technical PMs

## Overview
The CCPA (as amended by CPRA) gives California consumers rights over their personal data.
Applies to businesses that: collect personal info of 100,000+ consumers/households annually,
derive 50%+ revenue from selling personal info, or have gross annual revenue > $25 million.

## Key Requirements for Tech Teams

### Data Collection & Storage
- Must disclose categories of personal information collected at or before collection
- Must provide a "Do Not Sell or Share My Personal Information" link
- Must honor consumer requests to delete their data within 45 days
- Data minimization: only collect data reasonably necessary for the disclosed purpose

### Data Residency
- No strict data residency requirement (data CAN leave California/US)
- However, if transferring to third parties, must ensure contractual protections
- Cross-border transfers to countries without adequate protections require additional safeguards

### Cloud Infrastructure
- AWS US regions: us-east-1, us-east-2, us-west-1, us-west-2 (all compliant)
- Azure: multiple US regions available
- GCP: multiple US regions available
- No restriction on specific cloud providers

### Technical Implementation Requirements
- Must implement verifiable consumer request handling system
- Must maintain records of consumer requests for 24 months
- Must implement reasonable security measures (encryption, access controls)
- Must conduct annual cybersecurity audits (CPRA requirement)

### Enforcement
- California Privacy Protection Agency (CPPA) enforces
- Fines: up to $2,500 per violation, $7,500 per intentional violation
- Private right of action for data breaches

### Impact on Product Launches
- If your product collects any user data from California residents, CCPA applies
- Must have privacy policy, data deletion capability, and opt-out mechanism BEFORE launch
- Analytics, cookies, and tracking pixels all count as "personal information"
""",
            "metadata": {
                "country": "US",
                "regulation_name": "CCPA/CPRA",
                "document_type": "regulation_summary",
                "source_url": "https://oag.ca.gov/privacy/ccpa",
                "section_topics": ["data_collection", "data_residency", "cloud_infrastructure", "enforcement"],
                "year": 2024
            }
        },
        "germany_gdpr_summary.txt": {
            "content": """# GDPR + BDSG - Germany Compliance Summary for Technical PMs

## Overview
Germany follows the EU's General Data Protection Regulation (GDPR) supplemented by the
Bundesdatenschutzgesetz (BDSG). Germany has one of the strictest interpretations of GDPR
in the EU, with aggressive enforcement through both federal and state-level DPAs.

## Key Requirements for Tech Teams

### Data Collection & Processing
- Must have a lawful basis for processing (consent, contract, legitimate interest, etc.)
- Consent must be freely given, specific, informed, and unambiguous
- Must implement Privacy by Design and Privacy by Default
- Data Protection Impact Assessment (DPIA) required for high-risk processing
- Must appoint a Data Protection Officer (DPO) if processing personal data as core activity

### Data Residency
- CRITICAL: Strong preference for data to remain in EEA (European Economic Area)
- Transfers outside EEA require:
  - Adequacy decision (limited countries: Japan, UK, South Korea, etc.)
  - Standard Contractual Clauses (SCCs) with supplementary measures
  - Binding Corporate Rules (BCRs)
- US transfers: Post-EU-US Data Privacy Framework (DPF), transfers to certified US companies allowed
- Must conduct Transfer Impact Assessments (TIAs) for non-adequate countries

### Cloud Infrastructure
- AWS: eu-central-1 (Frankfurt) — PRIMARY CHOICE for Germany
- Azure: Germany West Central (Frankfurt), Germany North (Berlin) — sovereign cloud available
- GCP: europe-west3 (Frankfurt)
- German authorities prefer data centers physically located in Germany over other EU countries
- Some sectors (finance, healthcare) may require Germany-specific hosting

### Technical Implementation Requirements
- Cookie consent banner with granular controls (not just "Accept All")
- Right to erasure ("Right to be Forgotten") — must delete across all systems including backups
- Data portability — must export user data in machine-readable format
- Breach notification within 72 hours to supervisory authority
- Must maintain Records of Processing Activities (ROPA)

### Enforcement
- Federal: BfDI (Federal Commissioner for Data Protection)
- State: 16 state-level DPAs (each can enforce independently)
- Fines: up to €20 million or 4% of annual global turnover (whichever is higher)
- Germany has issued some of the largest GDPR fines in the EU

### Impact on Product Launches
- GDPR compliance is NON-NEGOTIABLE for Germany launch
- Must have DPO appointment, DPIA, cookie consent, and privacy policy before launch
- If hosting outside EU, need SCCs + TIA documentation
- German users expect high privacy standards — poor privacy UX can hurt adoption
""",
            "metadata": {
                "country": "DE",
                "regulation_name": "GDPR",
                "document_type": "regulation_summary",
                "source_url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679",
                "section_topics": ["data_residency", "cross_border_transfer", "consent", "dpo", "enforcement"],
                "year": 2024
            }
        },
        "india_dpdp_summary.txt": {
            "content": """# Digital Personal Data Protection Act (DPDP) 2023 - India Summary for Technical PMs

## Overview
India's DPDP Act 2023 is a comprehensive privacy law that governs the processing of digital
personal data. Enacted August 2023, with rules still being finalized. Applies to processing
of digital personal data within India AND processing outside India if offering goods/services to India.

## Key Requirements for Tech Teams

### Data Collection & Processing
- Must obtain consent before processing personal data (consent must be free, specific, informed)
- Can process without consent for "legitimate uses" (employment, medical emergency, government)
- Must provide clear notice in plain language before collecting data
- Children's data: must obtain verifiable parental consent; cannot track/target children

### Data Residency
- No blanket data localization requirement (unlike earlier drafts)
- Government CAN restrict transfers to specific countries via notification
- Certain categories of data may require localization (expected in upcoming rules)
- Significant Data Fiduciaries may face additional localization requirements
- Transfer restrictions expected to evolve — monitor closely

### Cloud Infrastructure
- AWS: ap-south-1 (Mumbai), ap-south-2 (Hyderabad) — both available
- Azure: Central India (Pune), South India (Chennai), West India (Mumbai)
- GCP: asia-south1 (Mumbai), asia-south2 (Delhi)
- Good cloud availability — infrastructure is NOT a blocker for India
- Government cloud (MeghRaj/GI Cloud) required for some government projects

### Technical Implementation Requirements
- Must implement consent management system
- Must provide mechanism for data principals to exercise rights (access, correction, erasure)
- Must appoint Data Protection Officer for Significant Data Fiduciaries
- Must implement reasonable security safeguards
- Must notify DPBI (Data Protection Board of India) and affected individuals in case of breach

### Enforcement
- Data Protection Board of India (DPBI) — quasi-judicial body
- Fines: up to ₹250 crore (approximately $30 million USD) per violation
- No private right of action (enforcement through DPBI only)

### Impact on Product Launches
- If serving Indian users, DPDP Act applies regardless of where company is based
- Consent mechanism must be in place before launch
- Children's data handling is particularly strict — avoid behavioral targeting for under-18
- Rules still being finalized — build flexibility into your compliance architecture
""",
            "metadata": {
                "country": "IN",
                "regulation_name": "DPDP Act 2023",
                "document_type": "regulation_summary",
                "source_url": "https://www.meity.gov.in/data-protection-framework",
                "section_topics": ["data_residency", "consent", "children_data", "enforcement"],
                "year": 2024
            }
        },
        "saudi_arabia_pdpl_summary.txt": {
            "content": """# Personal Data Protection Law (PDPL) - Saudi Arabia Summary for Technical PMs

## Overview
Saudi Arabia's PDPL was enacted September 2023 and is enforced by the Saudi Data & AI Authority (SDAIA).
It applies to processing of personal data within Saudi Arabia and to processing of data of
Saudi residents by entities outside the Kingdom.

## Key Requirements for Tech Teams

### Data Collection & Processing
- Must have explicit consent OR a lawful basis for processing
- Must provide privacy notice in Arabic (mandatory) and English
- Sensitive data (health, financial, biometric) requires explicit consent
- Must implement data minimization and purpose limitation
- Must maintain records of processing activities

### Data Residency
- CRITICAL: Data MUST be stored within Saudi Arabia unless specific conditions are met
- Cross-border transfer requires:
  - Transfer to a country with adequate level of protection (SDAIA maintains the list)
  - Standard contractual obligations approved by SDAIA
  - Explicit consent of the data subject
- Government and healthcare data has STRICT localization requirements
- Financial data: Saudi Central Bank (SAMA) has additional localization rules

### Cloud Infrastructure
- AWS: me-south-1 (Bahrain) — closest, but NOT in Saudi Arabia
  - AWS announced plans for Saudi Arabia region but may not be available yet
- Azure: has a Saudi Arabia region in Jeddah (uaenorth nearby in UAE)
- GCP: me-central1 (Doha, Qatar) — NOT in Saudi Arabia
  - GCP announced Dammam region
- Oracle Cloud: has a Jeddah region
- LOCAL PROVIDERS: stc cloud, Mobily — may be required for government projects
- Cloud availability IS a potential blocker — verify current region status before committing

### Technical Implementation Requirements
- Must implement consent management in Arabic
- Must have a mechanism for data subject rights (access, correction, deletion)
- Must appoint a Data Protection Officer
- Must conduct Data Protection Impact Assessment for high-risk processing
- Breach notification to SDAIA within 72 hours (expected, rules being finalized)

### Enforcement
- Saudi Data & AI Authority (SDAIA) enforces
- Fines: up to SAR 5 million (approximately $1.3 million USD)
- Criminal penalties possible: imprisonment up to 2 years for certain violations
- Enforcement expected to increase as implementation matures

### Impact on Product Launches
- Data localization is the BIGGEST challenge for Saudi Arabia
- Must verify cloud provider has actual Saudi Arabia region (not just Middle East)
- Arabic language support is mandatory for consent and privacy notices
- Financial and healthcare sectors have additional requirements beyond PDPL
- Vision 2030 digital transformation means high regulatory attention to data practices
""",
            "metadata": {
                "country": "SA",
                "regulation_name": "PDPL",
                "document_type": "regulation_summary",
                "source_url": "https://sdaia.gov.sa/en/SDAIA/about/Regulations",
                "section_topics": ["data_residency", "data_localization", "cloud_infrastructure", "arabic_requirement"],
                "year": 2024
            }
        },
        "brazil_lgpd_summary.txt": {
            "content": """# Lei Geral de Proteção de Dados (LGPD) - Brazil Summary for Technical PMs

## Overview
Brazil's LGPD (Law No. 13,709/2018) is a comprehensive data protection law modeled after GDPR.
Enforced by the ANPD (Autoridade Nacional de Proteção de Dados). Applies to any processing of
personal data in Brazil, or of data subjects located in Brazil, regardless of where the processor is based.

## Key Requirements for Tech Teams

### Data Collection & Processing
- 10 lawful bases for processing (more than GDPR's 6) — includes credit protection, health research
- Consent must be in writing or other means demonstrating the will of the data subject
- Must provide clear, complete information about data processing in Portuguese
- Sensitive data requires specific and highlighted consent
- Children's data requires parental consent

### Data Residency
- No strict data localization requirement (data CAN leave Brazil)
- Cross-border transfers allowed when:
  - Country provides adequate level of protection (ANPD list)
  - Standard contractual clauses
  - Global corporate rules (similar to BCRs)
  - Explicit consent of the data subject
  - Cooperation agreements between authorities
- More flexible than GDPR on transfers — but must still document the basis

### Cloud Infrastructure
- AWS: sa-east-1 (São Paulo) — primary choice for Brazil
- Azure: Brazil South (São Paulo), Brazil Southeast (Rio de Janeiro)
- GCP: southamerica-east1 (São Paulo), southamerica-west1 (Santiago, Chile)
- Cloud availability is NOT a blocker for Brazil — good infrastructure

### Technical Implementation Requirements
- Must appoint a Data Protection Officer (Encarregado)
- Must implement governance program with policies and training
- Must maintain processing records
- Must be able to respond to data subject requests (access, correction, deletion, portability)
- Breach notification to ANPD within "reasonable time" (specific timeline being defined)
- Must conduct Data Protection Impact Assessment for high-risk processing

### Enforcement
- ANPD (Autoridade Nacional de Proteção de Dados) enforces
- Fines: up to 2% of revenue in Brazil (capped at R$50 million / ~$10 million USD per violation)
- Can also: public warning, data processing suspension, partial/total database deletion
- Consumer protection agencies (PROCON) can also take action

### Impact on Product Launches
- Similar framework to GDPR — if you're GDPR-compliant, you're mostly LGPD-ready
- Key difference: Portuguese language requirement for all data processing notices
- DPO must be named publicly (no anonymous DPO)
- Consider that Brazil has specific requirements for financial data (Banco Central regulations)
- Cloud infrastructure is mature — focus on consent and language, not hosting
""",
            "metadata": {
                "country": "BR",
                "regulation_name": "LGPD",
                "document_type": "regulation_summary",
                "source_url": "https://www.gov.br/anpd/pt-br",
                "section_topics": ["data_residency", "cross_border_transfer", "consent", "dpo", "enforcement"],
                "year": 2024
            }
        },
        "singapore_pdpa_summary.txt": {
            "content": """# Personal Data Protection Act (PDPA) - Singapore Summary for Technical PMs

## Overview
Singapore's PDPA (2012, amended 2020) is enforced by the Personal Data Protection Commission (PDPC).
It governs the collection, use, and disclosure of personal data by organizations.
Known for being business-friendly while still providing meaningful data protection.

## Key Requirements for Tech Teams

### Data Collection & Processing
- Must obtain consent (can be deemed consent in some cases — more flexible than GDPR)
- Must inform individuals of purposes for data collection
- Purpose limitation: can only use data for purposes individual was informed about
- Data Protection Impact Assessments recommended but not always mandatory
- Must appoint Data Protection Officer (DPO)

### Data Residency
- No strict data localization requirement
- Cross-border transfers allowed IF organization ensures comparable level of protection
- Methods: contractual arrangements, binding corporate rules, APEC CBPR certification
- Singapore participates in APEC Cross-Border Privacy Rules (CBPR) system
- Generally one of the MOST flexible jurisdictions for data transfers

### Cloud Infrastructure
- AWS: ap-southeast-1 (Singapore) — major hub
- Azure: Southeast Asia (Singapore)
- GCP: asia-southeast1 (Singapore)
- Singapore is a MAJOR cloud hub — all major providers have strong presence
- Excellent connectivity and infrastructure — cloud is never a blocker here

### Technical Implementation Requirements
- Must implement Do Not Call (DNC) registry compliance if doing marketing
- Must maintain data protection policies and practices
- Must be able to respond to data access and correction requests
- Breach notification mandatory: notify PDPC within 3 calendar days of assessment
  AND notify affected individuals if significant harm is likely
- Must implement reasonable security arrangements

### Enforcement
- Personal Data Protection Commission (PDPC) enforces
- Fines: up to $1 million SGD (approximately $750,000 USD) or 10% of annual turnover
  (whichever is higher) — significantly increased in 2020 amendment
- PDPC publishes enforcement decisions publicly — reputational risk
- Can issue directions to stop collection/use of data

### Impact on Product Launches
- Singapore is one of the EASIEST markets for tech product launches from a compliance perspective
- Business-friendly regulation with clear guidelines
- No data localization requirement — can host anywhere with proper protections
- Mandatory breach notification is the strictest requirement — ensure incident response plan
- Great starting point for APAC expansion
""",
            "metadata": {
                "country": "SG",
                "regulation_name": "PDPA",
                "document_type": "regulation_summary",
                "source_url": "https://www.pdpc.gov.sg/overview-of-pdpa",
                "section_topics": ["data_residency", "cross_border_transfer", "breach_notification", "enforcement"],
                "year": 2024
            }
        },
        "cloud_provider_regions.txt": {
            "content": """# Cloud Provider Region Availability by Country

## AWS Regions
| Country | Region Code | Region Name | Status |
|---------|------------|-------------|--------|
| US | us-east-1 | N. Virginia | Active |
| US | us-east-2 | Ohio | Active |
| US | us-west-1 | N. California | Active |
| US | us-west-2 | Oregon | Active |
| Germany | eu-central-1 | Frankfurt | Active |
| India | ap-south-1 | Mumbai | Active |
| India | ap-south-2 | Hyderabad | Active |
| Saudi Arabia | me-south-1 | Bahrain (nearest) | Active |
| Brazil | sa-east-1 | São Paulo | Active |
| Singapore | ap-southeast-1 | Singapore | Active |

## Azure Regions
| Country | Region Name | Status |
|---------|-------------|--------|
| US | East US, West US, Central US | Active |
| Germany | Germany West Central, Germany North | Active |
| India | Central India, South India, West India | Active |
| Saudi Arabia | Saudi Arabia (Jeddah) | Active |
| Brazil | Brazil South, Brazil Southeast | Active |
| Singapore | Southeast Asia | Active |

## GCP Regions
| Country | Region Code | Region Name | Status |
|---------|------------|-------------|--------|
| US | us-central1, us-east1, etc. | Multiple | Active |
| Germany | europe-west3 | Frankfurt | Active |
| India | asia-south1, asia-south2 | Mumbai, Delhi | Active |
| Saudi Arabia | me-central1 | Doha (nearest) | Active |
| Brazil | southamerica-east1 | São Paulo | Active |
| Singapore | asia-southeast1 | Singapore | Active |

## Key Notes for PMs
- Saudi Arabia has LIMITED direct cloud presence — Bahrain/Qatar are nearest AWS/GCP options
- Germany has dedicated sovereign cloud options (Azure) for sensitive workloads
- Singapore is a major APAC hub — all providers have strong presence
- India has excellent multi-provider coverage
- Brazil has good coverage but only in São Paulo metro area
""",
            "metadata": {
                "country": "ALL",
                "regulation_name": "Cloud Infrastructure",
                "document_type": "cloud_compliance",
                "source_url": "https://aws.amazon.com/about-aws/global-infrastructure/regions_az/",
                "section_topics": ["cloud_infrastructure", "region_availability"],
                "year": 2024
            }
        }
    }

    for filename, data in samples.items():
        # Write content file
        filepath = os.path.join(docs_dir, filename)
        with open(filepath, "w") as f:
            f.write(data["content"])

        # Write metadata sidecar
        metadata_path = filepath.rsplit(".", 1)[0] + ".metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(data["metadata"], f, indent=2)

        print(f"  Created sample: {filename}")

    print(f"\n✅ Created {len(samples)} sample compliance documents with metadata")
    print("   These are starter docs — replace/supplement with real regulatory PDFs")


if __name__ == "__main__":
    ingest_all()
