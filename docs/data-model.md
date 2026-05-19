# County Line Data Model

This is the first database skeleton for turning the map into a civic data system. It is designed for a current baseline of May 17, 2026 while preserving enough temporal structure to add historical data and trend analysis later.

## Database Stack

- PostgreSQL is the target database.
- Prisma owns the application schema and typed client.
- `DATABASE_URL` is the only required connection setting for now.
- The app exposes `GET /api/health/db` to verify whether the configured database is reachable.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Start Postgres:

```sh
docker compose up -d db
```

3. Push the schema:

```sh
npm run db:push
```

4. Regenerate the typed Prisma client after schema changes:

```sh
npm run db:generate
```

## Current Baseline

Use `MAY_2026_BASELINE_AS_OF` from `src/lib/repositories/officials.ts` when asking for the first "current" roster:

```ts
import { listOfficialsAsOf } from '../src/lib/repositories/officials';

const officials = await listOfficialsAsOf();
```

The query treats an official as active when:

- `OfficialTenure.startDate <= 2026-05-17`
- `OfficialTenure.endDate` is null or after the baseline date
- `OfficialTenure.isCurrent = true`

The `isCurrent` flag is a convenience for baseline roster queries. The dates are still the source of truth for historical analysis.

## Core Entities

- `Geography`: states, counties, municipalities, congressional districts, state legislative districts, judicial/prosecutorial districts, ZIPs, and future census geographies.
- `GeographyRelationship`: containment, overlap, service-area, and succession relationships between geographies.
- `Person`: officials and other named actors.
- `PoliticalParty` and `PartyAffiliation`: party affiliation as a temporal relationship, because affiliation can change.
- `Office`: elected or appointed public offices, attached to geography and optional government organizations.
- `OfficialTenure`: a person serving in an office for a bounded time period, with optional party-at-service.
- `Organization`: courts, prosecutor offices, PACs, super PACs, committees, agencies, unions, corporations, and other donor/recipient entities.

## Relationship Data

The schema separates raw facts from derived insight relationships.

- `PoliticalMoneyFlow` captures direct contributions, in-kind support, transfers, and independent expenditures. Super PAC spending should usually be modeled as `INDEPENDENT_EXPENDITURE` with a `beneficiaryPersonId`, not as a direct accepted donation.
- `LegislativeMeasure`, `VoteEvent`, and `OfficialVote` model legislative behavior.
- `LegalOutcomeAggregate` models judicial and prosecutor/DA outcomes in aggregate by period, geography, office, person, case category, offense severity, and disposition.
- `MetricDefinition` and `MetricObservation` hold incarceration, recidivism, socioeconomic, demographic, housing, education, and other indicator time series.
- `RelationshipObservation` stores derived links or correlations between any modeled entities, including confidence, strength, method, and period.

## Provenance

- `DataSource` records the origin of a dataset.
- `ImportBatch` records a load attempt, including `asOfDate`, source period, status, and imported record count.
- `SourceAttribution` links any model row back to a source record or import batch without forcing every table to carry source-specific columns.

## First Ingestion Targets

1. Current elected-official roster as of May 2026.
2. Party affiliation snapshots for those officials.
3. Office and geography alignment for map selections.
4. Campaign finance and independent expenditure data.
5. Legislative voting records.
6. Judicial/prosecutorial aggregate outcomes.
7. Socioeconomic and public-safety indicators.
