const vscode = require('vscode');
const json = require('./badwords.json');

/** @type {any | null} */
let filter = null;

/** @type {vscode.DiagnosticCollection} */
let diagnosticCollection;

/** @type {NodeJS.Timeout | null} */
let timeout = null;

/** @type {boolean} */
let autoScanEnabled = true;

/** @type {vscode.StatusBarItem} */
let statusBarItem;

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

    // Status Bar
    statusBarItem =
        vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );

    statusBarItem.command =
        'wordguard.toggleAuto';

    updateStatusBar();

    statusBarItem.show();

    context.subscriptions.push(statusBarItem);

    // Toggle Auto Scan
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'wordguard.toggleAuto',
            async () => {

                autoScanEnabled =
                    !autoScanEnabled;

                updateStatusBar();

                vscode.window.showInformationMessage(
                    autoScanEnabled
                        ? 'WordGuard Auto Enabled'
                        : 'WordGuard Auto Disabled'
                );

                if (autoScanEnabled) {
                    await scanAllFiles();
                }
            }
        )
    );

    // Auto Scan While Typing
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(
            (event) => {

                if (!autoScanEnabled) return;

                if (timeout) {
                    clearTimeout(timeout);
                }

                timeout = setTimeout(() => {
                    scanDocument(event.document);
                }, 250);
            }
        )
    );

    // Scan opened files automatically
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(
            scanDocument
        )
    );

    // Scan current active editor
    if (vscode.window.activeTextEditor) {
        scanDocument(
            vscode.window.activeTextEditor.document
        );
    }

    // Scan all workspace files automatically
    await scanAllFiles();
}

async function scanAllFiles() {

    const files =
        await vscode.workspace.findFiles(
            '**/*.{js,ts,jsx,tsx,py,java,c,cpp,cs,go,rb,php,vue,html,css}',
            '**/{node_modules,.git,dist,build,.next,out,vendor}/**'
        );

    for (const file of files) {

        try {

            const doc =
                await vscode.workspace.openTextDocument(file);

            scanDocument(doc);

        } catch {}
    }
}

/**
 * @param {vscode.TextDocument} document
 */
function scanDocument(document) {

    if (!filter) return 0;

    const diagnostics = [];

    const text =
        document.getText();

    const lines =
        text.split('\n');

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];

        const wordRegex =
            /\b[a-zA-ZğüşöçıİĞÜŞÖÇ]{2,}\b/g;

        let match;

        while ((match = wordRegex.exec(line)) !== null) {

            const word = match[0];

            if (!filter.isProfane(word)) continue;

            const range =
                new vscode.Range(
                    new vscode.Position(i, match.index),
                    new vscode.Position(
                        i,
                        match.index + word.length
                    )
                );

            diagnostics.push(
                new vscode.Diagnostic(
                    range,
                    `WordGuard: Bad Word → "${word}"`,
                    vscode.DiagnosticSeverity.Warning
                )
            );
        }
    }

    diagnosticCollection.set(
        document.uri,
        diagnostics
    );

    return diagnostics.length;
}

function updateStatusBar() {

    if (!statusBarItem) return;

    statusBarItem.text =
        autoScanEnabled
            ? '$(check) WordGuard Auto'
            : '$(circle-slash) WordGuard Auto';

    statusBarItem.tooltip =
        autoScanEnabled
            ? 'Click to Disable Auto Scan'
            : 'Click to Enable Auto Scan';
}

function deactivate() {

    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }

    if (statusBarItem) {
        statusBarItem.dispose();
    }
}

module.exports = {
    activate,
    deactivate
};