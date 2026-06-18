#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import yaml


def main() -> int:
    config_path = Path(sys.argv[1])
    config = yaml.safe_load(config_path.read_text()) or {}
    servers = config.get("mcp_servers") or {}
    print(json.dumps({"names": sorted(servers.keys())}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())