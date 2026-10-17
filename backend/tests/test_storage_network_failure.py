import unittest
from types import SimpleNamespace
from unittest.mock import patch

import httpx

from app.services.storage_service import StorageService


class StorageNetworkFailureTests(unittest.TestCase):
    def test_network_failure_never_reports_successful_upload(self):
        for environment in ('development', 'test', 'production'):
            with self.subTest(environment=environment), \
                 patch('app.services.storage_service.get_settings', return_value=SimpleNamespace(environment=environment)), \
                 patch('app.services.storage_service._get_supabase_config', return_value=('https://storage.example.test', 'fake-key', 'images')), \
                 patch('app.services.storage_service.httpx.Client') as client:
                client.return_value.__enter__.return_value.post.side_effect = httpx.ConnectError('getaddrinfo failed')
                with self.assertRaisesRegex(RuntimeError, 'Your upload was not saved'):
                    StorageService._upload_to_supabase('screenings/test/image.png', b'image', 'image/png')

    def test_download_network_failure_has_actionable_message(self):
        with patch('app.services.storage_service._get_supabase_config', return_value=('https://storage.example.test', 'fake-key', 'images')), \
             patch('app.services.storage_service.httpx.Client') as client:
            client.return_value.__enter__.return_value.get.side_effect = httpx.ConnectError('getaddrinfo failed')
            with self.assertRaisesRegex(RuntimeError, 'Analysis cannot retrieve your photograph'):
                StorageService._download_from_supabase('screenings/test/image.png')

    def test_upload_success_still_sends_actual_bytes(self):
        with patch('app.services.storage_service._get_supabase_config', return_value=('https://storage.example.test', 'fake-key', 'images')), \
             patch('app.services.storage_service.httpx.Client') as client:
            send = client.return_value.__enter__.return_value.post
            send.return_value.status_code = 201
            StorageService._upload_to_supabase('screenings/test/image.png', b'actual-image', 'image/png')
            self.assertEqual(send.call_args.kwargs['content'], b'actual-image')
