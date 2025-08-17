import json
import subprocess
from textwrap import dedent


def run_node(code: str) -> str:
    result = subprocess.run([
        "node",
        "-e",
        code,
    ], capture_output=True, text=True, check=True)
    return result.stdout.strip()


def test_classification_after_symptoms():
    subprocess.run(["npm", "install", "jsdom"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    script = dedent(
        """
        const { readFileSync } = require('fs');
        const { JSDOM } = require('jsdom');

        const html = `<!DOCTYPE html><body>
            <div id="messages"></div>
            <div id="quick-replies"></div>
            <form id="input-form"><input id="user-input" /></form>
            <div id="consent"></div>
            <button id="start-btn"></button>
            <input id="lgpd-checkbox" type="checkbox" />
            <button id="theme-toggle"></button>
            <button id="reset-btn"></button>
            <progress id="progress"></progress>
            <div id="symptom-overlay">
              <form id="symptom-form">
                <div id="symptom-options"></div>
              </form>
              <button id="skip-symptoms"></button>
            </div>
        </body>`;

        const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.localStorage = dom.window.localStorage;
        global.fetch = (p) => {
            const data = readFileSync(p, 'utf-8');
            return Promise.resolve({ json: () => Promise.resolve(JSON.parse(data)) });
        };
        const cls = require('./classifier.js');
        global.preprocessDomainKeywords = cls.preprocessDomainKeywords;
        global.classifyDomain = cls.classifyDomain;
        global.messages = require('./messages.js');

        const mod = require('./app.js');
        document.dispatchEvent(new window.Event('DOMContentLoaded'));

        (async () => {
            await new Promise(r => setTimeout(r, 0));
            mod.handleIntake('nariz entupido');
            await new Promise(r => setTimeout(r, 0));
            const symptomForm = document.getElementById('symptom-form');
            const first = symptomForm.querySelector('input[name="symptom"]');
            first.checked = true;
            symptomForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, 0));
            console.log(JSON.stringify({ state: mod.chat.state, domain: mod.chat.domain }));
        })();
        """
    )
    out = run_node(script)
    data = json.loads(out)
    assert data["domain"] == "nariz"
    assert data["state"] == "ASK_FLAGS"
