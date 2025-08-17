import json
import subprocess
from textwrap import dedent


def run_node(code: str) -> str:
    result = subprocess.run(
        ["node", "-e", code], capture_output=True, text=True, check=True
    )
    return result.stdout.strip()


def test_red_flags_negative_flow():
    subprocess.run(
        ["npm", "install", "jsdom"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
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
            await new Promise(r => setTimeout(r, 700));
            while (mod.chat.state === 'ASK_FLAGS') {
                const buttons = Array.from(document.querySelectorAll('#quick-replies button'));
                const noBtn = buttons.find(b => b.textContent === 'Não');
                noBtn.click();
                await new Promise(r => setTimeout(r, 0));
            }
            await new Promise(r => setTimeout(r, 1000));
            const messagesDiv = document.getElementById('messages');
            const lastMessage = messagesDiv.lastElementChild.textContent;
            console.log(JSON.stringify({ state: mod.chat.state, lastMessage }));
        })();
        """
    )
    out = run_node(script)
    data = json.loads(out)
    assert data["state"] == "END"
    assert "Deseja agendar uma avaliação?" in data["lastMessage"]


def test_red_flags_positive_flow():
    subprocess.run(
        ["npm", "install", "jsdom"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
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
            await new Promise(r => setTimeout(r, 700));
            const buttons = Array.from(document.querySelectorAll('#quick-replies button'));
            const yesBtn = buttons.find(b => b.textContent === 'Sim');
            yesBtn.click();
            await new Promise(r => setTimeout(r, 0));
            await new Promise(r => setTimeout(r, 1000));
            const messagesDiv = document.getElementById('messages');
            const lastMessage = messagesDiv.lastElementChild.textContent;
            console.log(JSON.stringify({ state: mod.chat.state, lastMessage }));
        })();
        """
    )
    out = run_node(script)
    data = json.loads(out)
    assert data["state"] == "END"
    assert "Deseja agendar uma avaliação?" in data["lastMessage"]

