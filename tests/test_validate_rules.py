import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT))

import subprocess

VALIDATOR = ROOT / "validate_rules.py"
FIXTURE = ROOT / "rules_otorrino.json"

def run_validator(path):
    return subprocess.run(["python", str(VALIDATOR), str(path)], capture_output=True, text=True)

def test_valid_json(tmp_path):
    dest = tmp_path / "rules.json"
    dest.write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")
    assert run_validator(dest).returncode == 0

def test_invalid_json(tmp_path):
    dest = tmp_path / "invalid.json"
    dest.write_text("{invalid", encoding="utf-8")
    assert run_validator(dest).returncode == 1

def test_duplicate_red_flag_ids(tmp_path):
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    data["global_red_flags"].append(data["global_red_flags"][0])
    dest = tmp_path / "dup.json"
    dest.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    result = run_validator(dest)
    assert result.returncode == 1
    assert "IDs de red flags duplicados" in result.stdout

def test_invalid_pain_scale_limits(tmp_path):
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    for section in data.get("intake", {}).get("sections", []):
        for field in section.get("fields", []):
            if field.get("id") == "pain_scale":
                field["min"] = -1
                field["max"] = 11
    dest = tmp_path / "pain.json"
    dest.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    result = run_validator(dest)
    assert result.returncode == 1
    assert "pain_scale" in result.stdout
