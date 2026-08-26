# Archia Manual E2E Test Report

**Date:** 2026-08-24
**Environment:** Docker (backend:4410, web:3015, db:5434)

## Test Summary

| Suite | Tests | Passed | Failed |
|-------|-------|--------|--------|
| Backend Pytest | 290 | 290 | 0 |
| Frontend Unit | 25 | 25 | 0 |
| API E2E | 12 | 12 | 0 |
| **TOTAL** | **327** | **327** | **0** |

## Bugs Found & Fixed

### 1. delete_project returning 204 with body
- **File:** `backend/app/routes/projects.py:231`
- **Issue:** FastAPI throws AssertionError for 204 with response body
- **Fix:** Return `Response(status_code=204)` explicitly

### 2. Profile endpoint 307 redirect
- **File:** `backend/app/routes/profile.py:14`
- **Issue:** `@router.get("/")` causes redirect to `/api/v1/profile/`
- **Fix:** Added `@router.get("")` alias alongside existing route

### 3. Projects list without auth returning 200
- **File:** `backend/app/routes/projects.py:126`
- **Issue:** `list_projects` missing authentication dependency
- **Fix:** Added `current_user: User = Depends(get_current_user)`

### 4. TitleBlock using text-[11px]
- **File:** `web/src/components/canvas/TitleBlock.tsx:92`
- **Issue:** Violates 14px floor from manual §6
- **Fix:** Changed to `text-xs` (14px)

### 5. python-json-logger import error
- **File:** `backend/app/logging_config.py:32`
- **Issue:** Wrong import path `pythonjsonlogger.json` vs `pythonjsonlogger.jsonlog`
- **Fix:** Updated import to correct path

## Tests Run

### Backend API (12 tests)
- [x] HEALTH - Backend health check
- [x] REGISTER - User registration
- [x] LOGIN - User login with session cookie
- [x] PROFILE - Get current user profile
- [x] PROJECTS_AUTH - List projects with auth
- [x] PROJECTS_NO_AUTH - Verify 401 without auth
- [x] CREATE_PROJECT - Create new project
- [x] CREATE_GRAPH - Create new graph
- [x] UPDATE_GRAPH - Update graph with nodes/edges
- [x] ANALYZE - Run architecture analysis
- [x] DELETE_GRAPH - Delete graph
- [x] DELETE_PROJECT - Delete project

### Backend Pytest (290 tests)
All tests passed including:
- Auth integration tests
- Graph CRUD operations
- Analysis tests
- Governance tests
- Security tests
- Performance tests
- Race condition tests

### Frontend Unit (25 tests)
All tests passed:
- export.roundtrip
- blocks
- canvas-pro
- zones-edges
- review-ready
- canvas-filter
- saved-views

## Issues Found (Not Critical)

1. **Login username validation**: Requires ASCII alphanumeric only (no underscores). User should use simple usernames.
2. **ESLint warnings**: 54 warnings (mostly no-unused-vars) - non-blocking.

## Conclusion

All critical bugs fixed. Application is functional and tests pass. The Archia application is ready for use.
