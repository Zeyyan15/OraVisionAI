# OraVisionAI — Database Documentation

This directory contains the complete relational database schema design for the OraVisionAI platform.

## Documents

| Document | Purpose |
|---|---|
| [database_schema.md](database_schema.md) | Complete entity definitions — columns, types, constraints, indexes, design notes |
| [entity_relationships.md](entity_relationships.md) | Entity-relationship map — cardinality, join paths, hierarchy |
| [database_dictionary.md](database_dictionary.md) | Field-level reference — semantic meaning, privacy, security considerations |

## Design Summary

- **23 entities** across 7 domains
- **PostgreSQL** relational database
- **UUIDs** for all primary keys
- **Firebase Authentication** for identity — only `firebase_uid` stored in PostgreSQL
- **Firebase Storage** for files — only storage paths stored in PostgreSQL
- **Soft deletion** on screenings; `is_active` flags on users/conversations
- **Immutable audit log** for compliance-sensitive actions
- **AI model registry** supporting versioned multi-model inference
- **Async SQLAlchemy 2.x** with `asyncpg` (infrastructure already in Phase 2)

## Status

| Phase | Status |
|---|---|
| Schema design | ✅ Complete |
| SQLAlchemy models | ⬜ Phase 3B |
| Alembic migrations | ⬜ Phase 3B |
| PostgreSQL provisioning | ⬜ Prerequisite for Phase 3B |
