#!/usr/bin/env python3
"""
Запуск API-сервера Кинолент.

Использование:
  python3 run_server.py
  python3 run_server.py --port 8000 --reload
"""

import argparse
import uvicorn


def main():
    parser = argparse.ArgumentParser(description="Кинолент API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    args = parser.parse_args()

    uvicorn.run(
        "api.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
