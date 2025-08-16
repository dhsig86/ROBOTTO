#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validador do arquivo rules_otorrino.json.

Este script verifica a presença de chaves obrigatórias, validações
específicas e duplicidade de IDs de red flags.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


REQUIRED_KEYS = {"version", "locale", "legal", "intake", "domains", "logic"}
REQUIRED_ANSWER_OPTIONS = {"Sim", "Não"}


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

    # 1) Verifica chaves obrigatórias
    missing = sorted(REQUIRED_KEYS.difference(data.keys()))
    if missing:
        errors.append(
            "Chaves obrigatórias ausentes: " + ", ".join(missing)
        )

    # 2) Verifica limites da escala de dor
    pain_scale = None
    for section in data.get("intake", {}).get("sections", []):
        for field in section.get("fields", []):
            if field.get("id") == "pain_scale":
                pain_scale = field
                break
        if pain_scale:
            break

    if not pain_scale:
        errors.append("Campo 'pain_scale' não encontrado em 'intake'.")
    else:
        min_val = pain_scale.get("min")
        max_val = pain_scale.get("max")
        if (min_val is None or min_val < 0) or (max_val is None or max_val > 10):
            errors.append(
                f"'pain_scale' possui limites inválidos: min={min_val}, max={max_val}"
            )

    # 3) Verifica opções de resposta
    answer_opts = data.get("logic", {}).get("answer_options")
    if not isinstance(answer_opts, list):
        errors.append("logic.answer_options deve ser uma lista.")
    else:
        if not REQUIRED_ANSWER_OPTIONS.issubset(answer_opts):
            errors.append(
                "logic.answer_options deve conter 'Sim' e 'Não'."
            )

    # 4) Checa duplicidade de IDs de red flags
    seen_ids: set[str] = set()
    duplicate_ids: set[str] = set()

    for item in data.get("global_red_flags", []):
        flag_id = item.get("id")
        if flag_id in seen_ids:
            duplicate_ids.add(flag_id)
        else:
            seen_ids.add(flag_id)

    for domain_name, domain in data.get("domains", {}).items():
        for item in domain.get("red_flags", []):
            flag_id = item.get("id")
            if flag_id in seen_ids:
                duplicate_ids.add(flag_id)
            else:
                seen_ids.add(flag_id)

    if duplicate_ids:
        errors.append(
            "IDs de red flags duplicados: " + ", ".join(sorted(duplicate_ids))
        )

    if errors:
        for err in errors:
            print(err)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())

