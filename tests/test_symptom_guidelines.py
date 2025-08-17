import json
from textwrap import dedent
import subprocess


def run_node(code: str) -> str:
    result = subprocess.run([
        "node",
        "-e",
        code,
    ], capture_output=True, text=True, check=True)
    return result.stdout.strip()


def test_multiple_symptom_guidelines():
    script = dedent(
        """
        const fs = require('fs');
        const rules = JSON.parse(fs.readFileSync('./rules_otorrino.json', 'utf-8'));
        const selected = ['Tosse', 'Nariz entupido', 'Zumbido'];
        const messages = [];
        selected.forEach(sym => {
            const txt = rules?.guidelines?.[sym];
            if (txt) messages.push(txt);
        });
        console.log(JSON.stringify(messages));
        """
    )
    out = run_node(script)
    messages = json.loads(out)
    assert messages == [
        'Beba água e evite ambientes com fumaça.',
        'Lave o nariz com soro fisiológico.',
        'Reduza cafeína e álcool; procure otorrino se persistente.'
    ]
