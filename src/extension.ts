import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { toHex } from './utils';

interface PasteFile {
	fileName: string;
	content: string;
}

interface CreatePasteRequest {
	content: string;
	author?: string;
	comments_enabled: boolean;
	checksum_passphrase?: string;
	expires_at?: number;
	forked_from?: number;
}

interface CreatePasteResponse {
	id: number;
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// https://code.visualstudio.com/api/get-started/your-first-extension
	// https://code.visualstudio.com/api/references/vscode-api
	// https://brandonscott.me/posts/writing-and-publishing-your-first-visual-studio-code-extension/
	console.log('hastebin extension is now active.');

	// https://code.visualstudio.com/api/references/vscode-api#commands.registerCommand
	const shareSelectionCommand = vscode.commands.registerCommand(
		'hastebin.shareSelection',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage('No active editor found.');
				return;
			}

			const selection = editor.selection;
			const selectedText = editor.document.getText(selection);

			if (!selectedText) {
				vscode.window.showWarningMessage('No text selected.');
				return;
			}

			await shareToPastebin([{
				fileName: 'main',
				content: selectedText
			}]);
		}
	);

	const shareFileCommand = vscode.commands.registerCommand(
		'hastebin.shareFile',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage('No active editor found.');
				return;
			}

			const fileContent = editor.document.getText();
			const fileName = editor.document.fileName.split('/').pop() || 'Untitled'; // if src/main/main.rs, itll get only main.rs

			if (!fileContent) {
				vscode.window.showWarningMessage('File is empty.');
				return;
			}

			await shareToPastebin([{
				fileName: fileName,
				content: fileContent
			}]);
		}
	);

	// https://code.visualstudio.com/api/references/vscode-api#window.showOpenDialog
	const shareMultiFileCommand = vscode.commands.registerCommand(
		'hastebin.shareMultiFile',
		async () => {
			// i did not write this lmao
			const uris = await vscode.window.showOpenDialog({
				canSelectMany: true,
				canSelectFiles: true,
				canSelectFolders: false,
				openLabel: 'Share to Hastebin'
			});

			if (!uris || uris.length === 0) {
				vscode.window.showWarningMessage('No files selected.');
				return;
			}

			const files: PasteFile[] = [];
			for (const uri of uris) {
				// i also did not write this
				const document = await vscode.workspace.openTextDocument(uri);
				const fileName = uri.path.split('/').pop() || 'Untitled';
				files.push({
					fileName,
					content: document.getText()
				});
			}

			if (files.length === 0 || files.every(f => !f.content)) {
				vscode.window.showWarningMessage('All selected files are empty.');
				return;
			}

			await shareToPastebin(files);
		}
	);

	context.subscriptions.push(shareSelectionCommand, shareFileCommand, shareMultiFileCommand);
}

// This method is called when your extension is deactivated
export function deactivate() { }

async function shareToPastebin(files: PasteFile[]): Promise<void> {
	// https://code.visualstudio.com/api/references/vscode-api#workspace.getConfiguration
	const config = vscode.workspace.getConfiguration('hastebin');
	const apiUrl = config.get<string>('apiUrl', 'https://backend.ianhon.com/hastebin');
	const siteUrl = config.get<string>('siteUrl', 'https://hastebin.ianhon.com');
	const openInBrowser = config.get<boolean>('openInBrowser', true);
	const commentsEnabled = config.get<boolean>('commentsEnabled', true);

	try {
		vscode.window.setStatusBarMessage('$(sync~spin) Sharing to Hastebin...', 3000);

		// Serialize the files array as JSON string
		const pasteId = toHex(await createPaste(apiUrl, {
			content: JSON.stringify(files),
			comments_enabled: commentsEnabled,
		}));

		const pasteUrl = `${siteUrl}/${pasteId}`;

		// https://code.visualstudio.com/api/references/vscode-api#env.clipboard
		// all the damn docs say is 'clipboard'
		// like what else is it supposed to be bro
		await vscode.env.clipboard.writeText(pasteUrl);

		// https://code.visualstudio.com/api/references/vscode-api#env.openExternal
		if (openInBrowser) {
			await vscode.env.openExternal(vscode.Uri.parse(pasteUrl));
		}

		vscode.window.showInformationMessage(
			`Hastebin link copied to clipboard!`,
			'Open'
		).then(selection => {
			if (selection === 'Open') {
				vscode.env.openExternal(vscode.Uri.parse(pasteUrl));
			}
		});

	} catch (error) {
		vscode.window.showErrorMessage(
			`Failed to create paste: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

function createPaste(
	baseUrl: string,
	request: CreatePasteRequest
): Promise<number> {
	return new Promise((resolve, reject) => {
		try {
			const body = JSON.stringify(request);
			// console.log(body);
			const url = new URL(`${baseUrl}/paste/create`);

			const isHttps = url.protocol === 'https:';
			const client = isHttps ? https : http;

			const options: http.RequestOptions = {
				hostname: url.hostname,
				port: url.port || (isHttps ? 443 : 80),
				path: url.pathname,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body),
				},
			};

			const req = client.request(options, (res) => {
				// console.log(res);

				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
					// console.log(data);
					// console.log(chunk);
				});

				res.on('end', () => {
					if (res.statusCode === 200) {
						try {
							const response: CreatePasteResponse = JSON.parse(data);
							resolve(response.id);
						} catch (parseError) {
							reject(new Error(`Failed to parse response: ${data}`));
						}
					} else {
						reject(new Error(`Server returned status ${res.statusCode}: ${data}`));
					}
				});
			});

			req.on('error', (error) => {
				reject(new Error(`Request failed: ${error.message}`));
			});

			// attach body to request
			req.write(body);
			req.end();

		} catch (error) {
			reject(error);
		}
	});
}
