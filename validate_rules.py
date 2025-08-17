#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validador para o arquivo de regras do ROBOTTO.

Este módulo pode ser utilizado via CLI ou importado em testes.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable, List

REQUIRED_KEYS = {
    "version",
    "locale",
    "legal",
    "intake",
    "domains",
    "logic",
    "guidelines",
    "updated_at",
}
REQUIRED_ANSWER_OPTIONS = {"Sim", "Não"}


def load_json(path: Path) -> dict:
    """Carrega um arquivo JSON e retorna o objeto Python correspondente."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as err:
        raise FileNotFoundError(f"Arquivo não encontrado: {path}") from err
    except json.JSONDecodeError as err:
        raise ValueError(f"Erro ao carregar JSON: {err}") from err


def validate_required_keys(data: dict) -> List[str]:
    """Verifica a presença das chaves obrigatórias."""
    missing = sorted(REQUIRED_KEYS.difference(data.keys()))
    if missing:
        return ["Chaves obrigatórias ausentes: " + ", ".join(missing)]
    return []


def validate_unique_redflag_ids(data: dict) -> List[str]:
    """Garante que IDs de red flags sejam únicos em todo o arquivo."""
    seen: set[str] = set()
    duplicates: set[str] = set()

    for item in data.get("global_red_flags", []):
        flag_id = item.get("id")
        if flag_id in seen:
            duplicates.add(flag_id)
        else:
            seen.add(flag_id)

    for domain in data.get("domains", {}).values():
        for item in domain.get("red_flags", []):
            flag_id = item.get("id")
            if flag_id in seen:
                duplicates.add(flag_id)
            else:
                seen.add(flag_id)

    if duplicates:
        return ["IDs de red flags duplicados: " + ", ".join(sorted(duplicates))]
    return []


def validate_self_care(data: dict) -> List[str]:
    """Valida o campo opcional self_care dentro de on_true."""
    errors: List[str] = []

    def check(flags: List[dict], prefix: str) -> None:
      for idx, item in enumerate(flags):
        on_true = item.get("on_true", {})
        if "self_care" in on_true:
          sc = on_true["self_care"]
          if (
              not isinstance(sc, list)
              or not sc
              or not all(isinstance(x, str) and x.strip() for x in sc)
          ):
            errors.append(
                f"{prefix}[{idx}].on_true.self_care deve ser lista não vazia de strings")

    check(data.get("global_red_flags", []), "global_red_flags")
    for domain_name, domain in data.get("domains", {}).items():
      check(domain.get("red_flags", []), f"domains.{domain_name}.red_flags")

    return errors


def validate_logic(data: dict) -> List[str]:
    """Valida regras específicas de lógica."""
    errors: List[str] = []
    logic = data.get("logic", {})

    threshold = logic.get("pain_escalation_threshold")
    if not isinstance(threshold, int) or not 0 <= threshold <= 10:
        errors.append("logic.pain_escalation_threshold deve estar entre 0 e 10.")

    answer_opts = logic.get("answer_options")
    if not isinstance(answer_opts, list) or not REQUIRED_ANSWER_OPTIONS.issubset(answer_opts):
        errors.append("logic.answer_options deve conter 'Sim' e 'Não'.")

    return errors


def validate_guidelines(data: dict) -> List[str]:
    """Valida presença de guidelines para cada sintoma"""
    errors: List[str] = []
    guidelines = data.get("guidelines")
    if not isinstance(guidelines, dict):
        return ["guidelines deve ser um objeto com textos"]

    symptoms_section = None
    for section in data.get("intake", {}).get("sections", []):
        if section.get("id") == "symptoms":
            symptoms_section = section
            break

    if symptoms_section:
        checklist = next((f for f in symptoms_section.get("fields", []) if f.get("id") == "symptom_checklist"), None)
        if checklist:
            for choice in checklist.get("choices", []):
                text = guidelines.get(choice)
                if not isinstance(text, str) or not text.strip():
                    errors.append(f"guidelines ausente ou vazio para sintoma: {choice}")
    return errors


def validate(path: Path) -> bool:
    """Executa todas as validações e retorna True se o arquivo for válido."""
    try:
        data = load_json(path)
    except Exception as exc:  # pragma: no cover - mensagens já testadas via retorno
        print(exc)
        return False

    errors: List[str] = []
    validators: Iterable = (
        validate_required_keys,
        validate_logic,
        validate_unique_redflag_ids,
        validate_self_care,
        validate_guidelines,
    )
    for validator in validators:
        errors.extend(validator(data))

    if errors:
        for err in errors:
            print(err)
        return False

    print("Validação concluída com sucesso.")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Validador de regras do ROBOTTO")
    parser.add_argument(
        "--path",
        default="rules_otorrino.json",
        type=Path,
        help="Caminho para o arquivo de regras",
    )
    args = parser.parse_args()
    return 0 if validate(args.path) else 1


if __name__ == "__main__":  # pragma: no cover - ponto de entrada do script
    raise SystemExit(main())
