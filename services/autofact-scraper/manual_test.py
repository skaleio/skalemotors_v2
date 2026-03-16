from __future__ import annotations

import asyncio
import sys

from dotenv import load_dotenv

from app.autofact_client import lookup_vehicle


async def main() -> None:
    load_dotenv()

    if len(sys.argv) < 2:
        print("Uso: python manual_test.py PFRR65")
        raise SystemExit(1)

    patente = sys.argv[1]
    result = await lookup_vehicle(patente)
    print(result.model_dump_json(indent=2))


if __name__ == "__main__":
    asyncio.run(main())
