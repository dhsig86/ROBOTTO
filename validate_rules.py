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

    errors: list[str] = []

    # 1) Itera sobre os domínios e valida IDs e URLs
    for domain_name, domain in data.get("domains", {}).items():
        seen_ids: set[str] = set()
        for item in domain.get("red_flags", []):
            flag_id = item.get("id")
            if flag_id in seen_ids:
                errors.append(
                    f"ID duplicado '{flag_id}' no domínio '{domain_name}'."
                )
            else:
                seen_ids.add(flag_id)

            for cite in item.get("citations", []):
                url = cite.get("url")
                if not isinstance(url, str) or not url.startswith("http"):
                    errors.append(
                        f"URL inválido no domínio '{domain_name}', red flag '{flag_id}': {url!r}"
                    )

    if errors:
        for err in errors:
            print(err)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
