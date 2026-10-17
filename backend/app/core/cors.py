"""Origins used by Expo's local browser preview."""


def development_origin_regex(environment: str) -> str | None:
    if environment != "development":
        return None
    # Expo selects another port when 8081 is occupied. Limit this allowance to
    # loopback/private LAN hosts and development ports; production stays explicit.
    host = r"(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})"
    return rf"http://{host}:(?:808\d|809\d|517[3-9])"
