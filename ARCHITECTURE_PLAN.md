# County Line PWA Architecture Plan

## 1) Product Goal
Build a cloud-hosted Progressive Web App (PWA) that lets users navigate a US map from national → state → county → municipality/CDP, plus federal and state legislative districts, then overlay labor/census/public datasets.

## 2) Recommended Cloud: AWS (for growth + hiring signal)
Why AWS for your goal:
- Strong enterprise/government adoption and broad service maturity.
- High hiring signal for PM roles (many orgs run analytics/data products on AWS).
- Rich geospatial, serverless, and data-lake patterns with low upfront ops.

## 3) High-Level Architecture (MVP → Scale)

### Frontend (PWA)
- Framework: Next.js or React + Vite (both PWA-capable).
- Map engine: MapLibre GL JS (open-source) with vector tiles.
- PWA: service worker + offline cache for UI shell and most-used tiles.
- Hosting: AWS Amplify Hosting or S3 + CloudFront.

### API + Application Layer
- API Gateway + Lambda for serverless APIs.
- Auth: Amazon Cognito (optional for v1; add when user accounts needed).
- Search/filter metadata: OpenSearch Serverless (optional in v2).

### Geospatial + Data Storage
- Raw public datasets: S3 data lake (partitioned by source/date/granularity).
- Processed tabular data: Athena/Glue catalog + Parquet in S3.
- Transactional/app metadata: DynamoDB.
- Geometries + tiles:
  - Store authoritative boundary files in S3 (GeoJSON/FlatGeobuf/Parquet).
  - Pre-generate vector tiles (PMTiles or MBTiles pipeline) and serve via CloudFront.

### Ingestion / ETL
- EventBridge schedule + Step Functions orchestration.
- Lambda/Fargate jobs for pull/transform.
- Glue jobs for large transforms.
- Source adapters for:
  - US Census (TIGER/Line, ACS APIs)
  - BLS (public time-series and area data)
  - Additional federal/state open datasets.

### Analytics / BI (optional)
- QuickSight dashboards over Athena for internal validation and demos.

## 4) Geography Layers to Include

Base hierarchy:
1. Nation
2. State
3. County
4. County subdivisions + places (municipalities, CDPs)
5. Census tracts/block groups (optional after MVP)

District layers:
- Federal: US congressional districts.
- State: upper/lower legislative districts.
- Optional: school districts, judicial districts.

Best practice:
- Keep each layer versioned by vintage year (e.g., 2020, 2022, 2024) so users can compare over time.

## 5) Data Strategy (cloud-facing, low local burden)

### Bronze / Silver / Gold
- Bronze: raw source snapshots in S3.
- Silver: cleaned/normalized tables (Parquet).
- Gold: app-ready aggregates + tile-ready joins.

### Cost controls
- Use Parquet + partitioning by source/date/state.
- Compress tiles and simplify geometry by zoom level.
- Cache heavily in CloudFront.
- Start with read-only public data and no user uploads.

## 6) Suggested MVP Scope (8–12 weeks)

### MVP Feature Set
- Interactive US map with drill-down (state → county → place).
- Toggle overlays:
  - Congressional districts
  - State legislative districts
  - One BLS indicator (e.g., unemployment rate)
  - One Census indicator (e.g., population or median income)
- Time selector (year).
- Search by place/county/state.

### MVP Tech Slice
- Frontend: React/Next + MapLibre.
- Backend: API Gateway + Lambda.
- Data: S3 + Athena + Glue catalog.
- Infra/IaC: Terraform or AWS CDK.
- CI/CD: GitHub Actions + Amplify/CloudFront deploy.

## 7) Roadmap After MVP
- Add user-defined saved views and shareable links.
- Add comparison mode (two geographies side by side).
- Add alert subscriptions for indicator changes.
- Add more datasets: BEA, CDC, HUD, BJS, EPA, ED.

## 8) Portfolio Positioning (PM job search)
Frame the project around:
- Product discovery: persona + JTBD for policy analysts/journalists/local gov staff.
- Data product strategy: freshness, trust, lineage, and source transparency.
- Delivery excellence: measurable milestones, instrumentation, and adoption metrics.
- GTM thinking: freemium map explorer + paid API/export tiers.

Suggested resume bullets:
- "Led end-to-end design of a nationwide geospatial data product integrating Census and BLS datasets with district-level overlays."
- "Defined scalable AWS serverless architecture and data-lake strategy for multi-source public data ingestion and analytics delivery."
- "Shipped PWA map explorer with multi-level administrative drill-down and time-series indicator overlays."

## 9) Why AWS vs alternatives (quick compare)
- AWS: strongest breadth + enterprise demand + mature serverless/data-lake stack.
- GCP: excellent analytics UX (BigQuery) and geospatial friendliness.
- Azure: strong in Microsoft-heavy enterprises/public sector.

Given your PM career goal and expected scale of US public data, AWS is a defensible first choice.

## 10) Immediate Next Steps
1. Confirm MVP datasets + success metrics.
2. Pick frontend stack (Next.js vs Vite).
3. Build one end-to-end vertical slice:
   - one geography layer,
   - one BLS metric,
   - one Census metric,
   - one deployed environment.
4. Add observability (CloudWatch dashboards, cost alarms).
5. Publish architecture + product brief in repo for portfolio visibility.
