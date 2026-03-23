import { exec } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(exec);
export const bashTool = {
    id: 'bash',
    description: 'Execute a bash command',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The bash command to execute'
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 30000)'
            }
        },
        required: ['command']
    },
    async execute(args, context) {
        try {
            const timeout = args.timeout || 30000;
            const { stdout, stderr } = await execAsync(args.command, {
                cwd: context.workingDirectory,
                timeout,
                maxBuffer: 10 * 1024 * 1024, // 10MB
                shell: '/bin/bash'
            });
            return {
                success: true,
                data: {
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    command: args.command
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                data: {
                    stdout: error.stdout?.trim() || '',
                    stderr: error.stderr?.trim() || '',
                    code: error.code,
                    command: args.command
                }
            };
        }
    }
};
//# sourceMappingURL=bash-tool.js.map