#!/usr/bin/env python3
import json
import sys
from pathlib import Path


def main() -> int:
    rules_path = Path("rules_otorrino.json")
    try:
        data = json.loads(rules_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"Arquivo não encontrado: {rules_path}")
        return 1
    except json.JSONDecodeError as err:
        print(f"Erro ao carregar JSON: {err}")
        return 1

    errors = []

    # 2) IDs únicos por domínio
    seen = {}
    for item in data.get("red_flags", []):
        domain = item.get("domain")
        flag_id = item.get("id")
        if domain not in seen:
            seen[domain] = set()
        if flag_id in seen[domain]:
            errors.append(f"ID duplicado '{flag_id}' no domínio '{domain}'.")
        else:
            seen[domain].add(flag_id)

        # 3) URLs de citações válidas
        for cite in item.get("citations", []):
            url = cite.get("url")
            if not isinstance(url, str) or not url.startswith("http"):
                errors.append(f"URL inválido em domínio '{domain}', ID '{flag_id}': {url!r}")

    if errors:
        for err in errors:
            print(err)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
