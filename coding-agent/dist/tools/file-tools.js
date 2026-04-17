import { readFile, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import glob from 'fast-glob';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
function resolveWorkspacePath(workingDirectory, requestedPath) {
    const workspaceRoot = resolve(workingDirectory);
    const resolvedPath = resolve(workspaceRoot, requestedPath);
    const relativePath = relative(workspaceRoot, resolvedPath);
    if (relativePath === '..' || relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
        throw new Error('Access denied: path must stay within the working directory');
    }
    return resolvedPath;
}
export const readTool = {
    id: 'read',
    description: 'Read the contents of a file',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'Path to the file to read'
            }
        },
        required: ['file_path']
    },
    async execute(args, context) {
        try {
            const filePath = resolveWorkspacePath(context.workingDirectory, args.file_path);
            const content = await readFile(filePath, 'utf-8');
            return {
                success: true,
                data: { content, path: args.file_path }
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
};
export const writeTool = {
    id: 'write',
    description: 'Write content to a file (creates new file or overwrites existing)',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'Path to the file to write'
            },
            content: {
                type: 'string',
                description: 'Content to write to the file'
            }
        },
        required: ['file_path', 'content']
    },
    async execute(args, context) {
        try {
            const filePath = resolveWorkspacePath(context.workingDirectory, args.file_path);
            await writeFile(filePath, args.content, 'utf-8');
            return {
                success: true,
                data: { path: args.file_path, bytes: args.content.length }
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
};
export const editTool = {
    id: 'edit',
    description: 'Edit a file by replacing old_string with new_string',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'Path to the file to edit'
            },
            old_string: {
                type: 'string',
                description: 'The exact string to replace'
            },
            new_string: {
                type: 'string',
                description: 'The string to replace it with'
            }
        },
        required: ['file_path', 'old_string', 'new_string']
    },
    async execute(args, context) {
        try {
            const filePath = resolveWorkspacePath(context.workingDirectory, args.file_path);
            const content = await readFile(filePath, 'utf-8');
            if (!content.includes(args.old_string)) {
                return {
                    success: false,
                    error: 'old_string not found in file'
                };
            }
            const newContent = content.replace(args.old_string, args.new_string);
            await writeFile(filePath, newContent, 'utf-8');
            return {
                success: true,
                data: { path: args.file_path, replaced: true }
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
};
export const deleteTool = {
    id: 'delete',
    description: 'Delete a file or directory within the workspace',
    parameters: {
        type: 'object',
        properties: {
            file_path: {
                type: 'string',
                description: 'Path to the file or directory to delete'
            },
            recursive: {
                type: 'boolean',
                description: 'Whether to allow deleting non-empty directories'
            }
        },
        required: ['file_path']
    },
    async execute(args, context) {
        try {
            const filePath = resolveWorkspacePath(context.workingDirectory, args.file_path);
            await rm(filePath, {
                force: false,
                recursive: Boolean(args.recursive),
            });
            return {
                success: true,
                data: {
                    path: args.file_path,
                    deleted: true,
                    recursive: Boolean(args.recursive),
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
};
export const globTool = {
    id: 'glob',
    description: 'Find files matching a glob pattern',
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.js")'
            },
            ignore: {
                type: 'array',
                items: { type: 'string' },
                description: 'Patterns to ignore'
            }
        },
        required: ['pattern']
    },
    async execute(args, context) {
        try {
            const files = await glob(args.pattern, {
                cwd: context.workingDirectory,
                ignore: args.ignore || ['node_modules/**', '.git/**', 'dist/**', 'build/**']
            });
            return {
                success: true,
                data: { files, count: files.length }
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
};
export const grepTool = {
    id: 'grep',
    description: 'Search for a pattern in files',
    parameters: {
        type: 'object',
        properties: {
            pattern: {
                type: 'string',
                description: 'Pattern to search for (regex supported)'
            },
            path: {
                type: 'string',
                description: 'Path to search in (file or directory)'
            },
            file_pattern: {
                type: 'string',
                description: 'File pattern to filter (e.g., "*.ts")'
            }
        },
        required: ['pattern']
    },
    async execute(args, context) {
        try {
            const searchPath = args.path ? resolveWorkspacePath(context.workingDirectory, args.path) : context.workingDirectory;
            const relativeSearchPath = relative(context.workingDirectory, searchPath) || '.';
            const rgArgs = ['-n', args.pattern, relativeSearchPath];
            if (args.file_pattern) {
                rgArgs.push('-g', args.file_pattern);
            }
            const parseMatches = (stdout) => {
                const matches = stdout.trim().split('\n').filter(Boolean);
                return {
                    success: true,
                    data: { matches, count: matches.length }
                };
            };
            try {
                const { stdout } = await execFileAsync('rg', rgArgs, {
                    cwd: context.workingDirectory,
                    maxBuffer: 10 * 1024 * 1024 // 10MB
                });
                return parseMatches(stdout);
            }
            catch (error) {
                if (error?.code === 'ENOENT') {
                    const grepArgs = ['-r', '-n'];
                    if (args.file_pattern) {
                        grepArgs.push(`--include=${args.file_pattern}`);
                    }
                    grepArgs.push(args.pattern, relativeSearchPath);
                    const { stdout } = await execFileAsync('grep', grepArgs, {
                        cwd: context.workingDirectory,
                        maxBuffer: 10 * 1024 * 1024
                    });
                    return parseMatches(stdout);
                }
                if (error?.code === 1) {
                    return {
                        success: true,
                        data: { matches: [], count: 0 }
                    };
                }
                throw error;
            }
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
};
//# sourceMappingURL=file-tools.js.map