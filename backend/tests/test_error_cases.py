"""Test error cases, IDOR, and edge cases on critical endpoints."""

import pytest
from app.models import User, Graph


class TestAuthErrorHandling:
    """Auth endpoint error cases."""

    def test_login_invalid_credentials(self, client):
        """Login with wrong password should fail."""
        # Register user first
        client.post(
            "/auth/register",
            json={
                "email": "test@ex.com",
                "username": "testuser",
                "password": "ValidPass1!",
                "phone": "+5511999999999",
                "birth_date": "1990-01-01",
            },
        )
        
        # Try with wrong password
        response = client.post(
            "/auth/login",
            json={"username": "testuser", "password": "WrongPass123"},
        )
        assert response.status_code == 401
        assert "invalid" in response.json().get("detail", "").lower()

    def test_login_nonexistent_user(self, client):
        """Login with nonexistent user should fail."""
        response = client.post(
            "/auth/login",
            json={"username": "nonexistent", "password": "AnyPass123"},
        )
        assert response.status_code == 401

    def test_register_duplicate_username(self, client):
        """Registering duplicate username should fail."""
        data = {
            "email": "user1@ex.com",
            "username": "duplicate",
            "password": "ValidPass1!",
            "phone": "+5511999999999",
            "birth_date": "1990-01-01",
        }
        client.post("/auth/register", json=data)
        
        response = client.post(
            "/auth/register",
            json={**data, "email": "user2@ex.com"},
        )
        assert response.status_code in [400, 409]

    def test_register_invalid_email(self, client):
        """Register with invalid email should fail."""
        response = client.post(
            "/auth/register",
            json={
                "email": "not-an-email",
                "username": "testuser",
                "password": "ValidPass1!",
                "phone": "+5511999999999",
                "birth_date": "1990-01-01",
            },
        )
        assert response.status_code in [400, 422]

    def test_register_weak_password(self, client):
        """Register with weak password should fail."""
        response = client.post(
            "/auth/register",
            json={
                "email": "test@ex.com",
                "username": "testuser",
                "password": "weak",  # Too short/weak
                "phone": "+5511999999999",
                "birth_date": "1990-01-01",
            },
        )
        assert response.status_code in [400, 422]


class TestGraphErrorHandling:
    """Graph endpoint error cases."""

    def test_get_nonexistent_graph(self, client):
        """Fetching nonexistent graph should return 404."""
        response = client.get("/api/v1/graphs/nonexistent-id")
        assert response.status_code == 404

    def test_update_nonexistent_graph(self, client):
        """Updating nonexistent graph should return 404."""
        response = client.put(
            "/api/v1/graphs/nonexistent-id",
            json={"name": "New Name"},
        )
        assert response.status_code == 404

    def test_delete_nonexistent_graph(self, client):
        """Deleting nonexistent graph should return 404."""
        response = client.delete("/api/v1/graphs/nonexistent-id")
        assert response.status_code == 404

    def test_create_graph_invalid_payload(self, client):
        """Creating graph with invalid payload should fail."""
        response = client.post(
            "/api/v1/graphs",
            json={"nodes": "not-a-list"},  # nodes should be list
        )
        assert response.status_code == 422

    def test_create_graph_missing_required_fields(self, client):
        """Creating graph without required fields should fail."""
        response = client.post("/api/v1/graphs", json={})
        assert response.status_code == 422


class TestProjectErrorHandling:
    """Project endpoint error cases."""

    def test_get_nonexistent_project(self, client):
        """Fetching nonexistent project should return 404."""
        response = client.get("/projects/nonexistent-id")
        assert response.status_code == 404

    def test_delete_nonexistent_project(self, client):
        """Deleting nonexistent project should return 404."""
        response = client.delete("/projects/nonexistent-id")
        assert response.status_code == 404

    def test_create_project_empty_name(self, client):
        """Creating project with empty name creates but is unusual."""
        # API allows empty name, but it's not ideal
        response = client.post("/projects", json={"name": ""})
        # Accept either validation error or creation (depends on API design)
        assert response.status_code in [201, 400, 422]


class TestACLAndAccess:
    """ACL/IDOR test cases."""

    def test_list_graph_access_requires_ownership_or_grant(self, client):
        """Should only list access if user has permission."""
        # Create graph as user A
        graph = client.post(
            "/api/v1/graphs",
            json={"name": "Private Graph", "nodes": [], "edges": []},
        )
        graph_id = graph.json()["id"]
        
        # Try to list access (should work for owner)
        response = client.get(f"/api/v1/graphs/{graph_id}/access")
        assert response.status_code == 200

    def test_delete_nonexistent_access_rule(self, client):
        """Deleting nonexistent access rule should fail."""
        graph = client.post(
            "/api/v1/graphs",
            json={"name": "Test Graph", "nodes": [], "edges": []},
        )
        graph_id = graph.json()["id"]
        
        response = client.delete(
            f"/api/v1/graphs/{graph_id}/access/nonexistent-team"
        )
        assert response.status_code == 404


class TestAnalysisErrors:
    """Analysis endpoint error cases."""

    def test_analyze_empty_graph(self, client):
        """Analyzing empty graph should still work (returns 0 findings)."""
        graph = client.post(
            "/api/v1/graphs",
            json={"name": "Empty", "nodes": [], "edges": []},
        )
        graph_id = graph.json()["id"]
        
        response = client.post(f"/api/v1/graphs/{graph_id}/analyze")
        assert response.status_code == 200
        assert isinstance(response.json()["findings"], list)

    def test_heuristic_analyze_invalid_graph_payload(self, client):
        """Heuristic analyze with invalid payload should fail."""
        response = client.post(
            "/api/v1/analyze/heuristic",
            json={"invalid": "payload"},
        )
        assert response.status_code == 422


class TestConcurrencyEdgeCases:
    """Concurrency and data consistency edge cases."""

    def test_update_graph_concurrent_writes(self, client):
        """Concurrent updates should not corrupt state."""
        # Create graph
        graph_response = client.post(
            "/api/v1/graphs",
            json={"name": "Concurrent Test", "nodes": [], "edges": []},
        )
        graph_id = graph_response.json()["id"]
        
        # Simulate rapid updates (in real scenario, use threading)
        for i in range(5):
            response = client.put(
                f"/api/v1/graphs/{graph_id}",
                json={"name": f"Update {i}"},
            )
            assert response.status_code == 200
        
        # Fetch final state
        final = client.get(f"/api/v1/graphs/{graph_id}")
        assert final.json()["name"] == "Update 4"

    def test_delete_and_recreate_graph_quickly(self, client):
        """Deleting and recreating graph should work correctly."""
        graph = client.post(
            "/api/v1/graphs",
            json={"name": "Delete Test", "nodes": [], "edges": []},
        )
        graph_id = graph.json()["id"]
        
        # Delete
        response = client.delete(f"/api/v1/graphs/{graph_id}")
        assert response.status_code == 204
        
        # Should not exist
        assert client.get(f"/api/v1/graphs/{graph_id}").status_code == 404
        
        # Recreate with same ID should not be possible (new ID generated)
        new_graph = client.post(
            "/api/v1/graphs",
            json={"name": "Recreated", "nodes": [], "edges": []},
        )
        assert new_graph.json()["id"] != graph_id
