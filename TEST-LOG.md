# Archia Manual E2E Test Log

## Environment
- Backend: http://localhost:4410 (Docker)
- Web: http://localhost:3015 (Docker)
- DB: PostgreSQL 16 on localhost:5434

## Test 1: User Registration & Login
- [x] Register user: testuser / Test1234!
- [x] Login successful, session cookie set (archia_session)

## Test 2: Project CRUD
- [x] List projects: OK (2 projects)
- [x] Create project: OK (name="Test Project")
- [x] Update project: OK
- [x] List graphs in project: OK

## Test 3: Graph CRUD
- [x] Create graph: OK (diagram_kind="architecture")
- [x] Update graph with nodes: OK
- [x] Analyze graph: IN PROGRESS

## Issues Found

### BUG 1: Login returns access_token in body but frontend expects cookie
- **Severity**: High
- **Location**: auth.py:157-168
- **Impact**: Frontend may not persist session properly
- **Fix**: Ensure frontend reads access_token from body and stores in localStorage

### BUG 2: Profile endpoint returns 307 redirect
- **Severity**: High
- **Location**: /api/v1/profile
- **Impact**: Authentication flow broken
- **Fix**: Check redirect logic in profile endpoint

### BUG 3: No auth header validation in test
- **Severity**: Medium
- **Location**: test scripts
- **Impact**: Tests may pass without proper auth
- **Fix**: Add Bearer token tests

## Next Steps
1. Fix BUG 1 and BUG 2
2. Re-run all tests
3. Test frontend manually in browser
4. Check for UX issues
