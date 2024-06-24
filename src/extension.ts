import {exec} from 'child_process';
import {minimatch} from 'minimatch';
import * as vscode from 'vscode';

import {Config, FormatterConfig} from './types';

const DEFAULT_EXCLUDE_PATTERN: string[] = [];
const DEFAULT_INCLUDE_PATTERN: string[] = [];

let excludePattern: string[] = DEFAULT_EXCLUDE_PATTERN;
let includePattern: string[] = DEFAULT_INCLUDE_PATTERN;

let workspaceFolder: string;
export const EXTENSION_NAME = 'customizeFormatter';

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
    else workspaceFolder = '';

    const outputChannel = vscode.window.createOutputChannel(
        'Customize Formatters',
    );
    let disposables: readonly vscode.Disposable[] = [];

    vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration('customizeFormatter')) return;
        disposables.forEach((d) => d.dispose());
        disposables = registerFormatters(getFormatterConfigs(), outputChannel);
    });

    disposables = registerFormatters(getFormatterConfigs(), outputChannel);

    extensionContext = context;
    extensionPath = context.extensionPath;
    extensionState = context.workspaceState;
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

function loadSettings() {
    excludePattern = getExtensionSetting(
        'excludePattern',
        DEFAULT_EXCLUDE_PATTERN,
    );

    includePattern = getExtensionSetting(
        'includePattern',
        DEFAULT_INCLUDE_PATTERN,
    );
}

const getFormatterConfigs = () => {
    const config = vscode.workspace.getConfiguration('customizeFormatter');
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
                        const cwd = workspaceFolder;

                        const command = formatter.command
                            .replace(/\${file}/g, document.fileName)
                            .replace(
                                /\${insertSpaces}/g,
                                '' + options.insertSpaces,
                            )
                            .replace(
                                /\${tabSize}/g,
                                '' + options.tabSize.toString,
                            )
                            .replace('${workspaceFolder}', cwd);

                        loadSettings();

                        let is_in_include_pattern = false;
                        for (const pattern of includePattern) {
                            if (pattern === '*') {
                                is_in_include_pattern = true;
                                break;
                            }
                            const include_file_abs = minimatch(
                                document.fileName,
                                pattern,
                            );
                            const rel_file_name = document.fileName
                                .replace(cwd, '')
                                .replace(/\\/g, '/')
                                .replace(/^\/+/, '');
                            const include_file_rel = minimatch(
                                rel_file_name,
                                pattern,
                            );
                            if (include_file_abs || include_file_rel)
                                is_in_include_pattern = true;
                        }

                        if (
                            includePattern.length > 0 &&
                            !is_in_include_pattern
                        ) {
                            return new Promise<vscode.TextEdit[]>((_, __) => {
                                outputChannel.appendLine(
                                    `File is not included for formatting: ${command}`,
                                );
                                const originalDocumentText = document.getText();

                                process.stdin?.write(originalDocumentText);
                                process.stdin?.end();
                            });
                        }

                        for (const pattern of excludePattern) {
                            const exclude_file_abs = minimatch(
                                document.fileName,
                                pattern,
                            );
                            const rel_file_name = document.fileName
                                .replace(cwd, '')
                                .replace(/\\/g, '/')
                                .replace(/^\/+/, '');
                            const exclude_file_rel = minimatch(
                                rel_file_name,
                                pattern,
                            );
                            if (exclude_file_abs || exclude_file_rel) {
                                return new Promise<vscode.TextEdit[]>(
                                    (_, __) => {
                                        outputChannel.appendLine(
                                            `File is excluded from formatting: ${command}`,
                                        );
                                        const originalDocumentText =
                                            document.getText();

                                        process.stdin?.write(
                                            originalDocumentText,
                                        );
                                        process.stdin?.end();
                                    },
                                );
                            }
                        }

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
                                            vscode.window.showErrorMessage(
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
