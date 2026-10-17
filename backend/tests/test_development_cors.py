import unittest

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.core.cors import development_origin_regex


class DevelopmentCorsTests(unittest.TestCase):
    def client(self, environment):
        app = FastAPI()
        app.add_middleware(CORSMiddleware, allow_origins=["https://app.example.test"],
                           allow_origin_regex=development_origin_regex(environment),
                           allow_credentials=True, allow_methods=["GET"], allow_headers=["Authorization"])
        return TestClient(app)

    def preflight(self, client, origin):
        return client.options("/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"})

    def test_expo_ports_and_private_network_hosts_are_allowed_in_development(self):
        client = self.client("development")
        for origin in ["http://localhost:8081", "http://127.0.0.1:8084", "http://192.168.18.106:8083", "http://10.0.2.2:8090", "http://172.16.0.2:8082"]:
            with self.subTest(origin=origin):
                response = self.preflight(client, origin)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["access-control-allow-origin"], origin)

    def test_public_hosts_wrong_ports_and_suffixes_are_rejected(self):
        client = self.client("development")
        for origin in ["http://example.test:8083", "http://8.8.8.8:8083", "http://localhost:9999", "http://localhost.evil.test:8083", "http://172.32.0.2:8083"]:
            with self.subTest(origin=origin):
                self.assertEqual(self.preflight(client, origin).status_code, 400)

    def test_production_uses_only_configured_origins(self):
        client = self.client("production")
        self.assertEqual(self.preflight(client, "http://localhost:8083").status_code, 400)
        self.assertEqual(self.preflight(client, "https://app.example.test").status_code, 200)


if __name__ == "__main__":
    unittest.main()
