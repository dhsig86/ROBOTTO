import json
from pathlib import Path
import sys

import pytest

sys.path.append(str(Path(__file__).resolve().parent.parent))
from validate_rules import validate


def load_base() -> dict:
    return json.loads(Path("rules_otorrino.json").read_text())


def write_temp(tmp_path, data: dict) -> Path:
    path = tmp_path / "rules.json"
    path.write_text(json.dumps(data))
    return path


def test_valid_rules(tmp_path):
    data = load_base()
    path = write_temp(tmp_path, data)
    assert validate(path) is True


def test_duplicate_ids_fail(tmp_path):
    data = load_base()
    dup_id = data["global_red_flags"][0]["id"]
    data["global_red_flags"].append({"id": dup_id, "question": "?"})
    path = write_temp(tmp_path, data)
    assert validate(path) is False


def test_missing_top_level_key_fail(tmp_path):
    data = load_base()
    data.pop("locale", None)
    path = write_temp(tmp_path, data)
    assert validate(path) is False


def test_pain_threshold_out_of_range_fail(tmp_path):
    data = load_base()
    data["logic"]["pain_escalation_threshold"] = 11
    path = write_temp(tmp_path, data)
    assert validate(path) is False


def test_missing_answer_options_fail(tmp_path):
    data = load_base()
    data["logic"]["answer_options"] = ["Talvez"]
    path = write_temp(tmp_path, data)
    assert validate(path) is False
