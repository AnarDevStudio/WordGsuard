const vscode = require('vscode');
const json = require('./badwords.json');

/** @type {any | null} */
let filter = null;

/** @type {vscode.DiagnosticCollection} */
let diagnosticCollection;

async function loadFilter() {
    const Filter = require('bad-words');
    filter = new Filter();

    filter.addWords(
		...json
    );
}

/**
 * @param {import('vscode').ExtensionContext} context
 */
async function activate(context) {

    console.log('WordGuard Activated');

    await loadFilter();

    diagnosticCollection =
        vscode.languages.createDiagnosticCollection('wordguard');

    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'wordguard.scan',
            scanAllFiles
        )
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(scanDocument)
    );

    await scanAllFiles();
}

async function scanAllFiles() {

    const files = await vscode.workspace.findFiles(
        '**/*.{js,ts,jsx,tsx,py,java,c,cpp,cs,go,rb,php,vue,html,css}',
        '**/{node_modules,.git,dist,build,.next,out,vendor}/**'
    );

    let total = 0;

    for (const file of files) {

        try {

            const doc =
                await vscode.workspace.openTextDocument(file);

            total += scanDocument(doc);

        } catch {}
    }

    vscode.window.showInformationMessage(
        total === 0
            ? 'WordGuard: Clean Code'
            : `⚠️ WordGuard: ${total} issues found`
    );
}

/**
 * @param {vscode.TextDocument} document
 */
function scanDocument(document) {

    if (!filter) return 0;

    const diagnostics = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];

        const wordRegex =
            /\b[a-zA-ZğüşöçıİĞÜŞÖÇ]{2,}\b/g;

        let match;

        while ((match = wordRegex.exec(line)) !== null) {

            const word = match[0];

            if (!filter || !filter.isProfane(word)) continue;

            const range = new vscode.Range(
                new vscode.Position(i, match.index),
                new vscode.Position(i, match.index + word.length)
            );

            diagnostics.push(
                new vscode.Diagnostic(
                    range,
                    `WordGuard: uygunsuz kelime → "${word}"`,
                    vscode.DiagnosticSeverity.Warning
                )
            );
        }
    }

    diagnosticCollection.set(document.uri, diagnostics);

    return diagnostics.length;
}


function deactivate() {

    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};