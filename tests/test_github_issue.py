import os
import unittest
from unittest.mock import patch

from wohnungssuche.github_issue import notification_mentions


class GitHubIssueTests(unittest.TestCase):
    def test_notification_mentions_support_multiple_users(self):
        with patch.dict(
            os.environ,
            {"GITHUB_NOTIFICATION_USERS": "stewalpp,gishaa-create"},
            clear=True,
        ):
            self.assertEqual(notification_mentions(), "@stewalpp @gishaa-create")

    def test_notification_mentions_keep_legacy_single_user(self):
        with patch.dict(
            os.environ,
            {"GITHUB_NOTIFICATION_USER": "@stewalpp"},
            clear=True,
        ):
            self.assertEqual(notification_mentions(), "@stewalpp")


if __name__ == "__main__":
    unittest.main()
