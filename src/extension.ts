import {exec} from 'child_process';
import * as vscode from 'vscode';

import {Config, FormatterConfig} from './types';

const DEFAULT_GLOBAL_EXCLUDE: string[] = [];
const DEFAULT_EXCLUDE_PATTERN: string[] = [
    '**/build',
    '**/node_modules',
    '**/.*',
    '**/.vscode',
];
const DEFAULT_INCLUDE_PATTERN: string[] = ['*'];

const globalExclude: string[] = DEFAULT_GLOBAL_EXCLUDE;
let excludePattern: string[] = DEFAULT_EXCLUDE_PATTERN;
let includePattern: string[] = DEFAULT_INCLUDE_PATTERN;

let workspaceFolder: string | undefined;
export const EXTENSION_NAME = 'Workspace_Formatter';

export let extensionContext: vscode.ExtensionContext | undefined;
export let extensionState: vscode.Memento | undefined;
export let extensionPath: string | undefined;

export function activate(context: vscode.ExtensionContext) {
    if (
        !vscode.workspace.workspaceFolders ||
        vscode.workspace.workspaceFolders.length === 0
    )
        return;

    if (
        !vscode.workspace.workspaceFolders[0] ||
        !vscode.workspace.workspaceFolders[0].uri
    )
        return;

    if (vscode.workspace.workspaceFolders.length === 1)
        workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;

    const outputChannel = vscode.window.createOutputChannel(
        'Custom Local Formatters',
    );
    let disposables: readonly vscode.Disposable[] = [];

    vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration('customLocalFormatters')) return;
        disposables.forEach((d) => d.dispose());
        disposables = registerFormatters(getFormatterConfigs(), outputChannel);
    });

    disposables = registerFormatters(getFormatterConfigs(), outputChannel);

    extensionContext = context;
    extensionPath = context.extensionPath;
    extensionState = context.workspaceState;

    loadGlobalExcludeSettings();
    loadSettings();
}

function getExtensionSetting(name_: string, defaultValue: any) {
    const name: string = `${EXTENSION_NAME}.${name_}`;

    const settingsValue = vscode.workspace.getConfiguration().get(name);

    if (settingsValue === undefined) return defaultValue;

    return settingsValue;
}

export function getGlobalSetting(name: string, defaultValue: any) {
    const settingsValue = vscode.workspace.getConfiguration().get(name);

    if (settingsValue === undefined) return defaultValue;

    return settingsValue;
}

function loadGlobalExcludeSettings() {
    const globalExcludeObj = getGlobalSetting(
        'files.exclude',
        DEFAULT_GLOBAL_EXCLUDE,
    );

    const globalExcludeKeys = Object.keys(globalExcludeObj);

    for (const key of globalExcludeKeys)
        if (globalExcludeObj[key] === true) globalExclude.push(key);

    excludePattern.push(...globalExclude);
}

function loadSettings() {
    includePattern = getExtensionSetting(
        'includePattern',
        DEFAULT_INCLUDE_PATTERN,
    );
    excludePattern = getExtensionSetting(
        'excludePattern',
        DEFAULT_EXCLUDE_PATTERN,
    );
}

const getFormatterConfigs = () => {
    const config = vscode.workspace.getConfiguration('customLocalFormatters');
    return config.get<Config['formatters']>('formatters', []);
};

const registerFormatters = (
    formatters: readonly FormatterConfig[],
    outputChannel: vscode.OutputChannel,
): readonly vscode.Disposable[] => {
    return formatters
        .map((formatter) => {
            if (formatter.disabled) return;

            return vscode.languages.registerDocumentFormattingEditProvider(
                formatter.languages,
                {
                    provideDocumentFormattingEdits(document, options) {
                        const command = formatter.command
                            .replace(/\${file}/g, document.fileName)
                            .replace(
                                /\${insertSpaces}/g,
                                '' + options.insertSpaces,
                            )
                            .replace(
                                /\${tabSize}/g,
                                '' + options.tabSize.toString,
                            );

                        const cwd = workspaceFolder;

                        return new Promise<vscode.TextEdit[]>(
                            (resolve, reject) => {
                                outputChannel.appendLine(
                                    `Starting formatter: ${command}`,
                                );
                                const originalDocumentText = document.getText();

                                const process = exec(
                                    command,
                                    {cwd},
                                    (error, stdout, stderr) => {
                                        if (error) {
                                            outputChannel.appendLine(
                                                `Formatter failed: ${command}\nStderr:\n${stderr}`,
                                            );
                                            reject(error);
                                        }

                                        if (
                                            originalDocumentText.length > 0 &&
                                            stdout.length === 0
                                        ) {
                                            outputChannel.appendLine(
                                                `Formatter returned nothing - not applying changes.`,
                                            );
                                            resolve([]);
                                        }

                                        const documentRange = new vscode.Range(
                                            document.lineAt(0).range.start,
                                            document.lineAt(
                                                document.lineCount - 1,
                                            ).rangeIncludingLineBreak.end,
                                        );

                                        outputChannel.appendLine(
                                            `Finished running formatter: ${command}`,
                                        );
                                        if (stderr.length > 0) {
                                            outputChannel.appendLine(
                                                `Possible issues ocurred:\n${stderr}`,
                                            );
                                        }

                                        resolve([
                                            new vscode.TextEdit(
                                                documentRange,
                                                stdout,
                                            ),
                                        ]);
                                    },
                                );

                                process.stdin?.write(originalDocumentText);
                                process.stdin?.end();
                            },
                        );
                    },
                },
            );
        })
        .filter((v) => v != null) as vscode.Disposable[];
};

// this method is called when your extension is deactivated
export function deactivate() {}
