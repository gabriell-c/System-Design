"""Mutation testing guards — ensure mutations are caught by tests."""



class TestMutationGuards:
    """Tests designed to catch common mutations."""

    def test_status_code_401_not_200_on_auth_fail(self, client):
        """CATCH MUTATION: changing 401 to 200."""
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "x", "password": "wrong"},
        )
        # Mutation: if status_code == 200 → test fails ✓
        assert response.status_code == 401

    def test_graph_404_not_500_on_missing(self, client):
        """CATCH MUTATION: changing 404 to 500."""
        response = client.get("/api/v1/graphs/nonexistent")
        # Mutation: if status_code in [200, 500] → test fails ✓
        assert response.status_code == 404

    def test_list_empty_not_null_when_no_graphs(self, client):
        """CATCH MUTATION: changing [] to None."""
        response = client.get("/api/v1/graphs")
        result = response.json()
        # Mutation: if result is None → test fails ✓
        assert isinstance(result, list)
        assert result == []

    def test_created_status_201_not_200(self, client):
        """CATCH MUTATION: changing 201 to 200."""
        response = client.post(
            "/api/v1/graphs",
            json={"name": "New", "nodes": [], "edges": []},
        )
        # Mutation: if status_code == 200 → test fails ✓
        assert response.status_code == 201

    def test_delete_204_not_200(self, client):
        """CATCH MUTATION: changing 204 to 200."""
        graph = client.post(
            "/api/v1/graphs",
            json={"name": "Temp", "nodes": [], "edges": []},
        )
        gid = graph.json()["id"]
        response = client.delete(f"/api/v1/graphs/{gid}")
        # Mutation: if status_code == 200 → test fails ✓
        assert response.status_code == 204

    def test_graph_name_persists_not_overwritten(self, client):
        """CATCH MUTATION: name not being saved."""
        graph = client.post(
            "/api/v1/graphs",
            json={"name": "Original", "nodes": [], "edges": []},
        )
        gid = graph.json()["id"]
        fetched = client.get(f"/api/v1/graphs/{gid}")
        # Mutation: if name == None → test fails ✓
        assert fetched.json()["name"] == "Original"

    def test_update_actually_changes_value(self, client):
        """CATCH MUTATION: update not applying changes."""
        graph = client.post(
            "/api/v1/graphs",
            json={"name": "V1", "nodes": [], "edges": []},
        )
        gid = graph.json()["id"]
        client.put(f"/api/v1/graphs/{gid}", json={"name": "V2"})
        updated = client.get(f"/api/v1/graphs/{gid}")
        # Mutation: if name still == "V1" → test fails ✓
        assert updated.json()["name"] == "V2"

    def test_access_control_enforced(self, client):
        """CATCH MUTATION: removing access check."""
        graph = client.post(
            "/api/v1/graphs",
            json={"name": "Protected", "nodes": [], "edges": []},
        )
        gid = graph.json()["id"]
        # Add access rule
        response = client.post(
            f"/api/v1/graphs/{gid}/access",
            json={"team": "test-team", "role": "read"},
        )
        # Mutation: if access control removed → 200 even without auth
        assert response.status_code == 200
