import json
import subprocess
from textwrap import dedent


def run_node(code: str):
    result = subprocess.run(
        ["node", "-e", code], capture_output=True, text=True, check=True
    )
    return result.stdout.strip()


def test_classify_domain_basic():
    script = dedent(
        """
        const { preprocessDomainKeywords, classifyDomain } = require('./classifier.js');
        const rules = { logic: { domain_classification_keywords: {
            ouvido: ['ouvido', '/ouvid[oa]\\s*dor/'],
            nariz: ['nariz']
        }}};
        preprocessDomainKeywords(rules);
        const r1 = classifyDomain('Tenho dor de ouvido', rules);
        const r2 = classifyDomain('Sangue no nariz', rules);
        const r3 = classifyDomain('nariss', rules);
        console.log(JSON.stringify({r1, r2, r3}));
        """
    )
    out = run_node(script)
    data = json.loads(out)
    assert data['r1']['domain'] == 'ouvido'
    assert data['r1']['confidence'] == 1
    assert data['r2']['domain'] == 'nariz'
    assert data['r2']['confidence'] == 1
    assert data['r3']['domain'] == 'nariz'
    assert 0 < data['r3']['confidence'] < 1
